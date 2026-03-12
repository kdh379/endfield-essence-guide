import type {
  Option,
  StaticGameData,
  ThreatZone,
  Weapon,
} from "@/shared/lib/data/schemas";

export interface WeaponRecommendation {
  weapon: Weapon;
  bestMatchCount: number;
  score: number;
  matchedOptionIds: string[];
}

export interface ZoneValidWeaponSummary {
  zone: ThreatZone;
  weapons: Weapon[];
}

export interface FarmingPlan {
  zone: ThreatZone;
  baseOptionIds: string[];
  focusType: "sub" | "skill";
  focusOptionId: string;
  weapons: Weapon[];
}

export function partitionOptions(options: Option[]) {
  return {
    baseOptions: options.filter((option) => option.category === "base"),
    subOptions: options.filter((option) => option.category === "sub"),
    skillOptions: options.filter((option) => option.category === "skill"),
  };
}

export function buildZoneOptionSet(zone: ThreatZone) {
  const baseOptionIds = zone.essencePool?.base ?? [];
  const subOptionIds = zone.essencePool?.sub ?? [];
  const skillOptionIds = zone.essencePool?.skill ?? [];

  return new Set([...baseOptionIds, ...subOptionIds, ...skillOptionIds]);
}

function combinationsOfThree(values: string[], requiredValue: string) {
  const uniqueValues = Array.from(new Set(values));
  if (!uniqueValues.includes(requiredValue)) return [];

  const remainingValues = uniqueValues.filter(
    (value) => value !== requiredValue,
  );
  const combinations: string[][] = [];

  for (let leftIndex = 0; leftIndex < remainingValues.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < remainingValues.length;
      rightIndex += 1
    ) {
      combinations.push([
        requiredValue,
        remainingValues[leftIndex],
        remainingValues[rightIndex],
      ]);
    }
  }

  if (combinations.length === 0 && uniqueValues.length >= 3) {
    return [uniqueValues.slice(0, 3)];
  }

  return combinations;
}

function collectWeaponsWithFocusedSub(
  weapons: Weapon[],
  baseOptionIds: string[],
  subOptionId: string,
  zone: ThreatZone,
) {
  return weapons.filter((weapon) => {
    return (
      baseOptionIds.includes(weapon.essence.base) &&
      weapon.essence.sub === subOptionId &&
      (zone.essencePool?.skill ?? []).includes(weapon.essence.skill)
    );
  });
}

function collectWeaponsWithFocusedSkill(
  weapons: Weapon[],
  baseOptionIds: string[],
  skillOptionId: string,
  zone: ThreatZone,
) {
  return weapons.filter((weapon) => {
    return (
      baseOptionIds.includes(weapon.essence.base) &&
      weapon.essence.skill === skillOptionId &&
      (zone.essencePool?.sub ?? []).includes(weapon.essence.sub)
    );
  });
}

function compareFarmingPlans(left: FarmingPlan, right: FarmingPlan) {
  return (
    right.weapons.length - left.weapons.length ||
    left.zone.nameKo.localeCompare(right.zone.nameKo)
  );
}

export function getRecommendedFarmingPlans(
  data: StaticGameData,
  selectedWeapon: Weapon | undefined,
) {
  if (!selectedWeapon) return [];

  return data.threatZones
    .map((zone) => {
      const candidateBaseSets = combinationsOfThree(
        zone.essencePool?.base ?? [],
        selectedWeapon.essence.base,
      );
      if (candidateBaseSets.length === 0) return null;

      const candidatePlans: FarmingPlan[] = [];

      for (const baseOptionIds of candidateBaseSets) {
        if (
          (zone.essencePool?.sub ?? []).includes(selectedWeapon.essence.sub)
        ) {
          const matchedWeapons = collectWeaponsWithFocusedSub(
            data.weapons,
            baseOptionIds,
            selectedWeapon.essence.sub,
            zone,
          );

          if (matchedWeapons.length > 0) {
            candidatePlans.push({
              zone,
              baseOptionIds,
              focusType: "sub",
              focusOptionId: selectedWeapon.essence.sub,
              weapons: matchedWeapons,
            });
          }
        }

        if (
          (zone.essencePool?.skill ?? []).includes(selectedWeapon.essence.skill)
        ) {
          const matchedWeapons = collectWeaponsWithFocusedSkill(
            data.weapons,
            baseOptionIds,
            selectedWeapon.essence.skill,
            zone,
          );

          if (matchedWeapons.length > 0) {
            candidatePlans.push({
              zone,
              baseOptionIds,
              focusType: "skill",
              focusOptionId: selectedWeapon.essence.skill,
              weapons: matchedWeapons,
            });
          }
        }
      }

      return candidatePlans.sort(compareFarmingPlans)[0] ?? null;
    })
    .filter((plan): plan is FarmingPlan => Boolean(plan))
    .sort(compareFarmingPlans);
}

export function getRecommendedZonesForSelectedOption(
  threatZones: ThreatZone[],
  selectedTicketOptionIds: string[],
  zoneOptionSetByZone: Map<string, Set<string>>,
) {
  if (selectedTicketOptionIds.length === 0) return [];

  return threatZones
    .map((zone) => {
      const optionSet = zoneOptionSetByZone.get(zone.id) ?? new Set<string>();
      const matchedOptionIds = selectedTicketOptionIds.filter((optionId) =>
        optionSet.has(optionId),
      );

      return {
        zone,
        matchedOptionIds,
        bestMatchCount: matchedOptionIds.length,
        score: matchedOptionIds.length / selectedTicketOptionIds.length,
      };
    })
    .filter((zoneRecommendation) => zoneRecommendation.bestMatchCount > 0)
    .sort(
      (left, right) =>
        right.bestMatchCount - left.bestMatchCount ||
        right.score - left.score ||
        left.zone.nameKo.localeCompare(right.zone.nameKo),
    );
}

export function getRecommendedWeaponsForSelectedZone(
  weapons: Weapon[],
  selectedZone: ThreatZone | undefined,
  zoneOptionSetByZone: Map<string, Set<string>>,
) {
  if (!selectedZone) return [];

  const optionSet =
    zoneOptionSetByZone.get(selectedZone.id) ?? new Set<string>();

  return weapons
    .map((weapon) => {
      const essenceOptionIds = [
        weapon.essence.base,
        weapon.essence.sub,
        weapon.essence.skill,
      ];
      const matchedOptionIds = essenceOptionIds.filter((optionId) =>
        optionSet.has(optionId),
      );

      return {
        weapon,
        bestMatchCount: matchedOptionIds.length,
        score: matchedOptionIds.length / 3,
        matchedOptionIds,
      } satisfies WeaponRecommendation;
    })
    .filter((weaponRecommendation) => weaponRecommendation.bestMatchCount > 0)
    .sort(
      (left, right) =>
        right.bestMatchCount - left.bestMatchCount ||
        right.score - left.score ||
        left.weapon.nameKo.localeCompare(right.weapon.nameKo),
    );
}

export function getValidWeaponsByZone(
  threatZones: ThreatZone[],
  weapons: Weapon[],
) {
  return new Map(
    threatZones.map((zone) => {
      const validWeapons = weapons.filter((weapon) => {
        return (
          (zone.essencePool?.base ?? []).includes(weapon.essence.base) &&
          (zone.essencePool?.sub ?? []).includes(weapon.essence.sub) &&
          (zone.essencePool?.skill ?? []).includes(weapon.essence.skill)
        );
      });

      return [
        zone.id,
        { zone, weapons: validWeapons } satisfies ZoneValidWeaponSummary,
      ];
    }),
  );
}
