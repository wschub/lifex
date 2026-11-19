import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export const PAGE_SIZES = [10, 20, 50, 100] as const;

const number = new Intl.NumberFormat("es-CO");

/** Pie de la tabla: rango mostrado, tamaño de página y botones anterior / siguiente (paginación del servidor). */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  noun = "vuelos",
  disabled = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Qué se está paginando, en plural ("vuelos", "clientes", "compras"). */
  noun?: string;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        Mostrando {number.format(first)}–{number.format(last)} de {number.format(total)} {noun}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          Filas por página
          <select
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="tabular-nums">
          Página {number.format(page)} de {number.format(pages)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
