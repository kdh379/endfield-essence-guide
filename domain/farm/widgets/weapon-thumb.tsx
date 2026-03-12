import Image from "next/image";

import type { Weapon } from "@/shared/lib/data/schemas";

import { weaponTone } from "@/domain/farm/widgets/farm-theme";

interface WeaponThumbProps {
  weapon: Weapon;
  active: boolean;
  onClick: () => void;
}

export function WeaponThumb({ weapon, active, onClick }: WeaponThumbProps) {
  const tone = weaponTone(weapon.rarity);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[18px] border p-2.5 text-left transition-all duration-200 ${
        active
          ? `${tone.card} -translate-y-0.5 ring-1 ring-white/12`
          : "border-white/10 bg-[linear-gradient(160deg,rgba(17,23,32,0.94),rgba(9,13,20,0.94))] hover:-translate-y-0.5 hover:border-white/20 hover:bg-[linear-gradient(160deg,rgba(24,31,42,0.94),rgba(11,16,24,0.94))]"
      }`}
    >
      <div className="relative flex items-center gap-2.5">
        <div
          className={`relative h-14 w-14 overflow-hidden rounded-3xl border bg-black/20 ${
            active ? tone.frame : "border-white/10"
          }`}
        >
          {weapon.iconUrl ? (
            <Image
              src={weapon.iconUrl}
              alt={weapon.nameKo}
              fill
              sizes="64px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
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
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-white">
            {weapon.nameKo}
          </p>
        </div>
      </div>
    </button>
  );
}
