import {
  renderEmail,
  type TemplateName,
} from "../../../../shared/notifications/render-template.ts";
import type {
  FlightDisruption,
  NotificationPort,
} from "../../application/ports/notification.port.ts";
import type {
  BookingConfirmation,
  TicketView,
} from "../../domain/repositories/ticket.repository.ts";
import {
  disruptionSubject,
  type EmailParamsOptions,
  flightDisruptionParams,
  ticketConfirmationParams,
} from "./email-params.ts";

export interface BrevoOptions extends EmailParamsOptions {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Adaptador del puerto NotificationPort sobre la API transaccional de Brevo. */
export class BrevoNotificationAdapter implements NotificationPort {
  private readonly options: BrevoOptions;

  constructor(options: BrevoOptions) {
    this.options = options;
  }

  sendTicketConfirmation(confirmation: BookingConfirmation, ticket: TicketView): Promise<void> {
    return this.send(
      confirmation.contactEmail,
      `Tu boleto Lifex — ${confirmation.reservationNumber}`,
      "ticket-confirmation",
      ticketConfirmationParams(confirmation, ticket, this.options),
    );
  }

  sendFlightDisruption(
    confirmation: BookingConfirmation,
    disruption: FlightDisruption,
  ): Promise<void> {
    return this.send(
      confirmation.contactEmail,
      disruptionSubject(confirmation, disruption),
      "flight-status-change",
      flightDisruptionParams(confirmation, disruption, this.options),
    );
  }

  private async send(
    to: string,
    subject: string,
    template: TemplateName,
    params: Record<string, string>,
  ): Promise<void> {
    const { html, text } = renderEmail(template, params);
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.endpoint ?? BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": this.options.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: this.options.senderEmail, name: this.options.senderName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
    });
    if (!response.ok) throw new Error(`Brevo responded with ${response.status}`);
  }
}
