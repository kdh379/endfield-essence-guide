import type {
  DataManifest,
  Option,
  ThreatZone,
  ThreatZoneOptionPool,
  VersionedItems,
  Weapon,
} from "@/shared/lib/data/schemas";
import {
  validateManifest,
  validateOptions,
  validateThreatZones,
  validateWeapons,
} from "@/shared/lib/data/validate";

const STATIC_PREFIX = "/data/static";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function loadManifest(): Promise<DataManifest> {
  const manifest = await fetchJson<DataManifest>(
    `${STATIC_PREFIX}/manifest.json`,
  );
  validateManifest(manifest);
  return manifest;
}

export async function loadStaticData(version: string) {
  const [options, weapons, threatZones, threatZonePool] = await Promise.all([
    fetchJson<VersionedItems<Option>>(
      `${STATIC_PREFIX}/v${version}/options.json`,
    ),
    fetchJson<VersionedItems<Weapon>>(
      `${STATIC_PREFIX}/v${version}/weapons.json`,
    ),
    fetchJson<VersionedItems<ThreatZone>>(
      `${STATIC_PREFIX}/v${version}/threat-zones.json`,
    ),
    fetchJson<VersionedItems<ThreatZoneOptionPool>>(
      `${STATIC_PREFIX}/v${version}/threat-zone-option-pool.json`,
    ),
  ]);

  validateOptions(options.items);
  validateWeapons(weapons.items);
  validateThreatZones(threatZones.items, threatZonePool.items, options.items);

  return {
    options: options.items,
    weapons: weapons.items,
    threatZones: threatZones.items,
    threatZonePool: threatZonePool.items,
  };
}
