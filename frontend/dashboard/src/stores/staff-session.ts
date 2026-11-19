import type { MeResponse } from "@lifex/shared";
import { create } from "zustand";

interface StaffSessionState {
  /** Solo en memoria: al recargar se recupera con `/auth/refresh` (cookie HttpOnly). */
  accessToken: string | null;
  /** Instante (ms) en que caduca el token de acceso. */
  accessTokenExpiresAt: number | null;
  me: MeResponse | null;
  setSession(accessToken: string, me: MeResponse, expiresInSeconds: number): void;
  setAccessToken(accessToken: string, expiresInSeconds: number): void;
  clear(): void;
}

const expiry = (expiresInSeconds: number) => Date.now() + expiresInSeconds * 1000;

export const useStaffSession = create<StaffSessionState>((set) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  me: null,
  setSession: (accessToken, me, expiresInSeconds) =>
    set({ accessToken, me, accessTokenExpiresAt: expiry(expiresInSeconds) }),
  setAccessToken: (accessToken, expiresInSeconds) =>
    set({ accessToken, accessTokenExpiresAt: expiry(expiresInSeconds) }),
  clear: () => set({ accessToken: null, accessTokenExpiresAt: null, me: null }),
}));

/** `true` si la sesión actual tiene el permiso. Sin sesión, siempre `false`. */
export function usePermission(permission: string): boolean {
  return useStaffSession((state) => state.me?.permissions.includes(permission) ?? false);
}
