import Dexie, { type Table } from "dexie";

import type {
  ScannedTrait,
  UserOptionCorrection,
} from "@/shared/lib/data/schemas";

export interface LockRecord {
  id: string;
  scannedTraitId: string;
  createdAt: string;
  reason: "triple_valid" | "partial_match" | "manual";
}

export interface AppSetting {
  id: string;
  warningLevel: "high" | "medium" | "off";
}

export class EndfieldDB extends Dexie {
  scannedTraits!: Table<ScannedTrait, string>;
  userCorrections!: Table<UserOptionCorrection, string>;
  locks!: Table<LockRecord, string>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super("endfieldGuideDB_v1");
    this.version(1).stores({
      scannedTraits: "id,capturedAt,lock",
      userCorrections: "id,normalizedText,forcedOptionId,createdAt",
      locks: "id,scannedTraitId,createdAt,reason",
      appSettings: "id",
    });
  }
}

export const db = new EndfieldDB();
