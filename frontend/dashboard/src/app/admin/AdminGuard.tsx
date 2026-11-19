import { PERMISSION } from "@lifex/shared";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { fetchMe, refresh } from "@/api/auth.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { adminTexts as tx } from "./admin-texts.ts";

/** Pide el token nuevo cuando faltan 60 s para que caduque el actual. */
const REFRESH_MARGIN_MS = 60_000;

type Bootstrap = "checking" | "failed";

/**
 * Protege las rutas del panel con los permisos de `GET /auth/me`. Sin sesión en memoria intenta
 * recuperarla con la cookie de refresh; sin el permiso `dashboard:read` manda al login.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const accessToken = useStaffSession((state) => state.accessToken);
  const expiresAt = useStaffSession((state) => state.accessTokenExpiresAt);
  const me = useStaffSession((state) => state.me);
  const [bootstrap, setBootstrap] = useState<Bootstrap>("checking");

  const hasSession = accessToken !== null && me !== null;

  useEffect(() => {
    if (hasSession) return;
    let cancelled = false;
    void (async () => {
      try {
        const session = await refresh();
        const profile = await fetchMe(session.accessToken);
        if (!cancelled) {
          useStaffSession.getState().setSession(session.accessToken, profile, session.expiresIn);
        }
      } catch {
        if (!cancelled) setBootstrap("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession || expiresAt === null) return;
    const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);
    const timer = setTimeout(() => {
      refresh()
        .then((next) => useStaffSession.getState().setAccessToken(next.accessToken, next.expiresIn))
        .catch(() => useStaffSession.getState().clear());
    }, delay);
    return () => clearTimeout(timer);
  }, [hasSession, expiresAt]);

  if (!hasSession) {
    return bootstrap === "failed" ? (
      <Navigate to="/login" replace />
    ) : (
      <p className="text-muted-foreground p-6 text-sm">{tx.loading}</p>
    );
  }
  if (!me.permissions.includes(PERMISSION.dashboardRead)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
