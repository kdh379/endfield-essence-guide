export type PreprocessPreset = "default" | "highContrast" | "threshold";

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
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function applyContrast(data: Uint8ClampedArray, contrast = 1.35) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.min(
      255,
      Math.max(0, factor * (data[i + 1] - 128) + 128),
    );
    data[i + 2] = Math.min(
      255,
      Math.max(0, factor * (data[i + 2] - 128) + 128),
    );
  }
}

function applyThreshold(data: Uint8ClampedArray, threshold = 155) {
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
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
  return Math.round(min * 0.35 + max * 0.65);
}

function upscale(source: HTMLCanvasElement, ratio = 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width * ratio;
  canvas.height = source.height * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function preprocessForOcr(
  source: HTMLCanvasElement,
  preset: PreprocessPreset,
): HTMLCanvasElement {
  const upscaled = upscale(source, 2);
  if (preset === "default") return upscaled;

  const canvas = cloneCanvas(upscaled);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  applyGrayscale(data);
  if (preset === "highContrast") {
    applyContrast(data, 150);
  } else if (preset === "threshold") {
    applyContrast(data, 130);
    applyThreshold(data, estimateThreshold(data));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function buildLineOcrVariants(
  source: HTMLCanvasElement,
): LineOcrVariant[] {
  const presets: PreprocessPreset[] = ["default", "highContrast", "threshold"];
  const variants: LineOcrVariant[] = [];

  for (const preset of presets) {
    variants.push({
      id: `full-${preset}`,
      preset,
      region: "full",
      canvas: preprocessForOcr(source, preset),
    });
  }

  // Right-side numeric/UI 아이콘 노이즈를 줄이기 위해 텍스트 좌측 영역을 별도 OCR한다.
  const textX = Math.round(source.width * 0.06);
  const textY = Math.round(source.height * 0.08);
  const textWidth = Math.round(source.width * 0.7);
  const textHeight = Math.round(source.height * 0.84);
  const textCrop = cropCanvas(source, textX, textY, textWidth, textHeight);

  for (const preset of presets) {
    const prepared = preprocessForOcr(textCrop, preset);
    const boosted = upscale(prepared, 2);
    variants.push({
      id: `text-${preset}`,
      preset,
      region: "text",
      canvas: boosted,
    });
  }

  return variants;
}
