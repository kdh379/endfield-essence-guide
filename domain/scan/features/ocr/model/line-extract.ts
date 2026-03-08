export interface RectPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedLineRegions {
  lineCanvases: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  lineRects: [RectPx, RectPx, RectPx];
}

/**
 * Trait 캔버스에서 3줄 텍스트 영역을 분리할 때 사용하는 튜닝 포인트.
 * 모든 비율 값은 trait 캔버스(width/height) 기준이다.
 */
const LINE_EXTRACT_TUNING = {
  /**
   * 수평 에지 프로파일을 계산할 X 구간과 스무딩 강도.
   * xStartRatio/xEndRatio는 텍스트가 실제로 존재하는 좌측 영역을 샘플링한다.
   */
  edgeProfile: {
    xStartRatio: 0.05,
    xEndRatio: 0.72,
    smoothRadiusMinPx: 2,
    smoothRadiusRatio: 0.012,
  },
  /**
   * 라인 중심점 탐색 가이드.
   * anchors: 1/2/3줄의 예상 Y 중심 비율.
   */
  centerPick: {
    anchors: [0.2, 0.48, 0.76] as [number, number, number],
    searchWindowMinPx: 8,
    searchWindowRatio: 0.12,
    minGapPx: 6,
    minGapRatio: 0.12,
  },
  /**
   * 각 라인 crop 사각형 크기/위치.
   * xRatio/widthRatio는 trait 캔버스 내 텍스트 컬럼 영역.
   */
  lineRect: {
    heightMinPx: 11,
    heightRatio: 0.2,
    xRatio: 0.04,
    widthRatio: 0.74,
  },
  /** 3줄 미리보기 합성 시 라인 간 픽셀 간격. */
  preview: {
    lineGapPx: 2,
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cropCanvas(
  source: HTMLCanvasElement,
  rect: RectPx,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  return canvas;
}

function smooth(values: number[], radius: number): number[] {
  if (radius <= 1) return values.slice();
  const out = new Array<number>(values.length).fill(0);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - radius);
      j <= Math.min(values.length - 1, i + radius);
      j += 1
    ) {
      sum += values[j];
      count += 1;
    }
    out[i] = count > 0 ? sum / count : values[i];
  }
  return out;
}

function buildEdgeProfile(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const { width, height } = canvas;
  const x0 = Math.round(width * LINE_EXTRACT_TUNING.edgeProfile.xStartRatio);
  const x1 = Math.round(width * LINE_EXTRACT_TUNING.edgeProfile.xEndRatio);
  const image = ctx.getImageData(0, 0, width, height).data;
  const profile = new Array<number>(height).fill(0);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    let count = 0;
    let prevGray = -1;
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * image[idx] + 0.587 * image[idx + 1] + 0.114 * image[idx + 2];
      if (prevGray >= 0) {
        sum += Math.abs(gray - prevGray);
        count += 1;
      }
      prevGray = gray;
    }
    profile[y] = count > 0 ? sum / count : 0;
  }

  return smooth(
    profile,
    Math.max(
      LINE_EXTRACT_TUNING.edgeProfile.smoothRadiusMinPx,
      Math.round(height * LINE_EXTRACT_TUNING.edgeProfile.smoothRadiusRatio),
    ),
  );
}

function pickGuidedCenters(
  profile: number[],
  height: number,
): [number, number, number] {
  const anchors = LINE_EXTRACT_TUNING.centerPick.anchors;
  const window = Math.max(
    LINE_EXTRACT_TUNING.centerPick.searchWindowMinPx,
    Math.round(height * LINE_EXTRACT_TUNING.centerPick.searchWindowRatio),
  );

  const centers = anchors.map((ratio) => {
    const anchor = Math.round(height * ratio);
    const start = clamp(anchor - window, 0, height - 1);
    const end = clamp(anchor + window, 0, height - 1);
    let bestY = anchor;
    let bestScore = -1;
    for (let y = start; y <= end; y += 1) {
      if (profile[y] > bestScore) {
        bestScore = profile[y];
        bestY = y;
      }
    }
    // Keep edge-profile robustness while making anchor tuning visibly effective.
    return clamp(Math.round((bestY + anchor * 2) / 3), 0, height - 1);
  }) as [number, number, number];

  const minGap = Math.max(
    LINE_EXTRACT_TUNING.centerPick.minGapPx,
    Math.round(height * LINE_EXTRACT_TUNING.centerPick.minGapRatio),
  );
  for (let i = 1; i < centers.length; i += 1) {
    if (centers[i] <= centers[i - 1] + minGap) {
      centers[i] = clamp(centers[i - 1] + minGap, 0, height - 1);
    }
  }

  return centers;
}

/**
 * 고정 ROI 안에서 옵션 3줄의 라인 crop을 만든다.
 * OCR 성능이 갑자기 흔들릴 때는 모델보다 먼저 이 함수의 lineRect/anchor 튜닝을 확인해야 한다.
 */
export function extractLineRegionsFromTrait(
  traitCanvas: HTMLCanvasElement,
): ExtractedLineRegions {
  const { width, height } = traitCanvas;
  const profile = buildEdgeProfile(traitCanvas);
  const centers = pickGuidedCenters(profile, height);

  const lineHeight = Math.max(
    LINE_EXTRACT_TUNING.lineRect.heightMinPx,
    Math.round(height * LINE_EXTRACT_TUNING.lineRect.heightRatio),
  );
  const x = Math.round(width * LINE_EXTRACT_TUNING.lineRect.xRatio);
  const lineWidth = Math.round(width * LINE_EXTRACT_TUNING.lineRect.widthRatio);

  const lineRects = centers.map((centerY) => {
    const y = clamp(
      Math.round(centerY - lineHeight / 2),
      0,
      height - lineHeight,
    );
    return {
      x,
      y,
      width: lineWidth,
      height: lineHeight,
    };
  }) as [RectPx, RectPx, RectPx];

  const lineCanvases = lineRects.map((rect) =>
    cropCanvas(traitCanvas, rect),
  ) as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];

  return {
    lineCanvases,
    lineRects,
  };
}

/**
 * 디버깅용 3줄 미리보기 캔버스를 합성한다.
 * OCR 입력 자체는 각 line canvas이므로, preview 품질보다 lineRect 정합성이 더 중요하다.
 */
export function composeLinePreview(
  lineCanvases: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement],
): HTMLCanvasElement {
  const width = Math.max(...lineCanvases.map((line) => line.width));
  const height =
    lineCanvases[0].height +
    lineCanvases[1].height +
    lineCanvases[2].height +
    LINE_EXTRACT_TUNING.preview.lineGapPx * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  let y = 0;
  for (let i = 0; i < lineCanvases.length; i += 1) {
    const line = lineCanvases[i];
    ctx.drawImage(line, 0, y, line.width, line.height);
    y +=
      line.height +
      (i < lineCanvases.length - 1 ? LINE_EXTRACT_TUNING.preview.lineGapPx : 0);
  }

  return canvas;
}
