import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <h1>Turn confusing errors into clear reports.</h1>
          <p>
            ReproKit turns your rough explanation and screenshots into a structured,
            professional troubleshooting report — with reproduction steps, evidence,
            and environment details anyone can follow.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/register">
              Create a report — free
            </Link>
            <Link className="btn" to="/help">
              How it works
            </Link>
          </div>
          <p className="small muted" style={{ marginTop: "1rem" }}>
            Show what went wrong. Explain it clearly. Get it fixed faster.
          </p>
        </div>
      </section>

      <section className="container" id="how">
        <h2>Three steps to a report anyone can reproduce</h2>
        <div className="grid grid-3">
          <div className="card">
            <h3>1. Describe the issue</h3>
            <p>Write what you were trying to do, what happened instead, and what you expected. Guided fields keep it complete.</p>
          </div>
          <div className="card">
            <h3>2. Organize the evidence</h3>
            <p>Add numbered reproduction steps, screenshots with genuine redaction, and optional browser/device details.</p>
          </div>
          <div className="card">
            <h3>3. Export the report</h3>
            <p>Download Markdown, PDF, or JSON, copy a clean text version, print it, or share a private read-only link.</p>
          </div>
        </div>
      </section>

      <section className="container" id="features" style={{ marginTop: "2.5rem" }}>
        <h2>Features</h2>
        <div className="grid grid-3">
          <div className="card">
            <h3>📸 Screenshots &amp; redaction</h3>
            <p>Upload evidence, annotate it, and cover sensitive areas with real pixel redaction — not an overlay.</p>
          </div>
          <div className="card">
            <h3>📝 Reproduction steps</h3>
            <p>An interactive step editor with reordering, notes, and per-step expected results.</p>
          </div>
          <div className="card">
            <h3>🔒 Private by default</h3>
            <p>Reports are private unless you explicitly create a share link. Attachments stay private and permission-checked.</p>
          </div>
          <div className="card">
            <h3>✅ Report quality checks</h3>
            <p>Transparent, rule-based checks score completeness and explain exactly what is missing — no AI claims.</p>
          </div>
          <div className="card">
            <h3>👥 Workspaces &amp; teams</h3>
            <p>Share reports with a workspace, assign teammates, comment, and track activity with roles and permissions.</p>
          </div>
          <div className="card">
            <h3>📤 Real exports</h3>
            <p>Markdown, PDF, JSON, clipboard, and print — generated from the saved report, not a mockup.</p>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginTop: "2.5rem" }}>
        <h2>Sample report preview</h2>
        <p className="muted">A realistic example of what a finished ReproKit report looks like. This is sample data, not a customer report.</p>
        <div className="card">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge badge-high">High</span>
            <span className="badge badge-open">Open</span>
            <span className="badge">Login and authentication</span>
          </div>
          <h3 style={{ marginTop: "0.75rem" }}>Example — Cannot log in after password reset</h3>
          <p>
            <strong>What I was trying to do:</strong> Log in with the new password after resetting it.
          </p>
          <p>
            <strong>What happened instead:</strong> The login form shows “Invalid email or password” even though the reset said it succeeded.
          </p>
          <p>
            <strong>Expected:</strong> Login succeeds with the new password.
          </p>
          <ol>
            <li>Open the login page.</li>
            <li>Click “Forgot password” and complete the reset.</li>
            <li>Return to login and enter the new password.</li>
            <li>Observe the error message.</li>
          </ol>
        </div>
      </section>

      <section className="container" style={{ marginTop: "2.5rem" }}>
        <h2>Privacy, honestly</h2>
        <div className="card">
          <p>
            ReproKit stores your reports in your account so you can manage, share, and
            export them. Reports are private by default. Attachments are stored
            privately and served only after a permission check. We do not add
            analytics, tracking pixels, advertising scripts, or session replay.
            We never claim to detect information the browser cannot access, and
            we never send your report content to third-party services.
          </p>
          <p>
            <Link to="/privacy">Read the full Privacy Policy →</Link>
          </p>
        </div>
      </section>

      <section className="container" style={{ marginTop: "2.5rem" }}>
        <h2>Frequently asked questions</h2>
        <div className="card">
          <h3>Do I need an account?</h3>
          <p>Yes. ReproKit saves your reports to your account so you can edit, share, and export them later. Reports are private by default.</p>
          <h3>Is my data shared with anyone?</h3>
          <p>No. Reports are private unless you explicitly create a share link or invite someone to your workspace.</p>
          <h3>Does ReproKit use AI?</h3>
          <p>No. The report-quality checks are deterministic rules that explain exactly why each suggestion appears. No report content is sent to any AI service.</p>
          <h3>Can I delete my account and data?</h3>
          <p>Yes. Account deletion in Settings removes your account, reports, comments, and attachments.</p>
          <h3>Are password-reset emails sent?</h3>
          <p>
            Email delivery is currently <strong>blocked</strong> until an email provider is
            connected to this deployment. The reset flow exists, but no email is sent.
            See <Link to="/help">Help</Link> for setup details.
          </p>
        </div>
      </section>
    </main>
  );
}
