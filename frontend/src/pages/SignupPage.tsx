import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { upsertMe } from "../api/client";
import { useAuth } from "../auth/AuthContext";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

type Stage = "idle" | "creating-account" | "saving-profile" | "done";

const EMAIL_CONFIRM_HINT =
  "Account created, but Supabase didn't return a session — Email Confirmation is " +
  "probably enabled. Disable it in Supabase Dashboard -> Authentication -> Settings -> " +
  "Confirm email, then click 'Create account' again. (Existing email confirmations don't " +
  "need to be re-sent — the user record already exists.)";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useAuth();
  const [oauthBusy, setOauthBusy] = useState(false);
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

  async function handleGoogle() {
    setOauthBusy(true);
    setError(null);
    try {
      localStorage.setItem("medwiki_sso_new_signup", "1");
      await signInWithOAuth("google");
      // If we reach here the browser is being redirected — no further action needed.
    } catch (err) {
      console.error("[SSO] Signup page — Google OAuth initiation failed:", err);
      localStorage.removeItem("medwiki_sso_new_signup");
      setError(err instanceof Error ? err.message : "Google sign-up failed");
      setOauthBusy(false);
    }
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
          disabled={busy || oauthBusy}
          className="w-full py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50"
        >
          {stage === "creating-account"
            ? "Creating account…"
            : stage === "saving-profile"
            ? "Saving profile…"
            : "Create account"}
        </button>

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <hr className="flex-1 border-slate-200" />
        </div>

        <button
          type="button"
          disabled={oauthBusy || busy}
          onClick={() => void handleGoogle()}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-clinical-400 hover:ring-1 hover:ring-clinical-400 disabled:opacity-50 disabled:pointer-events-none transition"
        >
          <GoogleIcon />
          {oauthBusy ? "Redirecting…" : "Sign up with Google"}
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
