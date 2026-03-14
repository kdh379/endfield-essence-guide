import type {
  DataManifest,
  Option,
  ThreatZone,
  VersionedItems,
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

export function validateVersionedItems<T>(
  label: string,
  payload: VersionedItems<T>,
  expectedVersion: string,
) {
  assert(Boolean(payload.dataVersion), `${label}.dataVersion missing`);
  assert(
    payload.dataVersion === expectedVersion,
    `${label}.dataVersion mismatch: expected ${expectedVersion}, received ${payload.dataVersion}`,
  );
  assert(Array.isArray(payload.items), `${label}.items missing`);
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

export function validateThreatZones(zones: ThreatZone[], options: Option[]) {
  const optionIds = new Set(options.map((option) => option.id));

  for (const zone of zones) {
    assert(zone.id.length > 0, "zone.id missing");
    assert(zone.nameKo.length > 0, `zone.nameKo missing: ${zone.id}`);
    assert(Boolean(zone.essencePool), `zone.essencePool missing: ${zone.id}`);

    for (const optionId of zone.essencePool.base) {
      assert(optionIds.has(optionId), `unknown base optionId: ${optionId}`);
    }
    for (const optionId of zone.essencePool.sub) {
      assert(optionIds.has(optionId), `unknown sub optionId: ${optionId}`);
    }
    for (const optionId of zone.essencePool.skill) {
      assert(optionIds.has(optionId), `unknown skill optionId: ${optionId}`);
    }
  }
}
