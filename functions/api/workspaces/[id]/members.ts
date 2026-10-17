import { getSession } from "../../../lib/auth";
import { err, json, newId, now, type Env } from "../../../lib/util";
import { inviteSchema, zodErrorMessage } from "../../../lib/schemas";

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const ws = await context.env.DB.prepare("SELECT * FROM workspaces WHERE id = ?").bind(context.params.id).first<{ id: string }>();
  if (!ws) return err("Workspace not found", 404);
  const role = await context.env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(ws.id, session.user.id).first<{ role: string }>();
  if (role?.role !== "owner" && role?.role !== "admin") return err("Forbidden", 403);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const existing = await context.env.DB.prepare(
    "SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = (SELECT id FROM user WHERE email = ?)"
  ).bind(ws.id, parsed.data.email.toLowerCase()).first();
  if (existing) return err("That user is already a member of this workspace.", 400);
  // High-entropy invite code (256-bit). Stored raw: it is a capability the
  // inviter shares manually; it expires in 7 days and is single-use.
  // NOTE: share links store only a hash, but invite codes are looked up by
  // exact code; email delivery is blocked, so the code travels via the
  // inviter. Codes expire and are invalidated on accept.
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const code = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const id = newId();
  const ts = now();
  await context.env.DB.prepare(
    "INSERT INTO workspace_invites (id, workspace_id, email, code, role, created_by, expires_at, accepted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)"
  ).bind(id, ws.id, parsed.data.email.toLowerCase(), code, parsed.data.role, session.user.id, ts + 7 * 24 * 60 * 60 * 1000, ts).run();
  const url = new URL(context.request.url);
  // No email is sent: email delivery is BLOCKED (no provider). The inviter
  // shares this link manually.
  return json({ code, link: `${url.origin}/invite/${code}` }, 201);
}
