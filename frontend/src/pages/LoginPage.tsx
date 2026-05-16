import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, loading, configured, signInWithOAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-clinical-900">Sign in</h1>
        <p className="mt-3 text-slate-600 text-sm">
          Set <code className="text-xs bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">.env</code>, then restart the dev server.
        </p>
        <p className="mt-4 text-sm">
          <Link to="/" className="text-clinical-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    );
  }

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithOAuth("google");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-clinical-900">Sign in</h1>
      <p className="text-slate-600 mt-1 text-sm">Continue with your Google account (Supabase Google provider must be enabled).</p>

      <div className="mt-8">
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void handleGoogle()}
          className="w-full flex flex-col items-start rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-clinical-500 hover:ring-1 hover:ring-clinical-500 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="font-semibold text-clinical-900">{busy ? "Redirecting…" : "Continue with Google"}</span>
          <span className="text-slate-500 text-xs mt-0.5">Sign in with your Google account</span>
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-8 text-sm text-slate-600">
        <Link to="/" className="text-clinical-700 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
