import { createAuth } from "../../lib/auth";
import { getClientIp, rateLimit, type Env } from "../../lib/util";

/**
 * better-auth catch-all handler mounted at /api/auth/*.
 * Before delegating, rate-limit the abuse-sensitive endpoints (sign-in,
 * sign-up, request-password-reset): 5 attempts per 15 minutes per IP+email.
 * better-auth itself performs origin/CSRF checks on these routes.
 */
export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const sensitive =
    request.method === "POST" &&
    (path.endsWith("/sign-in/email") ||
      path.endsWith("/sign-up/email") ||
      path.endsWith("/request-password-reset"));
  if (sensitive) {
    let email = "";
    try {
      const clone = request.clone();
      const body = (await clone.json()) as { email?: string };
      email = typeof body.email === "string" ? body.email.toLowerCase() : "";
    } catch {
      // Unparseable body: let better-auth return its own validation error.
    }
    const ip = getClientIp(request);
    const key = `auth:${ip}:${email || "no-email"}`;
    if (!(await rateLimit(env.DB, key, 5, 15 * 60 * 1000))) {
      return new Response(JSON.stringify({ error: "Too many attempts. Please wait 15 minutes and try again." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  const auth = createAuth(env);
  return auth.handler(request);
}
