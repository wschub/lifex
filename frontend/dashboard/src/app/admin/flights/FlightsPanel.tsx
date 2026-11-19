import type { DashboardFlightRow } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { dashboardFlightsQuery } from "@/api/queries.ts";
import { AirportCombobox } from "@/components/AirportCombobox.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useAirports } from "@/hooks/use-airports.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { FlightsTable } from "../dashboard/FlightsTable.tsx";
import { TablePagination } from "./TablePagination.tsx";

interface Props {
  /** Fecha (AAAA-MM-DD) o "" para todas las que aún no salieron. */
  date: string;
  onDateChange: (date: string) => void;
  /** Con `false` el campo de fecha se oculta (la fecha la fija otra parte de la pantalla). */
  showDate?: boolean;
  canManage: boolean;
  selectedId?: string | null;
  onSelect?: (flight: DashboardFlightRow) => void;
  onChangeStatus: (flight: DashboardFlightRow) => void;
}

/**
 * Tabla de vuelos con filtros de origen y destino (autocompletar), fecha opcional y paginación del servidor.
 * Muestra todos los vuelos, nacionales e internacionales.
 */
export function FlightsPanel({
  date,
  onDateChange,
  showDate = true,
  canManage,
  selectedId = null,
  onSelect = () => undefined,
  onChangeStatus,
}: Props) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const airports = useAirports();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pageSize, setPageSize] = useState(20);
  // La página vuelve a la 1 cuando cambia cualquier filtro, sin efectos: se guarda con la clave de los filtros.
  const filterKey = `${date}|${origin}|${destination}|${pageSize}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const list = useQuery({
    ...dashboardFlightsQuery(
      {
        ...(date ? { date } : {}),
        ...(origin ? { from: origin } : {}),
        ...(destination ? { to: destination } : {}),
        page,
        pageSize,
      },
      token,
    ),
    enabled: token !== "",
  });
  const filtered = origin !== "" || destination !== "" || date !== "";

  return (
    <section aria-label="Vuelos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          Origen
          <AirportCombobox
            id="filter-origin"
            value={origin}
            options={airports}
            placeholder="Todos los orígenes"
            onChange={setOrigin}
          />
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          Destino
          <AirportCombobox
            id="filter-destination"
            value={destination}
            options={airports}
            placeholder="Todos los destinos"
            onChange={setDestination}
          />
        </label>
        {showDate ? (
          <label className="flex flex-col gap-1 text-sm">
            Fecha
            <Input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-44"
            />
          </label>
        ) : null}
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOrigin("");
              setDestination("");
              if (showDate) onDateChange("");
            }}
          >
            Limpiar filtros
          </Button>
        ) : null}
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
          onSelect={onSelect}
          onChangeStatus={onChangeStatus}
        />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={list.data?.total ?? 0}
          disabled={list.isPlaceholderData}
          onPageChange={(next) => setPaging({ key: filterKey, page: next })}
          onPageSizeChange={setPageSize}
        />
      </div>
    </section>
  );
}
