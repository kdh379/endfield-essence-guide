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

/**
 * 자동 OCR의 steady-state 목표 시간(ms).
 * 이 값을 넘기면 자동 경로는 variant 수를 줄이고, 정확도 보완은 재검사에 맡긴다.
 */
export const AUTO_OCR_TARGET_MS = 500;

/**
 * 자동 OCR 기본 variant 순서.
 * 앞쪽 variant일수록 비용 대비 성공률이 높아야 하며, 순서 변경은 latency에 직접 영향 준다.
 */
export const AUTO_OCR_VARIANTS = [
  "full-grayscale",
  "full-threshold",
  "full-invert",
] as const;

/** 성능이 목표치를 넘길 때 사용하는 최소 비용 자동 경로. */
export const AUTO_OCR_FAST_VARIANTS = ["full-grayscale"] as const;

/**
 * 수동 재검사 전용 variant 집합.
 * 느리더라도 복구력이 중요하므로 text crop과 추가 전처리를 모두 허용한다.
 */
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
