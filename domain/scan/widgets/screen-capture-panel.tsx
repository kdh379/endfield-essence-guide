"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  composeLinePreview,
  extractLineRegionsFromTrait,
} from "@/domain/scan/features/ocr/model/line-extract";
import {
  DEFAULT_ROI_TUNING,
  getScanRoiPixels,
} from "@/domain/scan/features/capture/model/roi-presets";

interface ScreenCapturePanelProps {
  onCaptureReady: (payload: {
    traitCanvas: HTMLCanvasElement;
    lineCanvases: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
    previewUrl: string;
    profile: string;
    signature: string;
    captureTs: number;
  }) => void;
}

interface PanelUiState {
  isSharing: boolean;
  status: string;
}

interface BorderRect {
  top: number;
  left: number;
  right: number;
}

interface CaptureSessionState {
  stream: MediaStream | null;
  rafId: number | null;
  intervalId: number | null;
  frameCanvas: HTMLCanvasElement | null;
  lastSignature: string | null;
  lastCaptureAt: number;
  isAutoCaptureBusy: boolean;
  borderCache: BorderRect;
  borderFrameCount: number;
  drawOverlay: () => void;
  captureFixedRoi: (source?: "manual" | "auto") => boolean;
}

const AUTO_CAPTURE_INTERVAL_MS = 120;
const DEV_CAPTURE_STORE_KEY = "__scanCaptureDevStore";

interface DevCaptureStore {
  stream: MediaStream | null;
}

function getDevCaptureStore(): DevCaptureStore | null {
  if (typeof window === "undefined") return null;
  const host = window as typeof window & {
    [DEV_CAPTURE_STORE_KEY]?: DevCaptureStore;
  };
  if (!host[DEV_CAPTURE_STORE_KEY]) {
    host[DEV_CAPTURE_STORE_KEY] = { stream: null };
  }
  return host[DEV_CAPTURE_STORE_KEY] ?? null;
}

