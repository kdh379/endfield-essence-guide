import type { Option } from "@/shared/lib/data/schemas";
import { normalizeWithVanillaRules } from "@/domain/scan/features/ocr/model/vanilla-rules";

const STOPWORDS = ["옵션", "효과"];

export interface ParsedLine {
  rawText: string;
  normalizedText: string;
  valueText?: string;
  valueNumeric?: number;
}

export interface OptionCandidate {
  optionId: string;
  score: number;
  aliasScore: number;
  lexicalScore: number;
  valuePatternScore: number;
}

export function normalizeOcrText(text: string): string {
  const nfkc = text.normalize("NFKC").toLowerCase();
  const unified = nfkc
    .replace(/[＋+]/g, " + ")
    .replace(/[％%]/g, " % ")
    .replace(/[|｜]/g, " ")
    .replace(/[·•]/g, " ")
    .replace(/[,]/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  return unified
    .split(" ")
    .filter((token) => token && !STOPWORDS.includes(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCompactKorean(text: string): string {
  return text.replace(/\s+/g, "").replace(/[^\uAC00-\uD7A3]/g, "");
}

function buildOptionAliases(option: Option): string[] {
  const base = option.nameKo;
  const ruleNorm = normalizeWithVanillaRules(base);
  const noSpace = base.replace(/\s+/g, "");
  const noIncrease = base.replace(/\s*증가$/g, "");

  const aliases = [base, ruleNorm, noSpace, noIncrease]
    .map((v) => normalizeOcrText(v))
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function scoreAlias(normalizedText: string, aliases: string[]): number {
  if (aliases.includes(normalizedText)) return 0.56;
  if (aliases.some((alias) => normalizedText.includes(alias))) return 0.44;
  if (aliases.some((alias) => alias.includes(normalizedText))) return 0.34;
  return 0;
}

function scoreLexical(normalizedText: string, aliases: string[]): number {
  if (!normalizedText || !aliases.length) return 0;

  let best = 0;
  for (const alias of aliases) {
    const maxLen = Math.max(alias.length, normalizedText.length);
    if (!maxLen) continue;
    const distance = levenshtein(normalizedText, alias);
    const similarity = 1 - distance / maxLen;
    best = Math.max(best, similarity);
  }

  return Math.max(0, Math.min(0.3, best * 0.3));
}

function scoreValuePattern(normalizedText: string): number {
  return /-?\d+(?:\.\d+)?/.test(normalizedText) ? 0.12 : 0.03;
}

export function extractValueParts(text: string): {
  valueText?: string;
  valueNumeric?: number;
} {
  const match = text.match(/(-?\d+(?:\.\d+)?)(?:\s*)(%|pt|s)?/i);
  if (!match) return {};
  const numeric = Number(match[1]);
  return {
    valueText: match[2] ? `${match[1]}${match[2]}` : match[1],
    valueNumeric: Number.isNaN(numeric) ? undefined : numeric,
  };
}

export function parseOcrLine(rawText: string): ParsedLine {
  const basicNormalized = normalizeOcrText(rawText);
  const vanillaNormalized = normalizeWithVanillaRules(rawText);

  const merged =
    [basicNormalized, vanillaNormalized]
      .map((v) => normalizeOcrText(v))
      .find((v) => toCompactKorean(v).length >= 1) ?? basicNormalized;

  const value = extractValueParts(merged);
  return { rawText, normalizedText: merged, ...value };
}

export function getOptionCandidates(
  parsed: ParsedLine,
  options: Option[],
  topN = 5,
): OptionCandidate[] {
  const normalizedVariants = Array.from(
    new Set(
      [
        parsed.normalizedText,
        normalizeOcrText(normalizeWithVanillaRules(parsed.rawText)),
      ].filter(Boolean),
    ),
  );

  const scored = options.map((option) => {
    const aliases = buildOptionAliases(option);
    let bestAliasScore = 0;
    let bestLexicalScore = 0;
    let bestValuePatternScore = 0;
    let bestScore = -1;

    const optionRuleCompact = toCompactKorean(
      normalizeWithVanillaRules(option.nameKo),
    );
    const variants =
      normalizedVariants.length > 0
        ? normalizedVariants
        : [parsed.normalizedText];
    for (const variant of variants) {
      const aliasScore = scoreAlias(variant, aliases);
      const lexicalScore = scoreLexical(variant, aliases);
      const valuePatternScore = scoreValuePattern(variant);
      const parsedCompact = toCompactKorean(variant);
      const ruleBonus =
        parsedCompact &&
        optionRuleCompact &&
        (parsedCompact === optionRuleCompact ||
          optionRuleCompact.includes(parsedCompact))
          ? 0.08
          : 0;

      const score = aliasScore + lexicalScore + valuePatternScore + ruleBonus;
      if (score > bestScore) {
        bestScore = score;
        bestAliasScore = aliasScore;
        bestLexicalScore = lexicalScore;
        bestValuePatternScore = valuePatternScore;
      }
    }

    return {
      optionId: option.id,
      score: bestScore,
      aliasScore: bestAliasScore,
      lexicalScore: bestLexicalScore,
      valuePatternScore: bestValuePatternScore,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

export function combinedConfidence(
  ocrConfidence: number,
  mappingScore: number,
) {
  const ocrNorm = Math.max(0, Math.min(1, ocrConfidence / 100));
  return Number((ocrNorm * 0.45 + mappingScore * 0.55).toFixed(3));
}
