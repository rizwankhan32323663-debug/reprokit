export interface ReportRow {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  title: string;
  site_name: string | null;
  site_url: string | null;
  category: string | null;
  severity: string | null;
  status: string;
  description: string | null;
  trying_to_do: string | null;
  happened_instead: string | null;
  expected_result: string | null;
  actual_result: string | null;
  error_message: string | null;
  notes: string | null;
  incident_at: number | null;
  env_json: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
}

export async function getReport(db: D1Database, id: string): Promise<ReportRow | null> {
  return db.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first<ReportRow>();
}

export async function isWorkspaceMember(
  db: D1Database,
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const row = await db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(workspaceId, userId)
    .first<{ role: string }>();
  return row ? row.role : null;
}

/** View access: report owner, or any member of the report's workspace. */
export async function canViewReport(
  db: D1Database,
  userId: string,
  report: ReportRow
): Promise<boolean> {
  if (report.owner_id === userId) return true;
  if (report.workspace_id) {
    return (await isWorkspaceMember(db, report.workspace_id, userId)) !== null;
  }
  return false;
}

/** Edit access: report owner, or owner/admin of the report's workspace. */
export async function canEditReport(
  db: D1Database,
  userId: string,
  report: ReportRow
): Promise<boolean> {
  if (report.owner_id === userId) return true;
  if (report.workspace_id) {
    const role = await isWorkspaceMember(db, report.workspace_id, userId);
    return role === "owner" || role === "admin";
  }
  return false;
}

export async function logActivity(
  db: D1Database,
  input: { report_id?: string | null; workspace_id?: string | null; actor_id: string; type: string; detail?: string }
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO activity_events (id, report_id, workspace_id, actor_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), input.report_id ?? null, input.workspace_id ?? null, input.actor_id, input.type, input.detail ?? null, Date.now())
    .run();
}

export async function notify(
  db: D1Database,
  input: { user_id: string; type: string; title: string; body?: string; link?: string }
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
    )
    .bind(crypto.randomUUID(), input.user_id, input.type, input.title, input.body ?? null, input.link ?? null, Date.now())
    .run();
}
