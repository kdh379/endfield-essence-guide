export type PreprocessPreset =
  | "grayscale"
  | "threshold"
  | "invert"
  | "thresholdInvert";

export interface LineOcrVariant {
  id: string;
  preset: PreprocessPreset;
  region: "full" | "text";
  canvas: HTMLCanvasElement;
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function applyGrayscale(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function applyThreshold(data: Uint8ClampedArray, threshold: number) {
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] >= threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

function applyInvert(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

function estimateThreshold(data: Uint8ClampedArray): number {
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return Math.round(min * 0.4 + max * 0.6);
}

/**
 * OCR 입력용 최소 전처리 단계.
 * threshold/invert의 효과는 게임 UI 대비와 글자 외곽선에 크게 좌우되므로,
 * 정확도 튜닝은 보통 이 함수보다 variant 순서에서 먼저 조정하는 편이 안전하다.
 */
function preprocessForOcr(
  source: HTMLCanvasElement,
  preset: PreprocessPreset,
): HTMLCanvasElement {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  applyGrayscale(data);

  if (preset === "threshold" || preset === "thresholdInvert") {
    applyThreshold(data, estimateThreshold(data));
  }
  if (preset === "invert" || preset === "thresholdInvert") {
    applyInvert(data);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * 한 줄 이미지에서 OCR 시도 후보를 만든다.
 * `full-*`은 속도 우선, `text-*`는 우측 수치/장식 노이즈를 줄인 복구 경로다.
 */
export function buildLineOcrVariants(
  source: HTMLCanvasElement,
): LineOcrVariant[] {
  const presets: PreprocessPreset[] = [
    "grayscale",
    "threshold",
    "invert",
    "thresholdInvert",
  ];
  const variants: LineOcrVariant[] = [];

  for (const preset of presets) {
    variants.push({
      id: `full-${preset}`,
      preset,
      region: "full",
      canvas: preprocessForOcr(source, preset),
    });
  }

  // Right-side numeric/UI noise is excluded for retry-only OCR attempts.
  const textX = Math.round(source.width * 0.04);
  const textY = Math.round(source.height * 0.06);
  const textWidth = Math.round(source.width * 0.72);
  const textHeight = Math.round(source.height * 0.88);
  const textCrop = cropCanvas(source, textX, textY, textWidth, textHeight);

  for (const preset of presets) {
    variants.push({
      id: `text-${preset}`,
      preset,
      region: "text",
      canvas: preprocessForOcr(textCrop, preset),
    });
  }

  return variants;
}
