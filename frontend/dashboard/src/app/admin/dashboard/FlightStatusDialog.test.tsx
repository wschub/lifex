import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLIGHT_A, flightRow, jsonResponse, problemBody } from "@/test/admin-fixtures.ts";
import { FlightStatusDialog } from "./FlightStatusDialog.tsx";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function renderDialog(onClose = vi.fn(), onChanged = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FlightStatusDialog
        flight={flightRow(FLIGHT_A) as never}
        token="jwt"
        onClose={onClose}
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return { onClose, onChanged };
}

describe("FlightStatusDialog", () => {
  it("warns that passengers will be emailed before cancelling", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("radio", { name: "Cancelado" }));
    expect(screen.getByText(/se enviará un correo a los pasajeros/i)).toBeInTheDocument();
  });

  it("sends the new status and closes on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ flight: { id: FLIGHT_A, status: "DELAYED", previous: "ACTIVE" } }),
    );
    const { onChanged, onClose } = renderDialog();
    await userEvent.click(screen.getByRole("radio", { name: "Retrasado" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(new RegExp(`/flights/${FLIGHT_A}/status$`));
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "DELAYED" });
  });

  it("shows the INVALID_FLIGHT_STATUS error from the backend and stays open", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        problemBody(409, "INVALID_FLIGHT_STATUS", "El cambio de estado no está permitido."),
        409,
      ),
    );
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("radio", { name: "Cancelado" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    expect(await screen.findByText("El cambio de estado no está permitido.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
