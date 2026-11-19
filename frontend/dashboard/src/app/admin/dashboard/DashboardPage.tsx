import { PERMISSION, type DashboardFlightRow } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { wsUrl } from "@/api/config.ts";
import { dashboardFlightQuery, dashboardFlightsQuery } from "@/api/queries.ts";
import { Input } from "@/components/ui/input.tsx";
import { usePermission, useStaffSession } from "@/stores/staff-session.ts";
import { createWsClient, type WsClient } from "@/ws/client.ts";
import { FlightsTable } from "./FlightsTable.tsx";
import { FlightStatusDialog } from "./FlightStatusDialog.tsx";
import { MetricsCards } from "./MetricsCards.tsx";
import { useDashboardLive } from "./useDashboardLive.ts";

const defaultClient = (token: string): WsClient => createWsClient(wsUrl(), { token });

/** Hoy en hora de Colombia, como AAAA-MM-DD (así se interpreta la fecha en la API). */
function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function DashboardPage({
  createClient = defaultClient,
}: {
  createClient?: (token: string) => WsClient;
}) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const canManage = usePermission(PERMISSION.flightsManage);
  const [date, setDate] = useState(todayInBogota);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DashboardFlightRow | null>(null);

  const list = useQuery({ ...dashboardFlightsQuery(date, token), enabled: token !== "" });
  const metrics = useQuery({
    ...dashboardFlightQuery(selectedId ?? "", token),
    enabled: token !== "" && selectedId !== null,
  });
  useDashboardLive(selectedId, token, createClient);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Vuelos del día</h2>
          <p className="text-muted-foreground text-sm">
            Selecciona un vuelo para ver su ocupación en tiempo real.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSelectedId(null);
            }}
            className="w-44"
          />
        </label>
      </div>

      {list.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudieron cargar los vuelos. {list.error.message}
        </p>
      ) : null}
      <div className="rounded-lg border">
        <FlightsTable
          flights={list.data?.flights}
          selectedId={selectedId}
          canManage={canManage}
          onSelect={setSelectedId}
          onChangeStatus={setEditing}
        />
      </div>

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
