import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMessage("Supabase is not configured.");
      return;
    }

    const supabase = getSupabase();
    let cancelled = false;

    const finish = () => {
      if (!cancelled) navigate("/", { replace: true });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      if (session) finish();
    });

    const t = window.setTimeout(() => {
      if (!cancelled) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!cancelled && !session) {
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
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto text-center">
      <p className="text-slate-700">{message}</p>
      <p className="mt-6 text-sm">
        <Link to="/login" className="text-clinical-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
