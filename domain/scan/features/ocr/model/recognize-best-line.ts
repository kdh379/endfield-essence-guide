import {
  AUTO_OCR_FAST_VARIANTS,
  AUTO_OCR_VARIANTS,
  MANUAL_RETRY_VARIANTS,
} from "@/domain/scan/features/ocr/model/ocr-engine";
import {
  combinedConfidence,
  getOptionCandidates,
  parseOcrLine,
} from "@/domain/scan/features/ocr/model/normalize";
import { buildLineOcrVariants } from "@/domain/scan/features/ocr/model/preprocess";
import { getOcrEngine } from "@/domain/scan/features/ocr/model/paddle-ocr-engine";
import type { Option } from "@/shared/lib/data/schemas";

const OCR_MIN_MAPPING_SCORE = 0.62;
const OCR_MIN_COMBINED_CONFIDENCE = 0.58;

export interface RecognizedLine {
  rawText: string;
  normalizedText: string;
  optionId?: string;
  valueText?: string;
  valueNumeric?: number;
  confidence: number;
  mappingScore: number;
  latencyMs: number;
  variantId: string;
}

export function isReliableMatch(result: {
  optionId?: string;
  mappingScore: number;
  confidence: number;
}) {
  return (
    Boolean(result.optionId) &&
    result.mappingScore >= OCR_MIN_MAPPING_SCORE &&
    result.confidence >= OCR_MIN_COMBINED_CONFIDENCE
  );
}

export async function recognizeBestLine(
  lineCanvas: HTMLCanvasElement,
  options: Option[],
  config?: {
    aggressive?: boolean;
    fastPathOnly?: boolean;
  },
): Promise<RecognizedLine> {
  const aggressive = config?.aggressive ?? false;
  const fastPathOnly = config?.fastPathOnly ?? false;
  const engine = await getOcrEngine();
  const variantById = new Map(
    buildLineOcrVariants(lineCanvas).map((variant) => [variant.id, variant]),
  );

  let best: RecognizedLine & { score: number } = {
    rawText: "",
    normalizedText: "",
    optionId: undefined,
    valueText: undefined,
    valueNumeric: undefined,
    confidence: 0,
    mappingScore: 0,
    latencyMs: 0,
    variantId: "",
    score: -1,
  };

  const preferredVariantIds = aggressive
    ? MANUAL_RETRY_VARIANTS
    : fastPathOnly
      ? AUTO_OCR_FAST_VARIANTS
      : AUTO_OCR_VARIANTS;

  const shouldEarlyExit = () =>
    Boolean(best.optionId) &&
    (isReliableMatch(best) ||
      (best.mappingScore >= 0.72 && best.confidence >= 0.64));

  for (const variantId of preferredVariantIds) {
    const variant = variantById.get(variantId);
    if (!variant) continue;

    const result = await engine.recognizeLine(variant.canvas, { variantId });
    const rawText = result.text.trim();
    if (!rawText) continue;

    const parsed = parseOcrLine(rawText);
    const top = getOptionCandidates(parsed, options, 1)[0];
    const mappingScore = top?.score ?? 0;
    const confidence = combinedConfidence(
      result.confidence * 100,
      mappingScore,
    );
    const totalScore =
      confidence + (parsed.normalizedText.length >= 2 ? 0.04 : 0);

    if (
      totalScore > best.score ||
      (totalScore === best.score && mappingScore > best.mappingScore)
    ) {
      best = {
        rawText,
        normalizedText: parsed.normalizedText,
        optionId: top?.optionId,
        valueText: parsed.valueText,
        valueNumeric: parsed.valueNumeric,
        confidence,
        mappingScore,
        latencyMs: result.latencyMs,
        variantId: result.variantId,
        score: totalScore,
      };
    }

    if (shouldEarlyExit()) break;
  }

  return {
    rawText: best.rawText,
    normalizedText: best.normalizedText,
    optionId: best.optionId,
    valueText: best.valueText,
    valueNumeric: best.valueNumeric,
    confidence: best.confidence,
    mappingScore: best.mappingScore,
    latencyMs: best.latencyMs,
    variantId: best.variantId,
  };
}
