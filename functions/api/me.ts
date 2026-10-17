import { getSession } from "../lib/auth";
import { err, json, type Env } from "../lib/util";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  return json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
    },
  });
}
