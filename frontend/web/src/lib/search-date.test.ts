import { describe, expect, it } from "vitest";
import { addDays, defaultSearchDate, todayBogota } from "./search-date.ts";

describe("search-date", () => {
  it("todayBogota usa la hora de Colombia (UTC-5)", () => {
    // 2026-11-20 02:00 UTC todavía es 2026-11-19 21:00 en Bogotá
    expect(todayBogota(new Date("2026-11-20T02:00:00Z"))).toBe("2026-11-19");
  });
  it("addDays cruza fin de mes y de año", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-12-01", -3)).toBe("2026-11-28");
  });
  it("defaultSearchDate es mañana en Bogotá", () => {
    expect(defaultSearchDate(new Date("2026-11-20T02:00:00Z"))).toBe("2026-11-20");
  });
});
