import { FIXED_OWNER_ID, getSession } from "../lib/auth";
import { logActivity } from "../lib/permissions";
import { err, getClientIp, json, newId, now, rateLimit, type Env } from "../lib/util";
import { reportCreateSchema, zodErrorMessage } from "../lib/schemas";

function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const userId = session.user.id;
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const status = url.searchParams.get("status") || "";
  const severity = url.searchParams.get("severity") || "";
  const category = url.searchParams.get("category") || "";
  const workspaceId = url.searchParams.get("workspace_id") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const assigned = url.searchParams.get("assigned") === "me";
  const sort = url.searchParams.get("sort") || "updated_desc";

  // Visibility: own reports + reports in workspaces the user belongs to.
  const where: string[] = [
    "(r.owner_id = ? OR r.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?))",
    "r.archived = 0",
  ];
  const params: unknown[] = [userId, userId];
  if (status) { where.push("r.status = ?"); params.push(status); }
  if (severity) { where.push("r.severity = ?"); params.push(severity); }
  if (category) { where.push("r.category = ?"); params.push(category); }
  if (workspaceId) { where.push("r.workspace_id = ?"); params.push(workspaceId); }
  if (assigned) { where.push("r.owner_id = ?"); params.push(userId); }
  if (q) {
    where.push("(r.title LIKE ? OR r.description LIKE ? OR r.error_message LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const order =
    sort === "created_desc" ? "r.created_at DESC" :
    sort === "created_asc" ? "r.created_at ASC" :
    sort === "title_asc" ? "r.title ASC" : "r.updated_at DESC";

  const rows = await env.DB.prepare(
    `SELECT r.*, COALESCE(u.name, 'Owner') AS owner_name,
     (SELECT COUNT(*) FROM attachments a WHERE a.report_id = r.id AND a.deleted_at IS NULL) AS attachment_count
     FROM reports r LEFT JOIN user u ON u.id = r.owner_id
     WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM reports r WHERE ${where.join(" AND ")}`
  ).bind(...params).first<{ c: number }>();
  return json({ reports: rows.results ?? [], total: total?.c ?? 0, page, limit });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const userId = session.user.id;
  const ip = getClientIp(request);
  if (!(await rateLimit(env.DB, `report-create:${ip}:${userId}`, 30, 60_000))) {
    return err("Too many requests. Please slow down.", 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const d = parsed.data;

  // Workspace assignment requires membership.
  if (d.workspace_id) {
    const member = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(d.workspace_id, userId).first();
    if (!member) return err("Not a member of that workspace", 403);
  }

  // Assignee must exist; if the report is in a workspace, the assignee must
  // be a member of that workspace. The fixed single owner ("owner") is always
  // valid without a user-table row (no-login mode).
  if (d.assignee_id) {
    if (d.assignee_id !== FIXED_OWNER_ID) {
      const assignee = await env.DB.prepare("SELECT id FROM user WHERE id = ?").bind(d.assignee_id).first();
      if (!assignee) return err("Assignee not found", 400);
    }
    if (d.workspace_id) {
      const member = await env.DB.prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
      ).bind(d.workspace_id, d.assignee_id).first();
      if (!member) return err("Assignee is not a member of that workspace", 400);
    }
  }

  const id = newId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO reports (id, owner_id, workspace_id, assignee_id, title, site_name, site_url, category, severity,
      status, description, trying_to_do, happened_instead, expected_result, actual_result,
      error_message, notes, incident_at, env_json, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    id, userId, d.workspace_id ?? null, d.assignee_id ?? null, d.title, d.site_name ?? null, d.site_url ?? null,
    d.category ?? null, d.severity ?? null, d.status ?? "draft",
    d.description ?? null, d.trying_to_do ?? null, d.happened_instead ?? null,
    d.expected_result ?? null, d.actual_result ?? null, d.error_message ?? null,
    d.notes ?? null, d.incident_at ?? null, d.env_json ?? null, ts, ts
  ).run();

  if (d.steps?.length) {
    const stmts = d.steps.map((s, i) =>
      env.DB.prepare(
        "INSERT INTO report_steps (id, report_id, position, text, note, expected_result) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(newId(), id, i + 1, s.text, s.note ?? null, s.expected_result ?? null)
    );
    await env.DB.batch(stmts);
  }
  await logActivity(env.DB, { report_id: id, workspace_id: d.workspace_id ?? null, actor_id: userId, type: "report.created", detail: d.title });
  return json({ id }, 201);
}
