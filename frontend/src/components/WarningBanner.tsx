import type { Warning } from "../api/client";

type Props = {
  warnings: Warning[];
  onDismiss: (code: string) => void;
};

export default function WarningBanner({ warnings, onDismiss }: Props) {
  const active = warnings.filter((w) => !w.dismissed);
  if (!active.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {active.map((w, index) => (
        <div
          key={`${w.code}-${index}-${w.message.slice(0, 32)}`}
          className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
            w.severity === "critical"
              ? "bg-amber-50 border-amber-300 text-amber-950"
              : "bg-yellow-50 border-yellow-200 text-yellow-900"
          }`}
        >
          <div>
            <p className="font-semibold text-sm">Doctor review required</p>
            <p className="text-sm mt-0.5">{w.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(w.code)}
            className="shrink-0 text-xs font-medium underline hover:no-underline"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
