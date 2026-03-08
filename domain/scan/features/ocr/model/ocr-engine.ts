export interface OcrRecognitionResult {
  text: string;
  confidence: number;
  latencyMs: number;
  variantId: string;
}

export interface RecognizeLineOptions {
  variantId?: string;
}

export interface OcrEngine {
  warmup(): Promise<void>;
  recognizeLine(
    canvas: HTMLCanvasElement,
    options?: RecognizeLineOptions,
  ): Promise<OcrRecognitionResult>;
  dispose(): Promise<void>;
}

export const AUTO_OCR_TARGET_MS = 500;

export const AUTO_OCR_VARIANTS = [
  "full-grayscale",
  "full-threshold",
  "full-invert",
] as const;

export const AUTO_OCR_FAST_VARIANTS = ["full-grayscale"] as const;

export const MANUAL_RETRY_VARIANTS = [
  "full-grayscale",
  "full-threshold",
  "full-invert",
  "full-thresholdInvert",
  "text-grayscale",
  "text-threshold",
  "text-invert",
  "text-thresholdInvert",
] as const;
