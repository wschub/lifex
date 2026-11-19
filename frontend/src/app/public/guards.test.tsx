import { describe, expect, it } from "vitest";
import type { HolderForm, PassengerForm } from "@/stores/booking-wizard.ts";
import { redirectFor } from "./guards.tsx";

const p: PassengerForm = {
  ok: true,
  g: "m",
  first: "Luis",
  last: "Pérez",
  dd: 1,
  dm: 1,
  dy: 1990,
  nat: "1",
  docType: "CC",
  docNumber: "1",
  hasLx: false,
  lx: "",
  assist: false,
};
const h: HolderForm = {
  ok: true,
  p: 0,
  pre: "+57",
  ph: "3001234567",
  em: "a@b.co",
  em2: "a@b.co",
  c1: true,
  c2: false,
};
const empty: Parameters<typeof redirectFor>[1] = {
  flightId: null,
  fareId: null,
  passengers: [],
  holder: null,
  booking: null,
  seats: [],
  confirmedBookingId: null,
  search: { from: "BOG", to: "", date: "2026-11-21", pax: 1 },
};
const booking = { id: "b", token: "t", expiresAt: "x", contactEmail: "e", contactPhone: "p" };
const seat = {
  seatId: "s",
  identifier: "08A",
  seatClass: "ECONOMY" as const,
  priceUsd: 50,
  holdExpiresAt: "x",
};

describe("redirectFor", () => {
  it("entrar directo a /payment, /seats o /confirmation sin reserva vuelve a un paso válido", () => {
    expect(redirectFor("payment", { ...empty })).toBe("/");
    expect(redirectFor("seats", { ...empty })).toBe("/");
    expect(redirectFor("confirmation", { ...empty })).toBe("/");
  });
  it("con búsqueda pero sin vuelo vuelve a los resultados", () => {
    expect(redirectFor("fares", { ...empty, search: { ...empty.search, to: "MDE" } })).toBe(
      "/results?from=BOG&to=MDE&date=2026-11-21&pax=1",
    );
  });
  it("sin tarifa vuelve a /fares; sin pasajeros ni reserva, a /passengers", () => {
    expect(redirectFor("summary", { ...empty, flightId: "f" })).toBe("/fares");
    expect(redirectFor("seats", { ...empty, flightId: "f", fareId: "light" })).toBe("/passengers");
  });
  it("no se puede pagar sin un asiento por pasajero", () => {
    const ready = {
      ...empty,
      flightId: "f",
      fareId: "light" as const,
      passengers: [p],
      holder: h,
      booking,
    };
    expect(redirectFor("payment", ready)).toBe("/seats");
    expect(redirectFor("payment", { ...ready, seats: [seat] })).toBeNull();
  });
  it("la confirmación solo existe tras un pago", () => {
    expect(redirectFor("confirmation", { ...empty, confirmedBookingId: "b" })).toBeNull();
  });
});
