import { getSession } from "../lib/auth";
import { err, json, type Env } from "../lib/util";

/** Real dashboard statistics computed from D1 — never hardcoded. */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const userId = session.user.id;
  const visible =
    "(r.owner_id = ? OR r.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?))";
  const count = async (extra: string, params: unknown[]) => {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM reports r WHERE ${visible} AND ${extra}`
    ).bind(userId, userId, ...params).first<{ c: number }>();
    return row?.c ?? 0;
  };
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [total, drafts, open, resolved, recent] = await Promise.all([
    count("r.archived = 0", []),
    count("r.archived = 0 AND r.status = 'draft'", []),
    count("r.archived = 0 AND r.status IN ('open','in_progress')", []),
    count("r.archived = 0 AND r.status IN ('resolved','closed')", []),
    count("r.archived = 0 AND r.updated_at >= ?", [weekAgo]),
  ]);
  const bySeverity = await env.DB.prepare(
    `SELECT COALESCE(r.severity,'Unspecified') AS severity, COUNT(*) AS c FROM reports r
     WHERE ${visible} AND r.archived = 0 GROUP BY r.severity ORDER BY c DESC`
  ).bind(userId, userId).all();
  const byStatus = await env.DB.prepare(
    `SELECT r.status, COUNT(*) AS c FROM reports r
     WHERE ${visible} AND r.archived = 0 GROUP BY r.status`
  ).bind(userId, userId).all();
  const storage = await env.DB.prepare(
    `SELECT COALESCE(SUM(a.size_bytes),0) AS bytes FROM attachments a
     JOIN reports r ON r.id = a.report_id WHERE ${visible} AND a.deleted_at IS NULL`
  ).bind(userId, userId).first<{ bytes: number }>();
  const unread = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0"
  ).bind(userId).first<{ c: number }>();
  return json({
    total,
    drafts,
    open,
    resolved,
    recentlyUpdated: recent,
    bySeverity: bySeverity.results ?? [],
    byStatus: byStatus.results ?? [],
    storageBytes: storage?.bytes ?? 0,
    unreadNotifications: unread?.c ?? 0,
  });
}
