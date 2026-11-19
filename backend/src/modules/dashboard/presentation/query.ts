import { AppError } from "../../../shared/errors/app-error.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Código IATA opcional (3 letras): se normaliza a mayúsculas. */
export function airportCode(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw new AppError("validation", { code: "INVALID_AIRPORT" });
  }
  return value.toUpperCase();
}

/** Entero positivo opcional (página y tamaño de página). */
export function positiveInt(value: unknown, code: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 1) throw new AppError("validation", { code });
  return number;
}

/** Texto opcional (búsqueda), con un límite razonable. */
export function searchText(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 100) {
    throw new AppError("validation", { code: "INVALID_SEARCH" });
  }
  return value;
}

/** Día AAAA-MM-DD (hora de Colombia) opcional: devuelve el inicio de ese día. */
export function dayStart(value: unknown): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const date =
    typeof value === "string" && DATE.test(value) ? new Date(`${value}T00:00:00-05:00`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new AppError("validation", { code: "INVALID_SEARCH_DATE" });
  }
  return date;
}

/** Inicio del día siguiente al indicado (para un límite superior excluyente). */
export function dayAfter(value: unknown): Date | undefined {
  const start = dayStart(value);
  return start ? new Date(start.getTime() + DAY_MS) : undefined;
}
