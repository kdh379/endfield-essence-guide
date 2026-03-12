import type { Option } from "@/shared/lib/data/schemas";

export type FarmTabKey = "weapon" | "option" | "zone";

export function tabLabel(tab: FarmTabKey) {
  if (tab === "weapon") return "무기 선택";
  if (tab === "option") return "옵션 티켓";
  return "구역 선택";
}

export function optionTone(category: Option["category"], active: boolean) {
  if (category === "base") {
    return active
      ? "border-sky-300/70 bg-sky-300/18 text-sky-100"
      : "border-sky-400/20 bg-sky-500/[0.06] text-sky-100/80 hover:border-sky-300/45 hover:bg-sky-400/10";
  }

  if (category === "sub") {
    return active
      ? "border-amber-300/70 bg-amber-300/18 text-amber-100"
      : "border-amber-400/20 bg-amber-500/[0.06] text-amber-100/80 hover:border-amber-300/45 hover:bg-amber-400/10";
  }

  return active
    ? "border-fuchsia-300/70 bg-fuchsia-300/18 text-fuchsia-100"
    : "border-fuchsia-400/20 bg-fuchsia-500/[0.06] text-fuchsia-100/80 hover:border-fuchsia-300/45 hover:bg-fuchsia-400/10";
}

export function zoneAccent(index: number) {
  const accents = [
    "from-[#4F8CFF]/26 via-[#101A34]/90 to-[#09111E]/96",
    "from-[#18C29C]/24 via-[#0B1C22]/92 to-[#081014]/96",
    "from-[#FF8F3D]/24 via-[#22160D]/92 to-[#130D08]/96",
    "from-[#FF5E7A]/24 via-[#211019]/92 to-[#120A0F]/96",
    "from-[#A47CFF]/24 via-[#181026]/92 to-[#0D0915]/96",
  ];

  return accents[index % accents.length];
}

export function weaponTone(rarity: number) {
  if (rarity >= 6) {
    return {
      card: "border-[#FF7100]/45 bg-[linear-gradient(160deg,rgba(73,28,10,0.92),rgba(24,11,7,0.9))] shadow-[0_10px_24px_rgba(255,113,0,0.14)]",
      frame: "border-[#FF7100]/60",
      glowAsset: "/images/weapons/weapon_rarity_6.png",
    };
  }

  return {
    card: "border-[#FFBB03]/40 bg-[linear-gradient(160deg,rgba(72,50,8,0.92),rgba(22,15,7,0.9))] shadow-[0_10px_24px_rgba(255,187,3,0.1)]",
    frame: "border-[#FFBB03]/55",
    glowAsset: "/images/weapons/weapon_rarity_5.png",
  };
}
