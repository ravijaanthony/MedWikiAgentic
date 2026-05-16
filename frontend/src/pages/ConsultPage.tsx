import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMe,
  startConsultation,
  transcribeAudio,
  type Patient,
} from "../api/client";
import AudioInputPanel, { type AudioInputMethod } from "../components/consult/AudioInputPanel";
import TranscriptEditor from "../components/consult/TranscriptEditor";
import ImmersiveShell from "../components/layout/ImmersiveShell";
import { canTranscribeRecording } from "../utils/audioRecording";

const FIXTURE_HINT =
  "A quick demo visit in Singlish—including a penicillin allergy and an amoxicillin prescription—so you can see how safety alerts work.";

type CaptureMode = "audio" | "fixture";

export default function ConsultPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Patient | null>(null);
  const [mode, setMode] = useState<CaptureMode>("audio");
  const [audioMethod, setAudioMethod] = useState<AudioInputMethod>("record");
  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState<string | undefined>();
  const [transcribing, setTranscribing] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribeRequestRef = useRef(0);

  useEffect(() => {
    getMe()
      .then((p) => setProfile(p))
      .catch(() => {
        // ignore — header just won't show the trailing name
      });
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setTranscriptSource(undefined);
  }, []);

  const transcribeFromAudio = useCallback(
    async (
      source: File | Blob,
      kind: "upload" | "recording",
      opts: { filename?: string; durationSeconds?: number; allowDemoFallback?: boolean }
    ) => {
      if (kind === "recording" && opts.durationSeconds != null) {
        if (!canTranscribeRecording(source, opts.durationSeconds)) {
          setError(
            "Recording too short or silent. Speak for at least one second, then stop before transcribing."
          );
          return;
        }
      }

      const requestId = ++transcribeRequestRef.current;
      setTranscribing(true);
      setError(null);

      try {
        const result = await transcribeAudio(source, {
          filename: opts.filename,
          durationSeconds: opts.durationSeconds,
          allowDemoFallback: opts.allowDemoFallback,
        });

        if (requestId !== transcribeRequestRef.current) return;

        const text = result.transcript?.trim() ?? "";
        if (!text) {
          setError("No speech was detected in that recording. Please try again.");
          clearTranscript();
          return;
        }

        setTranscript(text);
        const via = result.source === "valsea" ? "VALSEA" : "demo transcript";
        setTranscriptSource(
          kind === "upload" ? `From upload · ${via}` : `From recording · ${via}`
        );
      } catch (err) {
        if (requestId !== transcribeRequestRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't transcribe your audio. Make sure the API is running and try again."
        );
        if (kind === "upload") setUploadFileName(null);
        clearTranscript();
      } finally {
        if (requestId === transcribeRequestRef.current) {
          setTranscribing(false);
        }
      }
    },
    [clearTranscript]
  );

  const handleUploadFile = useCallback(
    (file: File) => {
      setUploadFileName(file.name);
      void transcribeFromAudio(file, "upload", {
        filename: file.name,
        allowDemoFallback: true,
      });
    },
    [transcribeFromAudio]
  );

  const handleUploadClear = useCallback(() => {
    setUploadFileName(null);
    clearTranscript();
    transcribeRequestRef.current += 1;
    setTranscribing(false);
  }, [clearTranscript]);

  const handleRecordingStart = useCallback(() => {
    transcribeRequestRef.current += 1;
    clearTranscript();
    setError(null);
  }, [clearTranscript]);

  const handleRecordingReady = useCallback(
    (blob: Blob, durationSec: number) => {
      void transcribeFromAudio(blob, "recording", {
        filename: "recording.webm",
        durationSeconds: durationSec,
        allowDemoFallback: false,
      });
    },
    [transcribeFromAudio]
  );

  const showTranscriptSection = mode !== "fixture";
  const transcriptVisible =
    transcribing ||
    !!transcript.trim() ||
    (mode === "audio" && audioMethod === "record" && !transcribing);

  const transcriptEmptyHint =
    mode === "audio" && audioMethod === "upload"
      ? "Upload audio above to generate a transcript with VALSEA."
      : mode === "audio"
        ? "Your transcript will appear here after you stop recording. Nothing is sent until you finish."
        : undefined;

  async function handleStart() {
    if (loading || transcribing) return;

    if (mode === "fixture") {
      setLoading(true);
      setError(null);
      try {
        const { run_id } = await startConsultation({ useFixture: true });
        navigate(`/results/${run_id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to start consultation. Ensure the backend is running on port 8000."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!transcript.trim()) {
      setError("Add or generate a transcript before starting your consultation.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { run_id } = await startConsultation({
        transcriptText: transcript.trim(),
      });
      navigate(`/results/${run_id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start consultation. Ensure the backend is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: CaptureMode) {
    setMode(next);
    setError(null);
    transcribeRequestRef.current += 1;
    setTranscribing(false);
    if (next === "audio") {
      setAudioMethod("record");
      clearTranscript();
      setUploadFileName(null);
    } else if (next === "fixture") {
      clearTranscript();
      setUploadFileName(null);
    }
  }

  return (
    <ImmersiveShell
      trailing={
        profile ? (
          <span className="max-w-[140px] truncate rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/80 sm:max-w-none">
            {profile.display_name}
          </span>
        ) : undefined
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <header className="immersive-step-enter pt-4 sm:pt-8">
          <h1
            data-step-focus
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            {mode === "audio" && "Capture your visit audio"}
            {mode === "fixture" && "Try the demo visit"}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            {mode === "audio" &&
              "Record live with your microphone, or upload an existing file. We'll transcribe with VALSEA after you finish—never while you're still recording."}
            {mode === "fixture" &&
              "Experience MedWiki instantly with a sample Singlish consultation—no audio needed."}
          </p>
        </header>

        <div
          className="mt-8 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Input method"
        >
          <ModeTab active={mode === "audio"} onClick={() => switchMode("audio")}>
            Audio
          </ModeTab>
          <ModeTab active={mode === "fixture"} onClick={() => switchMode("fixture")}>
            Demo
          </ModeTab>
        </div>

        <div key={mode} className="immersive-step-enter mt-6">
          {mode === "audio" && (
            <AudioInputPanel
              disabled={transcribing || loading}
              transcribing={transcribing}
              uploadFileName={uploadFileName}
              onInputMethodChange={setAudioMethod}
              onUploadFile={handleUploadFile}
              onUploadClear={handleUploadClear}
              onRecordingStart={handleRecordingStart}
              onRecordingReady={handleRecordingReady}
            />
          )}

          {mode === "fixture" && (
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <p className="text-base leading-relaxed text-slate-700">{FIXTURE_HINT}</p>
              <p className="mt-4 text-sm text-slate-500">
                No audio or transcript needed—starts the demo pipeline immediately.
              </p>
            </div>
          )}
        </div>

        {showTranscriptSection && (
          <TranscriptEditor
            value={transcript}
            onChange={setTranscript}
            sourceLabel={transcriptSource}
            loading={transcribing}
            emptyHint={transcriptEmptyHint}
            visible={transcriptVisible}
          />
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="immersive-nav-bar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn-ghost w-full sm:w-auto"
            onClick={() => navigate("/dashboard")}
            disabled={loading || transcribing}
          >
            ← Back to dashboard
          </button>
          <button
            type="button"
            className="btn-primary-lg"
            disabled={loading || transcribing}
            onClick={handleStart}
          >
            {loading ? "Starting…" : "Start my consultation"}
          </button>
        </div>
      </div>
    </ImmersiveShell>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? "bg-clinical-700 text-white shadow-sm"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
