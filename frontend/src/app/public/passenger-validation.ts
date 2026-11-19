import type { HolderForm, PassengerForm } from "@/stores/booking-wizard.ts";

const NAME = /^[\p{L}][\p{L}\s'.-]*$/u;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const DOC = /^[A-Za-z0-9-]{4,20}$/;

export interface PassengerInput {
  first: string;
  last: string;
  dd: number;
  dm: number;
  dy: number;
  nat: string;
  docType: PassengerForm["docType"];
  docNumber: string;
}

export type PassengerErrors = Partial<
  Record<"first" | "last" | "dob" | "nat" | "doc", "req" | "dob" | "name" | "docFormat">
>;

/** Edad mínima del prototipo: 12 años cumplidos en el año en curso. */
export function validatePassenger(input: PassengerInput, now = new Date()): PassengerErrors {
  const errors: PassengerErrors = {};
  const first = input.first.trim();
  const last = input.last.trim();
  if (first.length < 2) errors.first = "req";
  else if (!NAME.test(first)) errors.first = "name";
  if (last.length < 2) errors.last = "req";
  else if (!NAME.test(last)) errors.last = "name";
  if (!input.nat) errors.nat = "req";
  if (!DOC.test(input.docNumber.trim()))
    errors.doc = input.docNumber.trim() === "" ? "req" : "docFormat";
  const { dd, dm, dy } = input;
  let dobOk = false;
  if (dd && dm && dy) {
    const date = new Date(dy, dm - 1, dd);
    dobOk = date.getMonth() === dm - 1 && date.getDate() === dd && now.getFullYear() - dy >= 12;
  }
  if (!dobOk) errors.dob = "dob";
  return errors;
}

export interface HolderInput {
  ph: string;
  em: string;
  em2: string;
  c1: boolean;
}
export type HolderErrors = Partial<
  Record<"ph" | "em" | "em2" | "c1", "req" | "phone" | "mail" | "mail2" | "accept">
>;

export function validateHolder(input: HolderInput): HolderErrors {
  const errors: HolderErrors = {};
  const ph = input.ph.replace(/[\s-]/g, "");
  const em = input.em.trim();
  const em2 = input.em2.trim();
  if (!/^\d{7,12}$/.test(ph)) errors.ph = "phone";
  if (!EMAIL.test(em)) errors.em = "mail";
  if (!errors.em && em2.toLowerCase() !== em.toLowerCase()) errors.em2 = "mail2";
  else if (errors.em && !em2) errors.em2 = "req";
  if (!input.c1) errors.c1 = "accept";
  return errors;
}

/** Orden en el que se envían al backend: el titular de la reserva va primero (el comprador es el pasajero 0). */
export function orderedPassengers(
  passengers: readonly PassengerForm[],
  holder: HolderForm,
): { form: PassengerForm; index: number }[] {
  const all = passengers.map((form, index) => ({ form, index }));
  const holderEntry = all.find((e) => e.index === holder.p);
  return holderEntry ? [holderEntry, ...all.filter((e) => e !== holderEntry)] : all;
}
