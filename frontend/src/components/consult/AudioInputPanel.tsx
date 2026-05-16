import { useId, useState } from "react";
import AudioUploadZone from "./AudioUploadZone";
import LiveRecorder from "./LiveRecorder";

export type AudioInputMethod = "record" | "upload";

type Props = {
  disabled?: boolean;
  transcribing?: boolean;
  uploadFileName?: string | null;
  onInputMethodChange?: (method: AudioInputMethod) => void;
  onUploadFile: (file: File) => void;
  onUploadClear: () => void;
  onRecordingStart: () => void;
  onRecordingReady: (blob: Blob, durationSec: number) => void;
};

export default function AudioInputPanel({
  disabled,
  transcribing,
  uploadFileName,
  onInputMethodChange,
  onUploadFile,
  onUploadClear,
  onRecordingStart,
  onRecordingReady,
}: Props) {
  const [method, setMethod] = useState<AudioInputMethod>("record");
  const groupId = useId();

  function selectMethod(next: AudioInputMethod) {
    if (next === method) return;
    setMethod(next);
    onInputMethodChange?.(next);
  }

  return (
    <section
      className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80"
      aria-labelledby={`${groupId}-label`}
    >
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <p id={`${groupId}-label`} className="sr-only">
          Choose how to provide visit audio
        </p>
        <div
          className="mx-auto flex max-w-md rounded-xl bg-slate-100/90 p-1"
          role="tablist"
          aria-label="Audio input method"
        >
          <MethodTab
            active={method === "record"}
            onClick={() => selectMethod("record")}
            id={`${groupId}-record`}
            controls={`${groupId}-record-panel`}
          >
            Record live
          </MethodTab>
          <MethodTab
            active={method === "upload"}
            onClick={() => selectMethod("upload")}
            id={`${groupId}-upload`}
            controls={`${groupId}-upload-panel`}
          >
            Upload file
          </MethodTab>
        </div>
        {method === "record" ? (
          <p className="mt-3 text-center text-sm text-slate-500">
            Capture the visit with your microphone—the default way to add audio.
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-slate-500">
            Already have a recording? Upload it here instead.
          </p>
        )}
      </div>

      <div
        id={method === "record" ? `${groupId}-record-panel` : `${groupId}-upload-panel`}
        role="tabpanel"
        aria-labelledby={method === "record" ? `${groupId}-record` : `${groupId}-upload`}
      >
        {method === "record" ? (
          <>
            <LiveRecorder
              embedded
              disabled={disabled}
              onRecordingStart={onRecordingStart}
              onRecordingReady={onRecordingReady}
            />
            <p className="border-t border-slate-100 px-4 py-3 text-center sm:px-6">
              <button
                type="button"
                className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-clinical-700 hover:underline"
                onClick={() => selectMethod("upload")}
                disabled={disabled}
              >
                Upload an audio file instead
              </button>
            </p>
          </>
        ) : (
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <AudioUploadZone
              embedded
              disabled={disabled}
              fileName={uploadFileName}
              onFileSelected={onUploadFile}
              onClear={onUploadClear}
            />
            <p className="mt-4 text-center">
              <button
                type="button"
                className="text-sm font-medium text-clinical-700 underline-offset-2 hover:text-clinical-800 hover:underline"
                onClick={() => selectMethod("record")}
                disabled={disabled}
              >
                Record with microphone instead
              </button>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MethodTab({
  active,
  onClick,
  children,
  id,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  id: string;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "bg-white text-clinical-800 shadow-sm ring-1 ring-slate-200/80"
          : "text-slate-600 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
