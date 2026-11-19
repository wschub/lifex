import {
  loginResponseSchema,
  meResponseSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
} from "@lifex/shared";
import { z } from "zod";
import { apiFetch } from "./http.ts";

/** `/auth/refresh` devuelve solo el token nuevo (el refresh token viaja en una cookie HttpOnly). */
const refreshResponseSchema = loginResponseSchema.omit({ user: true });
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/** Inicia sesión: la respuesta fija la cookie de refresh, por eso lleva `csrf` (cookies + cabecera). */
export const login = (input: LoginRequest): Promise<LoginResponse> =>
  apiFetch("/auth/login", loginResponseSchema, { method: "POST", json: input, csrf: true });

export const refresh = (): Promise<RefreshResponse> =>
  apiFetch("/auth/refresh", refreshResponseSchema, { method: "POST", csrf: true });

export const logout = (): Promise<undefined> =>
  apiFetch("/auth/logout", z.undefined(), { method: "POST", csrf: true });

export const fetchMe = (accessToken: string): Promise<MeResponse> =>
  apiFetch("/auth/me", meResponseSchema, { staffToken: accessToken });
