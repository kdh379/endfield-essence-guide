"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScreenCapturePanel } from "@/domain/scan/widgets/screen-capture-panel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { Separator } from "@/shared/ui/separator";
import {
  loadEnrichmentData,
  loadManifest,
  loadStaticData,
} from "@/shared/lib/data/loader";
import { db } from "@/shared/lib/db/dexie";
import type {
  Option,
  ScannedTrait,
  ScannedTraitLine,
  Weapon,
} from "@/shared/lib/data/schemas";
import { determineLockReason } from "@/domain/scan/features/matching/model/rules";
import { matchWeaponsByTrait } from "@/domain/scan/features/matching/model/scorer";
import {
  isReliableMatch,
  recognizeBestLine,
} from "@/domain/scan/features/ocr/model/recognize-best-line";
import { terminateWorker } from "@/domain/scan/features/ocr/model/tesseract";
import Image from "next/image";

const AUTO_OCR_MIN_INTERVAL_MS = 120;

interface LoadedData {
  options: Option[];
  weapons: Weapon[];
  triples: Array<{ weaponId: string; optionTriples: string[][] }>;
  dataVersion: string;
}

interface CapturePayload {
  traitCanvas: HTMLCanvasElement;
  lineCanvases: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  previewUrl: string;
  profile: string;
  signature: string;
  captureTs: number;
}

function blankLines(): [ScannedTraitLine, ScannedTraitLine, ScannedTraitLine] {
  return [1, 2, 3].map((lineNo) => ({
    lineNo: lineNo as 1 | 2 | 3,
    rawText: "",
    normalizedText: "",
    confidence: 0,
  })) as [ScannedTraitLine, ScannedTraitLine, ScannedTraitLine];
}

function matchTypeLabel(type: "exact3" | "partial2" | "category_fit") {
  if (type === "exact3") return "정확 일치(3옵션)";
  if (type === "partial2") return "부분 일치(2옵션)";
  return "카테고리 적합";
}

function getLineDisplayText(
  line: ScannedTraitLine,
  optionsById: Map<string, Option>,
) {
  if (line.optionId) {
    return optionsById.get(line.optionId)?.nameKo ?? line.rawText;
  }
  return line.rawText || line.normalizedText || "-";
}

