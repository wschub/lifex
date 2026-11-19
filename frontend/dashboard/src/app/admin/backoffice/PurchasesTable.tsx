import type { PurchaseRow, PurchaseStatus } from "@lifex/shared";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { formatDate, formatTime } from "@/lib/dates.ts";
import { formatUsd } from "@/lib/format.ts";

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  DRAFT: "Borrador",
  PAYMENT_PENDING: "Pago pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

const PAYMENT_LABEL = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
} as const;

/** Tabla de compras: reserva, fecha, cliente, vuelo, pasajeros, total y pago. */
export function PurchasesTable({
  purchases,
  showCustomer = true,
  emptyText = "No hay compras con estos filtros.",
}: {
  purchases: PurchaseRow[] | undefined;
  /** En la ventana de un cliente la columna del cliente sobra. */
  showCustomer?: boolean;
  emptyText?: string;
}) {
  const rows = purchases ?? [];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reserva</TableHead>
          <TableHead>Fecha de compra</TableHead>
          {showCustomer ? <TableHead>Cliente</TableHead> : null}
          <TableHead>Vuelo</TableHead>
          <TableHead className="text-right">Pasajeros</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Pago</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={showCustomer ? 7 : 6}
              className="text-muted-foreground h-20 text-center"
            >
              {purchases === undefined ? "Cargando compras…" : emptyText}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium tracking-wider">{purchase.reservationNumber}</span>
                  <Badge variant={purchase.status === "CONFIRMED" ? "default" : "outline"}>
                    {PURCHASE_STATUS_LABEL[purchase.status]}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(purchase.createdAt, "es")} · {formatTime(purchase.createdAt)}
              </TableCell>
              {showCustomer ? (
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span className="font-medium">{purchase.customerName || "—"}</span>
                    <span className="text-muted-foreground text-xs">{purchase.customerEmail}</span>
                  </div>
                </TableCell>
              ) : null}
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="font-medium">
                    {purchase.flight.fromCity} ({purchase.flight.from}) → {purchase.flight.toCity} (
                    {purchase.flight.to})
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {purchase.flight.routeType === "INTERNATIONAL" ? "Internacional" : "Nacional"} ·{" "}
                    {formatDate(purchase.flight.departureDate, "es")} ·{" "}
                    {formatTime(purchase.flight.departureDate)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{purchase.passengers}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatUsd(purchase.totalUsd)}
              </TableCell>
              <TableCell className="text-sm">
                {purchase.payment ? (
                  <div className="flex flex-col">
                    <span>
                      {purchase.payment.cardBrand} •••• {purchase.payment.cardLast4}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {PAYMENT_LABEL[purchase.payment.status]}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Sin pago</span>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
