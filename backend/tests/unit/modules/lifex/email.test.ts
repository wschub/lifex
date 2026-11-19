import { describe, expect, it } from "vitest";
import { renderEmail } from "../../../../src/shared/notifications/render-template.ts";
import type {
  BookingConfirmation,
  TicketView,
} from "../../../../src/modules/tickets/domain/repositories/ticket.repository.ts";
import { BrevoNotificationAdapter } from "../../../../src/modules/tickets/infrastructure/notifications/brevo-notification.adapter.ts";
import {
  flightDisruptionParams,
  formatDepartureDate,
  formatDepartureTime,
  formatTotal,
  ticketConfirmationParams,
} from "../../../../src/modules/tickets/infrastructure/notifications/email-params.ts";

const ticket: TicketView = {
  ticketCode: "LXABCDEFGH23",
  passengerFirstName: "Ana",
  passengerFullName: "Ana Gómez",
  seatIdentifier: "12A",
  seatClass: "BUSINESS",
  luggage: [],
};

const confirmation: BookingConfirmation = {
  orderId: "o1",
  reservationNumber: "K7M2QX",
  contactEmail: "ana@example.com",
  locale: "es",
  buyerFirstName: "Ana",
  flight: {
    id: "f1",
    fromIata: "MDE",
    fromCity: "Medellín",
    toIata: "BOG",
    toCity: "Bogotá",
    departureDate: new Date("2026-11-19T12:30:00Z"), // 07:30 en Colombia
    arrivalDate: new Date("2026-11-19T13:30:00Z"),
  },
  totalPriceUsd: 130.9,
  tickets: [
    ticket,
    {
      ...ticket,
      ticketCode: "LXZZZZZZZZ22",
      passengerFullName: "Luis Pérez",
      seatIdentifier: "12B",
    },
  ],
};

const OPTIONS = {
  publicApiUrl: "https://api.lifex.test",
  appUrl: "http://localhost:5173",
  usdToCop: 3300,
};
const LOGO_IMG =
  '<img src="http://localhost:5173/mail/lifex-concept2-vertical-slogan-color-1200w.png"';

describe("formato de los correos", () => {
  it("fecha y hora en la zona de Colombia", () => {
    expect(formatDepartureDate(confirmation.flight.departureDate)).toBe("19 nov 2026");
    expect(formatDepartureTime(confirmation.flight.departureDate)).toBe("07:30");
    // 23:30 del 19 en Colombia ya es 04:30 UTC del 20
    expect(formatDepartureDate(new Date("2026-11-20T04:30:00Z"))).toBe("19 nov 2026");
  });

  it("el total se muestra en COP en español y en USD en inglés", () => {
    expect(formatTotal(130.9, "es", 3300)).toMatch(/^COP\s431\.970$/);
    expect(formatTotal(130.9, "en", 3300)).toBe("USD 130.90");
  });

  it("arma los params del ticket con el enlace del QR", () => {
    const params = ticketConfirmationParams(confirmation, ticket, OPTIONS);

    expect(params).toMatchObject({
      PASSENGER_NAME: "Ana",
      PASSENGER_FULL_NAME: "Ana Gómez",
      RESERVATION_NUMBER: "K7M2QX",
      TICKET_CODE: "LXABCDEFGH23",
      QR_CODE_URL: "https://api.lifex.test/tickets/LXABCDEFGH23/qr.png",
      SEAT_CLASS: "Business",
      SEAT_IDENTIFIER: "12A",
      FROM_AIRPORT_CODE: "MDE",
      DEPARTURE_TIME: "07:30",
    });
  });
});

