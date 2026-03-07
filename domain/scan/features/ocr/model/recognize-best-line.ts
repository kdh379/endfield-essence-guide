import { PSM } from "tesseract.js";

import {
  combinedConfidence,
  getOptionCandidates,
  parseOcrLine,
} from "@/domain/scan/features/ocr/model/normalize";
import {
  buildLineOcrVariants,
  preprocessForOcr,
} from "@/domain/scan/features/ocr/model/preprocess";
import { recognizeKorean } from "@/domain/scan/features/ocr/model/tesseract";
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
): Promise<RecognizedLine> {
  let best: RecognizedLine & { score: number } = {
    rawText: "",
    normalizedText: "",
    optionId: undefined,
    valueText: undefined,
    valueNumeric: undefined,
    confidence: 0,
    mappingScore: 0,
    score: -1,
  };

  const evaluateAttempt = async (attempt: {
    canvas: HTMLCanvasElement;
    psm: PSM;
  }) => {
    const result = await recognizeKorean(attempt.canvas, attempt.psm);
    const rawText = (result.lines[0] ?? "").trim();
    if (!rawText) return;

    const parsed = parseOcrLine(rawText);
    const top = getOptionCandidates(parsed, options, 1)[0];
    const mappingScore = top?.score ?? 0;
    const confidence = combinedConfidence(result.confidence, mappingScore);
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
        score: totalScore,
      };
    }
  };

  const baseAttempts: Array<{
    canvas: HTMLCanvasElement;
    psm: PSM;
  }> = [
    { canvas: preprocessForOcr(lineCanvas, "threshold"), psm: PSM.SINGLE_LINE },
    {
      canvas: preprocessForOcr(lineCanvas, "highContrast"),
      psm: PSM.SINGLE_LINE,
    },
    { canvas: preprocessForOcr(lineCanvas, "default"), psm: PSM.SINGLE_LINE },
  ];

  for (const attempt of baseAttempts) {
    await evaluateAttempt(attempt);
  }

  if (!isReliableMatch(best)) {
    const variantById = new Map(
      buildLineOcrVariants(lineCanvas).map((variant) => [variant.id, variant]),
    );
    const fallbackVariants = [
      variantById.get("text-threshold"),
      variantById.get("text-highContrast"),
      variantById.get("full-threshold"),
    ].flatMap((variant) => (variant ? [variant] : []));

    for (const variant of fallbackVariants) {
      await evaluateAttempt({ canvas: variant.canvas, psm: PSM.SINGLE_LINE });
      if (variant.region === "text") {
        await evaluateAttempt({ canvas: variant.canvas, psm: PSM.SINGLE_WORD });
      }
    }
  }

  return {
    rawText: best.rawText,
    normalizedText: best.normalizedText,
    optionId: best.optionId,
    valueText: best.valueText,
    valueNumeric: best.valueNumeric,
    confidence: best.confidence,
    mappingScore: best.mappingScore,
  };
}
