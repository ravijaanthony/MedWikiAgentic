import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMe,
  listMyConsultations,
  upsertMe,
  type ConsultationSummary,
  type Patient,
} from "../api/client";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Patient | null>(null);
  const [history, setHistory] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function refresh(allowRetry = false) {
    setLoading(true);
    setError(null);
    try {
      let me = await getMe();
      if (!me && allowRetry) {
        // First-mount fallback: the just-completed signup may have left a
        // POST /me request in flight that hasn't reflected yet. Try once more
        // before falling through to the "Complete your profile" form.
        await new Promise((r) => setTimeout(r, 500));
        me = await getMe();
      }
      setProfile(me);
      if (me) {
        const items = await listMyConsultations(20);
        setHistory(items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(true);
  }, []);

  if (loading) {
    return <p className="text-slate-500">Loading dashboard…</p>;
  }
  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }
  if (!profile) {
    return (
      <ProfileEditor
        initial={null}
        onSaved={async () => {
          setEditing(false);
          await refresh();
        }}
        onCancel={null}
        title="Complete your profile"
      />
    );
  }

  if (editing) {
    return (
      <ProfileEditor
        initial={profile}
        onSaved={async () => {
          setEditing(false);
          await refresh();
        }}
        onCancel={() => setEditing(false)}
        title="Edit profile"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-clinical-900">{profile.display_name}</h1>
            <p className="text-xs text-slate-500 mt-1">User ID: {profile.patient_id.slice(0, 8)}…</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Age</dt>
                <dd className="text-slate-800">{profile.demographics?.age ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Sex</dt>
                <dd className="text-slate-800">{profile.demographics?.sex ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Allergies</dt>
                <dd className="text-slate-800">{profile.allergies.join(", ") || "none"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Current medications</dt>
                <dd className="text-slate-800">{profile.current_meds.join(", ") || "none"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Linguistic signature</dt>
                <dd className="text-slate-800">{profile.linguistic_signature}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Edit
            </button>
            <Link
              to="/consult"
              className="px-3 py-1.5 text-sm font-medium bg-clinical-700 text-white rounded-lg hover:bg-clinical-900 text-center"
            >
              Start consultation
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800">Consultation history</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your most recent {history.length || 0} sessions.</p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center">
            No consultations yet. Click <strong>Start consultation</strong> above to run your first one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {history.map((h) => (
              <li
                key={h.run_id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-600">
                      {h.created_at ? new Date(h.created_at).toLocaleString() : "—"}
                    </span>
                    <StatusPill status={h.status} />
                    {h.warning_count > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {h.warning_count} warning{h.warning_count === 1 ? "" : "s"}
                      </span>
                    )}
                    {h.integrity_passed === false && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        integrity issues
                      </span>
                    )}
                  </div>
                  {h.transcript_preview && (
                    <p className="text-xs text-slate-500 truncate mt-1">{h.transcript_preview}</p>
                  )}
                </div>
                <Link
                  to={`/results/${h.run_id}`}
                  className="text-sm text-clinical-700 font-medium hover:underline shrink-0"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colour =
    status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "running"
      ? "bg-blue-100 text-blue-800"
      : "bg-slate-100 text-slate-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded ${colour}`}>{status}</span>;
}

function ProfileEditor({
  initial,
  onSaved,
  onCancel,
  title,
}: {
  initial: Patient | null;
  onSaved: () => void;
  onCancel: (() => void) | null;
  title: string;
}) {
  const [form, setForm] = useState({
    display_name: initial?.display_name || "",
    allergies: initial?.allergies.join(", ") || "",
    current_meds: initial?.current_meds.join(", ") || "",
    age: initial?.demographics?.age?.toString() || "",
    sex: initial?.demographics?.sex || "",
    linguistic_signature: initial?.linguistic_signature || "Singlish",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsertMe({
        display_name: form.display_name,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        current_meds: form.current_meds.split(",").map((s) => s.trim()).filter(Boolean),
        age: form.age ? parseInt(form.age, 10) : null,
        sex: form.sex || null,
        linguistic_signature: form.linguistic_signature,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-6 space-y-4 bg-white rounded-xl border border-slate-200 p-6"
    >
      <h1 className="text-xl font-semibold text-clinical-900">{title}</h1>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Display name *</span>
        <input
          required
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Allergies</span>
        <input
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="penicillin, peanuts"
          value={form.allergies}
          onChange={(e) => setForm({ ...form, allergies: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Current medications</span>
        <input
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Metformin 500mg"
          value={form.current_meds}
          onChange={(e) => setForm({ ...form, current_meds: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Age</span>
          <input
            type="number"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Sex</span>
          <select
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value })}
          >
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Linguistic signature</span>
        <select
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          value={form.linguistic_signature}
          onChange={(e) => setForm({ ...form, linguistic_signature: e.target.value })}
        >
          <option value="Singlish">Singlish</option>
          <option value="English">English</option>
          <option value="Manglish">Manglish</option>
          <option value="Taglish">Taglish</option>
        </select>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-clinical-700 text-white text-sm font-medium hover:bg-clinical-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
