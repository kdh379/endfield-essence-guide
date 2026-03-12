import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { unstable_cache } from "next/cache";

import type {
  DataManifest,
  Option,
  StaticGameData,
  ThreatZone,
  VersionedItems,
  Weapon,
} from "@/shared/lib/data/schemas";
import {
  validateManifest,
  validateOptions,
  validateThreatZones,
  validateWeapons,
} from "@/shared/lib/data/validate";

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as T;
}

async function readManifestFile(): Promise<DataManifest> {
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "data",
    "static",
    "manifest.json",
  );
  const manifest = await readJsonFile<DataManifest>(manifestPath);
  validateManifest(manifest);
  return manifest;
}

async function readStaticGameDataFile(): Promise<StaticGameData> {
  const manifest = await readManifestFile();
  const versionDir = path.join(
    process.cwd(),
    "public",
    "data",
    "static",
    `v${manifest.dataVersion}`,
  );

  const [options, weapons, threatZones] = await Promise.all([
    readJsonFile<VersionedItems<Option>>(path.join(versionDir, "options.json")),
    readJsonFile<VersionedItems<Weapon>>(path.join(versionDir, "weapons.json")),
    readJsonFile<VersionedItems<ThreatZone>>(
      path.join(versionDir, "threat-zones.json"),
    ),
  ]);

  validateOptions(options.items);
  validateWeapons(weapons.items);
  validateThreatZones(threatZones.items, options.items);

  return {
    dataVersion: manifest.dataVersion,
    options: options.items,
    weapons: weapons.items,
    threatZones: threatZones.items,
  };
}

export const getManifest = unstable_cache(
  async () => readManifestFile(),
  ["data-manifest"],
);

export const getStaticGameData = unstable_cache(
  async () => readStaticGameDataFile(),
  ["static-game-data"],
);
