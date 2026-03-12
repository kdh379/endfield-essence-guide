"use client";

import { useMemo, useState } from "react";

import type { Option, StaticGameData } from "@/shared/lib/data/schemas";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

type TabKey = "weapon" | "option" | "zone";

interface FarmPageProps {
  initialData: StaticGameData;
}

function categoryLabel(category: Option["category"]) {
  if (category === "base") return "Base";
  if (category === "sub") return "Sub";
  return "Skill";
}

function buildZoneOptionSet(zone: StaticGameData["threatZones"][number]) {
  return new Set([
    ...(zone.essencePool?.base ?? []),
    ...(zone.essencePool?.sub ?? []),
    ...(zone.essencePool?.skill ?? []),
  ]);
}

export default function FarmPage({ initialData }: FarmPageProps) {
  const [tab, setTab] = useState<TabKey>("weapon");
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  const effectiveWeaponId =
    selectedWeaponId || initialData.weapons[0]?.id || "";
  const effectiveOptionId =
    selectedOptionId || initialData.options[0]?.id || "";
  const effectiveZoneId =
    selectedZoneId || initialData.threatZones[0]?.id || "";

  const zoneOptionSetByZone = useMemo(
    () =>
      new Map(
        initialData.threatZones.map((zone) => [
          zone.id,
          buildZoneOptionSet(zone),
        ]),
      ),
    [initialData.threatZones],
  );

  const essenceByWeapon = useMemo(
    () =>
      new Map(
        initialData.weapons.map((weapon) => [
          weapon.id,
          [weapon.essence.base, weapon.essence.sub, weapon.essence.skill],
        ]),
      ),
    [initialData.weapons],
  );

  const recommendedZonesForSelectedWeapon = useMemo(() => {
    if (!effectiveWeaponId) return [];
    const essence = essenceByWeapon.get(effectiveWeaponId) ?? [];
    if (essence.length === 0) return [];

    return initialData.threatZones
      .map((zone) => {
        const optionSet = zoneOptionSetByZone.get(zone.id) ?? new Set<string>();
        const bestMatchCount = essence.filter((optionId) =>
          optionSet.has(optionId),
        ).length;

        return {
          zone,
          bestMatchCount,
          score: bestMatchCount / 3,
        };
      })
      .filter((row) => row.bestMatchCount > 0)
      .sort(
        (a, b) =>
          b.bestMatchCount - a.bestMatchCount ||
          b.score - a.score ||
          a.zone.nameKo.localeCompare(b.zone.nameKo),
      );
  }, [
    effectiveWeaponId,
    essenceByWeapon,
    initialData.threatZones,
    zoneOptionSetByZone,
  ]);

  const recommendedZonesForSelectedOption = useMemo(() => {
    if (!effectiveOptionId) return [];

    return initialData.threatZones
      .map((zone) => {
        if (zone.essencePool?.base?.includes(effectiveOptionId)) {
          return { zone, category: "base" as const };
        }
        if (zone.essencePool?.sub?.includes(effectiveOptionId)) {
          return { zone, category: "sub" as const };
        }
        if (zone.essencePool?.skill?.includes(effectiveOptionId)) {
          return { zone, category: "skill" as const };
        }
        return null;
      })
      .filter(
        (
          row,
        ): row is {
          zone: StaticGameData["threatZones"][number];
          category: Option["category"];
        } => Boolean(row),
      )
      .sort((a, b) => a.zone.nameKo.localeCompare(b.zone.nameKo));
  }, [effectiveOptionId, initialData.threatZones]);

  const recommendedWeaponsForSelectedZone = useMemo(() => {
    if (!effectiveZoneId) return [];

    const optionSet =
      zoneOptionSetByZone.get(effectiveZoneId) ?? new Set<string>();

    return initialData.weapons
      .map((weapon) => {
        const essence = essenceByWeapon.get(weapon.id) ?? [];
        const bestMatchCount = essence.filter((optionId) =>
          optionSet.has(optionId),
        ).length;
        return { weapon, bestMatchCount, score: bestMatchCount / 3 };
      })
      .filter((row) => row.bestMatchCount > 0)
      .sort(
        (a, b) =>
          b.bestMatchCount - a.bestMatchCount ||
          b.score - a.score ||
          a.weapon.nameKo.localeCompare(b.weapon.nameKo),
      );
  }, [
    effectiveZoneId,
    essenceByWeapon,
    initialData.weapons,
    zoneOptionSetByZone,
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 pb-10 md:p-6">
      <section className="hud-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hud-title">Farm recommend</p>
            <h1 className="text-2xl font-semibold">에너지 응집점 구역 추천</h1>
            <p className="text-sm text-muted-foreground">
              옵션 중복도와 무기의 3옵션 매칭을 기준으로 우선순위를 정합니다.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Data v{initialData.dataVersion}
          </Badge>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            tab === "weapon"
              ? "border-primary/50 bg-primary/20 text-primary"
              : "border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => setTab("weapon")}
        >
          By Weapon
        </button>
        <button
          type="button"
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            tab === "option"
              ? "border-primary/50 bg-primary/20 text-primary"
              : "border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => setTab("option")}
        >
          By Option
        </button>
        <button
          type="button"
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            tab === "zone"
              ? "border-primary/50 bg-primary/20 text-primary"
              : "border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => setTab("zone")}
        >
          By Zone
        </button>
      </section>

      {tab === "weapon" && (
        <Card className="hud-panel border-primary/20">
          <CardHeader>
            <CardTitle>Recommended Zones by Weapon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={initialData.weapons.map((weapon) => ({
                label: weapon.nameKo,
                value: weapon.id,
              }))}
              value={effectiveWeaponId}
              onValueChange={(value) => setSelectedWeaponId(value ?? "")}
            >
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {initialData.weapons.map((weapon) => (
                  <SelectItem key={weapon.id} value={weapon.id}>
                    {weapon.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScrollArea className="h-[420px] rounded-lg border border-border/70 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">
                      Matched Options
                    </TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendedZonesForSelectedWeapon.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground"
                      >
                        No recommended zones for this weapon.
                      </TableCell>
                    </TableRow>
                  )}
                  {recommendedZonesForSelectedWeapon.map((row) => (
                    <TableRow key={row.zone.id}>
                      <TableCell>{row.zone.nameKo}</TableCell>
                      <TableCell className="text-right">
                        {row.bestMatchCount}/3
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {row.score.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {tab === "option" && (
        <Card className="hud-panel border-primary/20">
          <CardHeader>
            <CardTitle>Recommended Zones by Option</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={initialData.options.map((option) => ({
                label: option.nameKo,
                value: option.id,
              }))}
              value={effectiveOptionId}
              onValueChange={(value) => setSelectedOptionId(value ?? "")}
            >
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {initialData.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScrollArea className="h-[420px] rounded-lg border border-border/70 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendedZonesForSelectedOption.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-muted-foreground"
                      >
                        No recommended zones for this option.
                      </TableCell>
                    </TableRow>
                  )}
                  {recommendedZonesForSelectedOption.map((row) => (
                    <TableRow key={`${row.zone.id}-${row.category}`}>
                      <TableCell>{row.zone.nameKo}</TableCell>
                      <TableCell>{categoryLabel(row.category)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {tab === "zone" && (
        <Card className="hud-panel border-primary/20">
          <CardHeader>
            <CardTitle>Recommended Weapons by Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              items={initialData.threatZones.map((zone) => ({
                label: zone.nameKo,
                value: zone.id,
              }))}
              value={effectiveZoneId}
              onValueChange={(value) => setSelectedZoneId(value ?? "")}
            >
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {initialData.threatZones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.nameKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScrollArea className="h-[420px] rounded-lg border border-border/70 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Weapon</TableHead>
                    <TableHead className="text-right">
                      Matched Options
                    </TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendedWeaponsForSelectedZone.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground"
                      >
                        No recommended weapons for this zone.
                      </TableCell>
                    </TableRow>
                  )}
                  {recommendedWeaponsForSelectedZone.map((row) => (
                    <TableRow key={row.weapon.id}>
                      <TableCell>{row.weapon.nameKo}</TableCell>
                      <TableCell className="text-right">
                        {row.bestMatchCount}/3
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {row.score.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
