import type { ScannedTrait, WeaponMatch } from "@/shared/lib/data/schemas";

export function determineLockReason(
  matches: WeaponMatch[],
): ScannedTrait["lockReason"] | undefined {
  const best = matches[0];
  if (!best) return undefined;
  if (best.matchType === "exact3") return "triple_valid";
  if (best.matchType === "partial2") return "partial_match";
  return undefined;
}

export function warningTone(
  matches: WeaponMatch[],
): "high" | "medium" | "none" {
  const best = matches[0];
  if (!best) return "none";
  if (best.matchType === "exact3") return "high";
  if (best.matchType === "partial2") return "medium";
  return "none";
}
