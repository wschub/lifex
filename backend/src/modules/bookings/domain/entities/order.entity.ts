import { randomInt, randomUUID } from "node:crypto";
import { AppError } from "../../../../shared/errors/app-error.ts";

export const ORDER_STATUSES = [
  "DRAFT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderProps {
  id: string;
  orderNumber: string;
  reservationNumber: string;
  flightId: string;
  contactEmail: string;
  contactPhone: string | null;
  /** Idioma del comprador: define la moneda que se muestra en el correo. */
  locale: "es" | "en";
  status: OrderStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface StartOrderInput {
  flightId: string;
  contactEmail: string;
  contactPhone?: string | undefined;
  locale?: "es" | "en" | undefined;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
/** Sin 0/O ni 1/I: el código de reserva (PNR) se dicta por teléfono. */
const PNR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function reservationCode(): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) code += PNR_ALPHABET[randomInt(PNR_ALPHABET.length)];
  return code;
}

function orderNumber(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `ORD-${date}-${String(randomInt(1_000_000)).padStart(6, "0")}`;
}

export class Order {
  readonly id: string;
  readonly orderNumber: string;
  readonly reservationNumber: string;
  readonly flightId: string;
  readonly contactEmail: string;
  readonly contactPhone: string | null;
  readonly locale: "es" | "en";
  readonly status: OrderStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.orderNumber = props.orderNumber;
    this.reservationNumber = props.reservationNumber;
    this.flightId = props.flightId;
    this.contactEmail = props.contactEmail;
    this.contactPhone = props.contactPhone;
    this.locale = props.locale;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
    Object.freeze(this);
  }

  /** Orden nueva en DRAFT. El correo y el teléfono de contacto pueden diferir de los de cualquier pasajero. */
  static start(input: StartOrderInput, ttlSeconds: number, now: Date = new Date()): Order {
    const contactEmail = input.contactEmail.trim().toLowerCase();
    const contactPhone = input.contactPhone?.trim() || null;
    if (!EMAIL.test(contactEmail) || (contactPhone !== null && !PHONE.test(contactPhone))) {
      throw new AppError("validation", { code: "INVALID_BOOKING_CONTACT" });
    }
    return new Order({
      id: randomUUID(),
      orderNumber: orderNumber(now),
      reservationNumber: reservationCode(),
      flightId: input.flightId,
      contactEmail,
      contactPhone,
      locale: input.locale ?? "es",
      status: "DRAFT",
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      createdAt: now,
    });
  }

  static restore(props: OrderProps): Order {
    return new Order(props);
  }

  /** Solo una orden DRAFT y vigente admite cambios de pasajeros. */
  assertEditable(now: Date): void {
    if (this.status !== "DRAFT") {
      throw new AppError("conflict", { code: "BOOKING_NOT_EDITABLE" });
    }
    if (this.expiresAt < now) throw new AppError("conflict", { code: "BOOKING_EXPIRED" });
  }
}
