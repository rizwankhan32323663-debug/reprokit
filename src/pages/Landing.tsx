import { useState } from "react";
import { Link } from "react-router-dom";

function Mockup() {
  return (
    <div className="mockup" aria-hidden="true">
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="badge badge-high">High</span>
        <span className="badge badge-open">Open</span>
        <span className="badge">Login and authentication</span>
      </div>
      <h3 style={{ margin: "0.75rem 0 0.5rem" }}>Cannot log in after password reset</h3>
      <div className="mockup-shot">
        <div
          style={{
            position: "absolute", inset: 0, padding: "1rem",
            fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--text-muted)",
          }}
        >
          <div>Error: Invalid email or password</div>
          <div style={{ marginTop: "0.5rem" }}>user@example.com</div>
          <div>••••••••••</div>
        </div>
        <div className="mockup-redact" style={{ left: "12%", top: "58%", width: "38%", height: "14px" }} />
        <div className="mockup-redact" style={{ left: "12%", top: "72%", width: "26%", height: "14px" }} />
      </div>
      <ol className="mockup-steps">
        <li>Open the login page.</li>
        <li>Complete the password reset.</li>
        <li>Enter the new password — observe the error.</li>
      </ol>
    </div>
  );
}

function RedactionDemo() {
  const [after, setAfter] = useState(false);
  return (
    <div className="feature-visual">
      <div
        style={{
          borderRadius: 8, border: "1px solid var(--border-soft)", padding: "1rem",
          background: "var(--bg-soft)", fontFamily: "var(--mono)", fontSize: "0.85rem",
        }}
      >
        <div>Order #4812 — receipt</div>
        <div style={{ marginTop: "0.5rem" }}>
          Card:{" "}
          {after ? (
            <span style={{ background: "#000", color: "#000", borderRadius: 3, padding: "0 0.5rem" }}>0000 0000 0000 0000</span>
          ) : (
            "4111 1111 1111 1111"
          )}
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          Email:{" "}
          {after ? (
            <span style={{ background: "#000", color: "#000", borderRadius: 3, padding: "0 0.5rem" }}>buyer@example.com</span>
          ) : (
            "buyer@example.com"
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button className={`btn btn-sm ${!after ? "btn-primary" : ""}`} onClick={() => setAfter(false)}>
          Before
        </button>
        <button className={`btn btn-sm ${after ? "btn-primary" : ""}`} onClick={() => setAfter(true)}>
          After redaction
        </button>
      </div>
      <p className="small muted" style={{ marginTop: "0.5rem" }}>
        Redaction replaces real pixels — it is not an overlay. The original is preserved.
      </p>
    </div>
  );
}

export default function Landing() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-split">
          <div>
            <h1>Turn confusing errors into clear reports.</h1>
            <p className="lead">
              ReproKit turns your rough explanation and screenshots into a structured,
              professional troubleshooting report — with reproduction steps, evidence,
              and environment details anyone can follow.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/register">
                Create a report — free
              </Link>
              <Link className="btn" to="/#how">
                How it works
              </Link>
            </div>
            <div className="trust-strip">
              <span>
                <strong>Free forever</strong> · No tracking
              </span>
              <span>
                <strong>Private by default</strong> · Revocable share links
              </span>
              <span>
                <strong>Export anytime</strong> · Markdown, PDF, JSON
              </span>
            </div>
          </div>
          <Mockup />
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <h2>Three steps to a report anyone can reproduce</h2>
          <div className="grid grid-3" style={{ marginTop: "2rem" }}>
            <div className="card">
              <div className="mono" aria-hidden="true">
                01
              </div>
              <h3>Capture</h3>
              <p>Describe what you were trying to do, what happened instead, and what you expected. Guided fields keep it complete.</p>
            </div>
            <div className="card">
              <div className="mono" aria-hidden="true">
                02
              </div>
              <h3>Redact</h3>
              <p>Add screenshots and cover sensitive areas with genuine pixel redaction. Review the saved copy before sharing.</p>
            </div>
            <div className="card">
              <div className="mono" aria-hidden="true">
                03
              </div>
              <h3>Share</h3>
              <p>Export Markdown, PDF, or JSON — or send a private read-only link you can revoke at any time.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt" id="features">
        <div className="container">
          <h2>Everything a good bug report needs</h2>
          <div className="feature-row" style={{ marginTop: "2.5rem" }}>
            <div>
              <h3>Report editor with live preview</h3>
              <p>
                Guided fields for the problem, expected vs. actual behavior, and the exact
                error message. Numbered reproduction steps with notes and per-step expected
                results. The preview updates as you type.
              </p>
            </div>
            <div className="feature-visual">
              <div className="mono">PREVIEW</div>
              <h4 style={{ margin: "0.5rem 0" }}>Cannot log in after password reset</h4>
              <p className="small muted">1. Open the login page. 2. Complete the password reset. 3. Enter the new password.</p>
              <span className="badge badge-high">High</span> <span className="badge badge-open">Open</span>
            </div>
          </div>
          <div className="feature-row" style={{ marginTop: "3rem" }}>
            <RedactionDemo />
            <div>
              <h3>Genuine redaction, not an overlay</h3>
              <p>
                Draw rectangles over passwords, tokens, or personal data. The saved copy
                has those pixels replaced — the sensitive content is gone, not hidden
                behind a layer. Toggle Before / After to inspect the result.
              </p>
            </div>
          </div>
          <div className="feature-row" style={{ marginTop: "3rem" }}>
            <div>
              <h3>Report quality checks</h3>
              <p>
                Transparent, rule-based checks score completeness and explain exactly what
                is missing — no AI claims, no content sent to any AI service. Each
                suggestion tells you why it matters.
              </p>
            </div>
            <div className="feature-visual">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Report quality</strong>
                <span className="badge badge-resolved">86 / 100</span>
              </div>
              <ul className="small muted">
                <li>Steps are numbered and ordered.</li>
                <li>Expected result is stated.</li>
                <li>Add the exact error message to reach 100.</li>
              </ul>
            </div>
          </div>
          <div className="feature-row" style={{ marginTop: "3rem" }}>
            <div className="feature-visual">
              <div className="mono">SHARE LINK</div>
              <p className="small muted" style={{ wordBreak: "break-all" }}>reprokit.example/share/…</p>
              <span className="badge badge-resolved">Read-only</span> <span className="badge">Revocable</span>
              <p className="small muted">Revocation blocks all future access through that link.</p>
            </div>
            <div>
              <h3>Sharing you can revoke</h3>
              <p>
                Reports are private by default. A share link creates a read-only public
                view — and revoking it blocks all future access. Optional expiry dates
                for time-sensitive reports.
              </p>
            </div>
          </div>
          <div className="feature-row" style={{ marginTop: "3rem" }}>
            <div>
              <h3>Workspaces and teams</h3>
              <p>
                Share reports with a workspace, assign teammates, comment, and track
                activity with roles and permissions. Owners, admins, and members each
                see exactly what they are allowed to see.
              </p>
            </div>
            <div className="feature-visual">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span className="avatar-initial">AK</span>
                <span className="avatar-initial">MR</span>
                <span className="avatar-initial">JT</span>
                <span className="small muted">3 members · Owner / Admin / Member</span>
              </div>
              <p className="small muted" style={{ marginTop: "0.75rem" }}>Comments, activity log, labels, and assignees on every report.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card pricing-card">
            <div className="mono" aria-hidden="true">
              PRICING
            </div>
            <h2 style={{ margin: "0.5rem 0" }}>Free forever</h2>
            <p className="muted">
              Every feature. No trial, no card, no per-seat charge.
            </p>
            <p className="small muted">
              For comparison, public starting prices elsewhere: ReportKit $5–35/mo ·
              Jam $0–14/creator · Marker.io $39–499/mo · BugHerd $42–150/mo ·
              Usersnap €39–319/mo.
            </p>
            <Link className="btn btn-primary" to="/register">
              Create a report — free
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2>Privacy, honestly</h2>
          <p className="lead" style={{ maxWidth: "68ch" }}>
            No analytics. No tracking. No cookies for ads.
          </p>
          <ul>
            <li>Reports are private by default.</li>
            <li>Share links are revocable — revocation blocks all future access.</li>
            <li>Originals are preserved when you save a redacted copy.</li>
            <li>Export or delete your data anytime from Settings.</li>
          </ul>
          <p>
            <Link to="/privacy">Read the full Privacy Policy →</Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container faq">
          <h2>Frequently asked questions</h2>
          <details>
            <summary>Do I need an account?</summary>
            <p>Yes. ReproKit saves your reports to your account so you can edit, share, and export them later. Reports are private by default.</p>
          </details>
          <details>
            <summary>Is my data shared with anyone?</summary>
            <p>No. Reports are private unless you explicitly create a share link or invite someone to your workspace.</p>
          </details>
          <details>
            <summary>Does ReproKit use AI?</summary>
            <p>No. The report-quality checks are deterministic rules that explain exactly why each suggestion appears. No report content is sent to any AI service.</p>
          </details>
          <details>
            <summary>Can I delete my account and data?</summary>
            <p>Yes. Account deletion in Settings removes your account, reports, comments, and attachments.</p>
          </details>
          <details>
            <summary>Are password-reset emails sent?</summary>
            <p>
              Email delivery is currently <strong>blocked</strong> until an email provider is
              connected to this deployment. The reset flow exists, but no email is sent.
              See <Link to="/help">Help</Link> for setup details.
            </p>
          </details>
          <details>
            <summary>What happens when I revoke a share link?</summary>
            <p>Revocation blocks all future access through that link. Anyone opening it afterwards sees an error instead of the report.</p>
          </details>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container" style={{ textAlign: "center" }}>
          <h2>Show the problem, not just describe it.</h2>
          <p className="muted" style={{ margin: "0 auto 1.5rem" }}>
            Your first report takes a few minutes — and it is free.
          </p>
          <Link className="btn btn-primary" to="/register">
            Create a report — free
          </Link>
        </div>
      </section>
    </main>
  );
}
