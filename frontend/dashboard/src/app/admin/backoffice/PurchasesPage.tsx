import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { purchasesQuery } from "@/api/queries.ts";
import { AirportCombobox } from "@/components/AirportCombobox.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useAirports } from "@/hooks/use-airports.ts";
import { useDebounced } from "@/hooks/use-debounced.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { TablePagination } from "../flights/TablePagination.tsx";
import { PurchasesTable } from "./PurchasesTable.tsx";

const STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmadas" },
  { value: "PAYMENT_PENDING", label: "Pago pendiente" },
  { value: "CANCELLED", label: "Canceladas" },
  { value: "EXPIRED", label: "Vencidas" },
  { value: "ALL", label: "Todas" },
] as const;

const selectClass = "border-input bg-background h-9 rounded-md border px-2 text-sm";

/**
 * Compras: todas las reservas con su cliente, vuelo y pago. Filtros por texto (reserva, correo, teléfono o
 * pasajero), estado, fecha de compra y ruta del vuelo (origen y destino con autocompletar), con paginación.
 */
export function PurchasesPage() {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const airports = useAirports();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("CONFIRMED");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const search = useDebounced(text.trim());

  // La página vuelve a la 1 cuando cambia cualquier filtro, sin efectos.
  const filterKey = [search, status, dateFrom, dateTo, origin, destination, pageSize].join("|");
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const list = useQuery({
    ...purchasesQuery(
      {
        ...(search ? { search } : {}),
        status,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(origin ? { origin } : {}),
        ...(destination ? { destination } : {}),
        page,
        pageSize,
      },
      token,
    ),
    enabled: token !== "",
  });
  const filtered =
    text !== "" || status !== "CONFIRMED" || dateFrom || dateTo || origin || destination;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Compras</h2>
        <p className="text-muted-foreground text-sm">
          Reservas con su cliente, vuelo y pago. Por defecto, las confirmadas.
        </p>
      </div>

      <section aria-label="Filtros de compras" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          Buscar
          <Input
            type="search"
            value={text}
            placeholder="Reserva, correo, teléfono, pasajero o documento"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Estado
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Comprada desde
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Comprada hasta
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          Origen del vuelo
          <AirportCombobox
            id="purchases-origin"
            value={origin}
            options={airports}
            placeholder="Todos los orígenes"
            onChange={setOrigin}
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          Destino del vuelo
          <AirportCombobox
            id="purchases-destination"
            value={destination}
            options={airports}
            placeholder="Todos los destinos"
            onChange={setDestination}
          />
        </label>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setStatus("CONFIRMED");
              setDateFrom("");
              setDateTo("");
              setOrigin("");
              setDestination("");
            }}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </section>

      {list.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudieron cargar las compras. {list.error.message}
        </p>
      ) : null}
      <div className="rounded-lg border">
        <PurchasesTable purchases={list.data?.purchases} />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={list.data?.total ?? 0}
          noun="compras"
          disabled={list.isPlaceholderData}
          onPageChange={(next) => setPaging({ key: filterKey, page: next })}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
