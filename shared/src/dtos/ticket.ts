import { z } from "zod";
import { seatClassSchema } from "../common.ts";

export const ticketSchema = z.object({
  /** Código único (`LX…`): es lo que codifica el QR. */
  ticketCode: z.string().regex(/^LX[A-HJ-NP-Z2-9]{10}$/),
  passengerFirstName: z.string(),
  passengerFullName: z.string(),
  seatIdentifier: z.string(),
  seatClass: seatClassSchema,
  luggage: z.array(z.string()),
});
export type Ticket = z.infer<typeof ticketSchema>;

/** `GET /bookings/:id/tickets`. La imagen del QR está en `GET /tickets/:code/qr.png`. */
export const orderTicketsSchema = z.object({
  reservationNumber: z.string(),
  tickets: z.array(ticketSchema),
});
export type OrderTickets = z.infer<typeof orderTicketsSchema>;

export const ticketQrPath = (ticketCode: string): string => `/tickets/${ticketCode}/qr.png`;
