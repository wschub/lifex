import { PERMISSION, type DashboardFlightRow } from "@lifex/shared";
import { useState } from "react";
import { useStaffSession, usePermission } from "@/stores/staff-session.ts";
import { FlightStatusDialog } from "../dashboard/FlightStatusDialog.tsx";
import { FlightsPanel } from "./FlightsPanel.tsx";

/**
 * Sección «Vuelos»: todos los vuelos (nacionales e internacionales) con filtros de origen, destino y fecha, y
 * paginación. La ven el administrador y el encargado; solo quien puede gestionar cambia el estado de un vuelo.
 */
export function FlightsPage() {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const canManage = usePermission(PERMISSION.flightsManage);
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<DashboardFlightRow | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Vuelos</h2>
        <p className="text-muted-foreground text-sm">
          Todos los vuelos programados, nacionales e internacionales. Sin fecha se listan los que
          aún no salieron.
        </p>
      </div>
      <FlightsPanel
        date={date}
        onDateChange={setDate}
        canManage={canManage}
        onChangeStatus={setEditing}
      />
      <FlightStatusDialog
        flight={editing}
        token={token}
        onClose={() => setEditing(null)}
        onChanged={() => undefined}
      />
    </div>
  );
}
