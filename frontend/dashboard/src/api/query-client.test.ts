import { describe, expect, it } from "vitest";
import { ApiError } from "./errors.ts";
import { shouldRetry } from "./query-client.ts";

describe("shouldRetry", () => {
  it("no reintenta errores 4xx", () => {
    expect(shouldRetry(0, new ApiError(409, "SEAT_UNAVAILABLE"))).toBe(false);
    expect(shouldRetry(0, new ApiError(429, "TOO_MANY_REQUESTS"))).toBe(false);
  });
  it("reintenta fallos de red y 5xx hasta 2 veces", () => {
    expect(shouldRetry(0, new ApiError(0, "NETWORK"))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, "HTTP_ERROR"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, "HTTP_ERROR"))).toBe(false);
  });
});
