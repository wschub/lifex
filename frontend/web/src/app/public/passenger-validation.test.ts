import { describe, expect, it } from "vitest";
import type { HolderForm, PassengerForm } from "@/stores/booking-wizard.ts";
import { orderedPassengers, validateHolder, validatePassenger } from "./passenger-validation.ts";

const ok = {
  first: "Ana",
  last: "Gómez",
  dd: 3,
  dm: 4,
  dy: 1990,
  nat: "1",
  docType: "CC" as const,
  docNumber: "123456",
};
const NOW = new Date("2026-11-20T12:00:00Z");

describe("validatePassenger", () => {
  it("acepta datos correctos", () => expect(validatePassenger(ok, NOW)).toEqual({}));
  it("exige nombre, apellido, nacionalidad y documento", () => {
    const e = validatePassenger({ ...ok, first: "", last: "A", nat: "", docNumber: "" }, NOW);
    expect(e).toMatchObject({ first: "req", last: "req", nat: "req", doc: "req" });
  });
  it("rechaza dígitos en el nombre y fechas imposibles o menores de 12 años", () => {
    expect(validatePassenger({ ...ok, first: "Ana2" }, NOW).first).toBe("name");
    expect(validatePassenger({ ...ok, dd: 31, dm: 2 }, NOW).dob).toBe("dob");
    expect(validatePassenger({ ...ok, dy: 2020 }, NOW).dob).toBe("dob");
  });
  it("documento de 4 a 20 caracteres alfanuméricos", () => {
    expect(validatePassenger({ ...ok, docNumber: "12" }, NOW).doc).toBe("docFormat");
    expect(validatePassenger({ ...ok, docNumber: "AB-1234" }, NOW).doc).toBeUndefined();
  });
});

describe("validateHolder", () => {
  const holder = { ph: "300 123 4567", em: "a@b.co", em2: "A@b.co", c1: true };
  it("acepta teléfono con espacios y correos iguales sin importar mayúsculas", () =>
    expect(validateHolder(holder)).toEqual({}));
  it("detecta teléfono, correo, confirmación y consentimiento", () => {
    expect(validateHolder({ ...holder, ph: "12" }).ph).toBe("phone");
    expect(validateHolder({ ...holder, em: "no" }).em).toBe("mail");
    expect(validateHolder({ ...holder, em2: "x@y.co" }).em2).toBe("mail2");
    expect(validateHolder({ ...holder, c1: false }).c1).toBe("accept");
  });
});

describe("orderedPassengers", () => {
  const p = (first: string): PassengerForm => ({
    ok: true,
    g: "m",
    first,
    last: "X",
    dd: 1,
    dm: 1,
    dy: 1990,
    nat: "1",
    docType: "CC",
    docNumber: "1234",
    hasLx: false,
    lx: "",
    assist: false,
  });
  const holder = (index: number): HolderForm => ({
    ok: true,
    p: index,
    pre: "+57",
    ph: "3001234567",
    em: "a@b.co",
    em2: "a@b.co",
    c1: true,
    c2: false,
  });
  it("el titular de la reserva va primero y conserva su índice original", () => {
    const out = orderedPassengers([p("A"), p("B"), p("C")], holder(2));
    expect(out.map((e) => e.form.first)).toEqual(["C", "A", "B"]);
    expect(out.map((e) => e.index)).toEqual([2, 0, 1]);
  });
});
