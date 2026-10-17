import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type Report } from "../lib/api";
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<{ id: string; title: string; body: string | null; link: string | null; read: number; created_at: number }[]>([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, r, n] = await Promise.all([
        api.dashboard(),
        api.reports.list({ ...(status ? { status } : {}), ...(severity ? { severity } : {}), ...(q ? { q } : {}), page: String(page), limit: "20" }),
        api.notifications.list(),
      ]);
      setStats(s as unknown as Stats);
      setReports(r.reports);
      setTotal(r.total);
      setNotifications(n.notifications);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity, page]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    void load();
  };

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="btn" to="/app/workspaces">Workspaces</Link>
          <Link className="btn btn-primary" to="/app/reports/new">+ New report</Link>
        </div>
      </div>
      {error ? <Alert kind="error">{error}</Alert> : null}

      {stats ? (
        <div className="grid grid-4" style={{ marginTop: "1.25rem" }}>
          <div className="card"><div className="small muted">Total reports</div><div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.total}</div></div>
          <div className="card"><div className="small muted">Drafts</div><div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.drafts}</div></div>
          <div className="card"><div className="small muted">Open / in progress</div><div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.open}</div></div>
          <div className="card"><div className="small muted">Resolved / closed</div><div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.resolved}</div></div>
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

      <form onSubmit={search} className="card" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Search</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, description, or error message…" />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
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
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Severity</span>
          <select className="select" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
            <option value="">All severities</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Create your first report: describe the problem, add steps and evidence, then export or share it."
          action={<Link className="btn btn-primary" to="/app/reports/new">Create a report</Link>}
        />
      ) : (
        <>
          <table className="table" aria-label="Reports">
            <thead>
              <tr><th>Title</th><th>Status</th><th>Severity</th><th>Category</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/app/reports/${r.id}`}>{r.title}</Link></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><SeverityBadge severity={r.severity} /></td>
                  <td>{r.category || "—"}</td>
                  <td>{new Date(r.updated_at).toLocaleString()}</td>
                  <td><Link className="btn btn-sm" to={`/app/reports/${r.id}/edit`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", alignItems: "center" }}>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="small">Page {page} · {total} reports</span>
            <button className="btn btn-sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>
      )}
    </main>
  );
}
