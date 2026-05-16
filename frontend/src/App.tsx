import { Link, Route, Routes, useLocation } from "react-router-dom";
import ConsultPage from "./pages/ConsultPage";
import OnboardingPage from "./pages/OnboardingPage";
import ResultsPage from "./pages/ResultsPage";

const IMMERSIVE_PATHS = new Set(["/", "/onboarding", "/consult"]);

function isImmersivePath(pathname: string) {
  return IMMERSIVE_PATHS.has(pathname);
}

export default function App() {
  const { pathname } = useLocation();
  const immersive = isImmersivePath(pathname);

  return (
    <div className="min-h-dvh">
      {!immersive && (
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-700 text-sm font-bold text-white">
                M
              </span>
              <div>
                <p className="font-semibold leading-tight text-clinical-900">MedWiki</p>
                <p className="text-xs text-slate-500">Ambient Medical Intelligence</p>
              </div>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/onboarding" className="text-slate-600 hover:text-clinical-700">
                Onboarding
              </Link>
              <Link to="/consult" className="text-slate-600 hover:text-clinical-700">
                Consult
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className={immersive ? "" : "mx-auto max-w-6xl px-4 py-8"}>
        <Routes>
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/consult" element={<ConsultPage />} />
          <Route path="/results/:runId" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  );
}
