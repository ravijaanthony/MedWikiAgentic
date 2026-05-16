import { useState } from "react";
import type { ConsultationState } from "../api/client";

type Props = {
  state: ConsultationState;
  onCitationClick: (citation: string) => void;
};

export default function SpecialistTabs({ state, onCitationClick }: Props) {
  const [tab, setTab] = useState<"vitals" | "safety" | "advocate" | "clinical">("safety");

  const tabs = [
    { id: "vitals" as const, label: "Vitals", count: state.vitals_findings?.length ?? 0 },
    { id: "safety" as const, label: "Safety", count: state.safety_findings?.length ?? 0 },
    { id: "advocate" as const, label: "Advocate", count: state.advocate_summary ? 1 : 0 },
    { id: "clinical" as const, label: "Clinical", count: state.clinical_note?.sections?.length ?? 0 },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden h-full flex flex-col">
      <div className="flex border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "bg-clinical-50 text-clinical-900 border-b-2 border-clinical-600" : "text-slate-500"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-xs bg-slate-200 rounded-full px-1.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="p-4 overflow-auto flex-1 text-sm">
        {tab === "vitals" &&
          (state.vitals_findings?.length ? (
            <InsightList items={state.vitals_findings} onCitationClick={onCitationClick} />
          ) : (
            <Empty label="No vitals extracted" />
          ))}
        {tab === "safety" &&
          (state.safety_findings?.length ? (
            <InsightList items={state.safety_findings} onCitationClick={onCitationClick} showSeverity />
          ) : (
            <Empty label="No safety findings" />
          ))}
        {tab === "advocate" &&
          (state.advocate_summary ? (
            <div>
              <p className="text-xs text-slate-500 mb-2">
                Dialect: {state.advocate_summary.dialect_label}
                {state.advocate_summary.source === "heuristic" && " · transcript-based fallback"}
              </p>
              {state.advocate_summary.unverified && (
                <p className="text-xs text-amber-700 mb-2">
                  Generated without LLM — summary built only from transcript excerpts.
                </p>
              )}
              <p className="text-base leading-relaxed font-medium text-clinical-900 italic border-l-4 border-clinical-500 pl-3">
                {state.advocate_summary.summary}
              </p>
              {state.advocate_summary.citations?.map((c, i) => (
                <CitationChip key={i} text={c} onClick={() => onCitationClick(c)} />
              ))}
            </div>
          ) : (
            <Empty label="Advocate summary pending" />
          ))}
        {tab === "clinical" &&
          (state.clinical_note?.sections?.length ? (
            <div className="space-y-4">
              {state.clinical_note.source === "heuristic" && (
                <p className="text-xs text-amber-700 mb-2">
                  Generated without LLM — sections extracted directly from transcript.
                </p>
              )}
              {state.clinical_note.sections.map((s) => (
                <div key={s.title}>
                  <h4 className="font-semibold text-slate-800">{s.title}</h4>
                  <p className="mt-1 text-slate-700">{s.content}</p>
                  {s.citations?.map((c, i) => (
                    <CitationChip key={i} text={c} onClick={() => onCitationClick(c)} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <Empty label="Clinical note pending" />
          ))}
      </div>
    </div>
  );
}


function InsightList({
  items,
  onCitationClick,
  showSeverity,
}: {
  items: { claim: string; verbatim_citation: string; severity?: string; unverified?: boolean }[];
  onCitationClick: (c: string) => void;
  showSeverity?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="border border-slate-100 rounded-lg p-3">
          {showSeverity && item.severity && (
            <span className="text-xs uppercase font-bold text-amber-700">{item.severity}</span>
          )}
          <p className="font-medium text-slate-800">{item.claim}</p>
          {item.unverified && (
            <p className="text-xs text-red-600 mt-1">Unverified — Doctor Review Required</p>
          )}
          <CitationChip text={item.verbatim_citation} onClick={() => onCitationClick(item.verbatim_citation)} />
        </li>
      ))}
    </ul>
  );
}

function CitationChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 block text-left text-xs text-clinical-700 bg-clinical-50 hover:bg-clinical-100 rounded px-2 py-1 truncate max-w-full"
      title={text}
    >
      “{text.slice(0, 60)}
      {text.length > 60 ? "…" : ""}”
    </button>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-slate-400">{label}</p>;
}
