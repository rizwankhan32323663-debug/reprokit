import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth";
import { ToastProvider } from "./components/ui";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import ReportEditor from "./pages/ReportEditor";
import ReportView from "./pages/ReportView";
import ShareView from "./pages/ShareView";
import Settings from "./pages/Settings";
import Workspaces from "./pages/Workspaces";
import InviteAccept from "./pages/InviteAccept";
import { Privacy, Terms, Help } from "./pages/Static";
import NotFound from "./pages/NotFound";

function Topbar() {
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
  const navLinks = (
    <>
      <Link to="/#how">How it works</Link>
      <Link to="/#features">Features</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/help">Help</Link>
      <Link to="/app">Dashboard</Link>
      <Link to="/app/settings">Settings</Link>
      <Link className="btn btn-primary btn-sm" to="/app/reports/new">
        Create a report
      </Link>
    </>
  );
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
          {navLinks}
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
          {navLinks}
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
            {/* Old auth routes: no login system anymore — send visitors to the app. */}
            <Route path="/login" element={<Navigate to="/app" replace />} />
            <Route path="/register" element={<Navigate to="/app" replace />} />
            <Route path="/forgot-password" element={<Navigate to="/app" replace />} />
            <Route path="/reset-password" element={<Navigate to="/app" replace />} />
            <Route path="/share/:token" element={<ShareView />} />
            <Route path="/invite/:code" element={<InviteAccept />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/help" element={<Help />} />
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/reports/new" element={<ReportEditor />} />
            <Route path="/app/reports/:id" element={<ReportView />} />
            <Route path="/app/reports/:id/edit" element={<ReportEditor />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/app/workspaces" element={<Workspaces />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <footer className="footer">
          <div className="container footer-grid">
            <div>
              <strong>ReproKit</strong> — Turn confusing problems into clear, actionable reports.
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                Free forever. No tracking. No login needed.
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
