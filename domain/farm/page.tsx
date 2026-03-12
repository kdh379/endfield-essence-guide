"use client";

import { useEffect, useMemo, useState } from "react";

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
import { loadManifest, loadStaticData } from "@/shared/lib/data/loader";
import type {
  Option,
  ThreatZone,
  ThreatZoneOptionPool,
  Weapon,
} from "@/shared/lib/data/schemas";

type TabKey = "weapon" | "option" | "zone";

interface LoadedData {
  options: Option[];
  weapons: Weapon[];
  threatZones: ThreatZone[];
  threatZonePool: ThreatZoneOptionPool[];
  dataVersion: string;
}

function categoryLabel(category: Option["category"]) {
  if (category === "base") return "Base";
  if (category === "sub") return "Sub";
  return "Skill";
}

export default function FarmPage() {
  const [tab, setTab] = useState<TabKey>("weapon");
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const manifest = await loadManifest();
        const staticData = await loadStaticData(manifest.dataVersion);
        setData({
          options: staticData.options,
          weapons: staticData.weapons,
          threatZones: staticData.threatZones,
          threatZonePool: staticData.threatZonePool,
          dataVersion: manifest.dataVersion,
        });
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load farming recommendation data.");
      }
    };
    void run();
  }, []);

  const effectiveWeaponId = selectedWeaponId || data?.weapons[0]?.id || "";
  const effectiveOptionId = selectedOptionId || data?.options[0]?.id || "";
  const effectiveZoneId = selectedZoneId || data?.threatZones[0]?.id || "";

  const zoneById = useMemo(
    () => new Map((data?.threatZones ?? []).map((zone) => [zone.id, zone])),
    [data?.threatZones],
  );

  const zoneOptionSetByZone = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of data?.threatZonePool ?? []) {
      if (!map.has(row.zoneId)) map.set(row.zoneId, new Set());
      map.get(row.zoneId)?.add(row.optionId);
    }
    return map;
  }, [data?.threatZonePool]);

  const tripleByWeapon = useMemo(
    () =>
      new Map(
        (data?.weapons ?? []).map((weapon) => [
          weapon.id,
          weapon.weaponBuildMeta?.validTripleOptionSets ?? [],
        ]),
      ),
    [data?.weapons],
  );

  const recommendedZonesForSelectedWeapon = useMemo(() => {
    if (!data || !effectiveWeaponId) return [];
    const triples = tripleByWeapon.get(effectiveWeaponId) ?? [];
    if (triples.length === 0) return [];

    return data.threatZones
      .map((zone) => {
        const optionSet = zoneOptionSetByZone.get(zone.id) ?? new Set<string>();
        let bestMatchCount = 0;
        for (const triple of triples) {
          const count = triple.filter((optionId) =>
            optionSet.has(optionId),
          ).length;
          if (count > bestMatchCount) bestMatchCount = count;
        }
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
  }, [data, effectiveWeaponId, tripleByWeapon, zoneOptionSetByZone]);

  const recommendedZonesForSelectedOption = useMemo(() => {
    if (!data || !effectiveOptionId) return [];
    return data.threatZonePool
      .filter((row) => row.optionId === effectiveOptionId)
      .map((row) => ({
        zone: zoneById.get(row.zoneId),
        weight: row.weight ?? 0,
        category: row.category,
        sourceConfidence: row.sourceConfidence,
      }))
      .filter((row) => Boolean(row.zone))
      .sort((a, b) => b.weight - a.weight);
  }, [data, effectiveOptionId, zoneById]);

  const recommendedWeaponsForSelectedZone = useMemo(() => {
    if (!data || !effectiveZoneId) return [];
    const optionSet =
      zoneOptionSetByZone.get(effectiveZoneId) ?? new Set<string>();
    return data.weapons
      .map((weapon) => {
        const triples = tripleByWeapon.get(weapon.id) ?? [];
        let bestMatchCount = 0;
        for (const triple of triples) {
          const count = triple.filter((optionId) =>
            optionSet.has(optionId),
          ).length;
          if (count > bestMatchCount) bestMatchCount = count;
        }
        return { weapon, bestMatchCount, score: bestMatchCount / 3 };
      })
      .filter((row) => row.bestMatchCount > 0)
      .sort(
        (a, b) =>
          b.bestMatchCount - a.bestMatchCount ||
          b.score - a.score ||
          a.weapon.nameKo.localeCompare(b.weapon.nameKo),
      );
  }, [data, effectiveZoneId, tripleByWeapon, zoneOptionSetByZone]);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-red-600">
        {error}
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">
        Loading farming recommendation data...
      </main>
    );
  }

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
            Data v{data.dataVersion}
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
              items={data.weapons.map((weapon) => ({
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
                {data.weapons.map((weapon) => (
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
              items={data.options.map((option) => ({
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
                {data.options.map((option) => (
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
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendedZonesForSelectedOption.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No recommended zones for this option.
                      </TableCell>
                    </TableRow>
                  )}
                  {recommendedZonesForSelectedOption.map((row) => (
                    <TableRow key={`${row.zone?.id}-${row.category}`}>
                      <TableCell>{row.zone?.nameKo}</TableCell>
                      <TableCell>{categoryLabel(row.category)}</TableCell>
                      <TableCell className="text-right text-primary">
                        {row.weight.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.sourceConfidence}
                      </TableCell>
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
              items={data.threatZones.map((zone) => ({
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
                {data.threatZones.map((zone) => (
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
