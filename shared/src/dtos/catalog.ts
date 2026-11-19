import { z } from "zod";

export const countrySchema = z.object({
  id: z.number().int(),
  isoCode: z.string().length(2),
  name: z.string(),
  nameEs: z.string(),
});
export type Country = z.infer<typeof countrySchema>;
export const countriesResponseSchema = z.object({ countries: z.array(countrySchema) });

export const citySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  nameEs: z.string(),
  countryIsoCode: z.string().length(2),
  /** Ruta relativa (ej. `/img/destinations/medellin.jpg`); el frontend la resuelve contra su origen. */
  imageName: z.string().nullable(),
  airports: z.array(z.object({ id: z.number().int(), iataCode: z.string().length(3) })),
});
export type City = z.infer<typeof citySchema>;
export const citiesResponseSchema = z.object({ cities: z.array(citySchema) });

export const luggageTypeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  nameEs: z.string(),
  rank: z.number().int(),
  /** Porcentaje del precio del asiento. */
  feePercentage: z.number(),
  /** Solo se puede elegir con un asiento BUSINESS. */
  businessOnly: z.boolean(),
});
export type LuggageType = z.infer<typeof luggageTypeSchema>;
export const luggageTypesResponseSchema = z.object({ luggageTypes: z.array(luggageTypeSchema) });

/** `GET /config`: valores públicos para calcular precios y límites en el navegador. Sin secretos. */
export const publicConfigSchema = z.object({
  /** Pesos colombianos por dólar (IATA_TRM). */
  iataTrm: z.number(),
  /** Porcentaje de impuestos incluido en el total. */
  taxPercentage: z.number(),
  maxSeatLockMinutes: z.number(),
  /** Minutos sin actividad en la web antes de mostrar el modal de sesión inactiva. */
  idleTimeoutMinutes: z.number(),
  maxHeldSeatsPerSession: z.number(),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;
