import { useEffect, useRef } from "react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

type Props = {
  onRecordingReady: (blob: Blob, durationSec: number) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
};

export default function LiveRecorder({ onRecordingReady, onRecordingStart, disabled }: Props) {
  const {
    status,
    durationSec,
    durationLabel,
    error: recorderError,
    recordedBlob,
    start,
    pause,
    resume,
    stop,
    reset,
    canPause,
  } = useAudioRecorder();

  const notifiedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (status === "stopped" && recordedBlob && notifiedBlobRef.current !== recordedBlob) {
      notifiedBlobRef.current = recordedBlob;
      onRecordingReady(recordedBlob, durationSec);
    }
    if (status === "idle") {
      notifiedBlobRef.current = null;
    }
  }, [status, recordedBlob, durationSec, onRecordingReady]);

  function handleStart() {
    onRecordingStart?.();
    void start();
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex flex-col items-center text-center">
        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
            status === "recording"
              ? "bg-red-50 ring-4 ring-red-100"
              : status === "paused"
                ? "bg-amber-50 ring-4 ring-amber-100"
                : "bg-clinical-50 ring-4 ring-clinical-100"
          }`}
          aria-hidden
        >
          {status === "recording" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20" />
          )}
          <span
            className={`relative h-10 w-10 rounded-full ${
              status === "recording"
                ? "bg-red-500"
                : status === "paused"
                  ? "bg-amber-500"
                  : "bg-clinical-600"
            }`}
          />
        </div>

        <p
          className="mt-5 font-mono text-3xl font-semibold tabular-nums text-slate-900"
          aria-live="polite"
          aria-label={`Recording duration ${durationLabel}`}
        >
          {durationLabel}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {status === "idle" && "Tap start when you're ready to record"}
          {status === "recording" && "Recording…"}
          {status === "paused" && "Paused"}
          {status === "stopped" && "Recording complete"}
        </p>
      </div>

      {recorderError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {recorderError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {status === "idle" && (
          <button
            type="button"
            className="btn-primary min-w-[140px]"
            disabled={disabled}
            onClick={handleStart}
          >
            Start recording
          </button>
        )}

        {status === "recording" && (
          <>
            {canPause && (
              <button type="button" className="btn-secondary" onClick={pause}>
                Pause
              </button>
            )}
            <button type="button" className="btn-primary" onClick={stop}>
              Stop
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button type="button" className="btn-secondary" onClick={resume}>
              Resume
            </button>
            <button type="button" className="btn-primary" onClick={stop}>
              Stop
            </button>
          </>
        )}

        {status === "stopped" && (
          <button type="button" className="btn-ghost" onClick={reset} disabled={disabled}>
            Record again
          </button>
        )}
      </div>
    </div>
  );
}
