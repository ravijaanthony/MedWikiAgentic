const STAGES = [
  { id: "ingest", label: "Ingest" },
  { id: "refine", label: "Refine" },
  { id: "dispatch", label: "Dispatch" },
  { id: "specialists", label: "Specialists" },
  { id: "merge", label: "Merge" },
  { id: "integrity", label: "Integrity" },
];

type Props = {
  completedNodes: Set<string>;
  activeNode?: string;
};

export default function StageStepper({ completedNodes, activeNode }: Props) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGES.map((stage, i) => {
        const done =
          completedNodes.has(stage.id) ||
          [...completedNodes].some((n) => n === stage.id || (stage.id === "specialists" && ["vitals", "safety", "advocate", "clinical"].includes(n)));
        const active = activeNode === stage.id;
        return (
          <li
            key={stage.id}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
              done
                ? "bg-clinical-100 border-clinical-500 text-clinical-900"
                : active
                  ? "bg-white border-clinical-700 text-clinical-900 ring-2 ring-clinical-200"
                  : "bg-slate-100 border-slate-200 text-slate-500"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center text-[10px]">
              {done ? "✓" : i + 1}
            </span>
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}
