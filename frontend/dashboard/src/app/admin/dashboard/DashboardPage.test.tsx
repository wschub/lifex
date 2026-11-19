import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FlightEvent } from "@lifex/shared";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WsClient, WsHandlers } from "@/ws/client.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import {
  FLIGHT_A,
  flightMetrics,
  flightRow,
  jsonResponse,
  makeMe,
  stubMatchMedia,
} from "@/test/admin-fixtures.ts";
import { DashboardPage } from "./DashboardPage.tsx";

const fetchMock = vi.fn<typeof fetch>();
let reserved = 5;

function fakeClient() {
  const handlers = new Map<string, WsHandlers>();
  const client: WsClient = {
    subscribe(topic, h = {}) {
      handlers.set(topic, h);
      return () => handlers.delete(topic);
    },
    close: () => undefined,
  };
  return { client, handlers };
}

beforeEach(() => {
  reserved = 5;
  stubMatchMedia(false);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/dashboard/flights/"))
      return Promise.resolve(jsonResponse({ metrics: flightMetrics(reserved) }));
    if (url.includes("/dashboard/flights"))
      return Promise.resolve(jsonResponse({ flights: [flightRow(FLIGHT_A)] }));
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
});

function renderPage(client: WsClient) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DashboardPage createClient={() => client} />
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("shows live seat counts for the selected flight and updates them on a WS event", async () => {
    const { client, handlers } = fakeClient();
    renderPage(client);

    await userEvent.click(await screen.findByText("BOG → MDE"));
    const reservedCard = (await screen.findAllByText("Reservados"))[0]!.closest(
      "[data-slot=card]",
    )!;
    expect(within(reservedCard as HTMLElement).getByText("5")).toBeInTheDocument();

    reserved = 6;
    const event: FlightEvent = {
      type: "SeatSold",
      topic: `dashboard:${FLIGHT_A}`,
      flightId: FLIGHT_A,
      version: 6,
      data: { seatId: FLIGHT_A, seatIdentifier: "01A", status: "RESERVED" },
      at: "2026-11-24T12:00:00.000Z",
    };
    await act(async () => handlers.get(`dashboard:${FLIGHT_A}`)?.onEvent?.(event));
    expect(await within(reservedCard as HTMLElement).findByText("6")).toBeInTheDocument();
  });

  it("does not render the change-status control for a viewer", async () => {
    renderPage(fakeClient().client);
    await screen.findByText("BOG → MDE");
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });
});
