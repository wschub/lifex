import { PERMISSION, type DashboardPassenger } from "@lifex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { setPassengerCheckIn } from "@/api/dashboard.ts";
import { dashboardPassengersQuery } from "@/api/queries.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { formatTime } from "@/lib/dates.ts";
import { normalizeText } from "@/lib/airport-search.ts";
import { usePermission, useStaffSession } from "@/stores/staff-session.ts";

const DOCUMENT_LABEL: Record<string, string> = {
  CC: "CC",
  CE: "CE",
  TI: "TI",
  PASSPORT: "Pasaporte",
};

type ClassFilter = "ALL" | "ECONOMY" | "BUSINESS";
type CheckInFilter = "ALL" | "YES" | "NO";

/** Texto que se busca en cada pasajero: nombre, documento, contacto, reserva, ticket y asiento. */
function searchable(passenger: DashboardPassenger): string {
  return normalizeText(
    [
      passenger.fullName,
      passenger.lastName,
      passenger.documentNumber,
      passenger.contactEmail,
      passenger.contactPhone ?? "",
      passenger.reservationNumber,
      passenger.ticketCode,
      passenger.seatIdentifier,
    ].join(" "),
  );
}

const selectClass = "border-input bg-background h-9 rounded-md border px-2 text-sm";

/**
 * Pasajeros del vuelo (reservas pagadas): nombre, documento, asiento y clase, tarifa de equipaje, contacto de la
 * reserva (correo y teléfono) y estado del check-in. Con filtros de texto, clase y check-in.
 * Quien puede gestionar vuelos (`flights:manage`) registra o quita el check-in de cada pasajero.
 */
export function PassengersPanel({ flightId }: { flightId: string }) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const canManage = usePermission(PERMISSION.flightsManage);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [cabin, setCabin] = useState<ClassFilter>("ALL");
  const [checkIn, setCheckIn] = useState<CheckInFilter>("ALL");

  const query = useQuery({ ...dashboardPassengersQuery(flightId, token), enabled: token !== "" });
  const toggle = useMutation({
    mutationFn: (input: { ticketId: string; checkedIn: boolean }) =>
      setPassengerCheckIn(flightId, input.ticketId, input.checkedIn, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboardPassengers", flightId] }),
  });

  const all = query.data?.passengers;
  const visible = useMemo(() => {
    const needle = normalizeText(text);
    return (all ?? []).filter(
      (passenger) =>
        (cabin === "ALL" || passenger.seatClass === cabin) &&
        (checkIn === "ALL" || (checkIn === "YES") === passenger.checkedIn) &&
        (needle === "" || searchable(passenger).includes(needle)),
    );
  }, [all, text, cabin, checkIn]);
  const checkedCount = (all ?? []).filter((passenger) => passenger.checkedIn).length;
  const filtered = text !== "" || cabin !== "ALL" || checkIn !== "ALL";

  return (
    <section aria-label="Pasajeros" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium">Pasajeros</h3>
          <p className="text-muted-foreground text-sm">
            {all
              ? `${all.length} con ticket · ${checkedCount} con check-in · ${all.length - checkedCount} sin check-in`
              : "Reservas pagadas de este vuelo"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          Buscar pasajero
          <Input
            type="search"
            value={text}
            placeholder="Nombre, documento, correo, teléfono, reserva, ticket o asiento"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Clase
          <select
            className={selectClass}
            value={cabin}
            onChange={(event) => setCabin(event.target.value as ClassFilter)}
          >
            <option value="ALL">Todas</option>
            <option value="ECONOMY">Economy</option>
            <option value="BUSINESS">Business</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Check-in
          <select
            className={selectClass}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value as CheckInFilter)}
          >
            <option value="ALL">Todos</option>
            <option value="YES">Con check-in</option>
            <option value="NO">Sin check-in</option>
          </select>
        </label>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setCabin("ALL");
              setCheckIn("ALL");
            }}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudieron cargar los pasajeros. {query.error.message}
        </p>
      ) : null}
      {toggle.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudo actualizar el check-in. {toggle.error.message}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pasajero</TableHead>
              <TableHead>Asiento</TableHead>
              <TableHead>Reserva</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Equipaje</TableHead>
              <TableHead>Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-20 text-center">
                  {all === undefined
                    ? "Cargando pasajeros…"
                    : filtered
                      ? "Ningún pasajero coincide con los filtros."
                      : "Este vuelo todavía no tiene reservas pagadas."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((passenger) => (
                <TableRow key={passenger.ticketId}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {passenger.fullName} {passenger.lastName}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {DOCUMENT_LABEL[passenger.documentType] ?? passenger.documentType}{" "}
                        {passenger.documentNumber} ·{" "}
                        {passenger.passengerType === "CHILD" ? "Niño" : "Adulto"}
                        {passenger.isHolder ? " · Titular" : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium tabular-nums">{passenger.seatIdentifier}</span>
                      <Badge variant="outline">
                        {passenger.seatClass === "BUSINESS" ? "Business" : "Economy"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium tracking-wider">
                        {passenger.reservationNumber}
                      </span>
                      <span className="text-muted-foreground text-xs">{passenger.ticketCode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <a
                        className="underline-offset-2 hover:underline"
                        href={`mailto:${passenger.contactEmail}`}
                      >
                        {passenger.contactEmail}
                      </a>
                      <span className="text-muted-foreground text-xs">
                        {passenger.contactPhone ?? "Sin teléfono"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{passenger.luggage ?? "Sin equipaje"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant={passenger.checkedIn ? "default" : "outline"}
                        className={passenger.checkedIn ? "bg-emerald-700 text-white" : undefined}
                      >
                        {passenger.checkedIn ? "Hecho" : "Pendiente"}
                      </Badge>
                      {passenger.checkedInAt ? (
                        <span className="text-muted-foreground text-xs">
                          {formatTime(passenger.checkedInAt)}
                        </span>
                      ) : null}
                      {canManage ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggle.isPending}
                          onClick={() =>
                            toggle.mutate({
                              ticketId: passenger.ticketId,
                              checkedIn: !passenger.checkedIn,
                            })
                          }
                        >
                          {passenger.checkedIn ? "Quitar check-in" : "Registrar check-in"}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
