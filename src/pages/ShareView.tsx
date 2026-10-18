import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api, type PublicReport } from "../lib/api";
import { Alert } from "../components/ui";

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.shareView(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This share link is invalid, expired, or revoked."));
  }, [token]);

  if (error) {
    return (
      <main className="page">
        <Alert kind="error">{error}</Alert>
        <p>
          <Link to="/">Go to ReproKit</Link>
        </p>
      </main>
    );
  }
  if (!data) return <main className="page">Loading shared report…</main>;

  const { report, steps, attachments } = data;
  return (
    <main className="page">
      <p className="small muted">Shared read-only report · ReproKit</p>
      <div className="card print-area">
        <h1 style={{ marginTop: 0 }}>{report.title}</h1>
        <p className="small muted">
          {report.site_name || ""}
          {report.category ? ` · ${report.category}` : ""}
          {report.severity ? ` · Severity: ${report.severity}` : ""}
          {` · Status: ${report.status}`}
        </p>
        {report.description ? <><h3>Problem description</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.description}</p></> : null}
        {report.trying_to_do ? <><h3>What they were trying to do</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.trying_to_do}</p></> : null}
        {report.happened_instead ? <><h3>What happened instead</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.happened_instead}</p></> : null}
        {report.expected_result ? <><h3>Expected behavior</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.expected_result}</p></> : null}
        {report.actual_result ? <><h3>Actual behavior</h3><p style={{ whiteSpace: "pre-wrap" }}>{report.actual_result}</p></> : null}
        {report.error_message ? <><h3>Exact error message</h3><pre style={{ whiteSpace: "pre-wrap", background: "var(--bg-soft)", padding: "0.75rem", borderRadius: 8 }}>{report.error_message}</pre></> : null}
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
        {attachments.length ? (
          <>
            <h3>Evidence</h3>
            <div className="thumb-grid">
              {attachments.map((a) => (
                <div className="thumb" key={a.id}>
                  <a href={`/api/share/${token}/attachments/${a.id}`} target="_blank" rel="noreferrer">
                    <img src={`/api/share/${token}/attachments/${a.id}`} alt={a.caption || a.filename} />
                  </a>
                  <div className="thumb-body small">{a.caption || a.filename}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className="small muted">
        This is a read-only shared copy. Internal details (owner, workspace, comments, activity) are not included.
      </p>
      <footer style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p className="small muted">
          Made with <a href="/">ReproKit</a> — <a href="/register">create your own report</a>
        </p>
      </footer>
    </main>
  );
}
