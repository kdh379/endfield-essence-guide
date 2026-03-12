import type { Option, Weapon, WeaponMatch } from "@/shared/lib/data/schemas";

export function matchWeaponsByTrait(
  lineOptionIds: string[],
  weapons: Weapon[],
): WeaponMatch[] {
  const matches: WeaponMatch[] = [];

  for (const weapon of weapons) {
    const sortedInput = [...lineOptionIds].sort();
    const essence = [
      weapon.essence.base,
      weapon.essence.sub,
      weapon.essence.skill,
    ];
    let best: WeaponMatch | null = null;

    const sortedEssence = [...essence].sort();
    const intersection = sortedInput.filter((x) => sortedEssence.includes(x));
    if (intersection.length === 3) {
      best = { weaponId: weapon.id, matchType: "exact3", score: 1 };
    } else if (intersection.length === 2) {
      best = { weaponId: weapon.id, matchType: "partial2", score: 0.72 };
    }

    if (best) matches.push(best);
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function inferCategoryFit(
  lineOptionIds: string[],
  optionDict: Map<string, Option>,
): number {
  const categories = lineOptionIds
    .map((id) => optionDict.get(id)?.category)
    .filter(Boolean);
  const unique = new Set(categories);
  if (!categories.length) return 0;
  if (unique.size === 3) return 0.7;
  if (unique.size === 2) return 0.55;
  return 0.4;
}
