import { describe, expect, it } from "vitest";
import { keys } from "./keys.ts";

describe("keys", () => {
  it("son estables y distintas por parámetros", () => {
    const search = { from: "BOG", to: "MDE", date: "2026-12-01" };
    expect(keys.flights(search)).toEqual(keys.flights({ ...search }));
    expect(keys.flights(search)).not.toEqual(keys.flights({ ...search, date: "2026-12-02" }));
    expect(keys.seatMap("f1")).not.toEqual(keys.seatMap("f2"));
    expect(keys.booking("b1")[0]).toBe("booking");
    expect(keys.config).toEqual(["config"]);
  });
});
