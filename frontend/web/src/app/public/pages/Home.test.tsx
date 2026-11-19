import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderPage, renderRoutes } from "@/test/render.tsx";
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
    "GET /flights/offers": { offers: [] },
  });
});

const OFFER_ID = "33333333-3333-4333-8333-333333333333";
const apt = (iataCode: string, city: string, cityEs: string, cityImageName: string | null) => ({
  iataCode,
  city,
  cityEs,
  country: "Colombia",
  countryEs: "Colombia",
  cityImageName,
});
const offerFlight = {
  id: OFFER_ID,
  routeType: "DOMESTIC",
  from: apt("BOG", "Bogotá", "Bogotá", "bogota.jpg"),
  to: apt("MDE", "Medellín", "Medellín", "medellin.jpg"),
  departureDate: "2026-12-05T13:00:00.000Z",
  arrivalDate: "2026-12-05T14:00:00.000Z",
  status: "ACTIVE",
  basePriceUsd: 100,
  averagePriceEconomyUsd: 0,
  averagePriceBusinessUsd: 0,
  priceEconomyUsd: 85,
  priceBusinessUsd: 255,
  numAvailableSeats: 120,
  availableByClass: { economy: 100, business: 20 },
  soldOut: false,
  offer: { discountPercentage: 15 },
};

function mockOffers(offers: unknown[]) {
  mockApi({
    "GET /catalog/cities": CITIES,
    "GET /catalog/luggage-types": {
      luggageTypes: [
        { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 0, businessOnly: false },
      ],
    },
    "GET /flights": { flights: [] },
    "GET /flights/offers": { offers },
  });
}

describe("Home: autocompletar de origen y destino", () => {
  // Solo las opciones de la lista abierta (el selector de pasajeros también tiene <option>).
  const optionNames = () =>
    within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((o) => o.textContent);

  it("origen y destino ofrecen todos los aeropuertos, nacionales e internacionales", async () => {
    renderPage(<Home />);
    const from = await screen.findByRole("combobox", { name: /origen/i });
    await waitFor(() => expect(from).toHaveValue("Bogotá (BOG)")); // ya cargó el catálogo
    await userEvent.click(from);
    expect(optionNames()).toEqual([
      "Bogotá (BOG)",
      "Medellín (MDE)",
      "Pereira (PEI)",
      "Londres (LHR)",
    ]);
    await userEvent.keyboard("{Escape}");

    // El destino ofrece los mismos menos el origen elegido.
    await userEvent.click(screen.getByRole("combobox", { name: /destino/i }));
    expect(optionNames()).toEqual(["Medellín (MDE)", "Pereira (PEI)", "Londres (LHR)"]);
  });

  it("buscar con origen y destino elegidos por autocompletar navega a los resultados con sus códigos", async () => {
    const { router } = renderPage(<Home />);
    const origin = await screen.findByRole("combobox", { name: /origen/i });
    await waitFor(() => expect(origin).toHaveValue("Bogotá (BOG)"));
    await userEvent.click(screen.getByRole("combobox", { name: /destino/i }));
    await userEvent.type(screen.getByRole("combobox", { name: /destino/i }), "lond{Enter}");

    await userEvent.click(screen.getByRole("button", { name: /buscar vuelos/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/results"));
    expect(router.state.location.search).toMatch(/from=BOG&to=LHR&/);
  });

  it("si se elige como origen el destino ya elegido, el destino se limpia", async () => {
    renderPage(<Home />);
    const from = await screen.findByRole("combobox", { name: /origen/i });
    await waitFor(() => expect(from).toHaveValue("Bogotá (BOG)"));
    const to = screen.getByRole("combobox", { name: /destino/i });
    await userEvent.click(to);
    await userEvent.type(to, "pereira{Enter}");
    expect(to).toHaveValue("Pereira (PEI)");

    await userEvent.click(from);
    await userEvent.clear(from); // en el navegador, al enfocar se selecciona el texto y escribir lo reemplaza
    await userEvent.type(from, "pei{Enter}");

    expect(from).toHaveValue("Pereira (PEI)");
    expect(to).toHaveValue("");
  });

  it("sin destino elegido, buscar marca el campo y no navega", async () => {
    const { router } = renderPage(<Home />);
    await screen.findByRole("combobox", { name: /origen/i });
    await userEvent.click(screen.getByRole("button", { name: /buscar vuelos/i }));
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByText("Elige un destino.")).toBeInTheDocument();
  });
});

describe("Home", () => {
  it("el encabezado lleva el login al panel admin y cambia con el idioma", async () => {
    renderPage(<Home />);
    const login = await screen.findByRole("link", { name: /iniciar sesión/i });
    expect(login).toHaveAttribute("href", "/dashboard/login");
    await userEvent.click(screen.getByRole("button", { name: /idioma y moneda/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /english/i }));
    expect(await screen.findByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/dashboard/login",
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

  it("las ofertas salen de GET /flights/offers con ciudad, imagen, descuento y precio con impuestos", async () => {
    mockOffers([offerFlight]);
    renderPage(<Home />);
    const card = (await screen.findByRole("heading", { name: "Medellín", level: 3 })).closest(
      ".offer",
    ) as HTMLElement;
    expect(card.querySelector("img")).toHaveAttribute("src", "/img/destinations/medellin.jpg");
    expect(within(card).getByText(/−15 %/)).toBeInTheDocument();
    // priceEconomyUsd 85 (ya con la oferta) × 1.00 × 1.19 × 3300 = 333.795
    expect(within(card).getByText("COP 333.795")).toBeInTheDocument();
  });

  it("si la foto de la ciudad no existe, la tarjeta usa la imagen del cielo", async () => {
    mockOffers([offerFlight]);
    renderPage(<Home />);
    const card = (await screen.findByRole("heading", { name: "Medellín", level: 3 })).closest(
      ".offer",
    ) as HTMLElement;
    const img = card.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe("/img/sky.jpg");
  });

  it("elegir una oferta guarda ese vuelo y va a las tarifas", async () => {
    mockOffers([offerFlight]);
    renderRoutes(
      [
        { path: "/", element: <Home /> },
        { path: "/fares", element: <div>fares page</div> },
      ],
      ["/"],
    );
    const card = (await screen.findByRole("heading", { name: "Medellín", level: 3 })).closest(
      ".offer",
    ) as HTMLElement;
    await userEvent.click(card);
    expect(await screen.findByText("fares page")).toBeInTheDocument();
    const state = useWizard.getState();
    expect(state.flightId).toBe(OFFER_ID);
    expect(state.search).toMatchObject({ from: "BOG", to: "MDE", date: "2026-12-05" });
  });

  it("sin ofertas no muestra la sección de ofertas", async () => {
    renderPage(<Home />);
    await screen.findByText(/mira desde tu ventanilla/i);
    expect(document.querySelector("#offers")).toBeNull();
  });
});
