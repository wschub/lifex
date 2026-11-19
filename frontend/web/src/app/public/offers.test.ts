import type { OfferFlight } from "@lifex/shared";
import { describe, expect, it } from "vitest";
import { pickDisplayOffers } from "./offers.ts";

const offer = (
  id: string,
  to: string,
  routeType: "DOMESTIC" | "INTERNATIONAL",
  image: string | null,
): OfferFlight =>
  ({
    id,
    routeType,
    from: { iataCode: "BOG", cityImageName: null },
    to: { iataCode: to, cityImageName: image },
    offer: { discountPercentage: 15 },
  }) as unknown as OfferFlight;

describe("pickDisplayOffers", () => {
  it("devuelve como máximo 5 ofertas", () => {
    const all = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG"].map((c) =>
      offer(c, c, "DOMESTIC", `${c}.jpg`),
    );
    expect(pickDisplayOffers(all, 5)).toHaveLength(5);
  });

  it("prefiere las ofertas con imagen de ciudad", () => {
    const picked = pickDisplayOffers(
      [offer("1", "AAA", "DOMESTIC", null), offer("2", "BBB", "DOMESTIC", "b.jpg")],
      1,
    );
    expect(picked.map((o) => o.id)).toEqual(["2"]);
  });

  it("alterna internacionales y nacionales empezando por una internacional", () => {
    const picked = pickDisplayOffers(
      [
        offer("d1", "AAA", "DOMESTIC", "a.jpg"),
        offer("d2", "BBB", "DOMESTIC", "b.jpg"),
        offer("i1", "CCC", "INTERNATIONAL", "c.jpg"),
        offer("i2", "DDD", "INTERNATIONAL", "d.jpg"),
      ],
      4,
    );
    expect(picked.map((o) => o.id)).toEqual(["i1", "d1", "i2", "d2"]);
  });

  it("no repite el destino aunque lleguen dos ofertas a la misma ciudad", () => {
    const picked = pickDisplayOffers(
      [offer("1", "AAA", "DOMESTIC", "a.jpg"), offer("2", "AAA", "DOMESTIC", "a.jpg")],
      5,
    );
    expect(picked).toHaveLength(1);
  });

  it("sin ofertas devuelve una lista vacía", () => {
    expect(pickDisplayOffers([], 5)).toEqual([]);
  });
});
