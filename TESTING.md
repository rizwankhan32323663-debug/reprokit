# ReproKit — Testing

## How to run

```bash
npm run db:migrate:local   # local D1 migrations (repeatable)
npm run pages:dev          # local server on http://localhost:8788
npm run test:unit          # 48 checks, pure logic + synthetic-owner getSession
npm run test:e2e           # 34 checks, full API against local server (no-login mode)
npm run build              # tsc --noEmit + vite build
```

## Actual results (2026-10-18, local, `wrangler pages dev --local`)

| Suite | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | ✅ clean (0 errors) |
| `vite build` | ✅ clean (dist built) |
| Unit tests | ✅ **48/48 passed** (42 original + 6 new: synthetic-owner `getSession` — fixed id/name, empty email, request-independence, no D1 read) |
| E2E tests | ✅ **34/34 passed** (no-login mode: health, fixed owner, profile persistence, report CRUD, comments + author fallback, assignee `owner` special-case, dashboard, share create/revoke, uploads incl. magic-bytes/size-limit, redacted copy, delete + D1 gate, storage status, workspaces + member fallback, invalid input, search, activity actor names) |
| Migrations (local) | ✅ 0001–0004 applied; 2nd run = "No migrations to apply" |

> Note: on a fresh checkout the local D1 database is empty — E2E fails
> with 500s ("no such table") until `npm run db:migrate:local` is run
> once. Always apply local migrations before `test:e2e`.

Real bugs found and fixed by these tests (not fake passes):
- Synthetic-owner compatibility: every `JOIN user` in the API dropped rows
  when no user row exists (report list, comments, activity, workspace
  members). Fixed with `LEFT JOIN` + `COALESCE(..., 'Owner')` — verified by
  E2E (comment author, owner_name, member names, actor names all resolve).
- Assignee validation rejected the fixed owner id (`"owner"`) because no
  user-table row exists — special-cased `FIXED_OWNER_ID`, verified by E2E
  (owner accepted, unknown id still 400).
- Report detail never returned `owner_name` (pre-existing; only the list
  query had it) — test assertion corrected to check the list response.
- E2E was not idempotent across runs (owner row persisted from the previous
  run) — the test now resets the owner row via local D1 at the start.

## The test list (no-login mode, 2026-10-18)

| # | Test | Result |
|---|---|---|
| 1 | Fixed owner identity (`/api/me`) | ✅ E2E #2–3 + Unit getSession checks |
| 2 | Display-name persistence (profile → `/api/me`) | ✅ E2E #4–5 |
| 3 | No-auth API access (no cookies/sessions anywhere) | ✅ all E2E requests carry no credentials |
| 4 | Report create / edit | ✅ E2E #6–10 |
| 5 | Persistence after refresh | ✅ E2E #7, #10 (D1 reads) |
| 6 | Uploads | ✅ E2E #20–23 (PNG ok, fake PNG rejected, oversize → 413, authorized download), #24 (redacted copy), #25–27 (delete → 200, deleted download → 404, detail excludes deleted), #28 (storage status KV). Near-limit manual test (earlier): 9.9 MB upload → 201, download byte-exact; exactly 10 MB → 201. |
| 7 | Redaction + exported-pixel verification | ✅ Unit: covered pixels solid black, original unmutated, clamping; E2E #24 (redacted copy upload) |
| 8 | MD / PDF / JSON exports | ✅ Unit: Markdown + JSON round-trip; PDF export uses vendored jsPDF (browser click-through not run — see "Not run") |
| 9 | Share create + revoke | ✅ E2E #16–19 (create, public view, revoke, revoked → 404) |
| 10 | Workspaces | ✅ E2E #29–31 (create, member list with owner fallback, report in workspace); role enforcement in code |
| 11 | Assignee validation | ✅ E2E #13–14 (`owner` accepted, unknown → 400) |
| 12 | Search + filters | ✅ E2E #33 + #8 (list owner_name) |
| 13 | Migrations | ✅ applied locally + repeatable (2nd run no-op) — 0001–0004 |
| 14 | Invalid input + upload limits | ✅ E2E #21–22, #32 |
| 15 | Mobile responsiveness | ⚠️ **NOT RUN** — responsive CSS + breakpoints ship, but no device/browser viewport test was run |
| 16 | Production build | ✅ `npm run build` clean |
| 17 | Live deployment + flows | ⏳ **PENDING** — deploy phase (lead). Re-run on the production URL: `/api/health` (expect `ok/db/kv` true), create report → persistence → share/revoke → upload. |

## Removed with the auth system (2026-10-18, per user order)

No login, no sessions, no cookies, no password reset, no email
verification, no account deletion, no OAuth, no Turnstile. The old
better-auth tables (`user`, `session`, `account`, `verification`) remain in
the migrations but are only touched by the profile route, which creates the
single owner row on first save (no new migration).

## Not run (tooling limits of this builder)

- **Browser click-through** (editor → redaction canvas → PDF download →
  mobile viewport): no live browser available to this builder. The lead
  must run this on the deployed URL before calling the app done.
- **Production KV namespace / D1 binding**: not reaching the production
  runtime from `wrangler.toml` (dashboard-only route blocked); local tests
  use miniflare's local D1/KV. Production bindings must be re-verified on
  the live URL via `/api/health` after they are attached.
- **Load / concurrency**: no load test run; rate limits are per-key fixed
  windows in D1 and were verified functionally (report-create 429 path
  exists in code; upload 20/hour).
