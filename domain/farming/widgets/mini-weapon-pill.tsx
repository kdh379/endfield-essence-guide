import Image from "next/image";

import type { Weapon } from "@/shared/lib/data/schemas";

import { weaponTone } from "@/domain/farming/widgets/farm-theme";

interface MiniWeaponPillProps {
  weapon: Weapon;
}

export function MiniWeaponPill({ weapon }: MiniWeaponPillProps) {
  const tone = weaponTone(weapon.rarity);

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/16 px-2 py-1">
      <div
        className={`relative h-7 w-7 overflow-hidden rounded-full border bg-black/20 ${tone.frame}`}
      >
        {weapon.iconUrl ? (
          <Image
            src={weapon.iconUrl}
            alt={weapon.nameKo}
            fill
            sizes="28px"
            className="object-cover"
          />
        ) : null}
        <Image
          src={tone.glowAsset}
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-2.5 w-8 -translate-x-1/2 object-contain opacity-95"
          width={56}
          height={16}
        />
      </div>
      <span className="line-clamp-1 text-[11px] font-medium text-white/88">
        {weapon.nameKo}
      </span>
    </div>
  );
}
