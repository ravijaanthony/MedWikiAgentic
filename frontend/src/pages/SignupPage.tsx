import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { upsertMe } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Stage = "idle" | "creating-account" | "saving-profile" | "done";

const EMAIL_CONFIRM_HINT =
  "Account created, but Supabase didn't return a session — Email Confirmation is " +
  "probably enabled. Disable it in Supabase Dashboard -> Authentication -> Settings -> " +
  "Confirm email, then click 'Create account' again. (Existing email confirmations don't " +
  "need to be re-sent — the user record already exists.)";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
    allergies: "",
    current_meds: "",
    age: "",
    sex: "",
    linguistic_signature: "Singlish",
  });
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const busy = stage === "creating-account" || stage === "saving-profile";

  function profilePayload() {
    return {
      display_name: form.display_name,
      allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
      current_meds: form.current_meds.split(",").map((s) => s.trim()).filter(Boolean),
      age: form.age ? parseInt(form.age, 10) : null,
      sex: form.sex || null,
      linguistic_signature: form.linguistic_signature,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);

    setStage("creating-account");
    let session;
    try {
      session = await signUp(form.email, form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
      setStage("idle");
      return;
    }

    if (!session) {
      // Email confirmation enabled in Supabase — auth user exists but no session
      // means we cannot call POST /me yet. Stop here with explicit instructions.
      setError(EMAIL_CONFIRM_HINT);
      setStage("idle");
      return;
    }

    setStage("saving-profile");
    try {
      await upsertMe(profilePayload());
    } catch (err) {
      // Auth user is created and we have a session; profile save failed. Send
      // the user to the dashboard, where the profile editor renders as the
      // recovery path. They keep their session so re-saving Just Works.
      setWarning(
        `Profile save failed (${err instanceof Error ? err.message : String(err)}). ` +
          `Continuing to the dashboard — finish your profile there.`
      );
    }

    setStage("done");
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold text-clinical-900">Create your account</h1>
      <p className="text-sm text-slate-600 mt-1">
        Your profile is bundled into every consultation for safety-aware processing.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 bg-white rounded-xl border border-slate-200 p-6"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Password" required>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Display name" required>
          <input
            className="input"
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
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
            placeholder="Metformin 500mg"
            value={form.current_meds}
            onChange={(e) => setForm({ ...form, current_meds: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
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

        {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}
        {warning && <p className="text-sm text-amber-700 whitespace-pre-line">{warning}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50"
        >
          {stage === "creating-account"
            ? "Creating account…"
            : stage === "saving-profile"
            ? "Saving profile…"
            : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-clinical-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <style>{`.input { @apply w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-200; }`}</style>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
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
