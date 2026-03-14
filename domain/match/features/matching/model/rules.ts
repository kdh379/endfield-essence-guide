import type { WeaponMatch } from "@/shared/lib/data/schemas";

export function warningTone(
  matches: WeaponMatch[],
): "high" | "medium" | "none" {
  const best = matches[0];
  if (!best) return "none";
  if (best.matchType === "exact3") return "high";
  if (best.matchType === "partial2") return "medium";
  return "none";
}
