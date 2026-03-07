import type { Option, Weapon, WeaponMatch } from "@/shared/lib/data/schemas";

interface WeaponTripleEntry {
  weaponId: string;
  optionTriples: string[][];
}

export function matchWeaponsByTrait(
  lineOptionIds: string[],
  weapons: Weapon[],
  triples: WeaponTripleEntry[],
): WeaponMatch[] {
  const byWeapon = new Map(triples.map((entry) => [entry.weaponId, entry]));
  const matches: WeaponMatch[] = [];

  for (const weapon of weapons) {
    const entry = byWeapon.get(weapon.id);
    if (!entry) continue;
    const sortedInput = [...lineOptionIds].sort();

    let best: WeaponMatch | null = null;
    for (const triple of entry.optionTriples) {
      const sortedTriple = [...triple].sort();
      const intersection = sortedInput.filter((x) => sortedTriple.includes(x));
      if (intersection.length === 3) {
        best = { weaponId: weapon.id, matchType: "exact3", score: 1 };
        break;
      }
      if (intersection.length === 2 && (!best || best.score < 0.72)) {
        best = { weaponId: weapon.id, matchType: "partial2", score: 0.72 };
      }
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
