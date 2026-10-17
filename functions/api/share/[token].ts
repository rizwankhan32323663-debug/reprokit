import { err, json, sha256Hex, type Env } from "../../lib/util";

/**
 * Public read-only share view. NO authentication. The token is hashed and
 * looked up on EVERY request; revoked or expired links fail immediately —
 * previously issued URLs grant no continued access beyond validity.
 * Internal fields (owner, workspace, comments, activity, DB ids) are
 * stripped from the response.
 */
async function resolveShare(env: Env, token: string) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const link = await env.DB.prepare("SELECT * FROM share_links WHERE token_hash = ?").bind(hash).first<{
    report_id: string; expires_at: number | null; revoked: number;
  }>();
  if (!link) return null;
  if (link.revoked) return null;
  if (link.expires_at && link.expires_at < Date.now()) return null;
  const report = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(link.report_id).first();
  if (!report) return null;
  return { link, report };
}

export async function onRequestGet(context: { request: Request; env: Env; params: { token: string } }) {
  const resolved = await resolveShare(context.env, context.params.token);
  if (!resolved) return err("This share link is invalid, expired, or revoked.", 404);
  const { report } = resolved as { report: Record<string, unknown> };
  const steps = await context.env.DB.prepare(
    "SELECT id, text, note, expected_result FROM report_steps WHERE report_id = ? ORDER BY position ASC"
  ).bind(report.id as string).all();
  const attachments = await context.env.DB.prepare(
    "SELECT id, filename, caption, is_redacted FROM attachments WHERE report_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
  ).bind(report.id as string).all();
  return json({
    report: {
      title: report.title,
      site_name: report.site_name,
      site_url: report.site_url,
      category: report.category,
      severity: report.severity,
      status: report.status,
      description: report.description,
      trying_to_do: report.trying_to_do,
      happened_instead: report.happened_instead,
      expected_result: report.expected_result,
      actual_result: report.actual_result,
      error_message: report.error_message,
      notes: report.notes,
      incident_at: report.incident_at,
      env_json: report.env_json,
      created_at: report.created_at,
      updated_at: report.updated_at,
    },
    steps: steps.results ?? [],
    attachments: attachments.results ?? [],
    shareToken: context.params.token,
  });
}
