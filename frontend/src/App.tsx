import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ConsultPage from "./pages/ConsultPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ResultsPage from "./pages/ResultsPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/consult"
              element={
                <RequireAuth>
                  <ConsultPage />
                </RequireAuth>
              }
            />
            <Route
              path="/results/:runId"
              element={
                <RequireAuth>
                  <ResultsPage />
                </RequireAuth>
              }
            />
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

function AppHeader() {
  const { user, signOut, loading } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-clinical-700 text-white flex items-center justify-center text-sm font-bold">
            M
          </span>
          <div>
            <p className="font-semibold text-clinical-900 leading-tight">MedWiki</p>
            <p className="text-xs text-slate-500">Ambient Medical Intelligence</p>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user && (
            <>
              <Link to="/dashboard" className="text-slate-600 hover:text-clinical-700">
                Dashboard
              </Link>
              <Link to="/consult" className="text-slate-600 hover:text-clinical-700">
                Consult
              </Link>
              <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-slate-600 hover:text-clinical-700"
              >
                Sign out
              </button>
            </>
          )}
          {!user && !loading && (
            <>
              <Link to="/login" className="text-slate-600 hover:text-clinical-700">
                Sign in
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-lg bg-clinical-700 text-white hover:bg-clinical-900"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-slate-500">Loading…</p>;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
