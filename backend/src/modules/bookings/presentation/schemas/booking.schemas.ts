import { z } from "zod";

export const startBookingSchema = z
  .object({
    flightId: z.uuid(),
    contactEmail: z.string().max(320),
    contactPhone: z.string().max(30).optional(),
  })
  .strict();

const passengerSchema = z
  .object({
    fullName: z.string().max(200),
    lastName: z.string().max(200),
    documentType: z.string().max(20),
    documentNumber: z.string().max(40),
    gender: z.string().max(20),
    dateBirth: z.string().max(10),
    nationalityCountryId: z.number().int().positive(),
    seatId: z.uuid(),
    luggageTypeId: z.number().int().positive().optional(),
  })
  .strict();

export const setPassengersSchema = z
  .object({ passengers: z.array(passengerSchema).min(1).max(20) })
  .strict();
