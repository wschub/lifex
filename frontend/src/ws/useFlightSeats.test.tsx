import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/api/query-client.ts";
import { FLIGHT_ID, makeSeatMap, seatEvent } from "@/test/fixtures.ts";
import type { WsClient, WsHandlers } from "./client.ts";
import { useFlightSeats } from "./useFlightSeats.ts";

let handlers: WsHandlers | undefined;
let unsubscribed = false;
const fakeClient: WsClient = {
  subscribe(_topic, h) {
    handlers = h;
    return () => {
      unsubscribed = true;
    };
  },
  close() {},
};

let snapshot = makeSeatMap();
const fetchMock = vi.fn();

beforeEach(() => {
  handlers = undefined;
  unsubscribed = false;
  snapshot = makeSeatMap();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(snapshot));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFlightSeats(FLIGHT_ID, fakeClient), { wrapper });
}

describe("useFlightSeats", () => {
  it("carga el snapshot y aplica los eventos del WebSocket encima", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.version).toBe(10));
    act(() => handlers!.onEvent!(seatEvent("SeatHeld", 0, 11)));
    await waitFor(() => expect(result.current.data?.seats[0]!.status).toBe("BLOCKED"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un hueco de versión fuerza un nuevo snapshot", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.version).toBe(10));
    snapshot = makeSeatMap({ version: 13 });
    act(() => handlers!.onEvent!(seatEvent("SeatHeld", 0, 12)));
    await waitFor(() => expect(result.current.data?.version).toBe(13));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("al reconectar (onResync) vuelve a pedir el snapshot", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.version).toBe(10));
    snapshot = makeSeatMap({ version: 20 });
    act(() => handlers!.onResync!());
    await waitFor(() => expect(result.current.data?.version).toBe(20));
  });

  it("un evento que llega antes del snapshot no rompe", async () => {
    const { result } = setup();
    act(() => handlers!.onEvent!(seatEvent("SeatHeld", 0, 11)));
    await waitFor(() => expect(result.current.data?.version).toBe(10));
  });

  it("cancela la suscripción al desmontar", async () => {
    const { unmount } = setup();
    unmount();
    expect(unsubscribed).toBe(true);
  });
});
