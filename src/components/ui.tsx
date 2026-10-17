import React from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
      {error ? <div className="field-error" role="alert">{error}</div> : null}
    </label>
  );
}

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
}) {
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "2rem 1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem" }}>{title}</h3>
      <p className="muted" style={{ margin: "0 0 1rem" }}>{body}</p>
      {action}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="badge">Unspecified</span>;
  const cls = severity === "Critical" ? "badge-critical" : severity === "High" ? "badge-high" : "";
  return <span className={`badge ${cls}`}>{severity}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "resolved" || status === "closed" ? "badge-resolved" : status === "open" || status === "in_progress" ? "badge-open" : "";
  const label = status.replace("_", " ");
  return <span className={`badge ${cls}`}>{label}</span>;
}
