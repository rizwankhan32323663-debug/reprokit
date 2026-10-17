-- ReproKit migration 0003 — report assignee.
-- Additive only.
ALTER TABLE reports ADD COLUMN assignee_id TEXT REFERENCES user(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reports_assignee ON reports(assignee_id);
