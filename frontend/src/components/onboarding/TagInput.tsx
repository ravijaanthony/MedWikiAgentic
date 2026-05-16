import { useId, useMemo, useState } from "react";
import { parseListField } from "./types";

type Props = {
  id?: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
};

export default function TagInput({ id: idProp, label, hint, placeholder, value, onChange, suggestions = [] }: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [draft, setDraft] = useState("");

  const tags = useMemo(() => parseListField(value), [value]);

  function commitDraft() {
    const next = draft.trim();
    if (!next) return;
    const merged = [...tags];
    if (!merged.some((t) => t.toLowerCase() === next.toLowerCase())) {
      merged.push(next);
    }
    onChange(merged.join(", "));
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag).join(", "));
  }

  function addSuggestion(s: string) {
    if (tags.some((t) => t.toLowerCase() === s.toLowerCase())) return;
    onChange([...tags, s].join(", "));
  }

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
          {label}
        </label>
      ) : null}
      {hint && <p className={`text-sm text-slate-500 ${label ? "mt-1" : ""}`}>{hint}</p>}

      <div
        className="mt-3 flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-clinical-500 focus-within:ring-4 focus-within:ring-clinical-100"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-clinical-50 px-2.5 py-1 text-sm font-medium text-clinical-900"
          >
            {tag}
            <button
              type="button"
              className="rounded-md p-0.5 text-clinical-600 hover:bg-clinical-100 hover:text-clinical-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="min-w-[120px] flex-1 border-0 bg-transparent py-1.5 text-base outline-none placeholder:text-slate-400"
          placeholder={tags.length ? "Add another…" : placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            }
            if (e.key === "Backspace" && !draft && tags.length) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          onBlur={commitDraft}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggested entries">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-200"
              onClick={() => addSuggestion(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
