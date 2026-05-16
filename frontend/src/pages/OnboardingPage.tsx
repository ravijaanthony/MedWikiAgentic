import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPatient, listPatients, type Patient } from "../api/client";

export default function OnboardingPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState({
    display_name: "",
    allergies: "",
    current_meds: "",
    age: "",
    sex: "",
    linguistic_signature: "Singlish",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPatients().then(setPatients).catch(() => setPatients([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const patient = await createPatient({
        display_name: form.display_name,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        current_meds: form.current_meds.split(",").map((s) => s.trim()).filter(Boolean),
        demographics: {
          age: form.age ? parseInt(form.age, 10) : null,
          sex: form.sex || null,
        },
        linguistic_signature: form.linguistic_signature,
      });
      setPatients((p) => [patient, ...p]);
      setForm({
        display_name: "",
        allergies: "",
        current_meds: "",
        age: "",
        sex: "",
        linguistic_signature: "Singlish",
      });
    } catch {
      setError("Could not create patient. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <section>
        <h1 className="text-2xl font-bold text-clinical-900">Patient onboarding</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Structured profile injected into every LangGraph consultation for safety-aware processing.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 bg-white rounded-xl border border-slate-200 p-6">
          <Field label="Display name" required>
            <input
              className="input"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </Field>
          <Field label="Allergies (comma-separated)">
            <input
              className="input"
              placeholder="penicillin, peanuts"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            />
          </Field>
          <Field label="Current medications">
            <input
              className="input"
              placeholder="Metformin 500mg, Panadol"
              value={form.current_meds}
              onChange={(e) => setForm({ ...form, current_meds: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age">
              <input
                className="input"
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </Field>
            <Field label="Sex">
              <select
                className="input"
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}
              >
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Linguistic signature">
            <select
              className="input"
              value={form.linguistic_signature}
              onChange={(e) => setForm({ ...form, linguistic_signature: e.target.value })}
            >
              <option value="Singlish">Singlish</option>
              <option value="English">English</option>
              <option value="Manglish">Manglish</option>
              <option value="Taglish">Taglish</option>
            </select>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Create patient profile"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800">Existing patients</h2>
        <ul className="mt-4 space-y-3">
          {patients.map((p) => (
            <li key={p.patient_id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium">{p.display_name}</p>
              <p className="text-xs text-slate-500 mt-1">ID: {p.patient_id.slice(0, 8)}…</p>
              <p className="text-sm mt-2">
                <span className="text-slate-500">Allergies:</span> {p.allergies.join(", ") || "none"}
              </p>
              <Link
                to={`/consult?patient=${p.patient_id}`}
                className="inline-block mt-3 text-sm text-clinical-700 font-medium hover:underline"
              >
                Start consultation →
              </Link>
            </li>
          ))}
          {!patients.length && (
            <p className="text-slate-400 text-sm">No patients yet. Demo patient seeds on API startup.</p>
          )}
        </ul>
      </section>

      <style>{`.input { @apply w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-200; }`}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
