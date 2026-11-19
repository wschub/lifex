import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard, type HolderForm, type PassengerForm } from "./booking-wizard.ts";

const passenger: PassengerForm = {
  ok: true,
  g: "f",
  first: "Ana",
  last: "Gómez",
  dd: 3,
  dm: 4,
  dy: 1990,
  nat: "1",
  docType: "CC",
  docNumber: "123456",
  hasLx: false,
  lx: "",
  assist: false,
};
const holder: HolderForm = {
  ok: true,
  p: 0,
  pre: "+57",
  ph: "3001234567",
  em: "a@b.co",
  em2: "a@b.co",
  c1: true,
  c2: false,
};

beforeEach(() => {
  useWizard.getState().reset();
  useLangStore.setState({ lang: "es" });
});

describe("booking wizard", () => {
  it("cambiar de idioma no borra los datos del titular ni de los pasajeros", () => {
    useWizard.getState().setPassengers([passenger]);
    useWizard.getState().setHolder(holder);
    useLangStore.getState().setLang("en");
    expect(useWizard.getState().passengers[0]?.first).toBe("Ana");
    expect(useWizard.getState().holder?.em).toBe("a@b.co");
  });

  it("elegir otro vuelo descarta tarifa, asientos y reserva", () => {
    const s = useWizard.getState();
    s.chooseFlight("f1");
    s.chooseFare({ fareId: "classic", luggageTypeId: 2, cabin: "economy" });
    s.attachBooking({ id: "b", token: "t", expiresAt: "x", contactEmail: "e", contactPhone: "p" });
    s.chooseFlight("f2");
    const after = useWizard.getState();
    expect(after.fareId).toBeNull();
    expect(after.booking).toBeNull();
  });

  it("elegir la misma tarifa no borra los asientos", () => {
    const s = useWizard.getState();
    s.chooseFlight("f1");
    s.chooseFare({ fareId: "classic", luggageTypeId: 2, cabin: "economy" });
    s.setSeats([
      { seatId: "s", identifier: "08A", seatClass: "ECONOMY", priceUsd: 50, holdExpiresAt: "x" },
    ]);
    s.chooseFare({ fareId: "classic", luggageTypeId: 2, cabin: "economy" });
    expect(useWizard.getState().seats).toHaveLength(1);
  });

  it("dropBooking conserva los datos escritos y descarta reserva, asientos y clave de pago", () => {
    const s = useWizard.getState();
    s.setPassengers([passenger]);
    s.attachBooking({ id: "b", token: "t", expiresAt: "x", contactEmail: "e", contactPhone: "p" });
    s.setPaymentKey("k");
    s.dropBooking();
    const after = useWizard.getState();
    expect(after.booking).toBeNull();
    expect(after.paymentKey).toBeNull();
    expect(after.passengers).toHaveLength(1);
  });

  it("no guarda nada parecido a una tarjeta en sessionStorage", () => {
    useWizard.getState().setPassengers([passenger]);
    const stored = sessionStorage.getItem("lx-wizard") ?? "";
    expect(stored).not.toMatch(/cvv|cardNumber|4242/i);
  });
});

describe("plazo de compra (purchaseStartedAt)", () => {
  const session = (id: string) => ({
    id,
    token: "t",
    expiresAt: "2026-12-01T16:00:00.000Z",
    contactEmail: "a@b.co",
    contactPhone: "",
  });

  it("abrir la reserva marca el inicio del plazo y volver a guardar la misma no lo reinicia", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T15:00:00Z"));
    useWizard.getState().reset();

    useWizard.getState().attachBooking(session("b1"));
    const started = useWizard.getState().purchaseStartedAt;
    expect(started).toBe(Date.parse("2026-12-01T15:00:00Z"));

    vi.setSystemTime(new Date("2026-12-01T15:05:00Z"));
    useWizard.getState().attachBooking(session("b1"));
    expect(useWizard.getState().purchaseStartedAt).toBe(started);

    useWizard.getState().attachBooking(session("b2")); // otra reserva: el plazo vuelve a empezar
    expect(useWizard.getState().purchaseStartedAt).toBe(Date.parse("2026-12-01T15:05:00Z"));
    vi.useRealTimers();
  });

  it("descartar la reserva o reiniciar el asistente borra el inicio del plazo", () => {
    useWizard.getState().attachBooking(session("b1"));
    useWizard.getState().dropBooking();
    expect(useWizard.getState().purchaseStartedAt).toBeNull();

    useWizard.getState().attachBooking(session("b1"));
    useWizard.getState().reset();
    expect(useWizard.getState().purchaseStartedAt).toBeNull();
  });
});
