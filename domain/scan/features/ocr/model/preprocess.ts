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

export function preprocessForOcr(
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
