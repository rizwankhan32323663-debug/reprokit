/**
 * Pages Functions middleware: security headers on every API response and a
 * CSRF check on state-changing requests.
 *
 * CSRF posture: for POST/PUT/PATCH/DELETE, when an Origin or Referer header
 * is present it must match the request origin; when neither is present the
 * request is allowed (covers non-browser clients) because session cookies
 * are SameSite=Lax. This control is covered by tests in TESTING.md.
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}) {
  const { request, next } = context;
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    if (origin) {
      try {
        if (new URL(origin).origin !== url.origin) {
          return new Response(JSON.stringify({ error: "CSRF check failed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "CSRF check failed" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else if (referer) {
      try {
        if (new URL(referer).origin !== url.origin) {
          return new Response(JSON.stringify({ error: "CSRF check failed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "CSRF check failed" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}
