import { useQuery } from "@tanstack/react-query";
import type { PublicConfig } from "@lifex/shared";
import { configQuery } from "@/api/queries.ts";

/** Valores de respaldo mientras llega `GET /config` (los mismos por defecto del backend). */
const FALLBACK: PublicConfig = {
  iataTrm: 3300,
  taxPercentage: 19,
  maxSeatLockMinutes: 15,
  maxHeldSeatsPerSession: 6,
};

export function usePublicConfig(): PublicConfig {
  return useQuery(configQuery()).data ?? FALLBACK;
}
