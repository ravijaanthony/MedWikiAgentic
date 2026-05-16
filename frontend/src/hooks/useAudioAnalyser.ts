import { useEffect, useRef } from "react";

const MAX_SAMPLES = 2048;
const IDLE_WAVE_POINTS = 120;

type VisualStatus = "idle" | "recording" | "paused" | "stopped";

/**
 * Scrolling time-domain waveform driven by AnalyserNode (no React re-renders per frame).
 * X-axis = recording timeline; Y-axis = smoothed amplitude at each moment.
 */
export function useAudioAnalyserCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  analyser: AnalyserNode | null,
  options: { active: boolean; paused: boolean; status: VisualStatus }
) {
  const rafRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const smoothedRef = useRef(0);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const prevStatusRef = useRef<VisualStatus>("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const resetTimeline = () => {
      samplesRef.current = [];
      smoothedRef.current = 0;
    };

    const readAmplitude = (): number => {
      if (!analyser) return 0;
      if (!timeDataRef.current || timeDataRef.current.length !== analyser.fftSize) {
        timeDataRef.current = new Uint8Array(analyser.fftSize);
      }
      analyser.getByteTimeDomainData(timeDataRef.current as Uint8Array<ArrayBuffer>);

      let sumSq = 0;
      let peak = 0;
      const data = timeDataRef.current;
      for (let i = 0; i < data.length; i++) {
        const n = (data[i] - 128) / 128;
        sumSq += n * n;
        const abs = Math.abs(n);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSq / data.length);
      const blended = rms * 0.65 + peak * 0.35;
      return Math.min(1, Math.pow(blended * 2.8, 0.72));
    };

    const appendSample = (value: number, cap: number) => {
      const samples = samplesRef.current;
      if (samples.length < cap) {
        samples.push(value);
      } else {
        samples.shift();
        samples.push(value);
      }
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;

      const prev = prevStatusRef.current;
      if (options.status === "recording" && (prev === "idle" || prev === "stopped")) {
        resetTimeline();
      }
      if (options.status === "idle" && prev !== "idle") {
        resetTimeline();
      }
      prevStatusRef.current = options.status;

      const cap = Math.min(MAX_SAMPLES, Math.max(64, Math.ceil(w)));
      const centerY = h / 2;
      const maxHalf = (h / 2) * 0.92;

      if (options.status === "idle") {
        const t = performance.now() * 0.001;
        samplesRef.current = Array.from({ length: IDLE_WAVE_POINTS }, (_, i) => {
          const phase = (i / IDLE_WAVE_POINTS) * Math.PI * 4 + t * 1.2;
          return 0.04 + Math.sin(phase) * 0.025;
        });
      } else if (
        analyser &&
        options.active &&
        !options.paused &&
        options.status === "recording"
      ) {
        const raw = readAmplitude();
        smoothedRef.current = smoothedRef.current * 0.42 + raw * 0.58;
        const level =
          smoothedRef.current < 0.012 ? smoothedRef.current * 0.3 : smoothedRef.current;
        appendSample(level, cap);
      }

      const samples = samplesRef.current;
      const drawWidth =
        options.status === "idle"
          ? w
          : samples.length >= cap
            ? w
            : Math.max(2, (samples.length / cap) * w);

      paintBackground(ctx, w, h);
      drawTimelineWaveform(ctx, w, h, centerY, maxHalf, samples, drawWidth, options.status);

      if (options.status === "recording" && !options.paused && samples.length > 0) {
        const last = samples[samples.length - 1] ?? 0;
        const progressX = samples.length >= cap ? w - 2 : Math.max(2, drawWidth - 1);
        drawPlayhead(ctx, progressX, centerY, maxHalf, last);
      }
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      draw();
    } else {
      paintBackground(ctx, canvas.clientWidth, canvas.clientHeight);
      const rw = canvas.clientWidth;
      const rh = canvas.clientHeight;
      drawTimelineWaveform(
        ctx,
        rw,
        rh,
        rh / 2,
        (rh / 2) * 0.92,
        options.status === "idle" ? [] : samplesRef.current,
        rw,
        options.status
      );
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser, options.active, options.paused, options.status, canvasRef]);
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#eef4fb");
  bg.addColorStop(1, "#f8fafc");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(26, 69, 120, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

function sampleAt(samples: number[], x: number, drawWidth: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0];
  const t = (x / Math.max(drawWidth - 1, 1)) * (samples.length - 1);
  const idx = Math.floor(t);
  const frac = t - idx;
  const a = samples[idx] ?? 0;
  const b = samples[Math.min(idx + 1, samples.length - 1)] ?? a;
  return a + (b - a) * frac;
}

function drawTimelineWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerY: number,
  maxHalf: number,
  samples: number[],
  drawWidth: number,
  status: VisualStatus
) {
  if (samples.length === 0) return;

  const drawTo = status === "idle" ? w : Math.min(w, drawWidth);
  if (drawTo <= 0) return;

  const topPath: { x: number; y: number }[] = [];
  const step = Math.max(1, drawTo / Math.min(samples.length, Math.ceil(drawTo)));
  const pixelStep = Math.max(1, Math.floor(step));

  for (let x = 0; x <= drawTo; x += pixelStep) {
    const level = Math.min(1, sampleAt(samples, x, drawTo));
    const half = Math.max(1.5, level * maxHalf);
    topPath.push({ x, y: centerY - half });
  }
  if (topPath.length === 0) return;
  const last = topPath[topPath.length - 1];
  if (last.x < drawTo) {
    const level = Math.min(1, sampleAt(samples, drawTo, drawTo));
    topPath.push({ x: drawTo, y: centerY - Math.max(1.5, level * maxHalf) });
  }

  ctx.beginPath();
  ctx.moveTo(0, centerY);
  for (const p of topPath) {
    ctx.lineTo(p.x, p.y);
  }
  for (let i = topPath.length - 1; i >= 0; i--) {
    const level = Math.min(1, sampleAt(samples, topPath[i].x, drawTo));
    const half = Math.max(1.5, level * maxHalf);
    ctx.lineTo(topPath[i].x, centerY + half);
  }
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, centerY - maxHalf, 0, centerY + maxHalf);
  if (status === "paused") {
    gradient.addColorStop(0, "rgba(251, 191, 36, 0.55)");
    gradient.addColorStop(0.5, "rgba(217, 119, 6, 0.75)");
    gradient.addColorStop(1, "rgba(251, 191, 36, 0.55)");
  } else if (status === "stopped") {
    gradient.addColorStop(0, "rgba(77, 133, 196, 0.45)");
    gradient.addColorStop(0.5, "rgba(26, 69, 120, 0.85)");
    gradient.addColorStop(1, "rgba(77, 133, 196, 0.45)");
  } else if (status === "idle") {
    gradient.addColorStop(0, "rgba(179, 204, 232, 0.35)");
    gradient.addColorStop(0.5, "rgba(122, 168, 214, 0.5)");
    gradient.addColorStop(1, "rgba(179, 204, 232, 0.35)");
  } else {
    gradient.addColorStop(0, "rgba(77, 133, 196, 0.5)");
    gradient.addColorStop(0.45, "rgba(26, 69, 120, 0.9)");
    gradient.addColorStop(1, "rgba(77, 133, 196, 0.5)");
  }
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle =
    status === "recording"
      ? "rgba(26, 69, 120, 0.35)"
      : status === "paused"
        ? "rgba(217, 119, 6, 0.4)"
        : "rgba(26, 69, 120, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < topPath.length; i++) {
    const p = topPath[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  maxHalf: number,
  level: number
) {
  const half = Math.max(4, level * maxHalf);
  ctx.strokeStyle = "rgba(26, 69, 120, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, centerY - half - 4);
  ctx.lineTo(x, centerY + half + 4);
  ctx.stroke();

  ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
  ctx.beginPath();
  ctx.arc(x, centerY - half - 8, 4, 0, Math.PI * 2);
  ctx.fill();
}
