import { z } from "zod";
import { isoDateTime } from "../common.ts";

/** Usuario del staff (admin / visor). El cliente invitado nunca tiene cuenta. */
export const publicUserSchema = z.object({
  publicId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  countryDefault: z.string().nullable(),
  mobilePhone: z.string().nullable(),
  locale: z.string(),
  status: z.string(),
  createdAt: isoDateTime,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const loginRequestSchema = z.object({ email: z.string(), password: z.string() }).strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** `POST /auth/login`. El refresh token viaja en una cookie HttpOnly, no en el cuerpo. */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int(),
  user: publicUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** `GET /auth/me`: el front construye el menú y protege las rutas de admin con `permissions`. */
export const meResponseSchema = z.object({
  user: publicUserSchema,
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Permisos del dominio de vuelos que usa el front. */
export const PERMISSION = {
  flightsRead: "flights:read",
  flightsManage: "flights:manage",
  dashboardRead: "dashboard:read",
} as const;
