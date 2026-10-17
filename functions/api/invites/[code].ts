import { getSession } from "../../lib/auth";
import { err, json, now, type Env } from "../../lib/util";

export async function onRequestPost(context: { request: Request; env: Env; params: { code: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const invite = await context.env.DB.prepare("SELECT * FROM workspace_invites WHERE code = ?").bind(context.params.code).first<{
    id: string; workspace_id: string; email: string; role: string; expires_at: number; accepted_at: number | null;
  }>();
  if (!invite) return err("Invite not found.", 404);
  if (invite.accepted_at) return err("This invite was already used.", 400);
  if (invite.expires_at < Date.now()) return err("This invite has expired.", 400);
  // Invites are tied to the invited email address.
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return err("This invite was sent to a different email address.", 403);
  }
  const existing = await context.env.DB.prepare(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
  ).bind(invite.workspace_id, session.user.id).first();
  if (existing) return err("You are already a member of this workspace.", 400);
  await context.env.DB.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)"
  ).bind(invite.workspace_id, session.user.id, invite.role, now()).run();
  await context.env.DB.prepare("UPDATE workspace_invites SET accepted_at = ? WHERE id = ?").bind(now(), invite.id).run();
  return json({ workspace_id: invite.workspace_id });
}
