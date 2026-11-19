import type { Response } from "express";
import { AppError } from "../errors/app-error.ts";

/**
 * Sesión de invitado: el cliente que compra sin cuenta recibe un token cuyo `sub` es el id de su
 * reserva. El middleware que lo valida deja ese id en `res.locals` y los controladores lo leen aquí.
 */
export function setGuestSession(res: Response, sessionId: string): void {
  res.locals.guestSessionId = sessionId;
}

export function guestSessionOf(res: Response): string {
  const id: unknown = res.locals.guestSessionId;
  if (typeof id !== "string") throw new AppError("unauthenticated");
  return id;
}
