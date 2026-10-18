# ReproKit — Testing

## How to run

```bash
npm run db:migrate:local   # local D1 migrations (repeatable)
npm run pages:dev          # local server on http://localhost:8788
npm run test:unit          # 42 checks, pure logic
npm run test:e2e           # 47 checks, full API against local server
npm run build              # tsc --noEmit + vite build
```

## Actual results (2026-10-17, local, `wrangler pages dev --local`)

| Suite | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | ✅ clean (0 errors) |
| `vite build` | ✅ clean (417 modules, dist built) |
| Unit tests | ✅ **42/42 passed** (19 original + 23 storage-helper: magic bytes, allowlist, size cap, filename sanitization, key generation, quotas) |
| E2E tests | ✅ **47/47 passed** (41 original + 6 new: delete 200, deleted → 404 D1 gate, detail excludes deleted, re-login, persistence after logout/login, storage status KV) |
| Migrations (local) | ✅ 0001–0004 applied; 2nd run = "No migrations to apply" |

> Note: on a fresh checkout the local D1 database is empty — E2E fails
> with 500s ("no such table") until `npm run db:migrate:local` is run
> once. Always apply local migrations before `test:e2e`.

Real bugs found and fixed by these tests (not fake passes):
- better-auth adapter import path (`better-auth/adapters/kysely` → `@better-auth/kysely-adapter`, separate package) + `kysely` version bump 0.28.5 → 0.28.17 (peer dep).
- better-auth 1.7 has **no** `/forget-password` endpoint — the real endpoint is `/request-password-reset` (requires `emailAndPassword.sendResetPassword` to be defined). Fixed frontend + rate-limit gate + added no-op callback (delivery still BLOCKED).
- `nodejs_compat` flag required (better-auth uses `node:crypto`).
- Share-create response lacked the link `id` needed for revoke — API now returns `{ id, token, url }`.

## The 20-item test list (from spec)

| # | Test | Result |
|---|---|---|
| 1 | Register / login | ✅ E2E #1–3, #21 |
| 2 | Logout + session invalidation | ✅ E2E #19–20 (old cookie → 401) |
| 3 | Reset flow | ⚠️ **PARTIAL / BLOCKED (see below)** — token creation + hashed storage verified (#24–26); invalid token rejected (#27); happy path BLOCKED (no email delivery) |
| 4 | Protected routes / APIs | ✅ E2E #44 (unauth list → 401), #16–18, #32 |
| 5 | Report create / edit | ✅ E2E #4–7 |
| 6 | Persistence after refresh | ✅ E2E #4–7 (D1 reads), dashboard #10 |
| 7 | Uploads | ✅ E2E #28–33 (PNG ok, fake PNG rejected, oversize → 413, authorized download, cross-user 404, redacted copy) + #34–36 (delete → 200, deleted download → 404, detail excludes deleted) + #37–39 (re-login, persistence, storage status KV). Near-limit manual test: 9.9 MB upload → 201 (602 ms), download → 200 byte-exact; exactly 10 MB → 201. KV key-list cross-check: deleted keys absent from KV (bytes actually removed, not just D1-gated). |
| 8 | Redaction + exported-pixel verification | ✅ Unit: covered pixels solid black, original unmutated, clamping; E2E #33 (redacted copy upload) |
| 9 | MD / PDF / JSON exports | ✅ Unit: Markdown + JSON round-trip; PDF export uses vendored jsPDF (browser click-through not run — see "Not run") |
| 10 | Share create + revoke | ✅ E2E #11–14 (create, public view, revoke, revoked → 404) |
| 11 | Workspace roles | ✅ E2E #40–42 (workspace create, report in workspace, cross-user 404); role enforcement in code (owner/admin/member checks on members endpoints) |
| 12 | Cross-user isolation | ✅ E2E #16–18, #32 (read/comment/search/download all 404, no leak) |
| 13 | Attachment authorization | ✅ E2E #31–32 |
| 14 | Search + filters | ✅ E2E #18, #45 |
| 15 | Account deletion | ✅ E2E #46–47 (delete → login 401) |
| 16 | Migrations | ✅ applied locally + repeatable (2nd run no-op) — 0001–0004 |
| 17 | Invalid input + upload limits | ✅ E2E #29–30, #43 |
| 18 | Mobile responsiveness | ⚠️ **NOT RUN** — responsive CSS + breakpoints ship, but no device/browser viewport test was run (no browser available to this builder) |
| 19 | Production build | ✅ `npm run build` clean |
| 20 | Live deployment + flows | ⏳ **PENDING** — deploy phase (lead). Must re-run: register → login → create report → persistence → share/revoke → cross-user isolation on the production URL |

## Blocked tests (honestly marked, never passed)

- **Reset-password happy path**: the token is delivered ONLY via email; email
  delivery is not configured. `request-password-reset` returns 200 and creates
  a hashed verification row (verified via D1), but no link reaches a user.
  Until an email provider is wired up, this flow cannot complete.
- **Email verification delivery**: same reason — `sendVerificationEmail` is a
  no-op; verification never gates sign-in (deliberate, documented).
- **OAuth**: not implemented.
- **Turnstile**: not implemented.

## Not run (tooling limits of this builder)

- **Browser click-through** (register → editor → redaction canvas → PDF
  download → mobile viewport): no live browser available to this builder.
  The lead must run this on the deployed URL before calling the app done.
- **Production KV namespace**: not yet created/bound in the dashboard
  (`EVIDENCE_KV` binding + real namespace id in `wrangler.toml`); local tests
  use miniflare's local KV. Production storage must be re-verified on the live
  URL after the namespace is wired + deployed.
- **Load / concurrency**: no load test run; rate limits are per-key fixed
  windows in D1 and were verified functionally (429 on 6th attempt).
