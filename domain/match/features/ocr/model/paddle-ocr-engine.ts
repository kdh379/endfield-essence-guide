import type {
  OcrEngine,
  OcrRecognitionResult,
  RecognizeLineOptions,
} from "@/domain/match/features/ocr/model/ocr-engine";

const MODEL_URL = "/models/ocr/korean-rec-v1.onnx";
const DICT_URL = "/models/ocr/korean-dict-v1.txt";

const MODEL_HEIGHT = 48;
const MODEL_WIDTH = 320;
const MAX_WASM_THREADS = 4;
const ORT_LOG_SEVERITY_ERROR = 3;

type OrtModule = typeof import("onnxruntime-web");
type OrtTensor = {
  dims: readonly number[];
  data: ArrayLike<number | bigint | string>;
};

let enginePromise: Promise<OcrEngine> | null = null;
let ortPromise: Promise<OrtModule> | null = null;

async function loadOrtModule() {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web/webgpu").catch(
      async () => import("onnxruntime-web"),
    );
  }
  return ortPromise;
}

function roundWidth(width: number) {
  const rounded = Math.ceil(width / 4) * 4;
  return Math.max(32, Math.min(MODEL_WIDTH, rounded));
}

function createResizeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getNormalizedConfidence(row: Float32Array, topIndex: number) {
  const top = row[topIndex];
  if (top >= 0 && top <= 1) return top;

  let rowMax = -Infinity;
  for (let i = 0; i < row.length; i += 1) {
    rowMax = Math.max(rowMax, row[i]);
  }

  let sum = 0;
  let topExp = 0;
  for (let i = 0; i < row.length; i += 1) {
    const exp = Math.exp(row[i] - rowMax);
    sum += exp;
    if (i === topIndex) topExp = exp;
  }
  return sum > 0 ? topExp / sum : 0;
}

