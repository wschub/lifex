import { PERMISSION } from "@lifex/shared";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { usePermission } from "@/stores/staff-session.ts";

/**
 * Secciones solo para el administrador (flota, categorías, clientes y compras): exigen `flights:manage`, que
 * tiene `ADMIN` pero no `ADMIN_VIEWER`. Quien no lo tiene vuelve al dashboard.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = usePermission(PERMISSION.flightsManage);
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}
