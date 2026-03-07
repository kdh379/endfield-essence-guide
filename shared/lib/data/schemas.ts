export type DataVersion = string;

export type OptionCategory = "base" | "sub" | "skill";

export interface Option {
  id: string;
  nameKo: string;
  category: OptionCategory;
}

export interface Weapon {
  id: string;
  nameKo: string;
  rarity: number;
  iconKey: string;
  iconUrl?: string;
  weaponOptionSlots: {
    base: number;
    sub: number;
    skill: number;
  };
  weaponBuildMeta?: {
    validTripleOptionSets: string[][];
    notes?: string;
    sourceRefs?: string[];
  };
}

export interface ThreatZone {
  id: string;
  nameKo: string;
  type: "threat" | "event" | "boss";
  difficultyTags: string[];
}

export interface ThreatZoneOptionPool {
  zoneId: string;
  category: OptionCategory;
  optionId: string;
  weight?: number;
  sourceConfidence: number;
}

export interface ScannedTraitLine {
  lineNo: 1 | 2 | 3;
  rawText: string;
  normalizedText: string;
  optionId?: string;
  valueText?: string;
  valueNumeric?: number;
  confidence: number;
  userCorrected?: boolean;
}

export interface WeaponMatch {
  weaponId: string;
  matchType: "exact3" | "partial2" | "category_fit";
  score: number;
}

export interface ScannedTrait {
  id: string;
  capturedAt: string;
  imageHash: string;
  lines: [ScannedTraitLine, ScannedTraitLine, ScannedTraitLine];
  lock: boolean;
  lockReason?: "triple_valid" | "partial_match" | "manual";
  matchedWeapons: WeaponMatch[];
}

export interface WeaponOptionLevel {
  weaponId: string;
  optionId: string;
  level: number;
  valueNumeric: number;
}

export interface WeaponStatProgression {
  weaponId: string;
  level: number;
  atk?: number;
  hp?: number;
  def?: number;
}

export interface UserOptionCorrection {
  id: string;
  normalizedText: string;
  forcedOptionId: string;
  createdAt: string;
}

export interface DataManifest {
  dataVersion: DataVersion;
  minAppVersion: string;
  updatedAt: string;
}

export interface VersionedItems<T> {
  dataVersion: DataVersion;
  items: T[];
}

export interface EnrichmentWeaponTriples {
  dataVersion: DataVersion;
  items: Array<{
    weaponId: string;
    optionTriples: string[][];
    sourceRefs?: string[];
    sourceConfidence: number;
  }>;
}
