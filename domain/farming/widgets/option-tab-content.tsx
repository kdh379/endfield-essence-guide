import { OptionBadgeList } from "@/domain/farming/widgets/option-badge-list";
import { optionTone, zoneAccent } from "@/domain/farming/widgets/farm-theme";
import type { Option, ThreatZone } from "@/shared/lib/data/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface OptionZoneRecommendation {
  zone: ThreatZone;
  matchedOptionIds: string[];
  bestMatchCount: number;
  score: number;
}

interface OptionTabContentProps {
  baseOptions: Option[];
  subOptions: Option[];
  skillOptions: Option[];
  selectedBaseOptionIds: string[];
  selectedSubOptionId: string;
  selectedSkillOptionId: string;
  selectedTicketOptionIds: string[];
  optionsById: Map<string, Option>;
  recommendedZones: OptionZoneRecommendation[];
  onToggleBaseOption: (optionId: string) => void;
  onToggleSubOption: (optionId: string) => void;
  onToggleSkillOption: (optionId: string) => void;
}

export function OptionTabContent({
  baseOptions,
  subOptions,
  skillOptions,
  selectedBaseOptionIds,
  selectedSubOptionId,
  selectedSkillOptionId,
  selectedTicketOptionIds,
  optionsById,
  recommendedZones,
  onToggleBaseOption,
  onToggleSubOption,
  onToggleSkillOption,
}: OptionTabContentProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
      <Card className="rounded-[24px] border-white/10 bg-[#0b1017]/92">
        <CardHeader className="border-b border-white/8 pb-3">
          <CardTitle className="text-xl text-white">옵션 확률업 티켓</CardTitle>
          <p className="text-sm text-white/52">
            Base는 최대 3개, Sub와 Skill은 각각 1개씩 선택할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">기초 옵션</h3>
              <span className="text-xs text-white/45">
                {selectedBaseOptionIds.length}/3 선택
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              {baseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onToggleBaseOption(option.id)}
                  className={`rounded-[16px] border px-3 py-2.5 text-left text-[13px] font-medium transition-all ${optionTone(
                    option.category,
                    selectedBaseOptionIds.includes(option.id),
                  )}`}
                >
                  {option.nameKo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">추가 속성</h3>
              <span className="text-xs text-white/45">1개 선택</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              {subOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onToggleSubOption(option.id)}
                  className={`rounded-[16px] border px-3 py-2.5 text-left text-[13px] font-medium transition-all ${optionTone(
                    option.category,
                    selectedSubOptionId === option.id,
                  )}`}
                >
                  {option.nameKo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">스킬 속성</h3>
              <span className="text-xs text-white/45">1개 선택</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              {skillOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onToggleSkillOption(option.id)}
                  className={`rounded-[16px] border px-3 py-2.5 text-left text-[13px] font-medium transition-all ${optionTone(
                    option.category,
                    selectedSkillOptionId === option.id,
                  )}`}
                >
                  {option.nameKo}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="rounded-[22px] border-white/10 bg-[#0b1017]/92">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">
              Ticket Summary
            </p>
            {selectedTicketOptionIds.length > 0 ? (
              <OptionBadgeList
                optionIds={selectedTicketOptionIds}
                optionsById={optionsById}
              />
            ) : (
              <p className="mt-3 text-sm text-white/48">
                아직 선택한 티켓 옵션이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {recommendedZones.map((row, index) => (
            <Card
              key={row.zone.id}
              className={`overflow-hidden rounded-[20px] border border-white/10 bg-linear-to-br ${zoneAccent(index)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                      티켓 추천
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {row.zone.nameKo}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/48">커버율</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {Math.round(row.score * 100)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/62">
                  선택 옵션 {row.bestMatchCount}개 매칭
                </div>
                <OptionBadgeList
                  optionIds={row.matchedOptionIds}
                  optionsById={optionsById}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
