import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, type Attachment, type ReportDetail, type Step } from "../lib/api";
import { Alert, EmptyState, Field, Modal, SeverityBadge, StatusBadge } from "../components/ui";
import { assessQuality } from "../lib/quality";
import { collectEnvironment, type EnvField } from "../lib/env";
import { applyRedactions, type Rect } from "../lib/redact";
import {
  copyTextWithFallback,
  downloadBlob,
  reportToJSON,
  reportToMarkdown,
  reportToText,
  slugifyFilename,
} from "../lib/format";
import { CATEGORIES, SEVERITIES, STATUSES } from "./editorConstants";

interface Draft {
  title: string;
  site_name: string;
  site_url: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  trying_to_do: string;
  happened_instead: string;
  expected_result: string;
  actual_result: string;
  error_message: string;
  notes: string;
  incident_at: string;
  workspace_id: string;
  assignee_id: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  site_name: "",
  site_url: "",
  category: "",
  severity: "",
  status: "draft",
  description: "",
  trying_to_do: "",
  happened_instead: "",
  expected_result: "",
  actual_result: "",
  error_message: "",
  notes: "",
  incident_at: "",
  workspace_id: "",
  assignee_id: "",
};

interface Annotation {
  kind: "rect" | "arrow" | "text";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
}

function RedactionModal({
  attachment,
  onClose,
  onSaved,
}: {
  attachment: Attachment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<"redact" | "rect" | "arrow" | "text">("redact");
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 640;
      const s = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * s);
      canvas.height = Math.round(img.naturalHeight * s);
      draw(img, canvas, [], []);
    };
    img.src = api.reports.attachments.downloadUrl(attachment.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  const draw = (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    r: Rect[],
    ann: Annotation[]
  ) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = canvas.width / img.naturalWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    for (const rect of r) ctx.fillRect(rect.x * s, rect.y * s, rect.w * s, rect.h * s);
    ctx.strokeStyle = "#e11d48";
    ctx.fillStyle = "#e11d48";
    ctx.lineWidth = 2;
    for (const a of ann) {
      if (a.kind === "rect") {
        ctx.strokeRect(a.x1 * s, a.y1 * s, (a.x2 - a.x1) * s, (a.y2 - a.y1) * s);
      } else if (a.kind === "arrow") {
        const x1 = a.x1 * s, y1 = a.y1 * s, x2 = a.x2 * s, y2 = a.y2 * s;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        for (const da of [0.4, -0.4]) {
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - 12 * Math.cos(ang + da), y2 - 12 * Math.sin(ang + da));
          ctx.stroke();
        }
      } else if (a.kind === "text" && a.text) {
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(a.text, a.x1 * s, a.y1 * s);
      }
    }
  };

  const redraw = (r: Rect[], ann: Annotation[]) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) draw(img, canvas, r, ann);
  };

  // Convert display coords to image-pixel coords.
  const toImage = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const img = imgRef.current!;
    return {
      x: ((e.clientX - rect.left) / rect.width) * img.naturalWidth,
      y: ((e.clientY - rect.top) / rect.height) * img.naturalHeight,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "text") {
      const p = toImage(e);
      const text = textValue.trim() || "Note";
      const next = [...annotations, { kind: "text" as const, x1: p.x, y1: p.y, x2: p.x, y2: p.y, text }];
      setAnnotations(next);
      redraw(rects, next);
      return;
    }
    setDrawing(toImage(e));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = toImage(e);
    const x = Math.min(drawing.x, p.x);
    const y = Math.min(drawing.y, p.y);
    const w = Math.abs(p.x - drawing.x);
    const h = Math.abs(p.y - drawing.y);
    if (w < 4 || h < 4) {
      setDrawing(null);
      return;
    }
    if (tool === "redact") {
      const next = [...rects, { x, y, w, h }];
      setRects(next);
      redraw(next, annotations);
    } else {
      const next = [...annotations, { kind: tool, x1: x, y1: y, x2: x + w, y2: y + h }];
      setAnnotations(next);
      redraw(rects, next);
    }
    setDrawing(null);
  };

  const save = async () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    setError("");
    try {
      // Flatten: draw base image, apply REAL pixel redaction via the same
      // pure function the unit test verifies, then draw annotations.
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const redacted = applyRedactions(imageData, rects);
      ctx.putImageData(new ImageData(redacted.data, redacted.width, redacted.height), 0, 0);
      ctx.strokeStyle = "#e11d48";
      ctx.fillStyle = "#e11d48";
      ctx.lineWidth = Math.max(2, img.naturalWidth / 400);
      for (const a of annotations) {
        if (a.kind === "rect") ctx.strokeRect(a.x1, a.y1, a.x2 - a.x1, a.y2 - a.y1);
        else if (a.kind === "arrow") {
          ctx.beginPath();
          ctx.moveTo(a.x1, a.y1);
          ctx.lineTo(a.x2, a.y2);
          ctx.stroke();
          const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
          for (const da of [0.4, -0.4]) {
            ctx.beginPath();
            ctx.moveTo(a.x2, a.y2);
            ctx.lineTo(a.x2 - 24 * Math.cos(ang + da), a.y2 - 24 * Math.sin(ang + da));
            ctx.stroke();
          }
        } else if (a.kind === "text" && a.text) {
          ctx.font = `bold ${Math.round(img.naturalWidth / 40)}px sans-serif`;
          ctx.fillText(a.text, a.x1, a.y1);
        }
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not export the redacted image.");
      const file = new File([blob], attachment.filename.replace(/(\.[^.]+)?$/, "-redacted.png"), { type: "image/png" });
      await api.reports.attachments.uploadRedacted(attachment.id, file, attachment.caption || "");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the redacted copy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Redact & annotate screenshot" onClose={onClose}>
      <p className="small muted">
        Draw rectangles to cover sensitive areas. The saved copy has those pixels
        replaced with solid black — it is not an overlay. Always inspect the saved
        copy before sharing. The original is preserved.
      </p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {(["redact", "rect", "arrow", "text"] as const).map((t) => (
          <button key={t} className={`btn btn-sm ${tool === t ? "btn-primary" : ""}`} onClick={() => setTool(t)}>
            {t === "redact" ? "⬛ Redact" : t === "rect" ? "▭ Rectangle" : t === "arrow" ? "➜ Arrow" : "T Text"}
          </button>
        ))}
        <button className="btn btn-sm" onClick={() => { setRects(rects.slice(0, -1)); redraw(rects.slice(0, -1), annotations); }}>Undo redaction</button>
        <button className="btn btn-sm" onClick={() => { setRects([]); setAnnotations([]); redraw([], []); }}>Clear all</button>
      </div>
      {tool === "text" ? (
        <input className="input" value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Text label (click on the image to place it)" />
      ) : null}
      <div style={{ overflow: "auto", border: "1px solid var(--border-soft)", borderRadius: 8, marginTop: "0.5rem" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", maxWidth: "100%", touchAction: "none", cursor: "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setDrawing(null)}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save redacted copy"}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [steps, setSteps] = useState<Step[]>([]);
  const [envFields, setEnvFields] = useState<EnvField[]>([]);
  const [includeUrl, setIncludeUrl] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [redactTarget, setRedactTarget] = useState<Attachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [shareLinks, setShareLinks] = useState<{ id: string; expires_at: number | null; revoked: number; created_at: number }[]>([]);
  const [shareExpiry, setShareExpiry] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [comments, setComments] = useState(detail?.comments ?? []);
  const [commentText, setCommentText] = useState("");
  const [activity, setActivity] = useState<{ id: string; type: string; detail: string | null; actor_name: string; created_at: number }[]>([]);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [members, setMembers] = useState<{ user_id: string; name: string; email: string; role: string }[]>([]);
  const [allLabels, setAllLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [assignedLabels, setAssignedLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api.reports.get(id);
      setDetail(d);
      setComments(d.comments);
      setSteps(d.steps);
      setDraft({
        title: d.report.title,
        site_name: d.report.site_name || "",
        site_url: d.report.site_url || "",
        category: d.report.category || "",
        severity: d.report.severity || "",
        status: d.report.status,
        description: d.report.description || "",
        trying_to_do: d.report.trying_to_do || "",
        happened_instead: d.report.happened_instead || "",
        expected_result: d.report.expected_result || "",
        actual_result: d.report.actual_result || "",
        error_message: d.report.error_message || "",
        notes: d.report.notes || "",
        incident_at: d.report.incident_at ? new Date(d.report.incident_at).toISOString().slice(0, 16) : "",
        workspace_id: d.report.workspace_id || "",
        assignee_id: (d.report as { assignee_id?: string | null }).assignee_id || "",
      });
      try {
        setEnvFields(d.report.env_json ? (JSON.parse(d.report.env_json) as EnvField[]) : []);
      } catch {
        setEnvFields([]);
      }
      setAssignedLabels(d.labels || []);
      const links = await api.reports.share.list(id);
      setShareLinks(links.links);
      const act = await api.activity(id);
      setActivity(act.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.workspaces.list().then((r) => setWorkspaces(r.workspaces)).catch(() => {});
    api.labels.list().then((r) => setAllLabels(r.labels)).catch(() => {});
  }, []);

  // Assignee options come from the selected workspace's members.
  useEffect(() => {
    if (!draft.workspace_id) {
      setMembers([]);
      return;
    }
    api.workspaces
      .get(draft.workspace_id)
      .then((d) => setMembers(d.members))
      .catch(() => setMembers([]));
  }, [draft.workspace_id]);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const buildPayload = () => ({
    title: draft.title.trim(),
    site_name: draft.site_name.trim() || null,
    site_url: draft.site_url.trim() || null,
    category: draft.category || null,
    severity: draft.severity || null,
    status: draft.status,
    description: draft.description || null,
    trying_to_do: draft.trying_to_do || null,
    happened_instead: draft.happened_instead || null,
    expected_result: draft.expected_result || null,
    actual_result: draft.actual_result || null,
    error_message: draft.error_message || null,
    notes: draft.notes || null,
    incident_at: draft.incident_at ? new Date(draft.incident_at).getTime() : null,
    env_json: envFields.length ? JSON.stringify(envFields) : null,
    workspace_id: draft.workspace_id || null,
    assignee_id: draft.assignee_id || null,
    steps: steps.map((s) => ({ text: s.text, note: s.note ?? null, expected_result: s.expected_result ?? null })),
  });

  const save = async (showNotice = false) => {
    if (!draft.title.trim()) {
      setError("Title is required before saving.");
      return;
    }
    setSaveStatus("saving");
    setError("");
    try {
      if (isNew) {
        const res = await api.reports.create(buildPayload());
        setDirty(false);
        navigate(`/app/reports/${res.id}/edit`, { replace: true });
      } else if (id) {
        await api.reports.update(id, buildPayload());
        setDirty(false);
        setSaveStatus("saved");
        if (showNotice) setNotice("Report saved.");
        await load();
      }
    } catch (err) {
      setSaveStatus("failed");
      setError(err instanceof ApiError ? err.message : "Save failed. Your changes were not saved.");
    }
  };

  // Autosave: debounce 1.5s after changes (existing reports only).
  useEffect(() => {
    if (isNew || !dirty || !id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(false), 1500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, steps, envFields, dirty, id]);

  const loadSample = () => {
    setDraft({
      ...EMPTY_DRAFT,
      title: "Cannot log in after password reset (sample)",
      site_name: "Example Shop",
      site_url: "https://example-shop.test/login",
      category: "Login and authentication",
      severity: "High",
      status: "open",
      description: "After completing a password reset, login fails with an invalid-credentials error even though the reset reported success.",
      trying_to_do: "Log in with the new password after resetting it.",
      happened_instead: "The login form shows “Invalid email or password”.",
      expected_result: "Login succeeds with the new password.",
      actual_result: "Login fails with an invalid-credentials error.",
      error_message: "Invalid email or password",
    });
    setSteps([
      { text: "Open the login page." },
      { text: "Click “Forgot password” and complete the reset.", note: "Used the link from the reset email." },
      { text: "Return to login and enter the new password." },
      { text: "Observe the error message.", expected_result: "Login succeeds" },
    ]);
    setSampleLoaded(true);
    setDirty(true);
  };

  const clearSample = () => {
    setDraft(EMPTY_DRAFT);
    setSteps([]);
    setSampleLoaded(false);
    setDirty(true);
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
    setDirty(true);
  };

  const uploadFile = async (file: File) => {
    if (!id) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, and WebP images are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Each file must be 10 MB or smaller.");
      return;
    }
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      await api.reports.attachments.upload(id, file, "");
      setUploadProgress("");
      await load();
    } catch (err) {
      setUploadProgress("");
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    }
  };

  const quality = assessQuality(
    {
      title: draft.title,
      description: draft.description,
      trying_to_do: draft.trying_to_do,
      expected_result: draft.expected_result,
      actual_result: draft.actual_result,
      error_message: draft.error_message,
      category: draft.category,
      env_json: envFields.length ? JSON.stringify(envFields) : null,
    },
    steps,
    detail?.attachments.length ?? 0
  );

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let y = 12;
      const addLine = (text: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, 180);
        for (const line of lines) {
          if (y > 275) {
            doc.addPage();
            y = 12;
          }
          doc.text(line, 15, y);
          y += 7;
        }
      };
      addLine(draft.title || "Untitled report", true);
      addLine(`Status: ${draft.status}${draft.severity ? ` | Severity: ${draft.severity}` : ""}`);
      if (draft.site_name) addLine(`Site / app: ${draft.site_name}`);
      if (draft.description) {
        addLine("Problem description", true);
        addLine(draft.description);
      }
      if (draft.expected_result) {
        addLine("Expected behavior", true);
        addLine(draft.expected_result);
      }
      if (draft.actual_result) {
        addLine("Actual behavior", true);
        addLine(draft.actual_result);
      }
      if (steps.length) {
        addLine("Reproduction steps", true);
        steps.forEach((s, i) => addLine(`${i + 1}. ${s.text}`));
      }
      // Attachments: include up to 4, downscaled.
      const atts = (detail?.attachments ?? []).slice(0, 4);
      for (const a of atts) {
        try {
          const res = await fetch(api.reports.attachments.downloadUrl(a.id), { credentials: "same-origin" });
          if (!res.ok) continue;
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (y > 200) {
            doc.addPage();
            y = 12;
          }
          addLine(a.caption || a.filename, true);
          doc.addImage(dataUrl, "JPEG", 15, y, 120, 70);
          y += 78;
        } catch {
          // Skip an image that cannot be embedded; the report text is intact.
        }
      }
      doc.save(`${slugifyFilename(draft.title)}.pdf`);
      setNotice("PDF downloaded.");
    } catch {
      setError("PDF export failed in this browser.");
    }
  };

  const createShare = async () => {
    if (!id) return;
    try {
      const expires = shareExpiry ? new Date(shareExpiry).getTime() : null;
      const res = await api.reports.share.create(id, expires);
      setShareUrl(res.url);
      const links = await api.reports.share.list(id);
      setShareLinks(links.links);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create share link.");
    }
  };

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/app">← Dashboard</Link>
        <h1 style={{ margin: 0 }}>{isNew ? "New report" : "Edit report"}</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="small muted" aria-live="polite">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "failed" ? "Save failed — retrying on next change" : dirty ? "Unsaved changes" : ""}
          </span>
          <button className="btn btn-primary" onClick={() => void save(true)}>Save report</button>
          {!isNew && detail ? <Link className="btn" to={`/app/reports/${detail.report.id}`}>View</Link> : null}
        </div>
      </div>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {sampleLoaded ? (
        <Alert kind="info">
          Sample data loaded — this is example content, not a real report.{" "}
          <button className="btn btn-sm" onClick={clearSample}>Clear sample data</button>
        </Alert>
      ) : null}

      <div className="editor-layout" style={{ marginTop: "1rem" }}>
        <div>
          <section className="card">
            <h2>Basic information</h2>
            <Field label="Report title">
              <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Cannot log in after password reset" />
            </Field>
            <div className="grid grid-2">
              <Field label="Website or application name">
                <input className="input" value={draft.site_name} onChange={(e) => set({ site_name: e.target.value })} placeholder="e.g. Example Shop" />
              </Field>
              <Field label="Website URL (optional)">
                <input className="input" type="url" value={draft.site_url} onChange={(e) => set({ site_url: e.target.value })} placeholder="https://…" />
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Problem category">
                <select className="select" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Severity">
                <select className="select" value={draft.severity} onChange={(e) => set({ severity: e.target.value })}>
                  <option value="">Choose severity</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Status">
                <select className="select" value={draft.status} onChange={(e) => set({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Date and time of the incident (editable)">
                <input className="input" type="datetime-local" value={draft.incident_at} onChange={(e) => set({ incident_at: e.target.value })} />
              </Field>
            </div>
            <Field label="Workspace (optional)">
              <select className="select" value={draft.workspace_id} onChange={(e) => set({ workspace_id: e.target.value, assignee_id: "" })}>
                <option value="">Personal (no workspace)</option>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            {draft.workspace_id ? (
              <Field label="Assigned teammate (optional)">
                <select className="select" value={draft.assignee_id} onChange={(e) => set({ assignee_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({m.email})</option>)}
                </select>
              </Field>
            ) : null}
          </section>

          {!isNew && detail ? (
            <section className="card">
              <h2>Labels</h2>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {allLabels.map((l) => {
                  const assigned = assignedLabels.some((a) => a.id === l.id);
                  return (
                    <button
                      key={l.id}
                      className={`btn btn-sm ${assigned ? "btn-primary" : ""}`}
                      style={{ borderColor: l.color }}
                      onClick={async () => {
                        if (assigned) {
                          await api.labels.unassign(detail.report.id, l.id);
                          setAssignedLabels(assignedLabels.filter((a) => a.id !== l.id));
                        } else {
                          await api.labels.assign(detail.report.id, l.id);
                          setAssignedLabels([...assignedLabels, l]);
                        }
                      }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>New label</span>
                  <input className="input" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="e.g. urgent" />
                </label>
                <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} aria-label="Label color" />
                <button
                  className="btn"
                  onClick={async () => {
                    if (!newLabelName.trim()) return;
                    const res = await api.labels.create(newLabelName.trim(), newLabelColor, draft.workspace_id || null);
                    setAllLabels([...allLabels, { id: res.id, name: newLabelName.trim(), color: newLabelColor }]);
                    setNewLabelName("");
                  }}
                >
                  Create label
                </button>
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2>Problem description</h2>
            <Field label="What were you trying to do?" hint="Example: “Log in with my new password.”">
              <textarea className="textarea" value={draft.trying_to_do} onChange={(e) => set({ trying_to_do: e.target.value })} />
            </Field>
            <Field label="What happened instead?" hint="Example: “The login form showed an error.”">
              <textarea className="textarea" value={draft.happened_instead} onChange={(e) => set({ happened_instead: e.target.value })} />
            </Field>
            <Field label="What did you expect to happen?">
              <textarea className="textarea" value={draft.expected_result} onChange={(e) => set({ expected_result: e.target.value })} />
            </Field>
            <Field label="What actually happened?">
              <textarea className="textarea" value={draft.actual_result} onChange={(e) => set({ actual_result: e.target.value })} />
            </Field>
            <Field label="Exact error message (if available)" hint="Copy the message exactly — do not paraphrase.">
              <textarea className="textarea" value={draft.error_message} onChange={(e) => set({ error_message: e.target.value })} />
            </Field>
            <Field label="Problem description (overall summary)">
              <textarea className="textarea" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Additional notes">
              <textarea className="textarea" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            {!isNew ? (
              <button className="btn" type="button" onClick={loadSample}>Load example issue</button>
            ) : null}
          </section>

          <section className="card">
            <h2>Reproduction steps</h2>
            <p className="small muted">One concrete action per step, in order. Steps are numbered automatically.</p>
            {steps.map((s, i) => (
              <div className="step-row" key={s.id || i}>
                <span className="step-num">{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <input
                    className="input"
                    value={s.text}
                    onChange={(e) => { const next = [...steps]; next[i] = { ...next[i], text: e.target.value }; setSteps(next); setDirty(true); }}
                    placeholder="e.g. Click “Log in”."
                    aria-label={`Step ${i + 1}`}
                  />
                  <input
                    className="input"
                    style={{ marginTop: "0.25rem" }}
                    value={s.note || ""}
                    onChange={(e) => { const next = [...steps]; next[i] = { ...next[i], note: e.target.value }; setSteps(next); setDirty(true); }}
                    placeholder="Optional note for this step"
                    aria-label={`Note for step ${i + 1}`}
                  />
                  <input
                    className="input"
                    style={{ marginTop: "0.25rem" }}
                    value={s.expected_result || ""}
                    onChange={(e) => { const next = [...steps]; next[i] = { ...next[i], expected_result: e.target.value }; setSteps(next); setDirty(true); }}
                    placeholder="Optional expected result for this step"
                    aria-label={`Expected result for step ${i + 1}`}
                  />
                </div>
                <div className="step-actions">
                  <button className="btn btn-sm" onClick={() => moveStep(i, -1)} aria-label="Move step up">↑</button>
                  <button className="btn btn-sm" onClick={() => moveStep(i, 1)} aria-label="Move step down">↓</button>
                  <button className="btn btn-sm" onClick={() => { setSteps(steps.filter((_, j) => j !== i)); setDirty(true); }} aria-label="Delete step">✕</button>
                </div>
              </div>
            ))}
            <button className="btn" onClick={() => { setSteps([...steps, { text: "" }]); setDirty(true); }}>+ Add step</button>
          </section>

          <section className="card">
            <h2>Environment details (optional)</h2>
            <p className="small muted">
              Collected only when you click the button, using standard browser APIs. Values
              may be incomplete or inaccurate. Review and remove any field before saving.
            </p>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <input type="checkbox" checked={includeUrl} onChange={(e) => setIncludeUrl(e.target.checked)} />
              Include the current page URL (this ReproKit page, not the problem site)
            </label>
            <button className="btn" onClick={() => { setEnvFields(collectEnvironment(includeUrl)); setDirty(true); }}>
              Add environment details
            </button>
            {envFields.length > 0 ? (
              <ul>
                {envFields.map((f) => (
                  <li key={f.key}>
                    <strong>{f.label}:</strong> {f.value}{" "}
                    <button className="btn btn-sm" onClick={() => { setEnvFields(envFields.filter((x) => x.key !== f.key)); setDirty(true); }}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {!isNew && detail ? (
            <section className="card">
              <h2>Screenshot evidence</h2>
              <p className="small muted">
                PNG, JPEG, or WebP, up to 10 MB each. Review every screenshot for passwords,
                tokens, payment info, or private messages before sharing.
              </p>
              <label
                style={{ display: "block", border: "2px dashed var(--border)", borderRadius: 8, padding: "1.25rem", textAlign: "center", cursor: "pointer" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) void uploadFile(f);
                }}
              >
                Drop an image here or click to choose one
                <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ""; }} />
              </label>
              {uploadProgress ? <p className="small">{uploadProgress}</p> : null}
              <div className="thumb-grid" style={{ marginTop: "1rem" }}>
                {detail.attachments.map((a) => (
                  <div className="thumb" key={a.id}>
                    <a href={api.reports.attachments.downloadUrl(a.id)} target="_blank" rel="noreferrer">
                      <img src={api.reports.attachments.downloadUrl(a.id)} alt={a.caption || a.filename} />
                    </a>
                    <div className="thumb-body small">
                      {a.caption || a.filename}
                      {a.is_redacted ? " (redacted copy)" : ""}
                      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        <button className="btn btn-sm" onClick={() => setRedactTarget(a)}>Redact / annotate</button>
                        <button className="btn btn-sm" onClick={async () => { if (window.confirm("Remove this attachment?")) { await api.reports.attachments.remove(a.id); await load(); } }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <Alert kind="info">Save the report first — screenshots can be added after the report exists.</Alert>
          )}

          {!isNew && detail ? (
            <>
              <section className="card">
                <h2>Share links</h2>
                <p className="small muted">Reports are private by default. A share link creates a read-only public view. You can revoke it at any time — revocation blocks all future access.</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
                  <Field label="Optional expiry">
                    <input className="input" type="datetime-local" value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)} />
                  </Field>
                  <button className="btn btn-primary" onClick={() => void createShare()}>Create share link</button>
                </div>
                {shareUrl ? <p style={{ wordBreak: "break-all" }}><a href={shareUrl}>{shareUrl}</a> <button className="btn btn-sm" onClick={() => void copyTextWithFallback(shareUrl)}>Copy</button></p> : null}
                <ul>
                  {shareLinks.map((l) => (
                    <li key={l.id}>
                      Created {new Date(l.created_at).toLocaleString()}
                      {l.expires_at ? ` · expires ${new Date(l.expires_at).toLocaleString()}` : " · no expiry"}
                      {l.revoked ? " · REVOKED" : ""}
                      {!l.revoked ? <button className="btn btn-sm" style={{ marginLeft: "0.5rem" }} onClick={async () => { await api.reports.share.revoke(detail.report.id, l.id); const links = await api.reports.share.list(detail.report.id); setShareLinks(links.links); }}>Revoke</button> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <h2>Comments</h2>
                {comments.length === 0 ? <EmptyState title="No comments yet" body="Add the first note to this report." /> : (
                  <ul>
                    {comments.map((c) => (
                      <li key={c.id} style={{ marginBottom: "0.75rem" }}>
                        <strong>{c.author_name}</strong> <span className="small faint">{new Date(c.created_at).toLocaleString()}</span>
                        <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!commentText.trim()) return;
                    await api.reports.comments.add(detail.report.id, commentText.trim());
                    setCommentText("");
                    await load();
                  }}
                >
                  <Field label="Add a comment">
                    <textarea className="textarea" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  </Field>
                  <button className="btn btn-primary" type="submit">Post comment</button>
                </form>
              </section>

              <section className="card">
                <h2>Activity</h2>
                {activity.length === 0 ? <p className="muted">No activity yet.</p> : (
                  <ul>
                    {activity.map((a) => (
                      <li key={a.id}><strong>{a.actor_name}</strong> — {a.type}{a.detail ? `: ${a.detail}` : ""} <span className="small faint">{new Date(a.created_at).toLocaleString()}</span></li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>

        <div>
          <section className="card">
            <h2>Report quality <span className="badge">{quality.score}/100</span></h2>
            <p className="small muted">Deterministic rule-based checks — not AI. Each suggestion explains why it appears.</p>
            {quality.issues.length === 0 ? <p>✓ This report looks complete.</p> : (
              <ul>
                {quality.issues.map((i) => (
                  <li key={i.id}><strong>{i.message}</strong><div className="small muted">Why: {i.why}</div></li>
                ))}
              </ul>
            )}
            {quality.suggestedTitle ? (
              <p className="small">
                Suggested title: <em>{quality.suggestedTitle}</em>{" "}
                <button className="btn btn-sm" onClick={() => set({ title: quality.suggestedTitle || "" })}>Use it</button>
              </p>
            ) : null}
            {quality.followUps.length ? (
              <>
                <h3>Follow-up questions</h3>
                <ul>{quality.followUps.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </>
            ) : null}
          </section>

          <section className="card">
            <h2>Live preview</h2>
            <div className="print-area" style={{ border: "1px solid var(--border-soft)", borderRadius: 8, padding: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <StatusBadge status={draft.status} />
                <SeverityBadge severity={draft.severity || null} />
                {draft.category ? <span className="badge">{draft.category}</span> : null}
              </div>
              <h3>{draft.title || "Untitled report"}</h3>
              {draft.description ? <p style={{ whiteSpace: "pre-wrap" }}>{draft.description}</p> : <p className="muted">No description yet.</p>}
              {steps.length ? (
                <ol>
                  {steps.map((s, i) => <li key={i}>{s.text || <em>(empty step)</em>}</li>)}
                </ol>
              ) : <p className="muted">No steps yet.</p>}
            </div>
          </section>

          <section className="card">
            <h2>Export</h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => { if (detail) { downloadBlob(new Blob([reportToMarkdown(detail.report, steps, detail.attachments)], { type: "text/markdown" }), `${slugifyFilename(draft.title)}.md`); setNotice("Markdown downloaded."); } }}>Markdown</button>
              <button className="btn" onClick={() => void exportPDF()}>PDF</button>
              <button className="btn" onClick={() => { if (detail) { downloadBlob(new Blob([reportToJSON(detail.report, steps, detail.attachments)], { type: "application/json" }), `${slugifyFilename(draft.title)}.json`); setNotice("JSON downloaded."); } }}>JSON</button>
              <button className="btn" onClick={async () => { if (detail) { const ok = await copyTextWithFallback(reportToText(detail.report, steps)); setNotice(ok ? "Report copied." : "Copy failed — clipboard blocked."); } }}>Copy</button>
              <button className="btn" onClick={() => window.print()}>Print</button>
            </div>
            <p className="small muted">Exports reflect the saved report. Save first if you just edited.</p>
          </section>
        </div>
      </div>

      {redactTarget ? (
        <RedactionModal
          attachment={redactTarget}
          onClose={() => setRedactTarget(null)}
          onSaved={async () => { setRedactTarget(null); setNotice("Redacted copy saved as a new attachment."); await load(); }}
        />
      ) : null}
    </main>
  );
}
