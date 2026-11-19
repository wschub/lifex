import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AirportEntry } from "@/lib/airport-search.ts";
import { AirportCombobox } from "./AirportCombobox.tsx";

const entry = (iata: string, name: string, nameEs: string, country: string): AirportEntry => ({
  iata,
  name,
  nameEs,
  countryIsoCode: country,
});
const OPTIONS = [
  entry("MDE", "Medellín", "Medellín", "CO"),
  entry("BOG", "Bogotá", "Bogotá", "CO"),
  entry("MAD", "Madrid", "Madrid", "ES"),
  entry("LHR", "London", "Londres", "GB"),
];

function Harness({
  initial = "",
  onChange = () => {},
}: {
  initial?: string;
  onChange?: (iata: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <label>
      Destino
      <AirportCombobox
        id="d"
        value={value}
        options={OPTIONS}
        placeholder="Todos los destinos"
        onChange={(iata) => {
          setValue(iata);
          onChange(iata);
        }}
      />
    </label>
  );
}

const optionNames = () => screen.queryAllByRole("option").map((o) => o.textContent);

describe("AirportCombobox del panel", () => {
  it("al enfocarlo lista todos los aeropuertos, nacionales e internacionales", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox", { name: /destino/i }));
    expect(optionNames()).toEqual([
      "Bogotá (BOG)",
      "Medellín (MDE)",
      "Londres (LHR)",
      "Madrid (MAD)",
    ]);
    expect(
      within(screen.getByRole("group", { name: "Nacionales" })).getAllByRole("option"),
    ).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Internacionales" })).toBeInTheDocument();
  });

  it("filtra al escribir por código o ciudad y Enter elige la primera coincidencia", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "londres");
    expect(optionNames()).toEqual(["Londres (LHR)"]);

    await userEvent.clear(input);
    await userEvent.type(input, "mad{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("MAD");
    expect(input).toHaveValue("Madrid (MAD)");
  });

  it("el clic elige una opción y cierra la lista", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Londres (LHR)" }));
    expect(onChange).toHaveBeenCalledWith("LHR");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("avisa si no hay coincidencias y al salir restaura la opción anterior", async () => {
    render(<Harness initial="BOG" />);
    const input = screen.getByRole("combobox");
    await userEvent.clear(input);
    await userEvent.type(input, "zzz");
    expect(screen.getByText("No encontramos ese aeropuerto.")).toBeInTheDocument();
    await userEvent.tab();
    expect(input).toHaveValue("Bogotá (BOG)");
  });

  it("es un filtro opcional: borrar el texto o pulsar la «x» lo quita", async () => {
    const onChange = vi.fn();
    render(<Harness initial="BOG" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar filtro" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
