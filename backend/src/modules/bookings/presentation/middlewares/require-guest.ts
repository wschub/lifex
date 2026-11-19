import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { setGuestSession } from "../../../../shared/http/guest-session.ts";
import type { GuestTokenService } from "../../application/ports/guest-token-service.ts";

const BEARER = /^Bearer\s+(\S+)$/i;

/** Valida el token de sesión de invitado y deja el id de la reserva como sesión. */
export function requireGuest(deps: { guestTokens: GuestTokenService }): RequestHandler {
  return async (req, res, next) => {
    const token = BEARER.exec(req.get("authorization") ?? "")?.[1];
    if (!token) throw new AppError("unauthenticated");
    const { subject } = await deps.guestTokens.verify(token);
    setGuestSession(res, subject);
    next();
  };
}

/**
 * Además de validar el token, exige que su `sub` coincida con la reserva de la URL (`:id`):
 * una sesión de invitado nunca toca la reserva de otro.
 */
export function requireBookingOwner(deps: { guestTokens: GuestTokenService }): RequestHandler {
  const authenticate = requireGuest(deps);
  return async (req, res, next) => {
    await authenticate(req, res, () => undefined);
    if (res.locals.guestSessionId !== req.params.id) {
      throw new AppError("forbidden", { code: "GUEST_TOKEN_MISMATCH" });
    }
    res.locals.bookingId = req.params.id;
    next();
  };
}
