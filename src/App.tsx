import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { api } from "./lib/api";
import { ToastProvider } from "./components/ui";
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
  if (loading)
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" style={{ width: "70%" }} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Topbar() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("reprokit-theme") || "light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("reprokit-theme", theme);
  }, [theme]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const { pathname } = useLocation();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  return (
    <header className={`topbar${scrolled ? " scrolled" : ""}`}>
      <div className="topbar-inner">
        <Link className="logo" to="/">
          <span className="logo-mark" aria-hidden="true">
            R
          </span>
          ReproKit
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
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </nav>
        <button
          className="btn btn-sm nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          Menu
        </button>
      </div>
      {menuOpen ? (
        <nav className="mobile-nav" aria-label="Mobile">
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
        </nav>
      ) : null}
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
      <ToastProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ScrollToTop />
        <Topbar />
        <div id="main">
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
        </div>
        <footer className="footer">
          <div className="container footer-grid">
            <div>
              <strong>ReproKit</strong> — Turn confusing problems into clear, actionable reports.
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                Free forever. No tracking. Private by default.
              </p>
            </div>
            <div>
              <strong>Product</strong>
              <div className="footer-links">
                <Link to="/app">Dashboard</Link>
                <Link to="/#features">Features</Link>
                <Link to="/#how">How it works</Link>
              </div>
            </div>
            <div>
              <strong>Company</strong>
              <div className="footer-links">
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
                <Link to="/help">Help</Link>
              </div>
            </div>
            <div>
              <strong>Status</strong>
              <div className="footer-links">
                <span className="small muted">Deployed on Cloudflare Pages.</span>
              </div>
            </div>
          </div>
        </footer>
      </ToastProvider>
    </AuthProvider>
  );
}
