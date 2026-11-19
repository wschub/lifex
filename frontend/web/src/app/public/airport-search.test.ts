import { describe, expect, it } from "vitest";
import { filterAirports, groupAirports, normalizeText } from "./airport-search.ts";
import type { AirportEntry } from "./hooks/useCities.ts";

const entry = (iata: string, name: string, nameEs: string, country: string): AirportEntry => ({
  iata,
  name,
  nameEs,
  countryIsoCode: country,
  imageName: null,
});

const ALL: AirportEntry[] = [
  entry("MIA", "Miami", "Miami", "US"),
  entry("MDE", "Medellín", "Medellín", "CO"),
  entry("BOG", "Bogotá", "Bogotá", "CO"),
  entry("LHR", "London", "Londres", "GB"),
  entry("MAD", "Madrid", "Madrid", "ES"),
  entry("MAN", "Manchester", "Mánchester", "GB"),
  entry("AXM", "Armenia", "Armenia", "CO"),
  entry("AMS", "Amsterdam", "Ámsterdam", "NL"),
  entry("ADZ", "San Andrés", "San Andrés", "CO"),
];

const iatas = (list: AirportEntry[]) => list.map((e) => e.iata);

describe("normalizeText", () => {
  it("ignora mayúsculas, tildes y espacios de los extremos", () => {
    expect(normalizeText("  MÁNCHESTER ")).toBe("manchester");
    expect(normalizeText("Bogotá")).toBe("bogota");
  });
});

describe("filterAirports", () => {
  it("sin texto devuelve todos: nacionales primero y luego internacionales, cada grupo por nombre", () => {
    expect(iatas(filterAirports(ALL, "", "es"))).toEqual([
      "AXM", // Armenia
      "BOG",
      "MDE",
      "ADZ", // San Andrés
      "AMS", // Ámsterdam
      "LHR", // Londres
      "MAD",
      "MAN", // Mánchester
      "MIA",
    ]);
  });

  it("filtra por código IATA (sin importar mayúsculas)", () => {
    expect(iatas(filterAirports(ALL, "lhr", "es"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "MD", "es"))).toEqual(["MDE"]);
    expect(iatas(filterAirports(ALL, "ma", "es"))).toEqual(["MAD", "MAN"]);
  });

  it("filtra por ciudad en español o en inglés y sin tildes", () => {
    expect(iatas(filterAirports(ALL, "londres", "es"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "london", "es"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "bogota", "en"))).toEqual(["BOG"]);
    expect(iatas(filterAirports(ALL, "amster", "es"))).toEqual(["AMS"]);
  });

  it("el código exacto o que empieza por el texto va antes que las ciudades que solo lo contienen", () => {
    // "man": MAN (código) y Mánchester empiezan por él; "Armenia" lo contiene en medio.
    expect(iatas(filterAirports(ALL, "man", "es"))[0]).toBe("MAN");
    expect(iatas(filterAirports(ALL, "san", "es"))).toEqual(["ADZ"]);
  });

  it("busca también por una palabra del nombre (San Andrés → 'andres')", () => {
    expect(iatas(filterAirports(ALL, "andres", "es"))).toEqual(["ADZ"]);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(filterAirports(ALL, "zzz", "es")).toEqual([]);
  });
});

describe("groupAirports", () => {
  it("separa nacionales (CO) de internacionales conservando el orden", () => {
    const groups = groupAirports(filterAirports(ALL, "", "es"));
    expect(iatas(groups.domestic)).toEqual(["AXM", "BOG", "MDE", "ADZ"]);
    expect(iatas(groups.international)).toEqual(["AMS", "LHR", "MAD", "MAN", "MIA"]);
  });
});
