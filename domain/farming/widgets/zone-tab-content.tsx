import Image from "next/image";

import type {
  WeaponRecommendation,
  ZoneValidWeaponSummary,
} from "@/domain/farming/features/recommendation/model/farm-recommendations";
import { MiniWeaponPill } from "@/domain/farming/widgets/mini-weapon-pill";
import { OptionBadgeList } from "@/domain/farming/widgets/option-badge-list";
import { weaponTone, zoneAccent } from "@/domain/farming/widgets/farm-theme";
import type { Option, ThreatZone } from "@/shared/lib/data/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";

interface ZoneTabContentProps {
  threatZones: ThreatZone[];
  selectedZone: ThreatZone | undefined;
  recommendedWeapons: WeaponRecommendation[];
  validWeaponsByZone: Map<string, ZoneValidWeaponSummary>;
  optionsById: Map<string, Option>;
  onSelectZone: (zoneId: string) => void;
}

export function ZoneTabContent({
  threatZones,
  selectedZone,
  recommendedWeapons,
  validWeaponsByZone,
  optionsById,
  onSelectZone,
}: ZoneTabContentProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="rounded-[24px] border-white/10 bg-[#0b1017]/92">
        <CardHeader className="border-b border-white/8 pb-3">
          <CardTitle className="text-xl text-white">위험구역 선택</CardTitle>
          <p className="text-sm text-white/52">
            목표 구역을 고르면, 해당 구역과 잘 맞는 무기를 아이콘과 등급
            중심으로 정렬해 보여줍니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {threatZones.map((zone, index) => {
            const summary = validWeaponsByZone.get(zone.id);
            const previewWeapons = summary?.weapons.slice(0, 3) ?? [];
            const extraCount = Math.max(
              0,
              (summary?.weapons.length ?? 0) - previewWeapons.length,
            );

            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onSelectZone(zone.id)}
                className={cn(
                  "rounded-3xl border px-3 py-2.5 text-left transition-all",
                  zone.id === selectedZone?.id
                    ? [
                        "bg-linear-to-br border-white/20 shadow-[0_12px_24px_rgba(0,0,0,0.24)]",
                        zoneAccent(index),
                      ]
                    : "border-white/10 bg-white/40 hover:border-white/20 hover:bg-white/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {zone.nameKo}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      Base {(zone.essencePool?.base ?? []).length} · Sub{" "}
                      {(zone.essencePool?.sub ?? []).length} · Skill{" "}
                      {(zone.essencePool?.skill ?? []).length}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/16 px-2 py-1 text-[11px] font-semibold text-white/78">
                    유효 {summary?.weapons.length ?? 0}
                  </div>
                </div>

                {previewWeapons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {previewWeapons.map((weapon) => (
                      <MiniWeaponPill key={weapon.id} weapon={weapon} />
                    ))}
                    {extraCount > 0 && (
                      <div className="rounded-full border border-dashed border-white/14 px-2 py-1 text-[11px] text-white/60">
                        +{extraCount}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {recommendedWeapons.map((row) => {
          const tone = weaponTone(row.weapon.rarity);

          return (
            <Card
              key={row.weapon.id}
              className={cn("overflow-hidden rounded-4xl border", tone.card)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "relative h-16 w-16 overflow-hidden rounded-3xl border bg-black/15",
                      tone.frame,
                    )}
                  >
                    {row.weapon.iconUrl ? (
                      <Image
                        src={row.weapon.iconUrl}
                        alt={row.weapon.nameKo}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                    <Image
                      src={tone.glowAsset}
                      alt=""
                      aria-hidden
                      width={96}
                      height={24}
                      className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-4 w-14 -translate-x-1/2 object-contain opacity-95"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[15px] font-semibold text-white">
                      {row.weapon.nameKo}
                    </h3>
                    <p className="mt-1 text-xs text-white/60">
                      {row.bestMatchCount}/3 옵션 매칭 · 점수{" "}
                      {row.score.toFixed(2)}
                    </p>
                  </div>
                </div>
                <OptionBadgeList
                  optionIds={row.matchedOptionIds}
                  optionsById={optionsById}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
