"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { Weapon, WeaponMatch } from "@/shared/lib/data/schemas";
import { warningTone } from "@/domain/match/features/matching/model/rules";

interface WarningPanelProps {
  matches: WeaponMatch[];
  weaponsById: Map<string, Weapon>;
}

export function WarningPanel({ matches, weaponsById }: WarningPanelProps) {
  const tone = warningTone(matches);
  const best = matches[0];

  if (tone === "none") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>4) 매칭 경고</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            현재는 위험 매칭이 감지되지 않았습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={tone === "high" ? "border-red-500" : "border-amber-400"}>
      <CardHeader>
        <CardTitle>
          4) 매칭 경고: {tone === "high" ? "강한 경고" : "주의 필요"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className={tone === "high" ? "text-red-600" : "text-amber-600"}>
          {tone === "high"
            ? "3줄 유효 가능성이 높습니다. 재료 소모 전 잠금 권장."
            : "부분 일치가 감지되었습니다. 수동 확인 후 결정하세요."}
        </p>
        {best && (
          <p className="text-sm">
            최고 일치 무기:{" "}
            <strong>
              {weaponsById.get(best.weaponId)?.nameKo ?? best.weaponId}
            </strong>{" "}
            ({best.matchType}, score {best.score.toFixed(2)})
          </p>
        )}
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {matches.slice(0, 5).map((match) => (
            <li key={`${match.weaponId}-${match.matchType}`}>
              {weaponsById.get(match.weaponId)?.nameKo ?? match.weaponId} /{" "}
              {match.matchType} / {match.score.toFixed(2)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
