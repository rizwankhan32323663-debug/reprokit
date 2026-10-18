import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, type ReportDetail } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, ConfirmModal, EmptyState, Modal, SeverityBadge, StatusBadge, useToast } from "../components/ui";
import { reportToMarkdown, reportToJSON, reportToText, downloadBlob, copyTextWithFallback, slugifyFilename } from "../lib/format";

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [shareExpiry, setShareExpiry] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const d = await api.reports.get(id);
      setDetail(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load report.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <main className="page">
        <Alert kind="error">{error}</Alert>
        <Link to="/app">Back to dashboard</Link>
      </main>
    );
  }
  if (!detail)
    return (
      <main className="page" aria-busy="true">
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" style={{ width: "70%" }} />
      </main>
    );

  const { report, steps, attachments, comments } = detail;
  const isOwner = user?.id === report.owner_id;

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.reports.comments.add(report.id, comment.trim());
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add comment.");
    }
  };

  const remove = async () => {
    try {
      await api.reports.remove(report.id);
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete report.");
    }
  };

  const duplicate = async () => {
    try {
      const res = await api.reports.duplicate(report.id);
      navigate(`/app/reports/${res.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to duplicate report.");
    }
  };

  const createShare = async () => {
    try {
      const expires = shareExpiry ? new Date(shareExpiry).getTime() : null;
      const res = await api.reports.share.create(report.id, expires);
      setShareUrl(res.url);
      setShowShare(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create share link.");
    }
  };

  const exportMarkdown = () => {
    downloadBlob(new Blob([reportToMarkdown(report, steps, attachments)], { type: "text/markdown" }), `${slugifyFilename(report.title)}.md`);
    toast("Markdown downloaded.", "success");
  };
  const exportJSON = () => {
    downloadBlob(new Blob([reportToJSON(report, steps, attachments)], { type: "application/json" }), `${slugifyFilename(report.title)}.json`);
    toast("JSON downloaded.", "success");
  };
  const copyReport = async () => {
    const ok = await copyTextWithFallback(reportToText(report, steps));
    toast(ok ? "Report copied to clipboard." : "Copy failed — clipboard access was blocked by the browser.", ok ? "success" : "error");
  };

  return (
    <main className="page">
      <div className="sticky-bar">
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link to="/app">← Dashboard</Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link className="btn" to={`/app/reports/${report.id}/edit`}>Edit</Link>
            <button className="btn" onClick={() => void duplicate()}>Duplicate</button>
            <button className="btn" onClick={() => void createShare()}>Create share link</button>
            {isOwner ? <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button> : null}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          <div className="card print-area">
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <StatusBadge status={report.status} />
              <SeverityBadge severity={report.severity} />
              {report.category ? <span className="badge">{report.category}</span> : null}
            </div>
            <h1 style={{ margin: "0.75rem 0 0.25rem" }}>{report.title}</h1>
            <p className="small muted">
              {report.site_name || "No site/app named"}
              {report.site_url ? <> · <a href={report.site_url} target="_blank" rel="noreferrer">{report.site_url}</a></> : null}
              {" · "}Created {new Date(report.created_at).toLocaleString()}
              {" · "}Updated {new Date(report.updated_at).toLocaleString()}
            </p>
            {report.description ? <><h3>Problem description</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.description}</p></> : null}
            {report.trying_to_do ? <><h3>What I was trying to do</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.trying_to_do}</p></> : null}
            {report.happened_instead ? <><h3>What happened instead</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.happened_instead}</p></> : null}
            {report.expected_result ? <><h3>Expected behavior</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.expected_result}</p></> : null}
            {report.actual_result ? <><h3>Actual behavior</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.actual_result}</p></> : null}
            {report.error_message ? <><h3>Exact error message</h3><pre className="mono" style={{ whiteSpace: "pre-wrap", background: "var(--bg-soft)", padding: "0.75rem", borderRadius: 8, fontSize: "0.85rem" }}>{report.error_message}</pre></> : null}
            {report.notes ? <><h3>Additional notes</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.notes}</p></> : null}
            {steps.length ? (
              <>
                <h3>Reproduction steps</h3>
                <ol>
                  {steps.map((s, i) => (
                    <li key={s.id || i}>
                      {s.text}
                      {s.note ? <div className="small muted">Note: {s.note}</div> : null}
                      {s.expected_result ? <div className="small muted">Expected: {s.expected_result}</div> : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            {report.env_json ? (
              <>
                <h3>Environment details</h3>
                <ul>
                  {(() => {
                    try {
                      const env = JSON.parse(report.env_json) as { label: string; value: string }[];
                      return env.map((f, i) => <li key={i}><strong>{f.label}:</strong> <span className="mono">{f.value}</span></li>);
                    } catch {
                      return <li>{report.env_json}</li>;
                    }
                  })()}
                </ul>
              </>
            ) : null}
            {attachments.length ? (
              <>
                <h3>Evidence</h3>
                <div className="thumb-grid">
                  {attachments.map((a) => (
                    <div className="thumb" key={a.id}>
                      <a href={api.reports.attachments.downloadUrl(a.id)} target="_blank" rel="noreferrer">
                        <img src={api.reports.attachments.downloadUrl(a.id)} alt={a.caption || a.filename} />
                      </a>
                      <div className="thumb-body small">
                        {a.caption || a.filename}
                        {a.is_redacted ? " (redacted copy)" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="card no-print" style={{ marginTop: "1rem" }}>
            <h3>Comments</h3>
            {comments.length === 0 ? <EmptyState title="No comments yet" body="Be the first to add a note to this report." /> : (
              <ul>
                {comments.map((c) => (
                  <li key={c.id} style={{ marginBottom: "0.75rem" }}>
                    <strong>{c.author_name}</strong> <span className="small faint">{new Date(c.created_at).toLocaleString()}</span>
                    <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addComment} style={{ marginTop: "1rem" }}>
              <label className="field">
                <span>Add a comment</span>
                <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ask a question or add context…" />
              </label>
              <button className="btn btn-primary" type="submit">Post comment</button>
            </form>
          </div>
        </div>

        <aside className="detail-rail" aria-label="Report details">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Details</h3>
            <dl className="small" style={{ margin: 0 }}>
              <dt className="muted">Status</dt>
              <dd style={{ margin: "0 0 0.75rem" }}><StatusBadge status={report.status} /></dd>
              <dt className="muted">Severity</dt>
              <dd style={{ margin: "0 0 0.75rem" }}><SeverityBadge severity={report.severity} /></dd>
              <dt className="muted">Category</dt>
              <dd style={{ margin: "0 0 0.75rem" }}>{report.category || "—"}</dd>
              <dt className="muted">Report ID</dt>
              <dd className="mono" style={{ margin: "0 0 0.75rem" }}>{report.id}</dd>
              <dt className="muted">Created</dt>
              <dd style={{ margin: "0 0 0.75rem" }}>{new Date(report.created_at).toLocaleString()}</dd>
              <dt className="muted">Updated</dt>
              <dd style={{ margin: 0 }}>{new Date(report.updated_at).toLocaleString()}</dd>
            </dl>
          </div>
          <div className="card no-print">
            <h3 style={{ marginTop: 0 }}>Share</h3>
            <p className="small muted">Reports are private by default. Create a read-only link you can revoke anytime.</p>
            <button className="btn btn-primary" onClick={() => void createShare()} style={{ width: "100%" }}>
              Create share link
            </button>
          </div>
          <div className="card no-print">
            <h3 style={{ marginTop: 0 }}>Export</h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={exportMarkdown}>Markdown</button>
              <button className="btn" onClick={exportJSON}>JSON</button>
              <button className="btn" onClick={() => void copyReport()}>Copy</button>
              <button className="btn" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </aside>
      </div>

      <div className="bottom-bar no-print">
        <Link className="btn" to={`/app/reports/${report.id}/edit`}>Edit</Link>
        <button className="btn btn-primary" onClick={() => void createShare()}>Share</button>
      </div>

      {showShare ? (
        <Modal title="Share link created" onClose={() => setShowShare(false)}>
          <p>Anyone with this link can view a read-only copy of the report. Revoking the link blocks all future access.</p>
          <label className="field">
            <span>Optional expiry</span>
            <input className="input" type="datetime-local" value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)} />
          </label>
          <button className="btn" onClick={() => void createShare()}>Create another link</button>
          <p style={{ wordBreak: "break-all" }}><a href={shareUrl}>{shareUrl}</a></p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const ok = await copyTextWithFallback(shareUrl);
              toast(ok ? "Share link copied." : "Copy failed — clipboard blocked.", ok ? "success" : "error");
            }}
          >
            Copy link
          </button>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <ConfirmModal
          title="Delete this report?"
          body={`Delete "${report.title}"? This also deletes its steps, comments, and attachments. This cannot be undone.`}
          confirmLabel="Delete report"
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </main>
  );
}
