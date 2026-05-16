import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ConsultPage from "./pages/ConsultPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import ResultsPage from "./pages/ResultsPage";

function HeaderAuth() {
  const { user, loading, configured, signOut } = useAuth();

  if (!configured || loading) return null;

  if (!user) {
    return (
      <Link to="/login" className="text-slate-600 hover:text-clinical-700">
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="text-slate-600 hover:text-clinical-700"
    >
      Sign out
    </button>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-clinical-700 text-white flex items-center justify-center text-sm font-bold">
              M
            </span>
            <div>
              <p className="font-semibold text-clinical-900 leading-tight">MedWiki</p>
              <p className="text-xs text-slate-500">Ambient Medical Intelligence</p>
            </div>
          </Link>
          <nav className="flex gap-4 text-sm items-center">
            <Link to="/onboarding" className="text-slate-600 hover:text-clinical-700">
              Onboarding
            </Link>
            <Link to="/consult" className="text-slate-600 hover:text-clinical-700">
              Consult
            </Link>
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/consult" element={<ConsultPage />} />
          <Route path="/results/:runId" element={<ResultsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </main>
    </div>
  );
}
