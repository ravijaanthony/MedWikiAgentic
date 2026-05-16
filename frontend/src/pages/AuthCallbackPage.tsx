import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { upsertMe } from "../api/client";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Profile setup modal shown after Google SSO for new signups
// ---------------------------------------------------------------------------

type ProfileForm = {
  display_name: string;
  allergies: string;
  current_meds: string;
  age: string;
  sex: string;
  linguistic_signature: string;
};

function ProfileSetupModal({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<ProfileForm>({
    display_name: "",
    allergies: "",
    current_meds: "",
    age: "",
    sex: "",
    linguistic_signature: "Singlish",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    console.info("[SSO] Saving profile after Google signup");
    try {
      await upsertMe({
        display_name: form.display_name,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        current_meds: form.current_meds.split(",").map((s) => s.trim()).filter(Boolean),
        age: form.age ? parseInt(form.age, 10) : null,
        sex: form.sex || null,
        linguistic_signature: form.linguistic_signature,
      });
      console.info("[SSO] Profile saved successfully — redirecting to dashboard");
      onDone();
    } catch (err) {
      console.error("[SSO] Profile save failed after Google signup:", err);
      setError(
        `Profile save failed (${err instanceof Error ? err.message : String(err)}). ` +
          "You can finish this from the dashboard."
      );
      setSaving(false);
    }
  }

  return (
    /* backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* header */}
        <div className="bg-clinical-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Complete your profile</h2>
          <p className="text-sm text-clinical-100 mt-0.5">
            Help us personalise every consultation for you.
          </p>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Display name" required>
            <input
              ref={firstInputRef}
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
                min={0}
                max={150}
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

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50 transition"
            >
              {saving ? "Saving…" : "Save & continue"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onDone}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Skip
            </button>
          </div>
        </form>
      </div>

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

// ---------------------------------------------------------------------------
// Callback page
// ---------------------------------------------------------------------------

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in…");
  const [showProfileModal, setShowProfileModal] = useState(false);

  function toDashboard() {
    navigate("/dashboard", { replace: true });
  }

  useEffect(() => {
    let cancelled = false;

    console.info("[SSO] AuthCallbackPage mounted — waiting for session from Supabase");

    const finish = () => {
      if (cancelled) return;
      const isNewSignup = localStorage.getItem("medwiki_sso_new_signup") === "1";
      console.info(`[SSO] Session established — isNewSignup=${isNewSignup}`);
      if (isNewSignup) {
        localStorage.removeItem("medwiki_sso_new_signup");
        setShowProfileModal(true);
      } else {
        toDashboard();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.info(`[SSO] onAuthStateChange — event=${event} hasSession=${!!session}`);
      if (session) finish();
    });

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("[SSO] getSession error:", error);
        setMessage(error.message);
        return;
      }
      console.info(`[SSO] getSession result — hasSession=${!!session}`);
      if (session) finish();
    });

    const t = window.setTimeout(() => {
      if (!cancelled) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!cancelled && !session) {
            console.error(
              "[SSO] Timeout: no session after 15 s. " +
                "Likely causes: redirect URL not whitelisted in Supabase, " +
                "Google provider not enabled, or OAuth credentials misconfigured."
            );
            setMessage("Could not complete sign-in. Return to the login page and try again.");
          }
        });
      }
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {showProfileModal && <ProfileSetupModal onDone={toDashboard} />}

      <div className="max-w-md mx-auto text-center">
        {!showProfileModal && <p className="text-slate-700">{message}</p>}
        <p className="mt-6 text-sm">
          <Link to="/login" className="text-clinical-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </>
  );
}
