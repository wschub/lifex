import type { OfferFlight } from "@lifex/shared";

/**
 * Ofertas que caben en la portada (la cuadrícula del prototipo tiene 5): primero las que tienen imagen de
 * ciudad, alternando internacionales y nacionales empezando por una internacional (la tarjeta grande), y
 * sin repetir destino.
 */
export function pickDisplayOffers(offers: readonly OfferFlight[], max: number): OfferFlight[] {
  const seen = new Set<string>();
  const unique = offers.filter((o) => {
    if (seen.has(o.to.iataCode)) return false;
    seen.add(o.to.iataCode);
    return true;
  });
  const withImage = unique.filter((o) => o.to.cityImageName);
  const withoutImage = unique.filter((o) => !o.to.cityImageName);
  const ordered = [...withImage, ...withoutImage];
  const international = ordered.filter((o) => o.routeType === "INTERNATIONAL");
  const domestic = ordered.filter((o) => o.routeType === "DOMESTIC");
  const result: OfferFlight[] = [];
  for (let i = 0; result.length < max && (i < international.length || i < domestic.length); i++) {
    if (international[i]) result.push(international[i]!);
    if (result.length < max && domestic[i]) result.push(domestic[i]!);
  }
  return result;
}
