/** Token de la sesión de invitado: su `sub` es el id de la reserva en curso. */
export interface GuestTokenService {
  issue(subject: string): Promise<{ token: string; expiresInSeconds: number }>;
  verify(token: string): Promise<{ subject: string }>;
}
