import { PERMISSION, type DashboardFlightRow } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { dashboardFlightQuery } from "@/api/queries.ts";
import { Input } from "@/components/ui/input.tsx";
import { usePermission, useStaffSession } from "@/stores/staff-session.ts";
import type { WsClient } from "@/ws/client.ts";
import { FlightsPanel } from "../flights/FlightsPanel.tsx";
import { OverviewSection } from "../overview/OverviewSection.tsx";
import { FlightStatusDialog } from "./FlightStatusDialog.tsx";
import { MetricsCards } from "./MetricsCards.tsx";
import { defaultDashboardClient, useDashboardLive } from "./useDashboardLive.ts";

/** Hoy en hora de Colombia, como AAAA-MM-DD (así se interpreta la fecha en la API). */
function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function DashboardPage({
  createClient = defaultDashboardClient,
}: {
  createClient?: (token: string) => WsClient;
}) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const canManage = usePermission(PERMISSION.flightsManage);
  const [date, setDate] = useState(todayInBogota);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DashboardFlightRow | null>(null);

  const metrics = useQuery({
    ...dashboardFlightQuery(selectedId ?? "", token),
    enabled: token !== "" && selectedId !== null,
  });
  useDashboardLive(selectedId, token, createClient);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Resumen del día</h2>
          <p className="text-muted-foreground text-sm">
            Indicadores y gráficas de los vuelos que salen en la fecha elegida.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value || todayInBogota());
              setSelectedId(null);
            }}
            className="w-44"
          />
        </label>
      </div>

      <OverviewSection date={date} />

      <div>
        <h2 className="text-xl font-semibold">Vuelos del día</h2>
        <p className="text-muted-foreground text-sm">
          Selecciona un vuelo para ver su ocupación en tiempo real.
        </p>
      </div>
      <FlightsPanel
        date={date}
        onDateChange={() => undefined}
        showDate={false}
        canManage={canManage}
        selectedId={selectedId}
        onSelect={(flight) => setSelectedId(flight.flightId)}
        onChangeStatus={setEditing}
      />

      {metrics.data ? <MetricsCards metrics={metrics.data.metrics} /> : null}

      <FlightStatusDialog
        flight={editing}
        token={token}
        onClose={() => setEditing(null)}
        onChanged={() => undefined}
      />
    </div>
  );
}
