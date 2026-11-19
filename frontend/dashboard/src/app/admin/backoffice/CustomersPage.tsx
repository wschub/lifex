import type { CustomerRow } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { customersQuery, purchasesQuery } from "@/api/queries.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { useDebounced } from "@/hooks/use-debounced.ts";
import { formatDate, formatTime } from "@/lib/dates.ts";
import { formatUsd } from "@/lib/format.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { TablePagination } from "../flights/TablePagination.tsx";
import { PurchasesTable } from "./PurchasesTable.tsx";

/** Las compras de un cliente, en una ventana. */
function CustomerPurchasesDialog({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const purchases = useQuery({
    ...purchasesQuery(
      { email: customer?.email ?? "", status: "CONFIRMED", page: 1, pageSize: 100 },
      token,
    ),
    enabled: token !== "" && customer !== null,
  });

  return (
    <Dialog open={customer !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{customer?.name || customer?.email}</DialogTitle>
          <DialogDescription>
            {customer
              ? `${customer.email}${customer.phone ? ` · ${customer.phone}` : ""} · ${customer.purchases} ${customer.purchases === 1 ? "compra" : "compras"} · ${formatUsd(customer.totalUsd)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {purchases.isError ? (
          <p role="alert" className="text-destructive text-sm">
            No se pudieron cargar las compras. {purchases.error.message}
          </p>
        ) : null}
        <div className="rounded-lg border">
          <PurchasesTable
            purchases={purchases.data?.purchases}
            showCustomer={false}
            emptyText="Este cliente no tiene compras confirmadas."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Clientes: quienes compraron en Lifex (no tienen cuenta: se agrupan por correo). Muestra cuántas compras hizo
 * cada uno y cuánto gastó; al dar clic en un cliente se ven sus compras. Búsqueda por nombre, correo o teléfono
 * y paginación.
 */
export function CustomersPage() {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const [text, setText] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const search = useDebounced(text.trim());

  const filterKey = `${search}|${pageSize}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const list = useQuery({
    ...customersQuery({ ...(search ? { search } : {}), page, pageSize }, token),
    enabled: token !== "",
  });
  const rows = list.data?.customers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Clientes</h2>
        <p className="text-muted-foreground text-sm">
          Quienes han comprado, agrupados por correo. Haz clic en un cliente para ver sus compras.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          Buscar cliente
          <Input
            type="search"
            value={text}
            placeholder="Nombre, correo o teléfono"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {text !== "" ? (
          <Button variant="ghost" size="sm" onClick={() => setText("")}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {list.isError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudieron cargar los clientes. {list.error.message}
        </p>
      ) : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Total gastado</TableHead>
              <TableHead>Última compra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-20 text-center">
                  {list.data === undefined
                    ? "Cargando clientes…"
                    : search
                      ? "Ningún cliente coincide con la búsqueda."
                      : "Todavía no hay clientes con compras confirmadas."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((customer) => (
                <TableRow
                  key={customer.email}
                  className="cursor-pointer"
                  onClick={() => setSelected(customer)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{customer.name || "—"}</span>
                      <span className="text-muted-foreground text-xs">{customer.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{customer.phone ?? "Sin teléfono"}</TableCell>
                  <TableCell className="text-right tabular-nums">{customer.purchases}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(customer.totalUsd)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(customer.lastPurchaseAt, "es")} ·{" "}
                    {formatTime(customer.lastPurchaseAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={list.data?.total ?? 0}
          noun="clientes"
          disabled={list.isPlaceholderData}
          onPageChange={(next) => setPaging({ key: filterKey, page: next })}
          onPageSizeChange={setPageSize}
        />
      </div>

      <CustomerPurchasesDialog customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
