import { useRef, useState } from "react";

type Props = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  fileName?: string | null;
  onClear?: () => void;
};

export default function AudioUploadZone({ onFileSelected, disabled, fileName, onClear }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file?.type.startsWith("audio/")) return;
    onFileSelected(file);
  }

  return (
    <div
      className={`flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragOver
          ? "border-clinical-500 bg-clinical-50/50"
          : fileName
            ? "border-clinical-400 bg-clinical-50/30"
            : "border-slate-200 bg-white shadow-card"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {fileName ? (
        <>
          <p className="text-lg font-semibold text-slate-900">{fileName}</p>
          <p className="mt-1 text-sm text-slate-500">Processing with VALSEA…</p>
          {onClear && (
            <button type="button" className="btn-ghost mt-4" onClick={onClear} disabled={disabled}>
              Choose a different file
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-4xl" aria-hidden>
            📁
          </p>
          <p className="mt-4 text-base font-medium text-slate-800">Drop audio here or browse</p>
          <p className="mt-1 text-sm text-slate-500">WAV, MP3, M4A, WebM — transcribed via VALSEA</p>
          <button
            type="button"
            className="btn-secondary mt-6"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </button>
        </>
      )}
    </div>
  );
}
