import type { FarmingPlan } from "@/domain/farm/features/recommendation/model/farm-recommendations";
import { MiniWeaponPill } from "@/domain/farm/widgets/mini-weapon-pill";
import { OptionBadgeList } from "@/domain/farm/widgets/option-badge-list";
import { optionTone, zoneAccent } from "@/domain/farm/widgets/farm-theme";
import { WeaponPortrait } from "@/domain/farm/widgets/weapon-portrait";
import { WeaponThumb } from "@/domain/farm/widgets/weapon-thumb";
import type { Option, Weapon } from "@/shared/lib/data/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ScrollArea } from "@/shared/ui/scroll-area";

interface WeaponTabContentProps {
  weapons: Weapon[];
  selectedWeapon: Weapon | undefined;
  optionsById: Map<string, Option>;
  recommendedFarmingPlans: FarmingPlan[];
  onSelectWeapon: (weaponId: string) => void;
}

export function WeaponTabContent({
  weapons,
  selectedWeapon,
  optionsById,
  recommendedFarmingPlans,
  onSelectWeapon,
}: WeaponTabContentProps) {
  const visibleFarmingPlans = selectedWeapon
    ? recommendedFarmingPlans.filter((plan) =>
        plan.weapons.some((weapon) => weapon.id === selectedWeapon.id),
      )
    : [];

  return (
    <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
      <Card className="overflow-hidden rounded-[24px] border-white/10 bg-[#0b1017]/92">
        <CardHeader className="border-b border-white/8 pb-3">
          <CardTitle className="text-xl text-white">무기 선택</CardTitle>
          <p className="text-sm text-white/52">
            아이콘을 눌러 무기를 고르면, 해당 무기의 속성 선택 추천과 함께 같이
            노릴 수 있는 무기까지 바로 확인할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-130 pr-2">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4">
              {weapons.map((weapon) => (
                <WeaponThumb
                  key={weapon.id}
                  weapon={weapon}
                  active={weapon.id === selectedWeapon?.id}
                  onClick={() => onSelectWeapon(weapon.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {selectedWeapon && (
          <Card className="rounded-[22px] border-white/10 bg-[#0b1017]/92">
            <CardContent className="p-0">
              <WeaponPortrait
                weapon={selectedWeapon}
                eyebrow="Selected Weapon"
              />
              <div className="px-4 pb-4">
                <OptionBadgeList
                  optionIds={[
                    selectedWeapon.essence.base,
                    selectedWeapon.essence.sub,
                    selectedWeapon.essence.skill,
                  ]}
                  optionsById={optionsById}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {visibleFarmingPlans.map((plan, index) => (
            <Card
              key={`${plan.zone.id}-${plan.focusType}`}
              className={`overflow-hidden py-4 rounded-2xl border border-white/10 bg-linear-to-br ${zoneAccent(index)}`}
            >
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                      속성 선택 추천
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {plan.zone.nameKo}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/48">유효 무기</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {plan.weapons.length}개
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs text-white/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-sky-100">
                      기초 속성
                    </span>
                    {plan.baseOptionIds.map((optionId) => {
                      const option = optionsById.get(optionId);
                      return option ? (
                        <span
                          key={optionId}
                          className="rounded-full border border-white/10 bg-black/16 px-2 py-0.5 text-white/80"
                        >
                          {option.nameKo}
                        </span>
                      ) : null;
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 ${optionTone(plan.focusType, true)}`}
                    >
                      {plan.focusType === "sub" ? "추가속성" : "스킬"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/16 px-2 py-0.5 text-white/80">
                      {optionsById.get(plan.focusOptionId)?.nameKo ??
                        plan.focusOptionId}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/42">
                    유호 무기 목록
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plan.weapons.map((weapon) => (
                      <MiniWeaponPill key={weapon.id} weapon={weapon} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
