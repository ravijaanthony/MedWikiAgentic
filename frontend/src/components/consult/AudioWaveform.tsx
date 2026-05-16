import { useRef } from "react";
import type { RecorderStatus } from "../../hooks/useAudioRecorder";
import { useAudioAnalyserCanvas } from "../../hooks/useAudioAnalyser";

type Props = {
  analyser: AnalyserNode | null;
  status: RecorderStatus;
};

export default function AudioWaveform({ analyser, status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useAudioAnalyserCanvas(canvasRef, analyser, {
    active: status !== "idle",
    paused: status === "paused",
    status,
  });

  const statusLabel =
    status === "idle"
      ? "Ready to record"
      : status === "recording"
        ? "Listening"
        : status === "paused"
          ? "Paused"
          : "Complete";

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="h-44 w-full rounded-2xl border border-clinical-200/80 bg-clinical-50/30 shadow-inner sm:h-48"
        role="img"
        aria-label={`Recording timeline waveform, ${statusLabel}`}
      />
      <div className="pointer-events-none absolute left-4 top-4">
        <StatusPill status={status} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RecorderStatus }) {
  const config = {
    idle: { label: "Ready", className: "bg-white/90 text-slate-600 ring-slate-200" },
    recording: { label: "Recording", className: "bg-white/90 text-red-800 ring-red-200" },
    paused: { label: "Paused", className: "bg-white/90 text-amber-900 ring-amber-200" },
    stopped: { label: "Done", className: "bg-white/90 text-clinical-800 ring-clinical-200" },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 backdrop-blur-sm ${config.className}`}
    >
      {(status === "recording" || status === "paused") && (
        <span
          className={`h-2 w-2 rounded-full ${
            status === "recording" ? "animate-pulse bg-red-500" : "bg-amber-500"
          }`}
          aria-hidden
        />
      )}
      {config.label}
    </span>
  );
}
