import type { MeResponse } from "@lifex/shared";
import { create } from "zustand";

interface StaffSessionState {
  /** Solo en memoria: al recargar se recupera con `/auth/refresh` (cookie HttpOnly). */
  accessToken: string | null;
  me: MeResponse | null;
  setSession(accessToken: string, me: MeResponse): void;
  setAccessToken(accessToken: string): void;
  clear(): void;
}

export const useStaffSession = create<StaffSessionState>((set) => ({
  accessToken: null,
  me: null,
  setSession: (accessToken, me) => set({ accessToken, me }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ accessToken: null, me: null }),
}));

/** `true` si la sesión actual tiene el permiso. Sin sesión, siempre `false`. */
export function usePermission(permission: string): boolean {
  return useStaffSession((state) => state.me?.permissions.includes(permission) ?? false);
}
