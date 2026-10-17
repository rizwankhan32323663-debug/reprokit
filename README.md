# ReproKit

**Show the problem, not just describe it.** ReproKit turns a rough bug description —
screenshots, steps, environment details — into a structured, professional
troubleshooting report that someone else can actually reproduce.

- Report builder with steps editor, evidence uploads, and manual redaction
- Deterministic, rule-based quality checks (NOT AI) that explain *why* each
  suggestion appears
- Exports: Markdown, PDF (with screenshots), structured JSON, print, clipboard
- Workspaces, roles, comments, activity timeline, in-app notifications
- Share links with revocation — read-only public views, sensitive fields stripped
- Privacy-first: no analytics, no trackers, no ads. Your report data lives in
  your own Cloudflare D1 database and R2 bucket.

## Status

Local build + tests: **passing** (see [TESTING.md](TESTING.md)).
Production deployment: **not yet done** — the deploy step (Cloudflare
dashboard) is performed separately. This repo contains everything needed for
it; follow "Production setup" below.

### Blocked / not configured (never claimed as working)

- **Email delivery — BLOCKED.** No email provider is configured. Password-reset
  and email-verification *tokens* are generated and stored (hashed), but no
  email is ever sent. The UI labels this as blocked and never says "email sent".
  Consequence: the reset-password *happy path* (user receives a link, clicks
  it, sets a new password) cannot complete until an email provider is wired up.
- **OAuth (Google/GitHub) — NOT IMPLEMENTED.** No credentials configured.
- **Turnstile / bot verification — NOT IMPLEMENTED.** No keys configured, no
  widget in the app. D1-backed rate limiting (below) is the abuse control that
  *is* implemented and tested.
- **Integrations (GitHub issues, webhooks, email notifications) — NOT
  IMPLEMENTED.** Documented as future work only; no connection UI, no fake
  "connected" statuses anywhere.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite → static `dist/` |
| Backend | Cloudflare Pages Functions, `functions/api/` (TypeScript, Workers runtime) |
| Database | Cloudflare D1 (`DB` binding), migrations in `migrations/` |
| Storage | Cloudflare R2 (`EVIDENCE` binding), private bucket |
| Auth | better-auth 1.7.10 + `@better-auth/kysely-adapter` + `kysely-d1` |
| PDF export | jsPDF 2.5.1 (npm, MIT — LICENSE vendored in `public/vendor/`) |

No secrets live in this repo. Secrets go in Cloudflare dashboard secret
storage (see "Production setup") or `.dev.vars` locally (gitignored).

## Local development

```bash
npm install
npm run db:migrate:local     # apply migrations to local D1 (repeatable: no-op on 2nd run)
npm run pages:dev            # serves dist/ + Functions on http://localhost:8788
npm run test:unit            # pure-logic unit tests (redaction, quality, formatters)
npm run test:e2e             # full API E2E against the local server (41 checks)
npm run build                # tsc + vite production build
```

Local auth needs `.dev.vars` with a `BETTER_AUTH_SECRET` (see
`.env.example`). It is gitignored — never commit it. The local D1
`database_id` in `wrangler.toml` is a zero-UUID placeholder for local dev
only; the dashboard assigns the real ID at deploy time.

## Production setup (Cloudflare dashboard)

Perform these steps in the Cloudflare dashboard (the deploy step is done
separately from this repo):

1. **Pages project** — Connect the `reprokit` GitHub repo. Build command:
   `npm run build`. Build output directory: `dist`. Root directory: `/`.
   Framework preset: none (Vite output is static).
2. **Compatibility flags** — set `nodejs_compat` on the Pages project.
   better-auth uses `node:crypto` (scrypt); without this flag the Functions
   worker fails to start. (Also present in `wrangler.toml` for local dev.)
3. **D1 database** — Create a database named `reprokit-db`. Bind it as `DB`.
   Apply migrations: `wrangler d1 migrations apply DB --remote` (from this
   repo), or run each file in `migrations/` in order via the dashboard SQL
   console. Migrations are additive-only and tracked — re-running is a no-op.
   **Never run migrations against production without a backup first** (below).
4. **R2 bucket** — Create a private bucket named `reprokit-evidence`
   (no public access, no public domain). Bind it as `EVIDENCE`.
5. **Secrets** (dashboard → Settings → Environment variables → Secrets):
   - `BETTER_AUTH_SECRET` — a long random secret (e.g. `openssl rand -hex 32`).
     Generate it fresh for production; never reuse the local dev value.
6. **Variables** (dashboard → Settings → Environment variables):
   - `BETTER_AUTH_URL` — the production site URL, e.g.
     `https://reprokit.pages.dev` (replace with the real assigned URL).
7. **Deploy** — trigger a Pages deployment from the connected repo.
8. **Post-deploy verification** — run the checks in [TESTING.md](TESTING.md)
   "Live deployment" against the production URL (register → login → create
   report → verify persistence → share/revoke → cross-user isolation).
   Do NOT run the destructive checks (account deletion, rate-limit lockout)
   against a production account you care about.
9. **Domain placeholders** — `public/robots.txt` and `public/sitemap.xml`
   contain `REPLACE-WITH-PRODUCTION-URL`. After the real domain is known,
   replace it and redeploy.

## Backup + recovery

**D1 (reports, users, comments, etc.)**
- Backup: `wrangler d1 export DB --remote --output backup.sql`
  (or dashboard → D1 → Export). Do this before any migration or major change.
- Recovery: create a fresh database, restore with
  `wrangler d1 execute DB --remote --file backup.sql`, then re-point the `DB`
  binding to the restored database. Verify row counts before switching traffic.

**R2 (attachments / evidence)**
- Backup: `wrangler r2 object get` per object, or
  `rclone sync` / `aws s3 sync` with an R2 API token (S3-compatible endpoint).
  List objects first: `wrangler r2 object list reprokit-evidence`.
- Recovery: re-upload objects to the same keys (`reports/<id>/...`) — the
  database stores `r2_key` per attachment, so keys must match exactly.

**Retention / deletion.** Account deletion removes the user row, cascades
their reports/comments, deletes their attachments' R2 objects, and transfers
or deletes workspaces they own (see `functions/api/settings/account.ts`).
Backups are NOT automatically purged — delete old backup files on the same
schedule you keep them.

## Security

See [SECURITY.md](SECURITY.md) for controls + test evidence. Headline:
- better-auth owns password hashing (scrypt) + sessions; reset/verification
  token identifiers stored SHA-256-hashed, expiring (reset ~1h, verify ~24h),
  single-use.
- Ownership + workspace permission checks on every endpoint; 403 without
  leaking existence.
- R2 private; magic-bytes upload validation (PNG/JPEG/WebP, ≤10 MB);
  downloads authorized per request; revoked share links re-verified on every
  access.
- D1-backed rate limiting: auth endpoints 5 attempts / 15 min per IP+email;
  report creation 30/min; uploads 20/hour.
- CSRF: SameSite=Lax session cookies + Origin/Referer check on mutations.
- Security headers via `functions/_middleware.ts` + `public/_headers`.
- Server-side zod validation everywhere; user text escaped on render.

## License

MIT — see [LICENSE](LICENSE). jsPDF is MIT; its license is vendored at
`public/vendor/jspdf-LICENSE`.
