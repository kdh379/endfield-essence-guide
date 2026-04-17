import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

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
  validateVersionedItems,
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
  const staticDir = path.join(process.cwd(), "public", "data", "static");

  const [options, weapons, threatZones] = await Promise.all([
    readJsonFile<VersionedItems<Option>>(path.join(staticDir, "options.json")),
    readJsonFile<VersionedItems<Weapon>>(path.join(staticDir, "weapons.json")),
    readJsonFile<VersionedItems<ThreatZone>>(
      path.join(staticDir, "threat-zones.json"),
    ),
  ]);

  validateVersionedItems("options", options, manifest.dataVersion);
  validateVersionedItems("weapons", weapons, manifest.dataVersion);
  validateVersionedItems("threatZones", threatZones, manifest.dataVersion);
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

export const getManifest = async () => readManifestFile();

export const getStaticGameData = async () => readStaticGameDataFile();
