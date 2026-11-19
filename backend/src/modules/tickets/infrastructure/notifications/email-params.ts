import type {
  BookingConfirmation,
  TicketView,
} from "../../domain/repositories/ticket.repository.ts";
import type { FlightDisruption } from "../../application/ports/notification.port.ts";

/**
 * Arma el objeto `params` de cada plantilla (ver src/shared/notifications/templates). La plantilla no
 * sabe de dónde salen los datos; aquí se traducen y se formatean (fecha y hora en Colombia, moneda
 * según el idioma del comprador).
 */
const TIME_ZONE = "America/Bogota";

export interface EmailParamsOptions {
  /** URL pública de la API, para el enlace de la imagen QR. */
  publicApiUrl: string;
  /** URL pública del frontend: de allí salen los logos de los correos (`/mail/...`). */
  appUrl: string;
  /** Pesos colombianos por dólar (IATA_TRM). */
  usdToCop: number;
}

const SEAT_CLASS_LABEL = { ECONOMY: "Economy", BUSINESS: "Business" } as const;

export function formatDepartureDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";
  // "19 nov 2026": sin "de" ni el punto de la abreviatura del mes.
  return `${part("day")} ${part("month").replaceAll(".", "")} ${part("year")}`;
}

export function formatDepartureTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Los precios se guardan en USD; en español se muestran en COP con la TRM. */
export function formatTotal(usd: number, locale: "es" | "en", usdToCop: number): string {
  if (locale === "es") {
    const pesos = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(usd * usdToCop);
    return pesos.replace(/\s+/g, " ");
  }
  return `USD ${usd.toFixed(2)}`;
}

const LOGO_FILE = "lifex-concept2-vertical-slogan-color-1200w.png";

function flightParams(
  confirmation: BookingConfirmation,
  options: EmailParamsOptions,
): Record<string, string> {
  const flight = confirmation.flight;
  return {
    LOGO_URL: `${options.appUrl}/mail/${LOGO_FILE}`,
    RESERVATION_NUMBER: confirmation.reservationNumber,
    FROM_CITY: flight.fromCity,
    FROM_AIRPORT_CODE: flight.fromIata,
    TO_CITY: flight.toCity,
    TO_AIRPORT_CODE: flight.toIata,
    DEPARTURE_DATE: formatDepartureDate(flight.departureDate),
    DEPARTURE_TIME: formatDepartureTime(flight.departureDate),
  };
}

export function ticketConfirmationParams(
  confirmation: BookingConfirmation,
  ticket: TicketView,
  options: EmailParamsOptions,
): Record<string, string> {
  return {
    ...flightParams(confirmation, options),
    PASSENGER_NAME: confirmation.buyerFirstName,
    PASSENGER_FULL_NAME: ticket.passengerFullName,
    TICKET_CODE: ticket.ticketCode,
    QR_CODE_URL: `${options.publicApiUrl}/tickets/${ticket.ticketCode}/qr.png`,
    SEAT_CLASS: SEAT_CLASS_LABEL[ticket.seatClass],
    SEAT_IDENTIFIER: ticket.seatIdentifier,
    TOTAL_PRICE_DISPLAY: formatTotal(
      confirmation.totalPriceUsd,
      confirmation.locale,
      options.usdToCop,
    ),
  };
}

const DISRUPTION = {
  CANCELLED: {
    subject: "CANCELADO",
    title: "Cancelación de tu vuelo",
    color: "#c53030",
    message:
      "Lamentamos informarte que tu vuelo fue cancelado y sentimos mucho los inconvenientes. Te pedimos estar pendiente de tu correo: por ese medio te informaremos las novedades sobre tu reserva.",
  },
  DELAYED: {
    subject: "RETRASADO",
    title: "Retraso de tu vuelo",
    color: "#b7791f",
    message:
      "Tu vuelo presenta un retraso respecto a la hora programada. Agradecemos tu comprensión y te pedimos estar pendiente de tu correo: por ese medio te iremos informando las novedades sobre tu vuelo.",
  },
} as const;

export function disruptionSubject(
  confirmation: BookingConfirmation,
  disruption: FlightDisruption,
): string {
  return `Tu boleto Lifex — ${confirmation.reservationNumber} fue ${DISRUPTION[disruption].subject}`;
}

export function flightDisruptionParams(
  confirmation: BookingConfirmation,
  disruption: FlightDisruption,
  options: EmailParamsOptions,
): Record<string, string> {
  const copy = DISRUPTION[disruption];
  return {
    ...flightParams(confirmation, options),
    PASSENGER_NAME: confirmation.buyerFirstName,
    STATUS_TITLE: copy.title,
    STATUS_MESSAGE: copy.message,
    STATUS_COLOR: copy.color,
    PASSENGERS_SUMMARY: confirmation.tickets
      .map((ticket) => `${ticket.passengerFullName} (${ticket.seatIdentifier})`)
      .join(", "),
  };
}
