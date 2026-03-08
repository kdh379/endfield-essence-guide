import type { Option } from "@/shared/lib/data/schemas";
import { normalizeWithVanillaRules } from "@/domain/scan/features/ocr/model/vanilla-rules";

const STOPWORDS = ["옵션", "효과"];
const OPTION_ALIAS_CACHE = new WeakMap<Option[], PreparedOption[]>();

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

interface PreparedOption {
  optionId: string;
  aliases: string[];
  optionRuleCompact: string;
}

/**
 * OCR 원문을 사전 매칭 가능한 형태로 정규화한다.
 * 모델이 바뀌어도 후처리 품질의 기준점이 되는 함수라서, 규칙 추가 시 기존 alias 충돌을 같이 봐야 한다.
 */
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

function stripValueTokens(text: string): string {
  return text
    .replace(/-?\d+(?:\.\d+)?(?:\s*)(%|pt|s)?/gi, " ")
    .replace(/[+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getPreparedOptions(options: Option[]): PreparedOption[] {
  const cached = OPTION_ALIAS_CACHE.get(options);
  if (cached) return cached;

  const prepared = options.map((option) => ({
    optionId: option.id,
    aliases: buildOptionAliases(option),
    optionRuleCompact: toCompactKorean(
      normalizeWithVanillaRules(option.nameKo),
    ),
  }));
  OPTION_ALIAS_CACHE.set(options, prepared);
  return prepared;
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

/**
 * OCR 한 줄을 "옵션명 + 수치" 구조로 해석한다.
 * 짧은 옵션명은 여기서 완벽히 확정하려고 하지 않고, 후보 사전 매칭 단계에 넘기는 것이 안정적이다.
 */
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

/**
 * 도메인 사전을 기준으로 OCR 후보 옵션을 점수화한다.
 * 실제 인식률 튜닝의 대부분은 모델 교체보다 alias/rule bonus/short token bonus 조정에서 나온다.
 */
export function getOptionCandidates(
  parsed: ParsedLine,
  options: Option[],
  topN = 5,
): OptionCandidate[] {
  const rawRuleNormalized = normalizeOcrText(
    normalizeWithVanillaRules(parsed.rawText),
  );
  const nameOnlyNormalized = normalizeOcrText(stripValueTokens(parsed.rawText));
  const normalizedVariants = Array.from(
    new Set(
      [
        parsed.normalizedText,
        rawRuleNormalized,
        nameOnlyNormalized,
        normalizeOcrText(
          normalizeWithVanillaRules(stripValueTokens(parsed.rawText)),
        ),
      ].filter(Boolean),
    ),
  );

  const scored = getPreparedOptions(options).map((option) => {
    let bestAliasScore = 0;
    let bestLexicalScore = 0;
    let bestValuePatternScore = 0;
    let bestScore = -1;

    const variants =
      normalizedVariants.length > 0
        ? normalizedVariants
        : [parsed.normalizedText];
    for (const variant of variants) {
      const aliasScore = scoreAlias(variant, option.aliases);
      const lexicalScore = scoreLexical(variant, option.aliases);
      const valuePatternScore = scoreValuePattern(variant);
      const parsedCompact = toCompactKorean(variant);
      const ruleBonus =
        parsedCompact &&
        option.optionRuleCompact &&
        (parsedCompact === option.optionRuleCompact ||
          option.optionRuleCompact.includes(parsedCompact))
          ? 0.08
          : 0;
      const exactRuleBonus =
        rawRuleNormalized && option.aliases.includes(rawRuleNormalized)
          ? 0.24
          : 0;
      const shortNameBonus =
        nameOnlyNormalized &&
        nameOnlyNormalized.length <= 3 &&
        option.aliases.includes(nameOnlyNormalized)
          ? 0.16
          : 0;

      const score =
        aliasScore +
        lexicalScore +
        valuePatternScore +
        ruleBonus +
        exactRuleBonus +
        shortNameBonus;
      if (score > bestScore) {
        bestScore = score;
        bestAliasScore = aliasScore;
        bestLexicalScore = lexicalScore;
        bestValuePatternScore = valuePatternScore;
      }
    }

    return {
      optionId: option.optionId,
      score: bestScore,
      aliasScore: bestAliasScore,
      lexicalScore: bestLexicalScore,
      valuePatternScore: bestValuePatternScore,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

/**
 * OCR confidence와 도메인 매핑 점수를 합성한다.
 * 한쪽 가중치만 올리면 빈 문자열 확정이나 오매칭이 늘 수 있어, 비율 변경은 회귀 테스트가 필요하다.
 */
export function combinedConfidence(
  ocrConfidence: number,
  mappingScore: number,
) {
  const ocrNorm = Math.max(0, Math.min(1, ocrConfidence / 100));
  return Number((ocrNorm * 0.45 + mappingScore * 0.55).toFixed(3));
}
