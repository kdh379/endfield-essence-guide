import { PSM, createWorker } from "tesseract.js";

let workerPromise: ReturnType<typeof createWorker> | null = null;
let initialized = false;
let lastPsm: PSM | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("kor+eng", 1, {
      logger: () => undefined,
    });
  }
  return workerPromise;
}

async function ensureParameters(psm: PSM) {
  const worker = await getWorker();

  // setParameters 호출 비용이 커서, 동일 설정일 때는 재호출하지 않는다.
  if (!initialized) {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    initialized = true;
  }

  if (lastPsm !== psm) {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
    });
    lastPsm = psm;
  }

  return worker;
}

export async function recognizeKorean(
  canvas: HTMLCanvasElement,
  psm: PSM = PSM.SINGLE_BLOCK,
): Promise<{ lines: string[]; confidence: number }> {
  const worker = await ensureParameters(psm);
  const result = await worker.recognize(canvas);
  const lines = result.data.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    lines,
    confidence: result.data.confidence ?? 0,
  };
}

export async function terminateWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
  initialized = false;
  lastPsm = null;
}
