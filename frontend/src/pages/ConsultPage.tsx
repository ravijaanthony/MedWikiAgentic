import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listPatients, startConsultation, type Patient } from "../api/client";
import StageStepper from "../components/StageStepper";

const FIXTURE_HINT =
  "Uses VALSEA fixture transcript (Singlish demo with penicillin allergy + amoxicillin prescription).";

export default function ConsultPage() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(search.get("patient") || "");
  const [mode, setMode] = useState<"fixture" | "text">("fixture");
  const [transcript, setTranscript] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPatients().then((list) => {
      setPatients(list);
      if (!patientId && list[0]) setPatientId(list[0].patient_id);
    });
  }, [patientId]);

  async function handleStart() {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const { run_id } = await startConsultation(patientId, {
        useFixture: mode === "fixture",
        transcriptText: mode === "text" ? transcript : undefined,
        audio: audio || undefined,
      });
      navigate(`/results/${run_id}`);
    } catch {
      setError("Failed to start consultation. Ensure backend is running on :8000");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-clinical-900">New consultation</h1>
      <p className="text-sm text-slate-600 mt-1">Ambient pipeline: VALSEA → Refine → Dispatch → Specialists → Integrity</p>

      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Patient
          <select
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <ModeButton active={mode === "fixture"} onClick={() => setMode("fixture")}>
            Demo fixture
          </ModeButton>
          <ModeButton active={mode === "text"} onClick={() => setMode("text")}>
            Paste transcript
          </ModeButton>
        </div>

        {mode === "fixture" && <p className="text-xs text-slate-500 bg-slate-50 rounded p-3">{FIXTURE_HINT}</p>}

        {mode === "text" && (
          <textarea
            className="w-full border border-slate-200 rounded-lg p-3 text-sm h-32"
            placeholder="Paste consultation transcript…"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        )}

        <label className="block text-sm text-slate-600">
          Optional audio (VALSEA)
          <input
            type="file"
            accept="audio/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setAudio(e.target.files?.[0] || null)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleStart}
          disabled={loading || !patientId}
          className="w-full py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50"
        >
          {loading ? "Starting pipeline…" : "Run consultation pipeline"}
        </button>
      </div>

      <section className="mt-8">
        <p className="text-xs text-slate-500 mb-2">Pipeline stages</p>
        <StageStepper completedNodes={new Set()} />
      </section>
    </div>
  );
}

function ModeButton({
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
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
        active ? "bg-clinical-100 border-clinical-500 text-clinical-900" : "border-slate-200 text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}
