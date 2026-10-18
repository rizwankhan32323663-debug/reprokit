import { FIXED_OWNER_ID, getSession } from "../../lib/auth";
import { canEditReport, canViewReport, getReport, logActivity } from "../../lib/permissions";
import { err, json, now, type Env } from "../../lib/util";
import { reportUpdateSchema, zodErrorMessage } from "../../lib/schemas";
import { getStorageProvider } from "../../lib/storage";

async function load(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return { error: err("Unauthorized", 401) };
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return { error: err("Report not found", 404) };
  return { session, report };
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const loaded = await load(context);
  if ("error" in loaded) return loaded.error;
  const { session, report } = loaded;
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const steps = await context.env.DB.prepare(
    "SELECT * FROM report_steps WHERE report_id = ? ORDER BY position ASC"
  ).bind(report.id).all();
  const attachments = await context.env.DB.prepare(
    "SELECT id, filename, content_type, size_bytes, caption, is_redacted, created_at FROM attachments WHERE report_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
  ).bind(report.id).all();
  const comments = await context.env.DB.prepare(
    "SELECT c.*, COALESCE(u.name, 'Owner') AS author_name FROM comments c LEFT JOIN user u ON u.id = c.author_id WHERE report_id = ? ORDER BY created_at ASC"
  ).bind(report.id).all();
  const labels = await context.env.DB.prepare(
    "SELECT l.* FROM labels l JOIN report_labels rl ON rl.label_id = l.id WHERE rl.report_id = ?"
  ).bind(report.id).all();
  return json({ report, steps: steps.results ?? [], attachments: attachments.results ?? [], comments: comments.results ?? [], labels: labels.results ?? [] });
}

export async function onRequestPut(context: { request: Request; env: Env; params: { id: string } }) {
  const loaded = await load(context);
  if ("error" in loaded) return loaded.error;
  const { session, report } = loaded;
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = reportUpdateSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const d = parsed.data;

  if (d.workspace_id !== undefined && d.workspace_id) {
    const member = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(d.workspace_id, session.user.id).first();
    if (!member) return err("Not a member of that workspace", 403);
  }

  if (d.assignee_id !== undefined && d.assignee_id) {
    // The fixed single owner ("owner") is always valid without a user-table
    // row (no-login mode).
    if (d.assignee_id !== FIXED_OWNER_ID) {
      const assignee = await context.env.DB.prepare("SELECT id FROM user WHERE id = ?").bind(d.assignee_id).first();
      if (!assignee) return err("Assignee not found", 400);
    }
    const wsId = d.workspace_id !== undefined ? d.workspace_id : report.workspace_id;
    if (wsId) {
      const member = await context.env.DB.prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
      ).bind(wsId, d.assignee_id).first();
      if (!member) return err("Assignee is not a member of that workspace", 400);
    }
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  const assign = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
  if (d.title !== undefined) assign("title", d.title);
  if (d.site_name !== undefined) assign("site_name", d.site_name);
  if (d.site_url !== undefined) assign("site_url", d.site_url);
  if (d.category !== undefined) assign("category", d.category);
  if (d.severity !== undefined) assign("severity", d.severity);
  if (d.status !== undefined) assign("status", d.status);
  if (d.description !== undefined) assign("description", d.description);
  if (d.trying_to_do !== undefined) assign("trying_to_do", d.trying_to_do);
  if (d.happened_instead !== undefined) assign("happened_instead", d.happened_instead);
  if (d.expected_result !== undefined) assign("expected_result", d.expected_result);
  if (d.actual_result !== undefined) assign("actual_result", d.actual_result);
  if (d.error_message !== undefined) assign("error_message", d.error_message);
  if (d.notes !== undefined) assign("notes", d.notes);
  if (d.incident_at !== undefined) assign("incident_at", d.incident_at);
  if (d.env_json !== undefined) assign("env_json", d.env_json);
  if (d.workspace_id !== undefined) assign("workspace_id", d.workspace_id);
  if (d.assignee_id !== undefined) assign("assignee_id", d.assignee_id);
  if (d.archived !== undefined) assign("archived", d.archived ? 1 : 0);
  assign("updated_at", now());
  if (sets.length > 1) {
    await context.env.DB.prepare(`UPDATE reports SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, report.id).run();
  }
  if (d.steps !== undefined) {
    await context.env.DB.prepare("DELETE FROM report_steps WHERE report_id = ?").bind(report.id).run();
    if (d.steps.length) {
      const stmts = d.steps.map((s, i) =>
        context.env.DB.prepare(
          "INSERT INTO report_steps (id, report_id, position, text, note, expected_result) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), report.id, i + 1, s.text, s.note ?? null, s.expected_result ?? null)
      );
      await context.env.DB.batch(stmts);
    }
  }
  await logActivity(context.env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "report.updated", detail: report.title });
  return json({ ok: true });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const loaded = await load(context);
  if ("error" in loaded) return loaded.error;
  const { session, report } = loaded;
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  // Delete storage objects for this report's attachments first (including
  // soft-deleted ones — their bytes must not linger after report deletion).
  const atts = await context.env.DB.prepare("SELECT r2_key FROM attachments WHERE report_id = ?").bind(report.id).all<{ r2_key: string }>();
  const provider = getStorageProvider(context.env);
  for (const a of atts.results ?? []) {
    if (!provider) break; // No provider configured: nothing to delete remotely.
    try {
      await provider.delete(a.r2_key);
    } catch {
      // Continue: DB row removal below still applies; orphaned objects are
      // listed in README recovery notes.
    }
  }
  await context.env.DB.prepare("DELETE FROM reports WHERE id = ?").bind(report.id).run();
  return json({ ok: true });
}
