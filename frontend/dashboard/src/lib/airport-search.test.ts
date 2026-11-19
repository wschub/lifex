import { describe, expect, it } from "vitest";
import {
  filterAirports,
  groupAirports,
  normalizeText,
  type AirportEntry,
} from "./airport-search.ts";

const entry = (iata: string, name: string, nameEs: string, country: string): AirportEntry => ({
  iata,
  name,
  nameEs,
  countryIsoCode: country,
});

const ALL: AirportEntry[] = [
  entry("MIA", "Miami", "Miami", "US"),
  entry("MDE", "Medellín", "Medellín", "CO"),
  entry("BOG", "Bogotá", "Bogotá", "CO"),
  entry("LHR", "London", "Londres", "GB"),
  entry("MAD", "Madrid", "Madrid", "ES"),
  entry("ADZ", "San Andrés", "San Andrés", "CO"),
];
const iatas = (list: AirportEntry[]) => list.map((e) => e.iata);

describe("autocompletar de aeropuertos", () => {
  it("normaliza tildes y mayúsculas", () => {
    expect(normalizeText("  BOGOTÁ ")).toBe("bogota");
  });

  it("sin texto devuelve todos: nacionales primero y luego internacionales, por nombre", () => {
    expect(iatas(filterAirports(ALL, ""))).toEqual(["BOG", "MDE", "ADZ", "LHR", "MAD", "MIA"]);
  });

  it("filtra por código IATA o por ciudad, en español o en inglés y sin tildes", () => {
    expect(iatas(filterAirports(ALL, "lhr"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "londres"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "london"))).toEqual(["LHR"]);
    expect(iatas(filterAirports(ALL, "bogota"))).toEqual(["BOG"]);
    expect(iatas(filterAirports(ALL, "andres"))).toEqual(["ADZ"]);
    expect(filterAirports(ALL, "zzz")).toEqual([]);
  });

  it("el código que empieza por el texto va antes que las ciudades que solo lo contienen", () => {
    expect(iatas(filterAirports(ALL, "ma"))[0]).toBe("MAD");
  });

  it("separa nacionales de internacionales", () => {
    const groups = groupAirports(filterAirports(ALL, ""));
    expect(iatas(groups.domestic)).toEqual(["BOG", "MDE", "ADZ"]);
    expect(iatas(groups.international)).toEqual(["LHR", "MAD", "MIA"]);
  });
});