async function loadDictionary() {
  const response = await fetch(DICT_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load OCR dictionary: ${response.status}`);
  }
  const text = await response.text();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 브라우저 전용 PaddleOCR recognition 엔진.
 * detection 모델 없이 line crop 입력을 바로 받는 구조라서, 정확도 문제의 원인이
 * 모델인지 crop/전처리인지 분리해서 봐야 한다.
 */
class PaddleOcrEngine implements OcrEngine {
  private ort: OrtModule | null = null;
  private session: Awaited<
    ReturnType<OrtModule["InferenceSession"]["create"]>
  > | null = null;
  private dictionary: string[] | null = null;
  private inputName = "";
  private outputName = "";
  private warm = false;
  private preferredProvider: "webgpu" | "wasm" = "wasm";

  /** 첫 추론 지연을 줄이기 위한 warmup. 화면 진입 시 1회만 호출하는 것이 전제다. */
  async warmup() {
    await this.ensureReady();
    if (this.warm) return;
    const ort = this.ort;
    if (!ort) throw new Error("ORT module unavailable");
    const tensor = new ort.Tensor(
      "float32",
      new Float32Array(3 * MODEL_HEIGHT * MODEL_WIDTH),
      [1, 3, MODEL_HEIGHT, MODEL_WIDTH],
    );
    await this.session?.run({ [this.inputName]: tensor });
    this.warm = true;
  }

  async recognizeLine(
    canvas: HTMLCanvasElement,
    options?: RecognizeLineOptions,
  ): Promise<OcrRecognitionResult> {
    await this.ensureReady();
    const ort = this.ort;
    if (!ort || !this.session || !this.dictionary) {
      throw new Error("OCR engine not ready");
    }

    const start = performance.now();
    const tensor = this.canvasToTensor(canvas, ort);
    const outputMap = await this.session.run({ [this.inputName]: tensor });
    const output = outputMap[this.outputName];
    const decoded = this.decode(output);

    return {
      text: decoded.text,
      confidence: decoded.confidence,
      latencyMs: performance.now() - start,
      variantId: options?.variantId ?? "unknown",
    };
  }

  async dispose() {
    const releasable = this.session as { release?: () => void } | null;
    releasable?.release?.();
    this.session = null;
    this.ort = null;
    this.dictionary = null;
    this.inputName = "";
    this.outputName = "";
    this.warm = false;
    this.preferredProvider = "wasm";
  }

  private async ensureReady() {
    if (this.session && this.dictionary && this.ort) return;

    const ort = await loadOrtModule();
    ort.env.wasm.numThreads = Math.min(
      MAX_WASM_THREADS,
      Math.max(1, navigator.hardwareConcurrency || 1),
    );

    const providers = (navigator as Navigator & { gpu?: unknown }).gpu
      ? (["webgpu", "wasm"] as const)
      : (["wasm"] as const);

    const dictionaryPromise = loadDictionary();

    let session: Awaited<
      ReturnType<OrtModule["InferenceSession"]["create"]>
    > | null = null;
    for (const provider of providers) {
      try {
        session = await ort.InferenceSession.create(MODEL_URL, {
          executionProviders: [provider],
          logSeverityLevel: ORT_LOG_SEVERITY_ERROR,
        });
        this.preferredProvider = provider;
        break;
      } catch (error) {
        if (provider === providers[providers.length - 1]) throw error;
      }
    }

    if (!session) {
      throw new Error("Failed to create OCR inference session");
    }

    this.ort = ort;
    this.session = session;
    this.dictionary = await dictionaryPromise;
    this.inputName = session.inputNames[0] ?? "x";
    this.outputName = session.outputNames[0] ?? "softmax_0.tmp_0";
  }

  /**
   * 입력 line canvas를 PP-OCR recognition 텐서로 변환한다.
   * width 리사이즈 정책과 정규화 방식은 모델 호환성, 속도, 짧은 단어 인식률에 직접 영향 준다.
   */
  private canvasToTensor(canvas: HTMLCanvasElement, ort: OrtModule) {
    const ratio = canvas.width / Math.max(1, canvas.height);
    const resizedWidth = roundWidth(MODEL_HEIGHT * ratio);

    const resizeCanvas = createResizeCanvas(resizedWidth, MODEL_HEIGHT);
    const resizeCtx = resizeCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!resizeCtx) throw new Error("Canvas 2D context unavailable");

    resizeCtx.fillStyle = "#000";
    resizeCtx.fillRect(0, 0, resizedWidth, MODEL_HEIGHT);
    resizeCtx.drawImage(canvas, 0, 0, resizedWidth, MODEL_HEIGHT);

    const { data } = resizeCtx.getImageData(0, 0, resizedWidth, MODEL_HEIGHT);
    const chw = new Float32Array(3 * MODEL_HEIGHT * MODEL_WIDTH);
    const planeSize = MODEL_HEIGHT * MODEL_WIDTH;

    for (let y = 0; y < MODEL_HEIGHT; y += 1) {
      for (let x = 0; x < resizedWidth; x += 1) {
        const src = (y * resizedWidth + x) * 4;
        const dst = y * MODEL_WIDTH + x;
        const r = data[src] / 255;
        const g = data[src + 1] / 255;
        const b = data[src + 2] / 255;

        chw[dst] = (b - 0.5) / 0.5;
        chw[planeSize + dst] = (g - 0.5) / 0.5;
        chw[planeSize * 2 + dst] = (r - 0.5) / 0.5;
      }
    }

    return new ort.Tensor("float32", chw, [1, 3, MODEL_HEIGHT, MODEL_WIDTH]);
  }

  /**
   * CTC 계열 출력에서 토큰을 복원한다.
   * 글자가 빠지거나 반복되는 문제는 후처리보다 이 decode 단계와 dictionary 정합성부터 확인해야 한다.
   */
  private decode(output: OrtTensor) {
    if (!this.dictionary) {
      throw new Error("OCR dictionary unavailable");
    }

    const dims = output.dims;
    const sequenceLength = dims[dims.length - 2] ?? 0;
    const classCount = dims[dims.length - 1] ?? 0;
    const raw = output.data as Float32Array;
    const chars: string[] = [];
    const confidences: number[] = [];

    let previousIndex = -1;
    for (let step = 0; step < sequenceLength; step += 1) {
      const offset = step * classCount;
      let topIndex = 0;
      let topValue = -Infinity;

      for (let cls = 0; cls < classCount; cls += 1) {
        const value = raw[offset + cls];
        if (value > topValue) {
          topValue = value;
          topIndex = cls;
        }
      }

      if (topIndex !== 0 && topIndex !== previousIndex) {
        const row = raw.subarray(offset, offset + classCount);
        const token = this.dictionary[topIndex - 1] ?? "";
        if (token) {
          chars.push(token);
          confidences.push(getNormalizedConfidence(row, topIndex));
        }
      }
      previousIndex = topIndex;
    }

    const text = chars.join("").normalize("NFC").trim();
    const confidence =
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) /
          confidences.length
        : 0;

    return { text, confidence };
  }
}

export async function getOcrEngine() {
  if (!enginePromise) {
    enginePromise = Promise.resolve(new PaddleOcrEngine());
  }
  return enginePromise;
}

export async function warmupOcrEngine() {
  const engine = await getOcrEngine();
  await engine.warmup();
}

export async function disposeOcrEngine() {
  if (!enginePromise) return;
  const engine = await enginePromise;
  await engine.dispose();
  enginePromise = null;
}
