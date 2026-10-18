import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ApiError, api, type Report } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, EmptyState, SeverityBadge, StatusBadge } from "../components/ui";

interface Stats {
  total: number;
  drafts: number;
  open: number;
  resolved: number;
  recentlyUpdated: number;
  bySeverity: { severity: string; c: number }[];
  byStatus: { status: string; c: number }[];
  storageBytes: number;
  unreadNotifications: number;
}

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; title: string; body: string | null; link: string | null; read: number; created_at: number }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, r, n, w] = await Promise.all([
        api.dashboard(),
        api.reports.list({
          ...(status ? { status } : {}),
          ...(severity ? { severity } : {}),
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
          ...(q ? { q } : {}),
          ...(sort ? { sort } : {}),
          page: String(page),
          limit: "20",
        }),
        api.notifications.list(),
        api.workspaces.list(),
      ]);
      setStats(s as unknown as Stats);
      setReports(r.reports);
      setTotal(r.total);
      setNotifications(n.notifications);
      setWorkspaces(w.workspaces);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity, workspaceId, sort, page]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    void load();
  };

  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);

  return (
    <div className="app-shell">
      {sidebarOpen ? (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      ) : null}
      <aside className={`app-sidebar${sidebarOpen ? " open" : ""}`} aria-label="Dashboard navigation">
        <nav>
          <NavLink to="/app" end className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/app/workspaces" className={({ isActive }) => (isActive ? "active" : "")}>
            Workspaces
          </NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
        </nav>
        <div style={{ marginTop: "1.5rem" }}>
          <Link className="btn btn-primary" to="/app/reports/new" style={{ width: "100%" }}>
            + New report
          </Link>
        </div>
        <p className="small muted" style={{ marginTop: "1.5rem" }}>
          Signed in as <strong>{user?.name || user?.email}</strong>
        </p>
      </aside>

      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-sm" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              Menu
            </button>
            <Link className="btn btn-primary" to="/app/reports/new">
              + New report
            </Link>
          </div>
        </div>
        {error ? <Alert kind="error">{error}</Alert> : null}

        {stats ? (
          <div className="grid grid-4" style={{ marginTop: "1.25rem" }}>
            <div className="stat-card"><div className="small muted">Total reports</div><div className="stat-value">{stats.total}</div></div>
            <div className="stat-card"><div className="small muted">Drafts</div><div className="stat-value">{stats.drafts}</div></div>
            <div className="stat-card"><div className="small muted">Open / in progress</div><div className="stat-value">{stats.open}</div></div>
            <div className="stat-card"><div className="small muted">Resolved / closed</div><div className="stat-value">{stats.resolved}</div></div>
          </div>
        ) : null}
        {stats ? (
          <p className="small muted">
            Updated in the last 7 days: <strong>{stats.recentlyUpdated}</strong>
            {" · "}Evidence storage used: <strong>{(stats.storageBytes / 1024).toFixed(1)} KB</strong>
            {" · "}Unread notifications: <strong>{stats.unreadNotifications}</strong>
          </p>
        ) : null}

        {notifications.filter((n) => !n.read).length > 0 ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Notifications</h3>
              <button className="btn btn-sm" onClick={() => void markAllRead()}>Mark all read</button>
            </div>
            <ul>
              {notifications.filter((n) => !n.read).slice(0, 5).map((n) => (
                <li key={n.id}>
                  <strong>{n.title}</strong>
                  {n.body ? ` — ${n.body}` : ""}
                  {n.link ? <> (<Link to={n.link}>View</Link>)</> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form onSubmit={search} className="card filter-bar" style={{ marginTop: "1rem" }}>
          <label className="field">
            <span>Search</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, description, or error message…" />
          </label>
          <label className="field">
            <span>Status</span>
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="field">
            <span>Severity</span>
            <select className="select" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
              <option value="">All severities</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>
          <label className="field">
            <span>Workspace</span>
            <select className="select" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); setPage(1); }}>
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select className="select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="updated_desc">Recently updated</option>
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="title_asc">Title A–Z</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Search</button>
        </form>

        {loading ? (
          <div aria-busy="true">
            <div className="skeleton skeleton-card" style={{ marginTop: "1rem" }} />
            <div className="skeleton skeleton-card" style={{ marginTop: "1rem" }} />
          </div>
        ) : reports.length === 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <EmptyState
              title="No reports yet"
              body="Create your first report: describe the problem, add steps and evidence, then export or share it."
              action={<Link className="btn btn-primary" to="/app/reports/new">Create a report</Link>}
              icon="◦"
            />
          </div>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: "1rem" }}>
              Showing {from}–{to} of {total} reports
            </p>
            <div className="grid" style={{ marginTop: "0.5rem" }}>
              {reports.map((r) => (
                <Link key={r.id} className="report-card" to={`/app/reports/${r.id}`}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <StatusBadge status={r.status} />
                    <SeverityBadge severity={r.severity} />
                    {r.category ? <span className="badge">{r.category}</span> : null}
                  </div>
                  <p className="report-card-title">{r.title}</p>
                  <div className="report-card-meta">
                    <span className="avatar-initial" aria-hidden="true">
                      {initials(r.owner_name)}
                    </span>
                    <span>{r.owner_name || "Unknown owner"}</span>
                    <span>Updated {new Date(r.updated_at).toLocaleString()}</span>
                    <span>{r.attachment_count ?? 0} attachment{(r.attachment_count ?? 0) === 1 ? "" : "s"}</span>
                    <span className="mono">{r.id.slice(0, 8)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", alignItems: "center" }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="small">Page {page} · {total} reports</span>
              <button className="btn btn-sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
