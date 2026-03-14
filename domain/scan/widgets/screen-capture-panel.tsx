"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  composeLinePreview,
  extractLineRegionsFromTrait,
} from "@/domain/scan/features/ocr/model/line-extract";
import { getScanRoiPixels } from "@/domain/scan/features/capture/model/roi-presets";

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

interface CaptureSessionState {
  stream: MediaStream | null;
  rafId: number | null;
  intervalId: number | null;
  frameCanvas: HTMLCanvasElement | null;
  lastSignature: string | null;
  lastFingerprint: Uint8Array | null;
  pendingSignature: string | null;
  pendingFingerprint: Uint8Array | null;
  pendingDetectedAt: number;
  lastCaptureAt: number;
  isAutoCaptureBusy: boolean;
}

const AUTO_CAPTURE_INTERVAL_MS = 50;
const SIGNATURE_STABLE_DIFF_THRESHOLD = 10;
const SIGNATURE_CONFIRM_DIFF_THRESHOLD = 16;
const SIGNATURE_IMMEDIATE_DIFF_THRESHOLD = 24;
const SIGNATURE_CONFIRM_WINDOW_MS = 140;

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

/**
 * 고정 ROI 내부 내용 변화를 빠르게 감지하기 위한 저해상도 fingerprint.
 * OCR용 고품질 이미지가 아니라 "같은 기질인지 다른 기질인지"를 안정적으로 구분하는 용도다.
 */
function createTraitFingerprint(source: HTMLCanvasElement) {
  const sampleWidth = 32;
  const sampleHeight = 24;
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      signature: "0",
      fingerprint: new Uint8Array(),
    };
  }

  const cropX = Math.round(source.width * 0.03);
  const cropY = Math.round(source.height * 0.06);
  const cropWidth = Math.max(1, Math.round(source.width * 0.74));
  const cropHeight = Math.max(1, Math.round(source.height * 0.88));

  ctx.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  const grayscale = new Uint8Array(sampleWidth * sampleHeight);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    grayscale[p] = gray;
  }

  const hex: string[] = [];
  for (let i = 0; i < grayscale.length; i += 2) {
    const left = grayscale[i] ?? 0;
    const right = grayscale[i + 1] ?? 0;
    hex.push(
      ((Math.round(left / 32) << 4) | Math.round(right / 32))
        .toString(16)
        .padStart(2, "0"),
    );
  }

  return {
    signature: `${cropWidth}x${cropHeight}:${hex.join("")}`,
    fingerprint: grayscale,
  };
}

function getFingerprintDiff(a: Uint8Array | null, b: Uint8Array | null) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;

  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total / a.length;
}

