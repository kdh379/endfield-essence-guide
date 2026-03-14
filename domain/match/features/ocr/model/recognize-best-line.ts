import {
  AUTO_OCR_FAST_VARIANTS,
  AUTO_OCR_VARIANTS,
  MANUAL_RETRY_VARIANTS,
} from "@/domain/match/features/ocr/model/ocr-engine";
import { buildLineOcrVariants } from "@/domain/match/features/ocr/model/preprocess";
import { getOcrEngine } from "@/domain/match/features/ocr/model/paddle-ocr-engine";
import type { Option } from "@/shared/lib/data/schemas";

const OCR_MIN_COMBINED_CONFIDENCE = 0.58;

export interface RecognizedLine {
  rawText: string;
  normalizedText: string;
  optionId?: string;
  confidence: number;
  latencyMs: number;
  variantId: string;
}

function resolveOptionMatch(
  rawText: string,
  options: Option[],
): { optionId?: string } {
  if (!rawText) {
    return { optionId: undefined };
  }

  const compactRawText = rawText.replace(/\s+/g, "");

  for (const option of options) {
    const base = option.nameKo;
    const compactBase = option.nameKo.replace(/\s+/g, "");
    const withIncrease = `${base}증가`;
    const compactWithIncrease = `${compactBase}증가`;
    if (
      rawText === base ||
      rawText === withIncrease ||
      compactRawText === compactBase ||
      compactRawText === compactWithIncrease
    ) {
      return { optionId: option.id };
    }
  }

  for (const option of options) {
    const compactOption = option.nameKo.replace(/\s+/g, "");
    if (
      rawText.includes(option.nameKo) ||
      compactRawText.includes(compactOption) ||
      `${option.nameKo}증가` === rawText ||
      `${compactOption}증가` === compactRawText
    ) {
      return { optionId: option.id };
    }
  }

  return { optionId: undefined };
}

export function isReliableMatch(result: {
  optionId?: string;
  confidence: number;
}) {
  return (
    Boolean(result.optionId) && result.confidence >= OCR_MIN_COMBINED_CONFIDENCE
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
    confidence: 0,
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
    Boolean(best.optionId) && best.confidence >= 0.64;

  for (const variantId of preferredVariantIds) {
    const variant = variantById.get(variantId);
    if (!variant) continue;

    const result = await engine.recognizeLine(variant.canvas, { variantId });
    const rawText = result.text.trim();
    if (!rawText) continue;

    const { optionId } = resolveOptionMatch(rawText, options);
    const confidence = Number(result.confidence.toFixed(3));
    const totalScore =
      confidence + (optionId ? 0.08 : 0) + (rawText.length >= 2 ? 0.04 : 0);

    if (
      totalScore > best.score ||
      (totalScore === best.score &&
        Number(Boolean(optionId)) > Number(Boolean(best.optionId)))
    ) {
      best = {
        rawText,
        normalizedText: rawText,
        optionId,
        confidence,
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
    confidence: best.confidence,
    latencyMs: best.latencyMs,
    variantId: best.variantId,
  };
}
