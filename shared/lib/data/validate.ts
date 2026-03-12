import type {
  DataManifest,
  Option,
  ThreatZone,
  ThreatZoneOptionPool,
  Weapon,
} from "@/shared/lib/data/schemas";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Data validation failed: ${message}`);
}

export function validateManifest(manifest: DataManifest) {
  assert(Boolean(manifest.dataVersion), "manifest.dataVersion missing");
  assert(Boolean(manifest.minAppVersion), "manifest.minAppVersion missing");
  assert(Boolean(manifest.updatedAt), "manifest.updatedAt missing");
}

export function validateOptions(options: Option[]) {
  const ids = new Set<string>();
  for (const option of options) {
    assert(option.id.length > 0, "option.id missing");
    assert(!ids.has(option.id), `duplicated option id: ${option.id}`);
    ids.add(option.id);
    assert(option.nameKo.length > 0, `nameKo missing: ${option.id}`);
    assert(Boolean(option.category), `category missing: ${option.id}`);
  }
}

export function validateWeapons(weapons: Weapon[]) {
  for (const weapon of weapons) {
    assert(weapon.id.length > 0, "weapon.id missing");
    assert(weapon.nameKo.length > 0, `weapon.nameKo missing: ${weapon.id}`);
    assert(Boolean(weapon.essence), `weapon.essence missing: ${weapon.id}`);
    assert(
      Boolean(weapon.essence.base),
      `weapon.essence.base missing: ${weapon.id}`,
    );
    assert(
      Boolean(weapon.essence.sub),
      `weapon.essence.sub missing: ${weapon.id}`,
    );
    assert(
      Boolean(weapon.essence.skill),
      `weapon.essence.skill missing: ${weapon.id}`,
    );
  }
}

export function validateThreatZones(
  zones: ThreatZone[],
  pools: ThreatZoneOptionPool[],
  options: Option[],
) {
  const zoneIds = new Set(zones.map((zone) => zone.id));
  const optionIds = new Set(options.map((option) => option.id));
  for (const pool of pools) {
    assert(zoneIds.has(pool.zoneId), `unknown zoneId: ${pool.zoneId}`);
    assert(optionIds.has(pool.optionId), `unknown optionId: ${pool.optionId}`);
  }
}
