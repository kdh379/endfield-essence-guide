export interface RectN {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoiTuning {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  lineDy: number;
  lineDh: number;
}

export interface LineGuideConfig {
  x: number;
  width: number;
  startY: number;
  height: number;
  gap: number;
}

export interface ScanRoiPixels {
  frame16x9: RectPx;
  traitRect: RectPx;
}

const TARGET_ASPECT = 16 / 9;

const BASE_ROI_CONFIG = {
  traitRect: { x: 0.09, y: 0.49, width: 0.14, height: 0.125 } as RectN,
};

export const DEFAULT_ROI_TUNING: RoiTuning = {
  dx: 0,
  dy: 0,
  dw: 0,
  dh: 0,
  lineDy: 0,
  lineDh: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function normalizeRect(rect: RectN): RectN {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const width = clamp01(rect.width);
  const height = clamp01(rect.height);
  return {
    x,
    y,
    width: clamp01(Math.min(width, 1 - x)),
    height: clamp01(Math.min(height, 1 - y)),
  };
}

function applyTuning(rect: RectN, tuning: RoiTuning): RectN {
  const tuned: RectN = {
    x: rect.x + tuning.dx,
    y: rect.y + tuning.dy,
    width: rect.width + tuning.dw,
    height: rect.height + tuning.dh,
  };
  return normalizeRect(tuned);
}

function toPixelRectInArea(rect: RectN, area: RectPx): RectPx {
  return {
    x: Math.round(area.x + rect.x * area.width),
    y: Math.round(area.y + rect.y * area.height),
    width: Math.round(rect.width * area.width),
    height: Math.round(rect.height * area.height),
  };
}

export function getAspectFit16x9Rect(width: number, height: number): RectPx {
  const currentAspect = width / height;
  if (Math.abs(currentAspect - TARGET_ASPECT) <= 0.005) {
    return { x: 0, y: 0, width, height };
  }

  if (currentAspect > TARGET_ASPECT) {
    const fitWidth = Math.round(height * TARGET_ASPECT);
    const x = Math.round((width - fitWidth) / 2);
    return { x, y: 0, width: fitWidth, height };
  }

  const fitHeight = Math.round(width / TARGET_ASPECT);
  const y = Math.round((height - fitHeight) / 2);
  return { x: 0, y, width, height: fitHeight };
}

export function getScanRoiPixels(
  width: number,
  height: number,
  tuning: RoiTuning = DEFAULT_ROI_TUNING,
): ScanRoiPixels {
  const frame16x9 = getAspectFit16x9Rect(width, height);

  const traitRect = toPixelRectInArea(
    applyTuning(BASE_ROI_CONFIG.traitRect, tuning),
    frame16x9,
  );

  return { frame16x9, traitRect };
}