export default function ScanPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [traitPreviewUrl, setTraitPreviewUrl] = useState<string | null>(null);
  const [lines, setLines] =
    useState<[ScannedTraitLine, ScannedTraitLine, ScannedTraitLine]>(
      blankLines(),
    );
  const [matches, setMatches] = useState<
    Array<{
      weaponId: string;
      matchType: "exact3" | "partial2" | "category_fit";
      score: number;
    }>
  >([]);
  const [lineNeedsRetry, setLineNeedsRetry] = useState<
    [boolean, boolean, boolean]
  >([false, false, false]);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [matchView, setMatchView] = useState<"atLeast3" | "atLeast2">(
    "atLeast2",
  );
  const [captureProfile, setCaptureProfile] = useState<string | null>(null);
  const [status, setStatus] = useState("데이터를 불러오는 중...");

  const autoOcrBusyRef = useRef(false);
  const autoOcrQueuedRef = useRef<CapturePayload | null>(null);
  const latestLineCanvasesRef = useRef<
    [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] | null
  >(null);
  const lastAutoOcrAtRef = useRef(0);
  const lastAutoSignatureRef = useRef<string | null>(null);
  const lastCommittedLinesRef =
    useRef<[ScannedTraitLine, ScannedTraitLine, ScannedTraitLine]>(
      blankLines(),
    );

  useEffect(() => {
    const run = async () => {
      try {
        const manifest = await loadManifest();
        const staticData = await loadStaticData(manifest.dataVersion);
        const enrichment = await loadEnrichmentData(manifest.dataVersion);
        setData({
          options: staticData.options,
          weapons: staticData.weapons,
          triples: enrichment.weaponTriples,
          dataVersion: manifest.dataVersion,
        });
        setStatus("게임 화면을 공유하면 자동 인식을 시작합니다.");
      } catch (error) {
        console.error(error);
        setLoadingError("정적 데이터 JSON 로드에 실패했습니다.");
      }
    };

    void run();
    return () => {
      void terminateWorker();
    };
  }, []);

  const weaponsById = useMemo(
    () => new Map((data?.weapons ?? []).map((weapon) => [weapon.id, weapon])),
    [data?.weapons],
  );
  const optionsById = useMemo(
    () => new Map((data?.options ?? []).map((option) => [option.id, option])),
    [data?.options],
  );
  const visibleMatches = useMemo(() => {
    if (matchView === "atLeast3") {
      return matches.filter((match) => match.matchType === "exact3");
    }
    return matches.filter(
      (match) => match.matchType === "exact3" || match.matchType === "partial2",
    );
  }, [matchView, matches]);
  const hasFailedLines = useMemo(
    () => lineNeedsRetry.some(Boolean),
    [lineNeedsRetry],
  );
  const lineProgress = useMemo(() => {
    const recognized = lines.filter((line) => Boolean(line.optionId)).length;
    return Math.round((recognized / 3) * 100);
  }, [lines]);
  const emptyMatchMessage = useMemo(() => {
    if (matches.length === 0) {
      return "OCR 매핑 이후 유효 무기 목록이 표시됩니다.";
    }
    return "현재 필터에서 표시할 무기가 없습니다.";
  }, [matches.length]);

  const runOcrOnLineCanvases = useCallback(
    async (
      targetLineCanvases: [
        HTMLCanvasElement,
        HTMLCanvasElement,
        HTMLCanvasElement,
      ],
      targetIndexes?: number[],
    ) => {
      if (!data) {
        setStatus("데이터가 아직 로드되지 않았습니다.");
        return;
      }

      latestLineCanvasesRef.current = targetLineCanvases;
      const targetSet = targetIndexes ? new Set(targetIndexes) : null;
      const nextLines = [
        ...lastCommittedLinesRef.current,
      ] as ScannedTraitLine[];
      const nextRetry = [...lineNeedsRetry] as [boolean, boolean, boolean];
      const failedIndexes: number[] = [];

      for (let i = 0; i < targetLineCanvases.length; i += 1) {
        if (targetSet && !targetSet.has(i)) continue;

        const best = await recognizeBestLine(
          targetLineCanvases[i],
          data.options,
        );
        const hasText =
          (best.normalizedText || best.rawText).trim().length >= 2;
        const reliable = hasText && isReliableMatch(best);

        if (!hasText) {
          nextLines[i] = {
            lineNo: (i + 1) as 1 | 2 | 3,
            rawText: "",
            normalizedText: "",
            confidence: 0,
          };
          nextRetry[i] = true;
          failedIndexes.push(i);
          continue;
        }

        nextLines[i] = {
          lineNo: (i + 1) as 1 | 2 | 3,
          rawText: best.rawText,
          normalizedText: best.normalizedText,
          optionId: reliable ? best.optionId : undefined,
          valueText: reliable ? best.valueText : undefined,
          valueNumeric: reliable ? best.valueNumeric : undefined,
          confidence: best.confidence,
        };
        nextRetry[i] = !reliable;
        if (!reliable) failedIndexes.push(i);
      }

      // Retry only failed lines once to reduce OCR cost while improving UX.
      for (const index of failedIndexes) {
        const retryBest = await recognizeBestLine(
          targetLineCanvases[index],
          data.options,
        );
        const hasText =
          (retryBest.normalizedText || retryBest.rawText).trim().length >= 2;
        const reliable = hasText && isReliableMatch(retryBest);
        if (!reliable) continue;

        nextLines[index] = {
          lineNo: (index + 1) as 1 | 2 | 3,
          rawText: retryBest.rawText,
          normalizedText: retryBest.normalizedText,
          optionId: retryBest.optionId,
          valueText: retryBest.valueText,
          valueNumeric: retryBest.valueNumeric,
          confidence: retryBest.confidence,
        };
        nextRetry[index] = false;
      }

      const typedLines = nextLines as [
        ScannedTraitLine,
        ScannedTraitLine,
        ScannedTraitLine,
      ];
      lastCommittedLinesRef.current = typedLines;
      setLines(typedLines);
      setLineNeedsRetry(nextRetry);

      const optionIds = typedLines
        .map((line) => line.optionId)
        .filter(Boolean) as string[];
      const matched = matchWeaponsByTrait(
        optionIds,
        data.weapons,
        data.triples,
      );
      setMatches(matched);
      if (nextRetry.some(Boolean)) {
        setStatus("일부 줄 인식 실패: 실패 줄만 재인식해 주세요.");
      } else {
        setStatus("자동 OCR이 완료되었습니다.");
      }
    },
    [data, lineNeedsRetry],
  );

  const drainAutoOcrQueue = useCallback(async () => {
    if (autoOcrBusyRef.current) return;

    const queued = autoOcrQueuedRef.current;
    if (!queued) return;

    const now = Date.now();
    const elapsed = now - lastAutoOcrAtRef.current;
    if (elapsed < AUTO_OCR_MIN_INTERVAL_MS) {
      const wait = AUTO_OCR_MIN_INTERVAL_MS - elapsed;
      window.setTimeout(() => {
        void drainAutoOcrQueue();
      }, wait);
      return;
    }

    if (queued.signature === lastAutoSignatureRef.current) {
      autoOcrQueuedRef.current = null;
      return;
    }

    autoOcrQueuedRef.current = null;
    autoOcrBusyRef.current = true;
    setIsOcrRunning(true);
    setStatus("옵션 3줄 OCR을 실행 중입니다...");

    try {
      await runOcrOnLineCanvases(queued.lineCanvases);
      lastAutoOcrAtRef.current = Date.now();
      lastAutoSignatureRef.current = queued.signature;
    } catch (error) {
      console.error(error);
      setStatus("자동 OCR에 실패했습니다.");
    } finally {
      autoOcrBusyRef.current = false;
      setIsOcrRunning(false);
      if (autoOcrQueuedRef.current) {
        window.setTimeout(() => {
          void drainAutoOcrQueue();
        }, 20);
      }
    }
  }, [runOcrOnLineCanvases]);

  const retryFailedLines = useCallback(async () => {
    if (!latestLineCanvasesRef.current || !data) return;
    const failed = lineNeedsRetry
      .map((value, index) => (value ? index : -1))
      .filter((index) => index >= 0);
    if (failed.length === 0) return;

    setIsOcrRunning(true);
    setStatus("실패 줄만 재인식 중입니다...");
    try {
      await runOcrOnLineCanvases(latestLineCanvasesRef.current, failed);
    } catch (error) {
      console.error(error);
      setStatus("실패 줄 재인식에 실패했습니다.");
    } finally {
      setIsOcrRunning(false);
    }
  }, [data, lineNeedsRetry, runOcrOnLineCanvases]);

  const saveScan = async () => {
    const record: ScannedTrait = {
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      imageHash: `${Date.now()}-${captureProfile ?? "16x9-auto"}`,
      lines,
      lock: (matches[0]?.matchType ?? "") === "exact3",
      lockReason:
        (matches[0]?.matchType ?? "") === "exact3"
          ? (determineLockReason(matches) ?? "manual")
          : undefined,
      matchedWeapons: matches,
    };

    await db.scannedTraits.put(record);
    if (record.lock && record.lockReason) {
      await db.locks.put({
        id: crypto.randomUUID(),
        scannedTraitId: record.id,
        createdAt: record.capturedAt,
        reason: record.lockReason,
      });
    }

    setStatus("스캔 기록을 저장했습니다.");
  };

  if (loadingError) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-sm text-red-600">
        {loadingError}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 pb-10 md:p-6">
      <section className="hud-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="hud-title">Live Scanner</p>
            <h1 className="text-2xl font-semibold">기질 식각 분석 콘솔</h1>
            <p className="text-sm text-muted-foreground">
              실시간 화면 공유로 옵션 3줄을 자동 인식하고 무기 매칭을
              추천합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
            >
              OCR Active
            </Badge>
            {data && (
              <Badge
                variant="outline"
                className="border-primary/40 text-primary"
              >
                Data v{data.dataVersion}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <ScreenCapturePanel
            onCaptureReady={(payload) => {
              const { previewUrl, profile } = payload;
              latestLineCanvasesRef.current = payload.lineCanvases;
              setTraitPreviewUrl(previewUrl);
              setCaptureProfile(profile);
              autoOcrQueuedRef.current = payload;
              void drainAutoOcrQueue();
              setStatus(`캡쳐 완료 (${profile}), 자동 OCR 대기 중`);
            }}
          />

          <Card className="hud-panel border-primary/20">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>인식된 옵션 3줄</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    hasFailedLines
                      ? "border-amber-400/60 text-amber-200"
                      : "border-emerald-400/60 text-emerald-200"
                  }
                >
                  {hasFailedLines ? "재인식 필요" : "인식 안정"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>인식 진행도</span>
                  <span>{lineProgress}%</span>
                </div>
                <Progress value={lineProgress} className="h-2 bg-muted/60" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="status-chip border-border/70 bg-muted/40 text-muted-foreground">
                {status}
              </p>
              {traitPreviewUrl && (
                <Image
                  src={traitPreviewUrl}
                  alt="고정 영역 미리보기"
                  className="w-fit max-h-44 rounded-md border border-primary/20 object-contain"
                  width={512}
                  height={512}
                />
              )}
              <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                {lines.map((line, index) => (
                  <div
                    key={line.lineNo}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30"
                  >
                    <p>
                      {line.lineNo}.{getLineDisplayText(line, optionsById)}
                    </p>
                    {lineNeedsRetry[index] && (
                      <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">
                        재인식
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void retryFailedLines()}
                  disabled={!data || isOcrRunning || !hasFailedLines}
                >
                  실패 줄 재인식
                </Button>
                <Button
                  variant="secondary"
                  onClick={saveScan}
                  disabled={!data || hasFailedLines}
                >
                  스캔 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="hud-panel h-full border-primary/20">
          <CardHeader>
            <CardTitle>유효 무기 매칭 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={matchView === "atLeast3" ? "default" : "outline"}
                onClick={() => setMatchView("atLeast3")}
              >
                3옵+
              </Button>
              <Button
                type="button"
                size="sm"
                variant={matchView === "atLeast2" ? "default" : "outline"}
                onClick={() => setMatchView("atLeast2")}
              >
                2옵+
              </Button>
            </div>
            {visibleMatches.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                {emptyMatchMessage}
              </p>
            )}
            {visibleMatches.map((match) => {
              const weapon = weaponsById.get(match.weaponId);
              return (
                <div
                  key={`${match.weaponId}-${match.matchType}`}
                  className="grid gap-3 rounded-lg border border-border/70 bg-background/45 p-3 md:grid-cols-[96px_1fr]"
                >
                  <div className="flex h-24 items-center justify-center rounded-md border border-primary/20 bg-muted/60">
                    {weapon?.iconUrl ? (
                      <Image
                        src={weapon.iconUrl}
                        alt={`${weapon.nameKo} 아이콘`}
                        className="h-full w-full rounded-md object-cover"
                        width={128}
                        height={128}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        이미지 없음
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {weapon?.nameKo ?? match.weaponId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      매칭: {matchTypeLabel(match.matchType)} / 점수{" "}
                      {match.score.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
