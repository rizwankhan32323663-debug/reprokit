-- ReproKit migration 0004 — soft-delete for attachments + storage provider tag.
-- Additive only. No DROP statements.
--
-- deleted_at: NULL = live attachment; non-NULL = deleted. Downloads ALWAYS
-- re-check this flag in D1 (the source of truth) before serving bytes, so a
-- stale KV entry can never resurrect a deleted attachment (KV is eventually
-- consistent). The bytes themselves are removed from the provider on delete.
-- provider: which storage provider holds the bytes ('kv' | 'r2'). Lets a
-- later R2 migration dual-read during cutover (see README migration path).

ALTER TABLE attachments ADD COLUMN deleted_at INTEGER;
ALTER TABLE attachments ADD COLUMN provider TEXT NOT NULL DEFAULT 'kv';
CREATE INDEX IF NOT EXISTS idx_attachments_live ON attachments(report_id, deleted_at);
