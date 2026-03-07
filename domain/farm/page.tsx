"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { loadEnrichmentData, loadManifest, loadStaticData } from "@/shared/lib/data/loader";
import type { Option, ThreatZone, ThreatZoneOptionPool, Weapon } from "@/shared/lib/data/schemas";

type TabKey = "weapon" | "option" | "zone";

interface LoadedData {
  options: Option[];
  weapons: Weapon[];
  threatZones: ThreatZone[];
  threatZonePool: ThreatZoneOptionPool[];
  triples: Array<{ weaponId: string; optionTriples: string[][] }>;
  dataVersion: string;
}

function categoryLabel(category: Option["category"]) {
  if (category === "base") return "기본";
  if (category === "sub") return "보조";
  return "스킬";
}

export default function FarmPage() {
  const [tab, setTab] = useState<TabKey>("weapon");
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const manifest = await loadManifest();
        const staticData = await loadStaticData(manifest.dataVersion);
        const enrichment = await loadEnrichmentData(manifest.dataVersion);
        setData({
          options: staticData.options,
          weapons: staticData.weapons,
          threatZones: staticData.threatZones,
          threatZonePool: staticData.threatZonePool,
          triples: enrichment.weaponTriples,
          dataVersion: manifest.dataVersion,
        });
      } catch (loadError) {
        console.error(loadError);
        setError("추천 파밍 데이터를 불러오지 못했습니다.");
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!selectedWeaponId && data.weapons[0]) setSelectedWeaponId(data.weapons[0].id);
    if (!selectedOptionId && data.options[0]) setSelectedOptionId(data.options[0].id);
    if (!selectedZoneId && data.threatZones[0]) setSelectedZoneId(data.threatZones[0].id);
  }, [data, selectedOptionId, selectedWeaponId, selectedZoneId]);

  const zoneById = useMemo(
    () => new Map((data?.threatZones ?? []).map((zone) => [zone.id, zone])),
    [data?.threatZones],
  );

  const zoneOptionSetByZone = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of data?.threatZonePool ?? []) {
      if (!map.has(row.zoneId)) map.set(row.zoneId, new Set());
      map.get(row.zoneId)?.add(row.optionId);
    }
    return map;
  }, [data?.threatZonePool]);

  const tripleByWeapon = useMemo(
    () => new Map((data?.triples ?? []).map((triple) => [triple.weaponId, triple.optionTriples])),
    [data?.triples],
  );

  const recommendedZonesForSelectedWeapon = useMemo(() => {
    if (!data || !selectedWeaponId) return [];
    const triples = tripleByWeapon.get(selectedWeaponId) ?? [];
    if (triples.length === 0) return [];

    const rows = data.threatZones
      .map((zone) => {
        const optionSet = zoneOptionSetByZone.get(zone.id) ?? new Set<string>();
        let bestMatchCount = 0;
        for (const triple of triples) {
          const count = triple.filter((optionId) => optionSet.has(optionId)).length;
          if (count > bestMatchCount) bestMatchCount = count;
        }
        return {
          zone,
          bestMatchCount,
          score: bestMatchCount / 3,
        };
      })
      .filter((row) => row.bestMatchCount > 0)
      .sort(
        (a, b) => b.bestMatchCount - a.bestMatchCount || b.score - a.score || a.zone.nameKo.localeCompare(b.zone.nameKo),
      );

    return rows;
  }, [data, selectedWeaponId, tripleByWeapon, zoneOptionSetByZone]);

  const recommendedZonesForSelectedOption = useMemo(() => {
    if (!data || !selectedOptionId) return [];
    return data.threatZonePool
      .filter((row) => row.optionId === selectedOptionId)
      .map((row) => ({
        zone: zoneById.get(row.zoneId),
        weight: row.weight ?? 0,
        category: row.category,
        sourceConfidence: row.sourceConfidence,
      }))
      .filter((row) => Boolean(row.zone))
      .sort((a, b) => b.weight - a.weight);
  }, [data, selectedOptionId, zoneById]);

  const recommendedWeaponsForSelectedZone = useMemo(() => {
    if (!data || !selectedZoneId) return [];
    const optionSet = zoneOptionSetByZone.get(selectedZoneId) ?? new Set<string>();
    return data.weapons
      .map((weapon) => {
        const triples = tripleByWeapon.get(weapon.id) ?? [];
        let bestMatchCount = 0;
        for (const triple of triples) {
          const count = triple.filter((optionId) => optionSet.has(optionId)).length;
          if (count > bestMatchCount) bestMatchCount = count;
        }
        return { weapon, bestMatchCount, score: bestMatchCount / 3 };
      })
      .filter((row) => row.bestMatchCount > 0)
      .sort(
        (a, b) =>
          b.bestMatchCount - a.bestMatchCount ||
          b.score - a.score ||
          a.weapon.nameKo.localeCompare(b.weapon.nameKo),
      );
  }, [data, selectedZoneId, tripleByWeapon, zoneOptionSetByZone]);

  if (error) {
    return <main className="mx-auto max-w-6xl p-6 text-sm text-red-600">{error}</main>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">
        추천 파밍 데이터를 불러오는 중...
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 md:p-6">
      <section className="rounded-xl border bg-card p-4">
        <h1 className="text-xl font-semibold">추천 파밍 위치</h1>
        <p className="text-sm text-muted-foreground">
          위협지 드랍 옵션을 기준으로 무기/옵션 추천 정보를 제공합니다. (데이터 v
          {data.dataVersion})
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm ${
            tab === "weapon"
              ? "bg-primary text-primary-foreground"
              : "border bg-background hover:bg-muted"
          }`}
          onClick={() => setTab("weapon")}
        >
          무기별 추천 위협지
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm ${
            tab === "option"
              ? "bg-primary text-primary-foreground"
              : "border bg-background hover:bg-muted"
          }`}
          onClick={() => setTab("option")}
        >
          옵션별 추천 위협지
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm ${
            tab === "zone"
              ? "bg-primary text-primary-foreground"
              : "border bg-background hover:bg-muted"
          }`}
          onClick={() => setTab("zone")}
        >
          위협지별 드랍 무기
        </button>
      </section>

      {tab === "weapon" && (
        <Card>
          <CardHeader>
            <CardTitle>무기별 추천 위협지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={data.weapons.map((weapon) => ({
                label: weapon.nameKo,
                value: weapon.id,
              }))}
              value={selectedWeaponId}
              onValueChange={(value) => setSelectedWeaponId(value ?? "")}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.weapons.map((weapon) => (
                  <SelectItem key={weapon.id} value={weapon.id}>
                    {weapon.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-3">
              {recommendedZonesForSelectedWeapon.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  선택한 무기에 대한 추천 위협지가 없습니다.
                </p>
              )}
              {recommendedZonesForSelectedWeapon.map((row) => (
                <div key={row.zone.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{row.zone.nameKo}</p>
                  <p className="text-muted-foreground">
                    일치 옵션 수: {row.bestMatchCount}/3, 추천 점수:{" "}
                    {row.score.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "option" && (
        <Card>
          <CardHeader>
            <CardTitle>옵션별 추천 위협지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={data.options.map((option) => ({
                label: option.nameKo,
                value: option.id,
              }))}
              value={selectedOptionId}
              onValueChange={(value) => setSelectedOptionId(value ?? "")}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-3">
              {recommendedZonesForSelectedOption.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  선택한 옵션의 추천 위협지가 없습니다.
                </p>
              )}
              {recommendedZonesForSelectedOption.map((row) => (
                <div
                  key={`${row.zone?.id}-${row.category}`}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">{row.zone?.nameKo}</p>
                  <p className="text-muted-foreground">
                    카테고리: {categoryLabel(row.category)}, 가중치:{" "}
                    {row.weight.toFixed(2)}, 신뢰도: {row.sourceConfidence}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "zone" && (
        <Card>
          <CardHeader>
            <CardTitle>위협지별 드랍 무기</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={data.threatZones.map((zone) => ({
                label: zone.nameKo,
                value: zone.id,
              }))}
              value={selectedZoneId}
              onValueChange={(value) => setSelectedZoneId(value ?? "")}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.threatZones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-3">
              {recommendedWeaponsForSelectedZone.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  선택한 위협지에서 추천할 무기가 없습니다.
                </p>
              )}
              {recommendedWeaponsForSelectedZone.map((row) => (
                <div key={row.weapon.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{row.weapon.nameKo}</p>
                  <p className="text-muted-foreground">
                    일치 옵션 수: {row.bestMatchCount}/3, 추천 점수:{" "}
                    {row.score.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

