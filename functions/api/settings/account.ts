import { getSession } from "../../lib/auth";
import { err, json, type Env } from "../../lib/util";
import { getStorageProvider } from "../../lib/storage";

/**
 * Account deletion. Retention policy: deleting the account removes the user
 * row; reports/comments/sessions/accounts cascade via FK. Attachments'
 * storage objects are deleted first so no orphaned files remain. Workspaces the user
 * owns are transferred to another member when one exists; otherwise the
 * workspace is deleted (its reports' workspace_id becomes NULL via FK).
 */
export async function onRequestDelete(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const userId = session.user.id;
  const db = context.env.DB;

  // Delete storage objects for the user's own reports' attachments.
  const atts = await db.prepare(
    "SELECT a.r2_key FROM attachments a JOIN reports r ON r.id = a.report_id WHERE r.owner_id = ?"
  ).bind(userId).all<{ r2_key: string }>();
  const provider = getStorageProvider(context.env);
  for (const a of atts.results ?? []) {
    if (!provider) break;
    try {
      await provider.delete(a.r2_key);
    } catch {
      // Continue: the DB rows are removed below.
    }
  }

  // Transfer or delete owned workspaces.
  const owned = await db.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).all<{ id: string }>();
  for (const w of owned.results ?? []) {
    const others = await db.prepare(
      "SELECT user_id, role FROM workspace_members WHERE workspace_id = ? AND user_id != ? ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1"
    ).bind(w.id, userId).first<{ user_id: string }>();
    if (others) {
      await db.prepare("UPDATE workspaces SET owner_id = ? WHERE id = ?").bind(others.user_id, w.id).run();
      await db.prepare("UPDATE workspace_members SET role = 'owner' WHERE workspace_id = ? AND user_id = ?").bind(w.id, others.user_id).run();
    } else {
      await db.prepare("DELETE FROM workspaces WHERE id = ?").bind(w.id).run();
    }
  }

  await db.prepare("DELETE FROM user WHERE id = ?").bind(userId).run();
  return json({ ok: true });
}
