import { useEffect, useRef } from "react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import AudioWaveform from "./AudioWaveform";

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
    analyser,
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

  const helperText =
    status === "idle"
      ? "Press start and speak clearly. Your voice levels will appear in the waveform."
      : status === "recording"
        ? "Speak naturally—we capture audio in real time."
        : status === "paused"
          ? "Recording is paused. Resume or stop when ready."
          : "Recording saved. Transcribing next…";

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80">
      <AudioWaveform analyser={analyser} status={status} />

      <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <p
            className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-slate-900"
            aria-live="polite"
            aria-label={`Recording duration ${durationLabel}`}
          >
            {durationLabel}
          </p>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{helperText}</p>
        </div>

        {recorderError && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {recorderError}
          </p>
        )}

        <div
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Recording controls"
        >
          {status === "idle" && (
            <button
              type="button"
              className="btn-primary-lg min-w-[180px]"
              disabled={disabled}
              onClick={handleStart}
            >
              <MicIcon />
              Start recording
            </button>
          )}

          {status === "recording" && (
            <>
              {canPause && (
                <button type="button" className="btn-secondary" onClick={pause} disabled={disabled}>
                  Pause
                </button>
              )}
              <button type="button" className="btn-primary min-w-[120px]" onClick={stop} disabled={disabled}>
                <StopIcon />
                Stop
              </button>
            </>
          )}

          {status === "paused" && (
            <>
              <button type="button" className="btn-secondary" onClick={resume} disabled={disabled}>
                Resume
              </button>
              <button type="button" className="btn-primary min-w-[120px]" onClick={stop} disabled={disabled}>
                <StopIcon />
                Stop
              </button>
            </>
          )}

          {status === "stopped" && (
            <button type="button" className="btn-secondary" onClick={reset} disabled={disabled}>
              Record again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V19H8v2h8v-2h-3v-1.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
