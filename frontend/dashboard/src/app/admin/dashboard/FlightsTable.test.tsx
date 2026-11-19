import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FLIGHT_A, FLIGHT_B, flightRow } from "@/test/admin-fixtures.ts";
import { FlightsTable } from "./FlightsTable.tsx";

const flights = [
  flightRow(FLIGHT_A),
  flightRow(FLIGHT_B, {
    from: "MDE",
    to: "CTG",
    fromCity: "Medellín",
    toCity: "Cartagena",
    status: "DELAYED",
    occupancyRate: 50,
  }),
];

describe("FlightsTable", () => {
  it("renders one row per flight with route, status and occupancy", () => {
    render(
      <FlightsTable
        flights={flights}
        selectedId={null}
        canManage={false}
        onSelect={() => undefined}
        onChangeStatus={() => undefined}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("Bogotá (BOG) → Medellín (MDE)")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Activo")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("16,7 %")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Retrasado")).toBeInTheDocument();
  });

  it("hides the change-status button without flights:manage", () => {
    render(
      <FlightsTable
        flights={flights}
        selectedId={null}
        canManage={false}
        onSelect={() => undefined}
        onChangeStatus={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });

  it("offers the button with flights:manage and reports the chosen flight", async () => {
    const onChangeStatus = vi.fn();
    render(
      <FlightsTable
        flights={flights}
        selectedId={null}
        canManage
        onSelect={() => undefined}
        onChangeStatus={onChangeStatus}
      />,
    );
    await userEvent.click(screen.getAllByRole("button", { name: /cambiar estado/i })[1]!);
    expect(onChangeStatus).toHaveBeenCalledWith(flights[1]);
  });

  it("selects a flight when its row is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <FlightsTable
        flights={flights}
        selectedId={null}
        canManage={false}
        onSelect={onSelect}
        onChangeStatus={() => undefined}
      />,
    );
    await userEvent.click(screen.getByText("Bogotá (BOG) → Medellín (MDE)"));
    expect(onSelect).toHaveBeenCalledWith(FLIGHT_A);
  });
});
