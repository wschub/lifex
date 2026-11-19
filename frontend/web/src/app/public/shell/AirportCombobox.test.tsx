import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import type { AirportEntry } from "../hooks/useCities.ts";
import { AirportCombobox } from "./AirportCombobox.tsx";

const entry = (iata: string, name: string, nameEs: string, country: string): AirportEntry => ({
  iata,
  name,
  nameEs,
  countryIsoCode: country,
  imageName: null,
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
  allowEmpty = true,
}: {
  initial?: string;
  onChange?: (iata: string) => void;
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="field">
      <label htmlFor="to">Destino</label>
      <AirportCombobox
        id="to"
        name="to"
        value={value}
        options={OPTIONS}
        placeholder="¿A dónde viajas?"
        allowEmpty={allowEmpty}
        onChange={(iata) => {
          setValue(iata);
          onChange(iata);
        }}
      />
    </div>
  );
}

const optionNames = () => screen.queryAllByRole("option").map((o) => o.textContent);

describe("AirportCombobox", () => {
  it("el campo es un combobox con su etiqueta y, al enfocarlo, lista todos los destinos nacionales e internacionales", async () => {
    useLangStore.getState().setLang("es");
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Destino" });
    expect(input).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(optionNames()).toEqual([
      "Bogotá (BOG)",
      "Medellín (MDE)",
      "Londres (LHR)",
      "Madrid (MAD)",
    ]);
    const national = screen.getByRole("group", { name: "Nacionales" });
    expect(within(national).getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Internacionales" })).toBeInTheDocument();
  });

  it("filtra mientras se escribe, por código o por ciudad (también en inglés y sin tildes)", async () => {
    useLangStore.getState().setLang("es");
    render(<Harness />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "mad");
    expect(optionNames()).toEqual(["Madrid (MAD)"]);

    await userEvent.clear(input);
    await userEvent.type(input, "london");
    expect(optionNames()).toEqual(["Londres (LHR)"]);

    await userEvent.clear(input);
    await userEvent.type(input, "bogota");
    expect(optionNames()).toEqual(["Bogotá (BOG)"]);
  });

  it("elegir con el clic llena el campo con 'Ciudad (CÓDIGO)', cierra la lista y avisa del código", async () => {
    useLangStore.getState().setLang("es");
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "lon");
    await userEvent.click(screen.getByRole("option", { name: "Londres (LHR)" }));

    expect(onChange).toHaveBeenCalledWith("LHR");
    expect(input).toHaveValue("Londres (LHR)");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("con el teclado: las flechas mueven la opción activa y Enter la elige; Escape cierra y restaura", async () => {
    useLangStore.getState().setLang("es");
    const onChange = vi.fn();
    render(<Harness initial="MDE" onChange={onChange} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Medellín (MDE)");

    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // Orden sin filtro: Bogotá, Medellín, Londres, Madrid; con Medellín activa de inicio, 2 abajo = Madrid.
    expect(onChange).toHaveBeenLastCalledWith("MAD");
    expect(input).toHaveValue("Madrid (MAD)");

    await userEvent.type(input, "{Backspace}x");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Madrid (MAD)");
  });

  it("Enter elige la primera coincidencia sin tocar las flechas", async () => {
    useLangStore.getState().setLang("es");
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox"), "bog{Enter}");
    expect(onChange).toHaveBeenCalledWith("BOG");
  });

  it("si no hay coincidencias lo avisa, y al salir sin elegir se restaura la opción anterior", async () => {
    useLangStore.getState().setLang("es");
    render(<Harness initial="BOG" />);
    const input = screen.getByRole("combobox");

    await userEvent.clear(input);
    await userEvent.type(input, "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No encontramos ese destino.")).toBeInTheDocument();

    await userEvent.tab();
    expect(input).toHaveValue("Bogotá (BOG)");
  });

  it("si el campo admite vacío, borrar el texto y salir deja el destino sin elegir", async () => {
    useLangStore.getState().setLang("es");
    const onChange = vi.fn();
    render(<Harness initial="BOG" onChange={onChange} />);
    const input = screen.getByRole("combobox");

    await userEvent.clear(input);
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
  });

  it("los textos cambian con el idioma", async () => {
    useLangStore.getState().setLang("en");
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("group", { name: "Domestic" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "International" })).toBeInTheDocument();
    expect(optionNames()).toContain("London (LHR)");
    useLangStore.getState().setLang("es");
  });
});
