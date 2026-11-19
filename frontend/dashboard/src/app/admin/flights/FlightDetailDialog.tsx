import type { DashboardFlightRow } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { dashboardFlightQuery } from "@/api/queries.ts";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { formatDate, formatTime } from "@/lib/dates.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import type { WsClient } from "@/ws/client.ts";
import { MetricsCards } from "../dashboard/MetricsCards.tsx";
import { defaultDashboardClient, useDashboardLive } from "../dashboard/useDashboardLive.ts";
import { statusLabel } from "../dashboard/status.ts";
import { PassengersPanel } from "./PassengersPanel.tsx";

/**
 * Ventana de detalle de un vuelo: los mismos conteos en vivo del dashboard (libres, bloqueados, pago pendiente y
 * reservados, por clase) y, debajo, los pasajeros con ticket con su check-in y sus datos de contacto.
 */
export function FlightDetailDialog({
  flight,
  onClose,
  createClient = defaultDashboardClient,
}: {
  flight: DashboardFlightRow | null;
  onClose: () => void;
  createClient?: (token: string) => WsClient;
}) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const flightId = flight?.flightId ?? null;
  const metrics = useQuery({
    ...dashboardFlightQuery(flightId ?? "", token),
    enabled: token !== "" && flightId !== null,
  });
  useDashboardLive(flightId, token, createClient);

  return (
    <Dialog open={flight !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {flight ? `${flight.fromCity} (${flight.from}) → ${flight.toCity} (${flight.to})` : ""}
            {flight ? <Badge variant="outline">{statusLabel(flight.status)}</Badge> : null}
          </DialogTitle>
          <DialogDescription>
            {flight
              ? `${flight.routeType === "INTERNATIONAL" ? "Internacional" : "Nacional"} · ${formatDate(flight.departureDate, "es")} · ${formatTime(flight.departureDate)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {metrics.isError ? (
          <p role="alert" className="text-destructive text-sm">
            No se pudo cargar la ocupación del vuelo. {metrics.error.message}
          </p>
        ) : null}
        {metrics.data ? <MetricsCards metrics={metrics.data.metrics} /> : null}

        {flightId ? <PassengersPanel flightId={flightId} /> : null}
      </DialogContent>
    </Dialog>
  );
}
