import { getSession } from "../lib/auth";
import { err, json, type Env } from "../lib/util";
import { storageProviderName, usageForUser, usageForWorkspace } from "../lib/storage";

/**
 * GET /api/storage[?workspace_id=...]
 *
 * Honest storage status for the upload UI: which provider is configured
 * (kv | r2 | none), whether uploads are available, and the current user's
 * quota usage (plus the workspace quota when workspace_id is given AND the
 * user belongs to that workspace). No byte counts for workspaces the user
 * cannot access are ever returned.
 */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const provider = storageProviderName(context.env);
  const user = await usageForUser(context.env.DB, session.user.id);
  const url = new URL(context.request.url);
  const workspaceId = url.searchParams.get("workspace_id");
  let workspace = null;
  if (workspaceId) {
    const member = await context.env.DB.prepare(
      `SELECT 1 AS ok FROM workspace_members WHERE workspace_id = ? AND user_id = ?
       UNION SELECT 1 FROM workspaces WHERE id = ? AND owner_id = ? LIMIT 1`
    ).bind(workspaceId, session.user.id, workspaceId, session.user.id).first<{ ok: number }>();
    if (member) {
      workspace = await usageForWorkspace(context.env.DB, workspaceId);
    }
  }
  return json({
    provider,
    configured: provider !== "none",
    quota: { user, workspace },
  });
}
