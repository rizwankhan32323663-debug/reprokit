# ReproKit — Build checklist

Last updated: 2026-10-17 (local verification). Production deployment is a
separate step (dashboard) — nothing here is claimed live until the lead
verifies the production URL.

## Completed ✅

- [x] Repo inspected; existing README-only state preserved (commit `6f49f7b`)
- [x] Scaffold: React + TS + Vite, `tsconfig`, `wrangler.toml`, `.gitignore`, MIT LICENSE
- [x] Auth: better-auth 1.7.10 + `@better-auth/kysely-adapter` + `kysely-d1`,
      verified Workers/D1 compatible (needs `nodejs_compat` flag)
- [x] D1 migrations 0001 (better-auth tables) / 0002 (app tables) / 0003 (assignee)
      / 0004 (attachment soft-delete + provider tag)
      — applied locally, repeatable (2nd run = no-op)
- [x] Backend: all endpoints (reports, steps, comments, attachments + redacted
      copies, share links, workspaces/members/invites, labels, notifications,
      activity, dashboard stats, settings incl. export + account deletion)
- [x] Frontend: landing, signup/login/forgot/reset, dashboard, report editor
      (autosave, steps editor, attachments + redaction modal, live preview,
      quality panel, MD/PDF/JSON/copy/print exports, share, comments, activity,
      labels + assignee), report view, public share view, settings, workspaces,
      invite accept, privacy/terms/help, 404, light/dark themes
- [x] Permissions on every endpoint (ownership + workspace checks, 403 w/o leak)
- [x] Storage: modular `StorageProvider` (KV default, R2 behind `STORAGE_PROVIDER`);
      KV private (no public URL), raw-binary uploads, magic-bytes validation,
      10 MB limit, SHA-256 metadata, server-generated opaque keys, authorized
      downloads proxied through the Worker, soft-delete with D1 `deleted_at`
      gate, per-owner (200 MiB / 200 files) + per-workspace (500 MiB) quotas
      enforced before upload, quota usage shown in UI, uploads honestly
      disabled (503 + UI message) when no provider is configured
- [x] Rate limiting (D1-backed): auth 5/15min per IP+email, reports 30/min,
      uploads 20/hour — tested (E2E #22–23)
- [x] CSRF: SameSite=Lax cookies + Origin/Referer check on mutations;
      security headers via middleware + `_headers`
- [x] Token storage: verification identifiers stored SHA-256-hashed
      (`verification.storeIdentifier: "hashed"`); reset ~1h, verify ~24h,
      single-use — verified via D1 inspection (E2E #25–26)
- [x] Quality engine: deterministic rules, every issue explains WHY,
      labelled rule-based, NOT AI
- [x] PDF export: jsPDF vendored via npm, LICENSE copied to `public/vendor/`
- [x] SEO: titles/meta/OG/favicon, semantic HTML, `robots.txt`, `sitemap.xml`
      (domain placeholder documented), private pages noindex
- [x] Tests: `tsc` clean, `vite build` clean, unit 42/42, E2E 47/47 (local)
- [x] Docs: README, CHECKLIST, TESTING, SECURITY, `.env.example`
- [x] No secrets in repo (scanned); `.dev.vars` gitignored
- [x] Health endpoint `GET /api/health` — presence booleans only, never throws, no auth (diagnoses binding/config issues on production)
- [x] Redesign: design system (Inter + mono metadata, 8px base, 1024px/640px breakpoints, 44px targets, skip link, reduced-motion, focus rings), CSS/HTML landing mockup, honest trust strip, pricing-contrast block (public competitor prices), dashboard sidebar + card list, report two-pane + sticky bar, editor sticky preview + as-recipient toggle + drag-reorder steps + blur redaction + before/after toggle, ConfirmModal for destructive actions, toasts, skeletons, empty states. No copied competitor assets/copy, no fake testimonials/logos/stats.
- [x] Reports list API returns `attachment_count` (live attachments only) for dashboard cards

## Pending (deploy phase — lead)

- [ ] Cloudflare Pages project created + repo connected (build: `npm run build`, output: `dist`)
- [ ] `nodejs_compat` compatibility flag set on the Pages project
- [ ] D1 database `reprokit-db` created + bound as `DB` + migrations applied
- [ ] KV namespace `reprokit-evidence-kv` created + bound as `EVIDENCE_KV`
      (production + preview); real namespace id wired into `wrangler.toml`
      (currently a clearly-marked placeholder)
- [ ] `BETTER_AUTH_SECRET` set in dashboard secret storage (fresh production value)
- [ ] `BETTER_AUTH_URL` set to the real production URL
- [ ] Replace `REPLACE-WITH-PRODUCTION-URL` in `public/robots.txt` + `public/sitemap.xml`
- [ ] Deploy + post-deploy verification against the live URL (TESTING.md)
- [ ] Browser click-through test (register → editor → redaction → export) on the
      live URL — not possible from this builder (no browser); must be done by lead

## Blocked (not configured — never claimed as working)

- [ ] **Email delivery** — no provider configured. Reset/verification tokens are
      generated + stored (hashed), but no email is sent. UI + docs label this
      BLOCKED. Consequence: reset-password happy path cannot complete until a
      provider is wired up.
- [ ] **Reset-password happy path test** — cannot be tested locally without
      email delivery (token is only delivered via email). Invalid-token
      rejection IS tested (E2E #27). Marked BLOCKED in TESTING.md, not passed.
- [ ] **OAuth (Google/GitHub)** — not implemented, no credentials.
- [ ] **Turnstile** — not implemented, no keys, no widget.
- [ ] **Integrations (GitHub issues, webhooks, email notifications)** — not
      implemented; documented as future only. No fake connection statuses.
- [ ] **AI-provider interface** — does not exist. Quality engine is rule-based
      only; no AI is connected or claimed.
