
import { Link } from "react-router-dom";

export function Privacy() {
  return (
    <main className="page narrow">
      <h1>Privacy Policy</h1>
      <p className="small muted">Last updated: October 17, 2026.</p>
      <h2>What ReproKit stores</h2>
      <p>
        ReproKit stores your account (name, email, password hash), the reports you create
        (titles, descriptions, steps, environment details, attachments), comments, workspace
        memberships, share links, activity events, and notifications. Attachments are stored
        privately in object storage and are served only after a permission check.
      </p>
      <h2>What we do not collect</h2>
      <p>
        We do not add analytics, tracking pixels, advertising scripts, or session replay.
        Environment details are collected only when you explicitly click “Add environment
        details”, and you can review and remove individual fields before attaching them.
        We never collect your location, contacts, browsing history, cookies, passwords, or
        unrelated personal information.
      </p>
      <h2>Sharing</h2>
      <p>
        Reports are private by default. A report becomes viewable to others only when you
        explicitly create a share link or invite someone to your workspace. You can revoke
        a share link at any time; revocation blocks all future access through that link.
      </p>
      <h2>Email</h2>
      <p>
        Email delivery (verification and password-reset emails) is currently <strong>blocked</strong> because
        no email provider is connected to this deployment. No emails are sent, and no
        delivery is claimed, until a provider is configured.
      </p>
      <h2>Security</h2>
      <p>
        Passwords are stored only as salted hashes. Sessions are server-managed and expire.
        We make no absolute security promises. Before sharing a report, review it for
        passwords, authentication tokens, payment information, private messages, and other
        sensitive details — especially in screenshots.
      </p>
      <h2>Deletion</h2>
      <p>
        You can delete individual reports, or delete your entire account in Settings.
        Account deletion removes your account, reports, comments, and attachments.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy questions, use the <Link to="/help">Help page</Link> or contact the
        workspace administrator for this deployment.
      </p>
    </main>
  );
}

export function Terms() {
  return (
    <main className="page narrow">
      <h1>Terms of Service</h1>
      <p className="small muted">Last updated: October 17, 2026.</p>
      <h2>Using ReproKit</h2>
      <p>
        ReproKit helps you create troubleshooting reports. You are responsible for the
        content you upload, including screenshots. Do not upload content you do not have
        the right to share, and do not include other people's private information
        without their consent.
      </p>
      <h2>Your content</h2>
      <p>
        You keep ownership of your reports and attachments. By creating a share link or
        inviting someone to a workspace, you grant those viewers access to the shared
        content. You can revoke share links at any time.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not use ReproKit to harass others, distribute malware, or violate applicable
        law. Abusive accounts may be suspended by the deployment operator.
      </p>
      <h2>Availability</h2>
      <p>
        ReproKit is provided “as is”, without warranties. The deployment operator may
        change or discontinue the service. Export your important reports regularly.
      </p>
    </main>
  );
}

export function Help() {
  return (
    <main className="page narrow">
      <h1>Help — How to create a useful report</h1>
      <h2>The recipe</h2>
      <ol>
        <li><strong>Describe the issue:</strong> what you were trying to do, what happened instead, what you expected.</li>
        <li><strong>List the steps:</strong> one concrete action per step, in order, so someone else can follow them.</li>
        <li><strong>Add evidence:</strong> a screenshot of the problem, with sensitive areas redacted.</li>
        <li><strong>Attach environment details:</strong> browser and device info help with device-specific bugs.</li>
        <li><strong>Check quality:</strong> the rule-based quality panel lists exactly what is missing and why.</li>
        <li><strong>Export or share:</strong> download Markdown/PDF/JSON, copy the text, print, or create a read-only share link.</li>
      </ol>
      <h2>Redaction</h2>
      <p>
        Open a screenshot in the editor, draw rectangles over anything sensitive, and save
        a redacted copy. The exported image has the covered pixels replaced with solid
        black — it is not just an overlay. Always inspect the redacted image before sharing.
      </p>
      <h2>Sharing</h2>
      <p>
        Reports are private by default. “Create share link” makes a read-only link with a
        high-entropy token. You can set an expiry and revoke the link; revocation blocks
        all future access through it.
      </p>
      <h2>Email delivery (blocked)</h2>
      <p>
        Email verification and password-reset emails are currently <strong>blocked</strong> because
        no email provider is connected. To enable them, the deployment operator must
        configure an email provider and set it in the server configuration — see the
        repository README “Email provider setup”.
      </p>
      <h2>Quality checks</h2>
      <p>
        Quality checks are deterministic rules, not AI. Each suggestion explains why it
        appears. Nothing is sent to any AI service.
      </p>
    </main>
  );
}
