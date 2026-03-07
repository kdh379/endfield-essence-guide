"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { db } from "@/shared/lib/db/dexie";

export function HistoryList() {
  const scans = useLiveQuery(
    () => db.scannedTraits.orderBy("capturedAt").reverse().toArray(),
    [],
  );

  if (!scans) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>스캔 기록</CardTitle>
        </CardHeader>
        <CardContent>불러오는 중...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>스캔 기록 ({scans.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scans.length === 0 && (
          <p className="text-sm text-muted-foreground">
            저장된 스캔 기록이 없습니다.
          </p>
        )}
        {scans.map((scan) => (
          <div key={scan.id} className="rounded-md border p-3 text-sm">
            <p>
              <strong>{new Date(scan.capturedAt).toLocaleString()}</strong>
            </p>
            <p>잠금: {scan.lock ? "예" : "아니오"}</p>
            <p>매칭 수: {scan.matchedWeapons.length}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {scan.lines.map((line) => (
                <li key={`${scan.id}-${line.lineNo}`}>
                  {line.lineNo}. {line.rawText} ({line.optionId ?? "미매핑"})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

