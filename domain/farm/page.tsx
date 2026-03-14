"use client";

import { useState } from "react";

import {
  buildZoneOptionSet,
  getRecommendedFarmingPlans,
  getRecommendedWeaponsForSelectedZone,
  getRecommendedZonesForSelectedOption,
  getValidWeaponsByZone,
  partitionOptions,
} from "@/domain/farm/features/recommendation/model/farm-recommendations";
import { FarmHeader } from "@/domain/farm/widgets/farm-header";
import { FarmTabNav } from "@/domain/farm/widgets/farm-tab-nav";
import { type FarmTabKey } from "@/domain/farm/widgets/farm-theme";
import { OptionTabContent } from "@/domain/farm/widgets/option-tab-content";
import { WeaponTabContent } from "@/domain/farm/widgets/weapon-tab-content";
import { ZoneTabContent } from "@/domain/farm/widgets/zone-tab-content";
import type { StaticGameData } from "@/shared/lib/data/schemas";

interface FarmPageProps {
  initialData: StaticGameData;
}

export default function FarmPage({ initialData }: FarmPageProps) {
  const [tab, setTab] = useState<FarmTabKey>("weapon");
  const [selectedWeaponId, setSelectedWeaponId] = useState(
    initialData.weapons[0]?.id ?? "",
  );
  const [selectedBaseOptionIds, setSelectedBaseOptionIds] = useState<string[]>(
    [],
  );
  const [selectedSubOptionId, setSelectedSubOptionId] = useState("");
  const [selectedSkillOptionId, setSelectedSkillOptionId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState(
    initialData.threatZones[0]?.id ?? "",
  );

  const optionsById = new Map(
    initialData.options.map((option) => [option.id, option]),
  );
  const { baseOptions, subOptions, skillOptions } = partitionOptions(
    initialData.options,
  );
  const zoneOptionSetByZone = new Map(
    initialData.threatZones.map((zone) => [zone.id, buildZoneOptionSet(zone)]),
  );

  const selectedWeapon =
    initialData.weapons.find((weapon) => weapon.id === selectedWeaponId) ??
    initialData.weapons[0];
  const selectedZone =
    initialData.threatZones.find((zone) => zone.id === selectedZoneId) ??
    initialData.threatZones[0];
  const selectedTicketOptionIds = [
    ...selectedBaseOptionIds,
    selectedSubOptionId || null,
    selectedSkillOptionId || null,
  ].filter(Boolean) as string[];

  const recommendedFarmingPlans = getRecommendedFarmingPlans(
    initialData,
    selectedWeapon,
  );
  const recommendedZones = getRecommendedZonesForSelectedOption(
    initialData.threatZones,
    selectedTicketOptionIds,
    zoneOptionSetByZone,
  );
  const recommendedWeapons = getRecommendedWeaponsForSelectedZone(
    initialData.weapons,
    selectedZone,
    zoneOptionSetByZone,
  );
  const validWeaponsByZone = getValidWeaponsByZone(
    initialData.threatZones,
    initialData.weapons,
  );

  const toggleBaseOption = (optionId: string) => {
    setSelectedBaseOptionIds((current) => {
      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }
      if (current.length >= 3) {
        return [...current.slice(1), optionId];
      }
      return [...current, optionId];
    });
  };

  const toggleSingleOption = (
    optionId: string,
    selectedId: string,
    setter: (value: string) => void,
  ) => {
    setter(selectedId === optionId ? "" : optionId);
  };

  return (
    <main className="mx-auto min-h-screen max-w-375 space-y-4 px-4 pb-10 pt-4 md:px-5">
      <FarmHeader dataVersion={initialData.dataVersion} />
      <FarmTabNav tab={tab} onChange={setTab} />

      {tab === "weapon" && (
        <WeaponTabContent
          weapons={initialData.weapons}
          selectedWeapon={selectedWeapon}
          optionsById={optionsById}
          recommendedFarmingPlans={recommendedFarmingPlans}
          onSelectWeapon={setSelectedWeaponId}
        />
      )}

      {tab === "option" && (
        <OptionTabContent
          baseOptions={baseOptions}
          subOptions={subOptions}
          skillOptions={skillOptions}
          selectedBaseOptionIds={selectedBaseOptionIds}
          selectedSubOptionId={selectedSubOptionId}
          selectedSkillOptionId={selectedSkillOptionId}
          selectedTicketOptionIds={selectedTicketOptionIds}
          optionsById={optionsById}
          recommendedZones={recommendedZones}
          onToggleBaseOption={toggleBaseOption}
          onToggleSubOption={(optionId) =>
            toggleSingleOption(
              optionId,
              selectedSubOptionId,
              setSelectedSubOptionId,
            )
          }
          onToggleSkillOption={(optionId) =>
            toggleSingleOption(
              optionId,
              selectedSkillOptionId,
              setSelectedSkillOptionId,
            )
          }
        />
      )}

      {tab === "zone" && (
        <ZoneTabContent
          threatZones={initialData.threatZones}
          selectedZone={selectedZone}
          recommendedWeapons={recommendedWeapons}
          validWeaponsByZone={validWeaponsByZone}
          optionsById={optionsById}
          onSelectZone={setSelectedZoneId}
        />
      )}
    </main>
  );
}