function cropCanvas(
  source: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
) {
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

function detectGameBorderFromCanvas(
  canvas: HTMLCanvasElement,
  threshold = 45,
): BorderRect {
  const vw = canvas.width;
  const vh = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { top: 0, left: 0, right: 0 };

  const imgData = ctx.getImageData(0, 0, vw, vh).data;

  const scanX = [
    Math.floor(vw * 0.25),
    Math.floor(vw * 0.5),
    Math.floor(vw * 0.75),
  ];
  const detectedTops: number[] = [];

  for (const x of scanX) {
    for (let y = 0; y < vh / 3; y += 1) {
      const i = (y * vw + x) * 4;
      const brightness = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
      if (brightness < threshold) {
        let consistent = true;
        for (let dy = 1; dy <= 5; dy += 1) {
          const ny = y + dy;
          if (ny >= vh) break;
          const ni = (ny * vw + x) * 4;
          const b = (imgData[ni] + imgData[ni + 1] + imgData[ni + 2]) / 3;
          if (b > threshold + 10) {
            consistent = false;
            break;
          }
        }
        if (consistent) {
          detectedTops.push(y);
          break;
        }
      }
    }
  }

  const top = detectedTops.length > 0 ? Math.min(...detectedTops) : 0;

  let left = 0;
  for (let x = 0; x < vw / 5; x += 1) {
    const i = (Math.floor(vh / 2) * vw + x) * 4;
    const brightness = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
    if (brightness < threshold) {
      left = x;
      break;
    }
  }

  let right = 0;
  for (let x = vw - 1; x > vw * 0.8; x -= 1) {
    const i = (Math.floor(vh / 2) * vw + x) * 4;
    const brightness = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
    if (brightness < threshold) {
      right = vw - x - 1;
      break;
    }
  }

  return { top, left, right };
}

function getGameFrameRect(frame: HTMLCanvasElement, border: BorderRect) {
  const width = Math.max(1, frame.width - border.left - border.right);
  const height = Math.max(1, frame.height - border.top);
  return {
    x: border.left,
    y: border.top,
    width,
    height,
  };
}

function isLikelyWindowMode(frame: HTMLCanvasElement) {
  const ratio = frame.width / frame.height;
  return ratio < 1.72;
}

export function ScreenCapturePanel({
  onCaptureReady,
}: ScreenCapturePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const captureSessionRef = useRef<CaptureSessionState>({
    stream: null,
    rafId: null,
    intervalId: null,
    frameCanvas: null,
    lastSignature: null,
    lastCaptureAt: 0,
    isAutoCaptureBusy: false,
    borderCache: { top: 0, left: 0, right: 0 },
    borderFrameCount: 0,
    drawOverlay: () => undefined,
    captureFixedRoi: () => false,
  });

  const [ui, setUi] = useState<PanelUiState>({
    isSharing: false,
    status: "화면 공유를 시작해 주세요.",
  });

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    captureSessionRef.current.stream = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    setUi({ isSharing: true, status: "화면 공유 중입니다." });
  }, []);

  const setStatus = useCallback((status: string) => {
    setUi((prev) => ({ ...prev, status }));
  }, []);

  const clearLoopTimers = useCallback(() => {
    const session = captureSessionRef.current;

    if (session.rafId) {
      cancelAnimationFrame(session.rafId);
      session.rafId = null;
    }
    if (session.intervalId) {
      window.clearInterval(session.intervalId);
      session.intervalId = null;
    }
    session.isAutoCaptureBusy = false;
  }, []);

  const stopSharing = useCallback(() => {
    const session = captureSessionRef.current;
    session.stream?.getTracks().forEach((track) => track.stop());
    session.stream = null;
    const devStore = getDevCaptureStore();
    if (devStore) devStore.stream = null;

    clearLoopTimers();
    setUi({ isSharing: false, status: "화면 공유를 종료했습니다." });
  }, [clearLoopTimers]);

  const drawOverlay = useCallback(() => {
    const canvas = displayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const session = captureSessionRef.current;
    let gameRect = { x: 0, y: 0, width: canvas.width, height: canvas.height };

    if (isLikelyWindowMode(canvas)) {
      if (session.borderFrameCount++ % 20 === 0) {
        session.borderCache = detectGameBorderFromCanvas(canvas, 45);
      }
      gameRect = getGameFrameRect(canvas, session.borderCache);
    } else {
      session.borderCache = { top: 0, left: 0, right: 0 };
      session.borderFrameCount = 0;
    }

    const roi = getScanRoiPixels(
      gameRect.width,
      gameRect.height,
      DEFAULT_ROI_TUNING,
    );
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      gameRect.x + roi.traitRect.x,
      gameRect.y + roi.traitRect.y,
      roi.traitRect.width,
      roi.traitRect.height,
    );
  }, []);

  const captureFixedRoi = useCallback(
    (source: "manual" | "auto" = "manual") => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) {
        setStatus("캡처할 화면을 찾는 중입니다.");
        return false;
      }

      const session = captureSessionRef.current;
      const now = Date.now();
      if (
        source === "auto" &&
        now - session.lastCaptureAt < AUTO_CAPTURE_INTERVAL_MS
      ) {
        return false;
      }

      let frame = session.frameCanvas;
      if (!frame) {
        frame = document.createElement("canvas");
        session.frameCanvas = frame;
      }

      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      const frameCtx = frame.getContext("2d");
      if (!frameCtx) return false;

      frameCtx.drawImage(video, 0, 0, frame.width, frame.height);

      let gameRect = { x: 0, y: 0, width: frame.width, height: frame.height };
      if (isLikelyWindowMode(frame)) {
        if (session.borderFrameCount++ % 20 === 0) {
          session.borderCache = detectGameBorderFromCanvas(frame, 45);
        }
        gameRect = getGameFrameRect(frame, session.borderCache);
      } else {
        session.borderCache = { top: 0, left: 0, right: 0 };
        session.borderFrameCount = 0;
      }

      const roi = getScanRoiPixels(
        gameRect.width,
        gameRect.height,
        DEFAULT_ROI_TUNING,
      );
      const traitCanvas = cropCanvas(frame, {
        x: gameRect.x + roi.traitRect.x,
        y: gameRect.y + roi.traitRect.y,
        width: roi.traitRect.width,
        height: roi.traitRect.height,
      });

      const extracted = extractLineRegionsFromTrait(traitCanvas);
      const lineCanvases = extracted.lineCanvases;
      const previewCanvas = composeLinePreview(lineCanvases);

      const signature = lineCanvases
        .map((lineCanvas) => {
          const ctx = lineCanvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return "0";

          const { data } = ctx.getImageData(
            0,
            0,
            lineCanvas.width,
            lineCanvas.height,
          );
          let sum = 0;
          const step = Math.max(4, Math.floor(data.length / 128));
          for (let i = 0; i < data.length; i += step) {
            sum += data[i] + data[i + 1] + data[i + 2];
          }
          return String(sum);
        })
        .join("-");

      if (source === "auto" && signature === session.lastSignature) {
        return false;
      }

      onCaptureReady({
        traitCanvas,
        lineCanvases,
        previewUrl: previewCanvas.toDataURL("image/png"),
        profile: isLikelyWindowMode(frame) ? "window" : "fullscreen",
        signature,
        captureTs: now,
      });

      session.lastSignature = signature;
      session.lastCaptureAt = now;
      setStatus("자동 인식 중입니다...");
      return true;
    },
    [onCaptureReady, setStatus],
  );

  useEffect(() => {
    captureSessionRef.current.drawOverlay = drawOverlay;
  }, [drawOverlay]);

  useEffect(() => {
    captureSessionRef.current.captureFixedRoi = captureFixedRoi;
  }, [captureFixedRoi]);

  useEffect(() => {
    if (!ui.isSharing) return;

    const session = captureSessionRef.current;

    const loop = () => {
      session.drawOverlay();
      session.rafId = requestAnimationFrame(loop);
    };
    session.rafId = requestAnimationFrame(loop);

    session.intervalId = window.setInterval(() => {
      if (session.isAutoCaptureBusy) return;
      session.isAutoCaptureBusy = true;
      try {
        session.captureFixedRoi("auto");
      } finally {
        session.isAutoCaptureBusy = false;
      }
    }, AUTO_CAPTURE_INTERVAL_MS);

    return () => {
      clearLoopTimers();
    };
  }, [ui.isSharing, clearLoopTimers]);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const devStore = getDevCaptureStore();
      if (devStore) devStore.stream = stream;
      await attachStreamToVideo(stream);
    } catch (error) {
      console.error(error);
      setStatus("화면 공유 시작에 실패했습니다.");
    }
  }, [attachStreamToVideo, setStatus]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const devStore = getDevCaptureStore();
    const stream = devStore?.stream;
    if (!stream) return;

    const hasLiveTrack = stream
      .getTracks()
      .some((track) => track.readyState === "live");
    if (!hasLiveTrack) {
      if (devStore) devStore.stream = null;
      return;
    }

    void attachStreamToVideo(stream);
  }, [attachStreamToVideo]);

  useEffect(() => {
    const session = captureSessionRef.current;
    return () => {
      const stream = session.stream;
      if (process.env.NODE_ENV === "development") {
        const devStore = getDevCaptureStore();
        const hasLiveTrack = stream
          ?.getTracks()
          .some((track) => track.readyState === "live");
        if (devStore) devStore.stream = hasLiveTrack ? stream : null;
      } else {
        stream?.getTracks().forEach((track) => track.stop());
      }
      session.stream = null;
      clearLoopTimers();
    };
  }, [clearLoopTimers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>화면 공유 캡처</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={startSharing} disabled={ui.isSharing}>
            공유 시작
          </Button>
          <Button
            onClick={stopSharing}
            variant="destructive"
            disabled={!ui.isSharing}
          >
            공유 중지
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{ui.status}</p>
        <video ref={videoRef} className="hidden" muted playsInline />
        <canvas
          ref={displayCanvasRef}
          className="w-full rounded-md border bg-black"
        />
      </CardContent>
    </Card>
  );
}
