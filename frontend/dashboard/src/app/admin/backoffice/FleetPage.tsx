import { useQuery } from "@tanstack/react-query";
import { aircraftQuery } from "@/api/queries.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { formatInteger } from "@/lib/format.ts";
import { useStaffSession } from "@/stores/staff-session.ts";

/** Flota: los aviones de Lifex con su descripción, capacidad por clase, alcance y vuelos programados. */
export function FleetPage() {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const query = useQuery({ ...aircraftQuery(token), enabled: token !== "" });
  const aircraft = query.data?.aircraft;
  const seats = (aircraft ?? []).reduce((sum, item) => sum + item.totalSeats, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Flota de aviones</h2>
        <p className="text-muted-foreground text-sm">
          Los aviones de Lifex: modelo, descripción, capacidad y alcance.
        </p>
      </div>

      {aircraft ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Aviones</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{aircraft.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Capacidad total</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{formatInteger(seats)}</CardTitle>
              <p className="text-muted-foreground text-xs">asientos entre todos los aviones</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Disponibles</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {aircraft.filter((item) => item.status === "AVAILABLE").length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {query.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudo cargar la flota. {query.error.message}
        </p>
      ) : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avión</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Capacidad</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Vuelos programados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aircraft === undefined || aircraft.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-20 text-center">
                  {aircraft === undefined ? "Cargando flota…" : "No hay aviones registrados."}
                </TableCell>
              </TableRow>
            ) : (
              aircraft.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.reference}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.internalIdentifier}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-72 text-sm whitespace-normal">
                    {item.descriptionEs || item.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.typeRange === "INTERNATIONAL" ? "Internacional" : "Nacional"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <span className="font-medium tabular-nums">
                        {formatInteger(item.totalSeats)} asientos
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {item.businessSeats} Business · {item.economySeats} Economy
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <span className="font-medium tabular-nums">
                        {formatInteger(item.rangeKm)} km
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatInteger(item.rangeNauticalMiles)} mn
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "AVAILABLE" ? "default" : "outline"}>
                      {item.status === "AVAILABLE" ? "Disponible" : "No disponible"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteger(item.upcomingFlights)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
