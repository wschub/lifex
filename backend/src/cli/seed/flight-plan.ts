/**
 * Plan de vuelos del seed: cada ruta tiene sus vuelos diarios en todo el rango de fechas.
 *
 *   Nacionales (10 ciudades, cada una hacia las otras 9 = 90 rutas): 3 vuelos diarios por ruta,
 *   uno en la mañana, uno en la tarde y uno en la noche.
 *   Internacionales (Medellín y Bogotá hacia cada destino): 2 vuelos diarios por ruta, uno en la
 *   tarde y uno en la noche.
 *
 * La hora de cada vuelo es "aleatoria" dentro de su franja, pero determinista: la misma ruta, día y
 * franja siempre dan la misma hora, así que volver a ejecutar el seed no duplica vuelos.
 * Es una función pura (sin Prisma ni entorno) para poder probarla.
 */

export type FlightKind = "DOMESTIC" | "INTERNATIONAL";

export interface FlightPlan {
  fromIata: string;
  toIata: string;
  type: FlightKind;
  departure: Date;
  /** Duración del vuelo en minutos. */
  minutes: number;
  /** basePriceDefault del vuelo (USD): precio mínimo de partida. */
  economy: number;
}

export interface PlanInput {
  /** Primer día (medianoche UTC del día calendario, hora de Colombia). */
  startDay: number;
  /** Último día, inclusive. */
  endDay: number;
  /** Instante actual: los vuelos que ya salieron hoy no se crean. */
  now: Date;
  domesticIatas: readonly string[];
  internationalDestinations: readonly { iata: string; minutes: number }[];
  internationalOrigins: readonly string[];
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBIA_OFFSET_HOURS = 5;

/** Franjas de salida en hora local de Colombia: [primera hora, última hora] (minutos de 5 en 5). */
const MORNING = [5, 11] as const;
const AFTERNOON = [12, 17] as const;
const NIGHT = [18, 23] as const;

const DOMESTIC_SLOTS = [MORNING, AFTERNOON, NIGHT] as const;
const INTERNATIONAL_SLOTS = [AFTERNOON, NIGHT] as const;

/** Generador pseudoaleatorio determinista (mulberry32) sembrado con un texto. */
function randomFrom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hora local de Colombia → instante UTC. */
function localDeparture(dayMs: number, hour: number, minute: number): Date {
  return new Date(dayMs + (hour + COLOMBIA_OFFSET_HOURS) * 3_600_000 + minute * 60_000);
}

function slotTime(
  slot: readonly [number, number],
  random: () => number,
): { hour: number; minute: number } {
  const [first, last] = slot;
  const options = (last - first + 1) * 12; // minutos de 5 en 5
  const pick = Math.floor(random() * options);
  return { hour: first + Math.floor(pick / 12), minute: (pick % 12) * 5 };
}

export function planFlights(input: PlanInput): FlightPlan[] {
  const plans: FlightPlan[] = [];
  const domesticRoutes: [string, string][] = [];
  for (const from of input.domesticIatas) {
    for (const to of input.domesticIatas) if (from !== to) domesticRoutes.push([from, to]);
  }
  const internationalRoutes: { from: string; to: string; minutes: number }[] = [];
  for (const from of input.internationalOrigins) {
    for (const destination of input.internationalDestinations) {
      internationalRoutes.push({ from, to: destination.iata, minutes: destination.minutes });
    }
  }

  for (let dayMs = input.startDay; dayMs <= input.endDay; dayMs += DAY_MS) {
    const dayKey = new Date(dayMs).toISOString().slice(0, 10);

    domesticRoutes.forEach(([fromIata, toIata], routeIndex) => {
      DOMESTIC_SLOTS.forEach((slot, slotIndex) => {
        const { hour, minute } = slotTime(
          slot,
          randomFrom(`${fromIata}-${toIata}|${dayKey}|${slotIndex}`),
        );
        plans.push({
          fromIata,
          toIata,
          type: "DOMESTIC",
          departure: localDeparture(dayMs, hour, minute),
          minutes: 60 + (routeIndex % 4) * 10,
          economy: 80 + (routeIndex % 8) * 10,
        });
      });
    });

    internationalRoutes.forEach((route, routeIndex) => {
      INTERNATIONAL_SLOTS.forEach((slot, slotIndex) => {
        const { hour, minute } = slotTime(
          slot,
          randomFrom(`${route.from}-${route.to}|${dayKey}|${slotIndex}`),
        );
        plans.push({
          fromIata: route.from,
          toIata: route.to,
          type: "INTERNATIONAL",
          departure: localDeparture(dayMs, hour, minute),
          minutes: route.minutes,
          economy: 400 + (routeIndex % 10) * 50,
        });
      });
    });
  }

  // Los vuelos de hoy que ya salieron no se crean.
  return plans.filter((plan) => plan.departure.getTime() > input.now.getTime());
}
