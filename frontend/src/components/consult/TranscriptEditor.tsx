type Props = {
  value: string;
  onChange: (value: string) => void;
  sourceLabel?: string;
  loading?: boolean;
  loadingMessage?: string;
  /** Shown when there is no transcript and not loading (e.g. before recording stops) */
  emptyHint?: string;
  visible?: boolean;
};

export default function TranscriptEditor({
  value,
  onChange,
  sourceLabel,
  loading = false,
  loadingMessage = "Transcribing with VALSEA…",
  emptyHint,
  visible = true,
}: Props) {
  if (!visible) return null;

  const showEmpty = !loading && !value.trim() && emptyHint;

  return (
    <section className="mt-6" aria-labelledby="transcript-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="transcript-heading" className="text-sm font-semibold text-slate-800">
          Your transcript
        </h2>
        {sourceLabel && !loading && (
          <span className="rounded-full bg-clinical-50 px-2.5 py-0.5 text-xs font-medium text-clinical-800">
            {sourceLabel}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="mt-3 flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-clinical-200 bg-clinical-50/40 px-6 py-10"
          role="status"
          aria-live="polite"
        >
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-clinical-200 border-t-clinical-700" />
          <p className="mt-4 text-sm font-medium text-clinical-900">{loadingMessage}</p>
          <p className="mt-1 text-xs text-slate-500">This may take a few seconds</p>
        </div>
      ) : showEmpty ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
          <p className="text-sm text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <textarea
          className="input-field mt-3 min-h-[180px] resize-y leading-relaxed"
          placeholder="Your transcript will appear here. You can edit it before starting your consultation."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Consultation transcript"
          aria-describedby="transcript-hint"
        />
      )}

      <p id="transcript-hint" className="mt-2 text-xs text-slate-500">
        Review and edit your transcript, then start your consultation when you&apos;re ready.
      </p>
    </section>
  );
}