describe("plantillas", () => {
  it("la confirmación rellena todas las variables, en HTML y en texto plano", () => {
    const { html, text } = renderEmail(
      "ticket-confirmation",
      ticketConfirmationParams(confirmation, ticket, OPTIONS),
    );

    for (const output of [html, text]) {
      expect(output).not.toContain("{{");
      expect(output).toContain("K7M2QX");
      expect(output).toContain("LXABCDEFGH23");
      expect(output).toContain("Medellín");
    }
    expect(html).toContain('src="https://api.lifex.test/tickets/LXABCDEFGH23/qr.png"');
    expect(html).not.toContain("<!--");
    expect(html.trimStart().toLowerCase().startsWith("<!doctype html>")).toBe(true);
  });

  it("el aviso de vuelo cancelado o retrasado lista a los pasajeros", () => {
    for (const disruption of ["CANCELLED", "DELAYED"] as const) {
      const { html, text } = renderEmail(
        "flight-status-change",
        flightDisruptionParams(confirmation, disruption, OPTIONS),
      );
      expect(html).not.toContain("{{");
      expect(text).toContain("Ana Gómez (12A), Luis Pérez (12B)");
      expect(html).toContain(
        disruption === "CANCELLED" ? "Cancelación de tu vuelo" : "Retraso de tu vuelo",
      );
      // Texto corto y diplomático: pide estar pendiente del correo, donde llegarán las novedades.
      expect(text).toContain("estar pendiente de tu correo");
      expect(text).toContain("novedades");
    }
  });

  it("las dos plantillas llevan el logo vertical con eslogan desde APP_URL", () => {
    const rendered = [
      renderEmail("ticket-confirmation", ticketConfirmationParams(confirmation, ticket, OPTIONS)),
      renderEmail("flight-status-change", flightDisruptionParams(confirmation, "DELAYED", OPTIONS)),
    ];
    for (const { html, text } of rendered) {
      expect(html).toContain(LOGO_IMG);
      expect(html).toContain('width="200"');
      expect(html).toContain('alt="lifex - The best experience, always."');
      expect(html).not.toContain("<!--");
      expect(text).not.toContain("<img");
      expect(text).not.toContain("mail/lifex-concept2");
    }
  });

  it("el dominio del logo sigue a APP_URL", () => {
    const { html } = renderEmail(
      "flight-status-change",
      flightDisruptionParams(confirmation, "CANCELLED", {
        ...OPTIONS,
        appUrl: "https://lifex.example.com",
      }),
    );
    expect(html).toContain(
      '<img src="https://lifex.example.com/mail/lifex-concept2-vertical-slogan-color-1200w.png"',
    );
  });

  it("escapa el HTML de los valores y falla si falta una variable", () => {
    const params = ticketConfirmationParams(
      confirmation,
      { ...ticket, passengerFullName: '<script>alert("x")</script>' },
      OPTIONS,
    );

    const { html, text } = renderEmail("ticket-confirmation", params);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("<script>"); // texto plano: sin escapar
    const incomplete: Record<string, string> = { ...params };
    delete incomplete.TICKET_CODE;
    expect(() => renderEmail("ticket-confirmation", incomplete)).toThrow(/TICKET_CODE/);
  });
});

describe("BrevoNotificationAdapter", () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("{}", { status: 201 });
  }) as typeof fetch;
  const adapter = new BrevoNotificationAdapter({
    apiKey: "key-123",
    senderEmail: "no-reply@lifex.test",
    senderName: "Lifex",
    fetchImpl,
    ...OPTIONS,
  });

  it("envía el boleto con la API key, destinatario, HTML y texto", async () => {
    await adapter.sendTicketConfirmation(confirmation, ticket);

    const { url, init } = calls.at(-1)!;
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("key-123");
    expect(body.to).toEqual([{ email: "ana@example.com" }]);
    expect(body.subject).toBe("Tu boleto Lifex — K7M2QX");
    expect(body.htmlContent).toContain("LXABCDEFGH23");
    expect(body.textContent).toContain("LXABCDEFGH23");
  });

  it("el asunto del aviso dice si fue Cancelación o Retraso", async () => {
    await adapter.sendFlightDisruption(confirmation, "CANCELLED");
    const cancelled = JSON.parse(String(calls.at(-1)!.init.body));
    await adapter.sendFlightDisruption(confirmation, "DELAYED");
    const delayed = JSON.parse(String(calls.at(-1)!.init.body));

    expect(cancelled.subject).toBe("Cancelación de tu vuelo MDE → BOG — K7M2QX");
    expect(cancelled.htmlContent).toContain("Cancelación de tu vuelo");
    expect(delayed.subject).toBe("Retraso de tu vuelo MDE → BOG — K7M2QX");
    expect(delayed.htmlContent).toContain("Retraso de tu vuelo");
  });

  it("si Brevo responde con error, lanza para que el outbox reintente", async () => {
    const failing = new BrevoNotificationAdapter({
      apiKey: "k",
      senderEmail: "a@b.co",
      senderName: "L",
      fetchImpl: (async () =>
        new Response('{"code":"unauthorized","message":"unrecognised IP address 1.2.3.4"}', {
          status: 401,
        })) as typeof fetch,
      ...OPTIONS,
    });

    // El motivo que devuelve Brevo viaja en el error (queda en outbox_events.lastError).
    await expect(failing.sendTicketConfirmation(confirmation, ticket)).rejects.toThrow(
      'Brevo responded with 401: {"code":"unauthorized","message":"unrecognised IP address 1.2.3.4"}',
    );
  });
});
