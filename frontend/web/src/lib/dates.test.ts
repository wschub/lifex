import { describe, expect, it } from "vitest";
import { formatDate, formatTime } from "./dates.ts";

describe("formatDate", () => {
  it("formatea en español con el día y el mes abreviado", () => {
    const text = formatDate("2026-11-24T12:30:00Z", "es");
    expect(text).toContain("24");
    expect(text).toContain("nov");
  });

  it("usa la hora de Colombia: 03:30 UTC del 25 sigue siendo el 24", () => {
    expect(formatDate("2026-11-25T03:30:00Z", "es")).toContain("24");
    expect(formatDate("2026-11-25T03:30:00Z", "en")).toContain("24");
  });

  it("acepta opciones propias de Intl", () => {
    expect(formatDate("2026-11-24T12:30:00Z", "en", { weekday: "long" })).toBe("Tuesday");
  });
});

describe("formatTime", () => {
  it("muestra la hora local de Colombia en 24 horas", () => {
    expect(formatTime("2026-11-24T12:30:00Z")).toBe("07:30");
    expect(formatTime("2026-11-25T03:05:00Z")).toBe("22:05");
  });
});
