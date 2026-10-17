import { err, sha256Hex, type Env } from "../../../../lib/util";
import { getStorageProvider } from "../../../../lib/storage";

async function resolveShare(env: Env, token: string) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const link = await env.DB.prepare("SELECT * FROM share_links WHERE token_hash = ?").bind(hash).first<{
    report_id: string; expires_at: number | null; revoked: number;
  }>();
  if (!link) return null;
  if (link.revoked) return null;
  if (link.expires_at && link.expires_at < Date.now()) return null;
  return link;
}

export async function onRequestGet(context: { request: Request; env: Env; params: { token: string; id: string } }) {
  const link = await resolveShare(context.env, context.params.token);
  if (!link) return err("This share link is invalid, expired, or revoked.", 404);
  const att = await context.env.DB.prepare("SELECT * FROM attachments WHERE id = ? AND report_id = ?")
    .bind(context.params.id, link.report_id)
    .first<{ r2_key: string; filename: string; content_type: string; deleted_at: number | null }>();
  if (!att || att.deleted_at) return err("Attachment not found", 404);
  const provider = getStorageProvider(context.env);
  if (!provider) return err("Screenshot storage is not configured.", 503);
  const obj = await provider.get(att.r2_key);
  if (!obj) return err("Attachment file missing", 404);
  const headers = new Headers();
  headers.set("Content-Type", att.content_type);
  headers.set("Content-Disposition", `inline; filename="${att.filename.replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { headers });
}
