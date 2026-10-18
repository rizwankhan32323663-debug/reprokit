import type { Env } from "./util";

/**
 * Single-user no-login mode (user order 2026-10-18: remove the login system).
 *
 * There is NO authentication: getSession ALWAYS returns the same synthetic
 * fixed owner. All ownership/permission checks in the API keep working
 * unchanged — every request transparently acts as the single owner.
 *
 * No D1 user row is required and none is read here: display-name joins in
 * the API use LEFT JOIN + COALESCE so they degrade gracefully, and the
 * settings profile route creates the owner row on first save (no migration).
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export interface Session {
  user: SessionUser;
}

/** The single fixed owner of this ReproKit instance. */
export const FIXED_OWNER_ID = "owner";
export const FIXED_OWNER_NAME = "Owner";

const FIXED_OWNER: SessionUser = {
  id: FIXED_OWNER_ID,
  name: FIXED_OWNER_NAME,
  email: "",
  emailVerified: false,
  image: null,
};

export async function getSession(_request: Request, _env: Env): Promise<Session> {
  return { user: FIXED_OWNER };
}
