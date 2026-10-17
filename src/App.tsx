import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { api } from "./lib/api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ReportEditor from "./pages/ReportEditor";
import ReportView from "./pages/ReportView";
import ShareView from "./pages/ShareView";
import Settings from "./pages/Settings";
import Workspaces from "./pages/Workspaces";
import InviteAccept from "./pages/InviteAccept";
import { Privacy, Terms, Help } from "./pages/Static";
import NotFound from "./pages/NotFound";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Topbar() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("reprokit-theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("reprokit-theme", theme);
  }, [theme]);
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="logo" to="/">
          <span className="logo-mark">R</span> ReproKit
        </Link>
        <nav className="topbar-nav" aria-label="Main">
          <Link to="/#how">How it works</Link>
          <Link to="/#features">Features</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/help">Help</Link>
          {user ? (
            <>
              <Link to="/app">Dashboard</Link>
              <Link to="/app/settings">Settings</Link>
              <button className="btn btn-sm" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link className="btn btn-primary btn-sm" to="/register">
                Create a report
              </Link>
            </>
          )}
          <button
            className="btn btn-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </nav>
      </div>
    </header>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  // Warm the session on load (AuthProvider does this too; harmless).
  useEffect(() => {
    api.me().catch(() => {});
  }, []);
  return (
    <AuthProvider>
      <ScrollToTop />
      <Topbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/invite/:code" element={<InviteAccept />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/help" element={<Help />} />
        <Route
          path="/app"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/app/reports/new"
          element={
            <Protected>
              <ReportEditor />
            </Protected>
          }
        />
        <Route
          path="/app/reports/:id"
          element={
            <Protected>
              <ReportView />
            </Protected>
          }
        />
        <Route
          path="/app/reports/:id/edit"
          element={
            <Protected>
              <ReportEditor />
            </Protected>
          }
        />
        <Route
          path="/app/settings"
          element={
            <Protected>
              <Settings />
            </Protected>
          }
        />
        <Route
          path="/app/workspaces"
          element={
            <Protected>
              <Workspaces />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="footer">
        <div className="container">
          <strong>ReproKit</strong> — Turn confusing problems into clear, actionable reports.
          <div className="footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/help">Help</Link>
            <Link to="/app">Dashboard</Link>
          </div>
        </div>
      </footer>
    </AuthProvider>
  );
}
