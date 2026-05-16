import { useMemo } from "react";

type Props = {
  transcript: string;
  highlight?: string | null;
};

export default function TranscriptPanel({ transcript, highlight }: Props) {
  const parts = useMemo(() => {
    if (!highlight || !transcript.includes(highlight)) {
      return [{ text: transcript, mark: false }];
    }
    const idx = transcript.indexOf(highlight);
    return [
      { text: transcript.slice(0, idx), mark: false },
      { text: highlight, mark: true },
      { text: transcript.slice(idx + highlight.length), mark: false },
    ];
  }, [transcript, highlight]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 h-full overflow-auto">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Ground-truth transcript</h3>
      <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.mark ? (
            <mark key={i} className="citation-highlight">
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    </div>
  );
}
