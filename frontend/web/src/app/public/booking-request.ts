import type { SetPassengersRequest } from "@lifex/shared";
import type { HeldSeat, HolderForm, PassengerForm } from "@/stores/booking-wizard.ts";
import { orderedPassengers } from "./passenger-validation.ts";

const pad = (n: number) => String(n).padStart(2, "0");

interface Input {
  passengers: readonly PassengerForm[];
  holder: HolderForm;
  seats: readonly (HeldSeat | null)[];
  luggageTypeId: number;
  count: number;
}

/**
 * Cuerpo de `PUT /bookings/:id/passengers`. El titular de la reserva va primero (el backend lo toma como
 * comprador) y cada pasajero conserva el asiento que se le eligió, aunque cambie el orden.
 */
export function toSetPassengersRequest({
  passengers,
  holder,
  seats,
  luggageTypeId,
  count,
}: Input): SetPassengersRequest {
  const used = passengers.slice(0, count);
  return {
    passengers: orderedPassengers(used, holder).map(({ form, index }) => {
      const seat = seats[index];
      if (!seat) throw new Error(`El pasajero ${index + 1} no tiene asiento`);
      return {
        fullName: form.first,
        lastName: form.last,
        documentType: form.docType,
        documentNumber: form.docNumber,
        gender: form.g === "f" ? ("FEMENINO" as const) : ("MASCULINO" as const),
        dateBirth: `${form.dy}-${pad(form.dm)}-${pad(form.dd)}`,
        nationalityCountryId: Number(form.nat),
        seatId: seat.seatId,
        luggageTypeId,
      };
    }),
  };
}
