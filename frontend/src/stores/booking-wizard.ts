import type { SeatClass } from "@lifex/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultSearchDate } from "@/lib/search-date.ts";

export type FareId = "light" | "classic" | "flex" | "elite" | "royal";
export type Cabin = "economy" | "business";

export interface SearchParams {
  from: string;
  to: string;
  date: string;
  pax: number;
}

/** Datos de un pasajero tal como los escribe el formulario (la validación fina la hace la página). */
export interface PassengerForm {
  ok: boolean;
  /** "m" masculino · "f" femenino (el backend no admite otro valor). */
  g: "m" | "f";
  first: string;
  last: string;
  dd: number;
  dm: number;
  dy: number;
  /** Id del país (`countries.id`) como texto, para el `<select>`. */
  nat: string;
  docType: "CC" | "CE" | "TI" | "PASSPORT";
  docNumber: string;
  hasLx: boolean;
  lx: string;
  assist: boolean;
}

export interface HolderForm {
  ok: boolean;
  /** Índice del pasajero que es el titular. */
  p: number;
  pre: string;
  ph: string;
  em: string;
  em2: string;
  c1: boolean;
  c2: boolean;
}

export interface BookingSession {
  id: string;
  token: string;
  /** La reserva y su token de invitado caducan juntos. */
  expiresAt: string;
  /** Contacto con el que se creó: si cambia, hay que abrir otra reserva. */
  contactEmail: string;
  contactPhone: string;
}

export interface HeldSeat {
  seatId: string;
  identifier: string;
  seatClass: SeatClass;
  priceUsd: number;
  holdExpiresAt: string;
}

export interface WizardState {
  search: SearchParams;
  flightId: string | null;
  fareId: FareId | null;
  luggageTypeId: number | null;
  cabin: Cabin;
  passengers: PassengerForm[];
  holder: HolderForm | null;
  booking: BookingSession | null;
  /** Un asiento por pasajero (misma posición que `passengers`); `null` = sin elegir. */
  seats: (HeldSeat | null)[];
  /** Clave de idempotencia del intento de pago en curso. */
  paymentKey: string | null;
  /** Reserva ya pagada: la confirmación la lee de aquí. */
  confirmedBookingId: string | null;

  setSearch(search: SearchParams): void;
  setSearchDate(date: string): void;
  chooseFlight(flightId: string): void;
  chooseFare(input: { fareId: FareId; luggageTypeId: number; cabin: Cabin }): void;
  setCabin(cabin: Cabin): void;
  setPassengers(passengers: PassengerForm[]): void;
  setHolder(holder: HolderForm | null): void;
  attachBooking(booking: BookingSession): void;
  setSeats(seats: (HeldSeat | null)[]): void;
  setPaymentKey(key: string | null): void;
  confirm(bookingId: string): void;
  /** Descarta la reserva y los asientos (por ejemplo tras un pago rechazado) y conserva los datos escritos. */
  dropBooking(): void;
  reset(): void;
}

export const initialSearch = (): SearchParams => ({
  from: "BOG",
  to: "",
  date: defaultSearchDate(),
  pax: 1,
});

const initialData = () => ({
  search: initialSearch(),
  flightId: null,
  fareId: null,
  luggageTypeId: null,
  cabin: "economy" as Cabin,
  passengers: [] as PassengerForm[],
  holder: null,
  booking: null,
  seats: [] as (HeldSeat | null)[],
  paymentKey: null,
  confirmedBookingId: null,
});

export const WIZARD_STORAGE_KEY = "lx-wizard";

/**
 * Estado del asistente de compra (búsqueda → tarifa → pasajeros → asiento → pago).
 * Vive en `sessionStorage`: sobrevive a una recarga, no a cerrar la pestaña. Nunca guarda datos de tarjeta.
 * El estado de la reserva en el servidor se consulta con TanStack Query, no se copia aquí.
 */
export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      ...initialData(),
      setSearch: (search) => set({ search }),
      setSearchDate: (date) => set((s) => ({ search: { ...s.search, date } })),
      chooseFlight: (flightId) =>
        set((s) =>
          s.flightId === flightId
            ? {}
            : { flightId, fareId: null, luggageTypeId: null, seats: [], booking: null },
        ),
      chooseFare: ({ fareId, luggageTypeId, cabin }) =>
        set((s) => (s.fareId === fareId ? { cabin } : { fareId, luggageTypeId, cabin, seats: [] })),
      setCabin: (cabin) => set({ cabin }),
      setPassengers: (passengers) => set({ passengers }),
      setHolder: (holder) => set({ holder }),
      attachBooking: (booking) => set({ booking }),
      setSeats: (seats) => set({ seats }),
      setPaymentKey: (paymentKey) => set({ paymentKey }),
      confirm: (confirmedBookingId) => set({ confirmedBookingId }),
      dropBooking: () => set({ booking: null, seats: [], paymentKey: null }),
      reset: () => set(initialData()),
    }),
    {
      name: WIZARD_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/** Para el selector de pasajeros: nombre completo o "Adulto n" si aún no se escribió. */
export const passengerLabel = (p: PassengerForm | undefined): string | null =>
  p?.ok ? `${p.first} ${p.last}` : null;
