import React from "react";

/* ---------- Toasts (transient, bottom-right) ---------- */
export interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastItem["kind"], actionLabel?: string, onAction?: () => void) => void;
}

const ToastContext = React.createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => React.useContext(ToastContext);

let toastSeq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback(
    (message: string, kind: ToastItem["kind"] = "info", actionLabel?: string, onAction?: () => void) => {
      const id = toastSeq++;
      setToasts((t) => [...t, { id, message, kind, actionLabel, onAction }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    },
    []
  );
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            <span>{t.message}</span>
            {t.actionLabel && t.onAction ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  t.onAction?.();
                }}
              >
                {t.actionLabel}
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              aria-label="Dismiss notification"
              style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", marginLeft: "auto" }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Skeleton (card-shaped shimmer) ---------- */
export function Skeleton({ lines = 3, height }: { lines?: number; height?: string }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: `${100 - i * 18}%`, height }} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" aria-hidden="true">
      <div className="skeleton skeleton-card" />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const errorId = id ? `${id}-error` : undefined;
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })
    : children;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {child}
      {hint ? <div className="field-hint">{hint}</div> : null}
      {error ? (
        <div className="field-error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
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
  const ref = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<Element | null>(null);

  React.useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const modal = ref.current;
    const focusables = modal?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modal) {
        const items = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Destructive-action confirmation. Names the item; never a bare window.confirm. */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p>{body}</p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented-btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="card empty-state">
      {icon ? (
        <div className="empty-state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 style={{ margin: "0 0 0.5rem" }}>{title}</h3>
      <p className="muted" style={{ margin: "0 auto 1rem", maxWidth: "52ch" }}>
        {body}
      </p>
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
  const cls =
    status === "resolved" || status === "closed"
      ? "badge-resolved"
      : status === "open" || status === "in_progress"
        ? "badge-open"
        : "";
  const label = status.replace("_", " ");
  return <span className={`badge ${cls}`}>{label}</span>;
}
