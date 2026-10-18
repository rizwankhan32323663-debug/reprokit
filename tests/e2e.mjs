/**
 * ReproKit end-to-end test against a LOCAL `wrangler pages dev` server —
 * SINGLE-USER NO-LOGIN mode (auth system removed 2026-10-18 per user order).
 *
 * Usage:
 *   1. npm run db:migrate:local        (apply migrations to local D1)
 *   2. npm run pages:dev               (in another terminal, port 8788)
 *   3. npm run test:e2e
 *
 * Covers: /api/health, /api/me fixed owner, profile name persistence,
 * report CRUD, persistence, comments (+author fallback), dashboard stats,
 * share create/revoke, attachment upload (magic bytes + size limit),
 * redacted copy, delete, storage status, workspace create + member list,
 * assignee special-case for the fixed owner, invalid input, search,
 * activity actor names.
 *
 * There are no sessions, cookies, logins, or users to register: every
 * request transparently acts as the single fixed owner ("owner").
 */
const BASE = process.env.E2E_BASE || "http://localhost:8788";

import { execSync } from "node:child_process";
function d1(query) {
  try {
    const out = execSync(`npx wrangler d1 execute DB --local --command ${JSON.stringify(query)} --json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const jsonStart = out.indexOf("[");
    return JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : out);
  } catch { return null; }
}

let step = 0;
let failures = 0;
function check(name, cond, extra = "") {
  step += 1;
  if (cond) console.log(`  PASS ${step}. ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${step}. ${name} ${extra}`);
  }
}

async function req(method, path, { body, raw, headers: extraHeaders } = {}) {
  const headers = { Origin: BASE, ...(extraHeaders ?? {}) };
  let payload;
  if (raw !== undefined) {
    payload = raw; // raw bytes (Buffer) + caller-supplied Content-Type / X-* headers
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  } else if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers["Content-Type"] = "application/json";
    payload = "{}";
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (e.g. file download) */ }
  return { status: res.status, json, text, headers: res.headers };
}

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

console.log(`E2E (no-login mode) against ${BASE}`);

// 1. Health: no-auth probe reports db + kv bound.
let r = await req("GET", "/api/health");
check("health returns 200 + ok/db/kv true + kv provider",
  r.status === 200 && r.json?.ok === true && r.json?.db === true && r.json?.kv === true &&
  r.json?.storageProvider === "kv", `got ${r.status} ${r.text.slice(0, 200)}`);

// 2. /api/me returns the fixed owner with no cookie/session.
// Reset any owner row left by a previous run so the default-name path is tested.
d1(`DELETE FROM user WHERE id = 'owner'`);
r = await req("GET", "/api/me");
check("GET /api/me returns fixed owner (id 'owner')", r.status === 200 && r.json?.user?.id === "owner",
  `got ${r.status} ${r.text.slice(0, 200)}`);
check("fixed owner default name is 'Owner' (no user row)", r.json?.user?.name === "Owner");

// 3. Profile name persistence: PUT profile creates the owner row; /api/me reflects it.
r = await req("PUT", "/api/settings/profile", { body: { name: "E2E Owner" } });
check("PUT /api/settings/profile returns 200", r.status === 200, `got ${r.status} ${r.text.slice(0, 200)}`);
r = await req("GET", "/api/me");
check("saved display name surfaces via /api/me", r.json?.user?.name === "E2E Owner", `got ${r.json?.user?.name}`);

// 4. Create report (no auth of any kind).
r = await req("POST", "/api/reports", {
  body: { title: "E2E button does nothing", description: "Clicking does nothing.", severity: "High", status: "open" },
});
check("create report returns 201 + id", r.status === 201 && typeof r.json?.id === "string", `got ${r.status} ${r.text.slice(0, 200)}`);
const reportId = r.json?.id;

// 5. Read back (persistence) + owner_name on the LIST query via LEFT JOIN fallback.
r = await req("GET", `/api/reports/${reportId}`);
check("GET report returns created title", r.status === 200 && r.json?.report?.title === "E2E button does nothing", `got ${r.status}`);
r = await req("GET", "/api/reports?search=E2E button does nothing");
check("report owner_name resolves (join fallback)", r.status === 200 &&
  (r.json?.reports ?? []).some((x) => x.id === reportId && typeof x.owner_name === "string" && x.owner_name.length > 0),
  `got ${r.status} ${r.text.slice(0, 300)}`);

// 6. Update.
r = await req("PUT", `/api/reports/${reportId}`, { body: { title: "E2E button does nothing (updated)" } });
check("PUT report returns 200", r.status === 200, `got ${r.status} ${r.text.slice(0, 200)}`);
r = await req("GET", `/api/reports/${reportId}`);
check("updated title persists", r.json?.report?.title === "E2E button does nothing (updated)");

// 7. Comment + author name via LEFT JOIN fallback.
r = await req("POST", `/api/reports/${reportId}/comments`, { body: { body: "Reproduced on Chrome." } });
check("POST comment returns 201", r.status === 201, `got ${r.status} ${r.text.slice(0, 200)}`);
r = await req("GET", `/api/reports/${reportId}`);
check("comment appears with author name", Array.isArray(r.json?.comments) &&
  r.json.comments.some((c) => c.body === "Reproduced on Chrome." && typeof c.author_name === "string" && c.author_name.length > 0),
  `got ${r.status}`);

// 8. Assignee: the fixed owner id is accepted without a user-table lookup.
r = await req("PUT", `/api/reports/${reportId}`, { body: { assignee_id: "owner" } });
check("assignee 'owner' accepted (400 would mean lookup failure)", r.status === 200, `got ${r.status} ${r.text.slice(0, 200)}`);
r = await req("PUT", `/api/reports/${reportId}`, { body: { assignee_id: "ghost-user" } });
check("unknown assignee rejected (400)", r.status === 400, `got ${r.status}`);

// 9. Dashboard stats.
r = await req("GET", "/api/dashboard");
check("dashboard total >= 1", r.status === 200 && r.json?.total >= 1, `got ${r.status} ${r.text.slice(0, 200)}`);

// 10. Share create + revoke (public links need no login by design).
r = await req("POST", `/api/reports/${reportId}/share`, { body: { label: "e2e" } });
check("create share link returns 201 + token", r.status === 201 && typeof r.json?.token === "string", `got ${r.status} ${r.text.slice(0, 200)}`);
const shareToken = r.json?.token;
const shareLinkId = r.json?.id;
r = await req("GET", `/api/share/${shareToken}`);
check("public share view works", r.status === 200 && r.json?.report?.title?.includes("E2E button"), `got ${r.status}`);
r = await req("DELETE", `/api/reports/${reportId}/share/${shareLinkId}`);
check("revoke share link returns 200", r.status === 200, `got ${r.status}`);
r = await req("GET", `/api/share/${shareToken}`);
check("revoked share link fails (404)", r.status === 404, `got ${r.status}`);

// 11. Attachments: valid PNG upload (raw binary), magic-bytes rejection, size limit, redacted copy.
r = await req("POST", `/api/reports/${reportId}/attachments`, {
  raw: png1x1,
  headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("shot.png"), "X-Caption": encodeURIComponent("e2e screenshot") },
});
check("PNG upload returns 201 + id", r.status === 201 && typeof r.json?.id === "string", `got ${r.status} ${r.text.slice(0, 200)}`);
const attId = r.json?.id;

r = await req("POST", `/api/reports/${reportId}/attachments`, {
  raw: Buffer.from("hello, not a png"),
  headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("fake.png") },
});
check("fake PNG (bad magic bytes) rejected (400)", r.status === 400, `got ${r.status}`);

r = await req("POST", `/api/reports/${reportId}/attachments`, {
  raw: Buffer.alloc(10 * 1024 * 1024 + 1),
  headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("big.png") },
});
check("oversize upload rejected (413)", r.status === 413, `got ${r.status}`);

r = await req("GET", `/api/attachments/${attId}`);
check("attachment download returns 200 + PNG", r.status === 200 && (r.headers.get("content-type") || "").includes("image/png"),
  `got ${r.status} ${r.headers.get("content-type")}`);

r = await req("POST", `/api/attachments/${attId}/redacted`, {
  raw: png1x1,
  headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("shot-redacted.png") },
});
check("redacted copy upload returns 201", r.status === 201, `got ${r.status} ${r.text.slice(0, 200)}`);
const redactedId = r.json?.id;

// 12. Delete: bytes removed + D1 gate; re-download 404s; list excludes it.
r = await req("DELETE", `/api/attachments/${redactedId}`);
check("delete redacted copy returns 200", r.status === 200, `got ${r.status} ${r.text.slice(0, 200)}`);
r = await req("GET", `/api/attachments/${redactedId}`);
check("deleted attachment download returns 404 (D1 gate)", r.status === 404, `got ${r.status}`);
r = await req("GET", `/api/reports/${reportId}`);
check("report detail excludes deleted attachment",
  r.status === 200 && !(r.json?.attachments ?? []).some((a) => a.id === redactedId) &&
  (r.json?.attachments ?? []).some((a) => a.id === attId), `got ${r.status}`);

// 13. Storage status: KV configured, quota reported.
r = await req("GET", "/api/storage");
check("storage status reports kv + configured + quota",
  r.status === 200 && r.json?.provider === "kv" && r.json?.configured === true &&
  typeof r.json?.quota?.user?.usedBytes === "number" && r.json.quota.user.usedBytes >= png1x1.length,
  `got ${r.status} ${r.text.slice(0, 200)}`);

// 14. Workspace: create + member list shows the fixed owner via LEFT JOIN fallback.
r = await req("POST", "/api/workspaces", { body: { name: "E2E Workspace" } });
check("create workspace returns 201", r.status === 201 && typeof r.json?.id === "string", `got ${r.status} ${r.text.slice(0, 200)}`);
const wsId = r.json?.id;
r = await req("GET", `/api/workspaces/${wsId}`);
check("workspace member list includes owner with name", r.status === 200 &&
  (r.json?.members ?? []).some((m) => m.user_id === "owner" && typeof m.name === "string" && m.name.length > 0),
  `got ${r.status} ${r.text.slice(0, 300)}`);
r = await req("POST", "/api/reports", { body: { title: "E2E workspace report", workspace_id: wsId } });
check("create report in workspace returns 201", r.status === 201, `got ${r.status} ${r.text.slice(0, 200)}`);

// 15. Invalid input.
r = await req("POST", "/api/reports", { body: { title: "" } });
check("empty title rejected (400)", r.status === 400, `got ${r.status}`);

// 16. Search.
r = await req("GET", "/api/reports?search=E2E button");
check("owner search finds own report", r.status === 200 && (r.json?.reports ?? []).some((x) => x.id === reportId), `got ${r.status}`);

// 17. Activity: actor names resolve via LEFT JOIN fallback.
r = await req("GET", "/api/activity");
check("activity feed returns 200 with actor names", r.status === 200 && Array.isArray(r.json?.events) &&
  r.json.events.every((e) => typeof e.actor_name === "string" && e.actor_name.length > 0),
  `got ${r.status} ${r.text.slice(0, 200)}`);

console.log(`\nE2E: ${step - failures}/${step} passed${failures ? ` — ${failures} FAILURES` : ""}`);
process.exit(failures ? 1 : 0);