function getTraitRect(frame: HTMLCanvasElement) {
  return getScanRoiPixels(frame.width, frame.height).traitRect;
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
    lastFingerprint: null,
    pendingSignature: null,
    pendingFingerprint: null,
    pendingDetectedAt: 0,
    lastCaptureAt: 0,
    isAutoCaptureBusy: false,
  });
  const drawOverlayRef = useRef<() => void>(() => undefined);
  const captureScanFrameRef = useRef<() => boolean>(() => false);

  const [ui, setUi] = useState<PanelUiState>({
    isSharing: false,
    status: "화면 공유를 시작해 주세요.",
  });

  const attachStreamToVideo = async (stream: MediaStream) => {
    captureSessionRef.current.stream = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    setUi({ isSharing: true, status: "화면 공유 중입니다." });
  };

  const setStatus = (status: string) => {
    setUi((prev) => ({ ...prev, status }));
  };

  const clearLoopTimers = () => {
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
  };

  const releaseSharingSession = () => {
    const session = captureSessionRef.current;
    session.stream?.getTracks().forEach((track) => track.stop());
    session.stream = null;
    clearLoopTimers();
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  };

  const stopSharing = () => {
    releaseSharingSession();
    setUi({ isSharing: false, status: "화면 공유를 종료했습니다." });
  };

  const drawOverlay = () => {
    const canvas = displayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const roi = getTraitRect(canvas);
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
  };

  const captureScanFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setStatus("캡처할 화면을 찾는 중입니다.");
      return false;
    }

    const session = captureSessionRef.current;
    const now = Date.now();
    if (now - session.lastCaptureAt < AUTO_CAPTURE_INTERVAL_MS) {
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

    const traitRect = getTraitRect(frame);
    const traitCanvas = cropCanvas(frame, traitRect);

    const { signature, fingerprint } = createTraitFingerprint(traitCanvas);

    const diff = getFingerprintDiff(fingerprint, session.lastFingerprint);
    if (
      signature === session.lastSignature ||
      diff < SIGNATURE_STABLE_DIFF_THRESHOLD
    ) {
      session.pendingSignature = null;
      session.pendingFingerprint = null;
      session.pendingDetectedAt = 0;
      return false;
    }

    const hasImmediateChange = diff >= SIGNATURE_IMMEDIATE_DIFF_THRESHOLD;
    if (!hasImmediateChange) {
      const pendingDiff = getFingerprintDiff(
        fingerprint,
        session.pendingFingerprint,
      );
      const pendingIsFresh =
        now - session.pendingDetectedAt <= SIGNATURE_CONFIRM_WINDOW_MS;
      const matchesPending =
        pendingIsFresh &&
        pendingDiff < SIGNATURE_STABLE_DIFF_THRESHOLD &&
        session.pendingSignature === signature;

      if (!matchesPending || diff < SIGNATURE_CONFIRM_DIFF_THRESHOLD) {
        session.pendingSignature = signature;
        session.pendingFingerprint = fingerprint;
        session.pendingDetectedAt = now;
        return false;
      }
    }

    session.pendingSignature = null;
    session.pendingFingerprint = null;
    session.pendingDetectedAt = 0;

    const extracted = extractLineRegionsFromTrait(traitCanvas);
    const lineCanvases = extracted.lineCanvases;
    const previewCanvas = composeLinePreview(lineCanvases);

    onCaptureReady({
      traitCanvas,
      lineCanvases,
      previewUrl: previewCanvas.toDataURL("image/png"),
      profile: "fullscreen",
      signature,
      captureTs: now,
    });

    session.lastSignature = signature;
    session.lastFingerprint = fingerprint;
    session.lastCaptureAt = now;
    setStatus("자동 인식 중입니다...");
    return true;
  };

  useEffect(() => {
    drawOverlayRef.current = drawOverlay;
    captureScanFrameRef.current = captureScanFrame;
  });

  useEffect(() => {
    if (!ui.isSharing) return;

    const session = captureSessionRef.current;

    const loop = () => {
      drawOverlayRef.current();
      session.rafId = requestAnimationFrame(loop);
    };
    session.rafId = requestAnimationFrame(loop);

    session.intervalId = window.setInterval(() => {
      if (session.isAutoCaptureBusy) return;
      session.isAutoCaptureBusy = true;
      try {
        captureScanFrameRef.current();
      } finally {
        session.isAutoCaptureBusy = false;
      }
    }, AUTO_CAPTURE_INTERVAL_MS);

    return () => {
      clearLoopTimers();
    };
  }, [ui.isSharing]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      await attachStreamToVideo(stream);
    } catch (error) {
      console.error(error);
      setStatus("화면 공유 시작에 실패했습니다.");
    }
  };

  useEffect(() => {
    const sessionRef = captureSessionRef;
    const localVideoRef = videoRef;

    return () => {
      const session = sessionRef.current;
      session.stream?.getTracks().forEach((track) => track.stop());
      session.stream = null;
      clearLoopTimers();
      const video = localVideoRef.current;
      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  return (
    <Card className="hud-panel border-primary/20">
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
        <p className="status-chip w-fit border-border/70 bg-muted/35 text-muted-foreground">
          {ui.status}
        </p>
        <video ref={videoRef} className="hidden" muted playsInline />
        <canvas
          ref={displayCanvasRef}
          className="w-full rounded-lg border border-primary/20 bg-black/90"
        />
      </CardContent>
    </Card>
  );
}
