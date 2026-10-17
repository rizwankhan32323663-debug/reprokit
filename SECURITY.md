# ReproKit — Security

## Controls

| Control | Implementation | Test evidence |
|---|---|---|
| Password hashing | better-auth (scrypt), maintained library — no hand-rolled crypto | Library-verified; login works (E2E #21), wrong password rejected |
| Sessions | better-auth session tokens, 7-day expiry, daily refresh, `reprokit` cookie prefix, SameSite=Lax, secure cookies in production | E2E #19–20: logout invalidates (old cookie → 401) |
| Reset / verification tokens | Crypto-random; identifiers stored **SHA-256-hashed** (`verification.storeIdentifier: "hashed"`); reset ~1h, verify ~24h; single-use (deleted on use); never in logs | E2E #24–26: row created, identifier is a hash (not a usable token); #27: garbage token rejected |
| Permissions | Ownership + workspace checks on EVERY endpoint (reports, steps, comments, attachments, exports, share links, workspaces, members, labels, activity, notifications, settings). 403/404 without leaking existence | E2E #16–18, #32, #36: cross-user + cross-workspace access → 404 |
| R2 privacy | Private bucket, no public access. Downloads authorized per request. Share attachments served only via a valid, unrevoked token | E2E #31–32; share revoke #13–14 |
| Upload validation | Magic-bytes check (PNG/JPEG/WebP), not extension; ≤10 MB; redacted copies must be PNG | E2E #29 (fake PNG → 400), #30 (oversize → 400) |
| Share links | 256-bit token, only SHA-256 hash stored, raw token returned once. Token status re-verified on EVERY access — revoked/expired → fail. Sensitive fields stripped in public view | E2E #11–14 |
| Rate limiting | D1-backed fixed window: auth 5 attempts / 15 min per IP+email; report create 30/min; uploads 20/hour | E2E #22–23: 6th rapid login → 429 |
| CSRF | SameSite=Lax cookies + Origin/Referer check on mutations (better-auth origin check on auth routes; middleware check on app mutations when header present) | E2E: requests without `Origin` → 403 (better-auth origin check); with Origin → pass |
| Security headers | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` via `functions/_middleware.ts` + `public/_headers` | Headers parsed by wrangler at startup ("Parsed 1 valid header rule"); live-header check is a deploy-phase step |
| Server-side validation | zod schemas on every mutation; invalid input → 400 | E2E #37 (empty title → 400) |
| Output escaping | React escapes user text by default; no `dangerouslySetInnerHTML` for user content | Code review (no user-content HTML injection paths) |
| Secrets | Never in repo/config/bundles/logs/screenshots. `BETTER_AUTH_SECRET` via dashboard secret storage (prod) / `.dev.vars` (local, gitignored) | Repo scanned: no secret values present |

## Known limitations (honest)

- **Email delivery is not configured.** Reset/verification tokens are generated
  and stored hashed, but no email is sent. This means a leaked DB alone does
  not expose usable tokens (hashed), but the reset flow cannot complete until
  a provider is wired up.
- **No Turnstile / CAPTCHA.** Rate limiting is the only automated-abuse
  control. A determined attacker with many IPs can still attempt sign-ups;
  this is acceptable for launch but should be revisited if abuse appears.
- **D1 rate limiting is per-key fixed-window**, not sliding-window, and is
  enforced in the Functions handler (not at the edge). It was verified
  functionally, not under load.
- **CSP allows `'unsafe-inline'` for styles** (React inline styles require
  it). Script sources remain `'self'` only.
- **Backups are manual** (see README). No automated backup schedule exists yet.

## What is NOT claimed

- No penetration test has been run.
- No audit of better-auth internals beyond the token-storage verification
  above (SHA-256-hashed identifiers confirmed in D1).
- Production headers / TLS / WAF settings depend on the Cloudflare dashboard
  configuration at deploy time and must be verified on the live URL.
