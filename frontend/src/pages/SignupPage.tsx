import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { upsertMe } from "../api/client";
import { useAuth } from "../auth/AuthContext";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await signUp(form.email, form.password);
      if (!session) {
        setError(
          "Account created — check your inbox to confirm. Once confirmed, sign in to finish setup."
        );
        return;
      }
      await upsertMe({
        display_name: form.display_name,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        current_meds: form.current_meds.split(",").map((s) => s.trim()).filter(Boolean),
        age: form.age ? parseInt(form.age, 10) : null,
        sex: form.sex || null,
        linguistic_signature: form.linguistic_signature,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
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

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-clinical-700 text-white font-medium hover:bg-clinical-900 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
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
