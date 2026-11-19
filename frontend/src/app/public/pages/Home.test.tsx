import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderPage } from "@/test/render.tsx";
import { Home } from "./Home.tsx";

const city = (
  id: number,
  name: string,
  nameEs: string,
  iata: string,
  country: string,
  imageName: string | null,
) => ({
  id,
  name,
  nameEs,
  countryIsoCode: country,
  imageName,
  airports: [{ id, iataCode: iata }],
});

const CITIES = {
  cities: [
    city(1, "Bogotá", "Bogotá", "BOG", "CO", "bogota.jpg"),
    city(2, "Medellín", "Medellín", "MDE", "CO", "medellin.jpg"),
    city(3, "Pereira", "Pereira", "PEI", "CO", null),
    city(4, "London", "Londres", "LHR", "GB", "london.jpg"),
  ],
};

beforeEach(() => {
  useLangStore.setState({ lang: "es" });
  useWizard.getState().reset();
  mockApi({
    "GET /catalog/cities": CITIES,
    "GET /catalog/luggage-types": { luggageTypes: [] },
    "GET /flights": { flights: [] },
  });
});

describe("Home", () => {
  it("el encabezado lleva el login al panel admin y cambia con el idioma", async () => {
    renderPage(<Home />);
    const login = await screen.findByRole("link", { name: /iniciar sesión/i });
    expect(login).toHaveAttribute("href", "/admin/login");
    await userEvent.click(screen.getByRole("button", { name: /idioma y moneda/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /english/i }));
    expect(await screen.findByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/admin/login",
    );
    expect(screen.getByText("EN · USD")).toBeInTheDocument();
  });

  it("muestra ES · COP en español", async () => {
    renderPage(<Home />);
    expect(await screen.findByText("ES · COP")).toBeInTheDocument();
  });

  it("los destinos usan la imagen de su ciudad y caen al cielo si no tiene", async () => {
    renderPage(<Home />);
    const chips = await screen.findByText(/mira desde tu ventanilla/i);
    const strip = chips.parentElement as HTMLElement;
    await waitFor(() => expect(within(strip).getAllByRole("button").length).toBe(2));
    const medellin = within(strip).getByRole("button", { name: "Medellín" });
    expect((medellin.querySelector("i") as HTMLElement).style.backgroundImage).toContain(
      "medellin.jpg",
    );
    // Pereira no tiene imagen: no es destino destacado
    expect(within(strip).queryByRole("button", { name: "Pereira" })).toBeNull();
  });

  it("exige un destino antes de buscar", async () => {
    renderPage(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: /buscar vuelos/i }));
    expect(screen.getByText(/elige un destino/i).closest(".field")).toHaveClass("invalid");
  });
});
