import React, { createContext, useContext } from "react";
import type { User } from "./lib/api";

/**
 * Single-user no-login mode (user order 2026-10-18: remove the login system).
 * The app always acts as the one fixed owner — no login wall, no sessions.
 * The hook keeps its old shape so every call site works unchanged.
 */
interface AuthState {
  user: User;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const FIXED_USER: User = {
  id: "owner",
  name: "Owner",
  email: "",
  emailVerified: false,
  image: null,
};

const Ctx = createContext<AuthState>({
  user: FIXED_USER,
  loading: false,
  refresh: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ user: FIXED_USER, loading: false, refresh: async () => {}, logout: async () => {} }}>{children}</Ctx.Provider>;
}
