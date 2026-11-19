import type { DashboardFlightRow } from "@lifex/shared";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { formatDate, formatTime } from "@/lib/dates.ts";
import { cn } from "@/lib/utils.ts";
import { formatPercent, statusLabel } from "./status.ts";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, DashboardFlightRow>();
const columns = helper.columns([
  helper.accessor((row) => `${row.from} → ${row.to}`, { id: "route", header: "Ruta" }),
  helper.accessor("departureDate", {
    header: "Salida",
    cell: (info) => `${formatDate(info.getValue(), "es")} · ${formatTime(info.getValue())}`,
  }),
  helper.accessor("status", {
    header: "Estado",
    cell: (info) => <Badge variant="outline">{statusLabel(info.getValue())}</Badge>,
  }),
  helper.accessor("occupancyRate", {
    header: "Ocupación",
    cell: (info) => formatPercent(info.getValue()),
  }),
]);

const NO_ROWS: DashboardFlightRow[] = [];

export function FlightsTable({
  flights,
  selectedId,
  canManage,
  onSelect,
  onChangeStatus,
}: {
  flights: DashboardFlightRow[] | undefined;
  selectedId: string | null;
  canManage: boolean;
  onSelect: (flightId: string) => void;
  onChangeStatus: (flight: DashboardFlightRow) => void;
}) {
  const table = useTable({ features, columns, data: flights ?? NO_ROWS });
  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
            {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={canManage ? 5 : 4}
              className="text-muted-foreground h-20 text-center"
            >
              No hay vuelos para esta fecha.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.original.flightId === selectedId ? "selected" : undefined}
              className={cn("cursor-pointer")}
              onClick={() => onSelect(row.original.flightId)}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
              {canManage ? (
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChangeStatus(row.original);
                    }}
                  >
                    Cambiar estado
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
