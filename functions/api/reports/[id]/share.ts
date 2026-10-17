import { getSession } from "../../../lib/auth";
import { canEditReport, getReport, logActivity } from "../../../lib/permissions";
import { err, json, newId, now, sha256Hex, type Env } from "../../../lib/util";

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  const links = await context.env.DB.prepare(
    "SELECT id, expires_at, revoked, created_at FROM share_links WHERE report_id = ? ORDER BY created_at DESC"
  ).bind(report.id).all();
  return json({ links: links.results ?? [] });
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(env.DB, session.user.id, report))) return err("Forbidden", 403);
  let body: { expires_at?: number | null } = {};
  try {
    body = (await request.json()) as { expires_at?: number | null };
  } catch {
    // No body: no expiry.
  }
  const expiresAt = typeof body.expires_at === "number" && body.expires_at > Date.now() ? body.expires_at : null;
  // High-entropy token (256-bit). Only the SHA-256 hash is stored; the raw
  // token is returned once to the creator and never logged.
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const tokenHash = await sha256Hex(token);
  const id = newId();
  await env.DB.prepare(
    "INSERT INTO share_links (id, report_id, token_hash, expires_at, revoked, created_by, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
  ).bind(id, report.id, tokenHash, expiresAt, session.user.id, now()).run();
  await logActivity(env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "share.created" });
  const url = new URL(request.url);
  return json({ id, token, url: `${url.origin}/share/${token}` }, 201);
}
