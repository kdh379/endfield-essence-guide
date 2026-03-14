import Image from "next/image";

import type { Weapon } from "@/shared/lib/data/schemas";

import { weaponTone } from "@/domain/farming/widgets/farm-theme";

interface WeaponPortraitProps {
  weapon: Weapon;
  eyebrow: string;
}

export function WeaponPortrait({ weapon, eyebrow }: WeaponPortraitProps) {
  const tone = weaponTone(weapon.rarity);

  return (
    <div className="flex items-center gap-3 p-4">
      <div
        className={`relative h-16 w-16 overflow-hidden rounded-3xl border ${tone.frame}`}
      >
        {weapon.iconUrl ? (
          <Image
            src={weapon.iconUrl}
            alt={weapon.nameKo}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : null}
        <Image
          src={tone.glowAsset}
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-4 w-14 -translate-x-1/2 object-contain opacity-95"
          width={96}
          height={24}
        />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-white/40">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {weapon.nameKo}
        </h2>
      </div>
    </div>
  );
}
