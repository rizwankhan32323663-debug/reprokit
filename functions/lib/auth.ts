import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { D1Dialect } from "kysely-d1";
import { Kysely } from "kysely";
import type { Env } from "./util";

/**
 * Maintained auth library: better-auth (v1.7.x) with the Kysely adapter over
 * the native D1 dialect. Verified compatible with the Workers runtime
 * (workerd, no Node-only APIs). better-auth owns password hashing (scrypt),
 * session tokens, and verification/reset token storage.
 *
 * Email delivery is NOT configured (no email provider). The
 * sendVerificationEmail / sendResetPassword callbacks therefore do NOT send
 * anything — the UI labels email delivery as BLOCKED and no "email sent"
 * claim is ever made. Token generation/storage still works and is tested
 * via direct D1 inspection in the local test harness (see TESTING.md).
 */
export function createAuth(env: Env) {
  const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) });
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    database: kyselyAdapter(db, { type: "sqlite" }),
    emailAndPassword: {
      enabled: true,
      // Email verification delivery is blocked (no provider), so verification
      // must not gate sign-in. See README "Email delivery (BLOCKED)".
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Reset tokens: crypto-random, ~1h expiry, single-use (deleted on use).
      resetPasswordTokenExpiresIn: 60 * 60,
      // BLOCKED: no email provider configured. Intentionally a no-op.
      // The endpoint is enabled so the reset TOKEN is still generated and
      // stored (hashed) — but no reset email is ever sent. The UI labels
      // delivery as BLOCKED and never claims an email was sent.
      sendResetPassword: async () => {},
    },
    emailVerification: {
      sendOnSignUp: false,
      // Verification tokens expire after ~24h.
      expiresIn: 60 * 60 * 24,
      // BLOCKED: no email provider configured. Intentionally a no-op.
      // Never claim a verification email was sent.
      sendVerificationEmail: async () => {},
    },
    verification: {
      // Store verification identifiers (which contain reset/verification
      // tokens) as SHA-256 hashes, not plaintext — a DB leak must not expose
      // usable tokens. better-auth hashes on both write and lookup, so the
      // flows work transparently.
      storeIdentifier: "hashed",
    },
    account: {},
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: "reprokit",
      useSecureCookies: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function getSession(request: Request, env: Env) {
  const auth = createAuth(env);
  return auth.api.getSession({ headers: request.headers });
}
