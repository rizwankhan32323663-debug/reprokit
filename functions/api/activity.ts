import { getSession } from "../lib/auth";
import { canViewReport, getReport } from "../lib/permissions";
import { err, json, type Env } from "../lib/util";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const url = new URL(context.request.url);
  const reportId = url.searchParams.get("report_id") || "";
  const workspaceId = url.searchParams.get("workspace_id") || "";
  if (reportId) {
    const report = await getReport(context.env.DB, reportId);
    if (!report) return err("Report not found", 404);
    if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
    const rows = await context.env.DB.prepare(
      `SELECT a.*, COALESCE(u.name, 'Owner') AS actor_name FROM activity_events a LEFT JOIN user u ON u.id = a.actor_id
       WHERE a.report_id = ? ORDER BY a.created_at DESC LIMIT 100`
    ).bind(reportId).all();
    return json({ events: rows.results ?? [] });
  }
  if (workspaceId) {
    const role = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, session.user.id).first();
    if (!role) return err("Not found", 404);
    const rows = await context.env.DB.prepare(
      `SELECT a.*, COALESCE(u.name, 'Owner') AS actor_name FROM activity_events a LEFT JOIN user u ON u.id = a.actor_id
       WHERE a.workspace_id = ? ORDER BY a.created_at DESC LIMIT 100`
    ).bind(workspaceId).all();
    return json({ events: rows.results ?? [] });
  }
  // Own activity: events the user caused or on their reports.
  const rows = await context.env.DB.prepare(
    `SELECT a.*, COALESCE(u.name, 'Owner') AS actor_name FROM activity_events a LEFT JOIN user u ON u.id = a.actor_id
     WHERE a.actor_id = ? OR a.report_id IN (SELECT id FROM reports WHERE owner_id = ?)
     ORDER BY a.created_at DESC LIMIT 100`
  ).bind(session.user.id, session.user.id).all();
  return json({ events: rows.results ?? [] });
}
