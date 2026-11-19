# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS pages linked to each other, no backend. A navigable prototype with sample data: every step of the booking flow is its own HTML file. The language switch is handled in the front end (see Capabilities).

## Users

Travelers booking a flight, mainly from Colombia, who want to buy a ticket quickly and without price surprises. Their job: search a route, pick a fare, enter passenger data, choose a seat and pay.

## Product Purpose

lifex is a new premium airline from Colombia. The website lets a traveler search, choose a fare (Economy or Business), personalize the trip (seat, baggage) and pay. Success is a completed purchase with no confusion about what the total includes.

## Positioning

"The best experience, always.": a premium experience in every cabin, not only in Business.

## Operating Context

The booking flow follows the structure of the reference screenshots in `mockups/` (taken from avianca.com, used as a flow and information-architecture reference only):

1. Home with search (origin, destination, dates, passengers), promo banner, offers from a city, travel prep, help and footer.
2. Step 1, results: date strip with prices, filters, flight card; fare selector with an Economy/Business toggle (Economy: Light, Classic, Flex; Business: Classic, Flex); trip summary with total and "no surprises" note.
3. Step 2, passengers: passenger accordion with validation and booking-holder contact accordion.
4. Step 3, personalize: seat, extra baggage and sports baggage cards.
5. Seat selection. Business: 1-2-1 flatbed map. Economy (`mockups/economy/`): 3-3-3 map with zones (Plus, Economy, emergency exit), lavatories, hover tooltip, per-leg tabs.
6. Step 4, payment: card, PSE or Apple Pay, with purchase summary.

## Capabilities and Constraints

- Bilingual: Spanish and English. A language select with flags; in English prices show in USD, in Spanish in COP. The switch is done in code, not by separate copy decisions.
- Flow and screen structure stay as in the Avianca mockups. Fare names Light, Classic and Flex are kept (generic).
- Avianca trademarks are not reused: the Business cabin ("Insignia" in the reference) and the miles program ("Lifemiles") get lifex-owned generic names. Exact names are still open (placeholders such as "lifex Business" and "lifex Miles").
- No real payment, no real inventory: all data is sample data.
- Open: final fare, cabin and program names; real routes and fares.

## Brand Commitments

- Name: lifex (lowercase).
- Slogan: "The best experience, always."
- Logo: concept 2 "Ala" (red rounded badge with a white wing, geometric wordmark). Main web version: `logos/concept-2-ala/lifex-concept2-horizontal-color.svg`. Vertical version for emails.
- Brand palette: red `#C8102E`, ink `#14161A`, slogan gray `#5F6570`, support gray `#7B818B`, white. Dark-background variants use red `#E8283F`, white text and gray `#B4B9C2`.
- The website is light.
- Slogan font: Jost Medium.

## Evidence on Hand

- Logos in `logos/concept-2-ala/` (SVG) and `logos/png/` (email PNGs).
- Reference screenshots in `mockups/` and `mockups/economy/`.
- Absent and not to be fabricated: lifex photography, real routes, real fares, fleet details, testimonials, partner logos. Photos will be sourced from licensed stock where needed.

## Product Principles

1. Price honesty: the total includes taxes and charges from the first fare screen onward.
2. Premium in every cabin: care in Economy matches the promise of the slogan.
3. One decision per step: each screen asks the traveler for one thing and keeps the running total visible.
4. Familiar booking flow: use proven airline-booking patterns so the purchase is never in doubt.
5. Own the brand: no Avianca assets, names or copy carried over.

## Accessibility & Inclusion

No product-specific standard established yet. Default: WCAG AA contrast, keyboard-operable seat maps and forms. Accessibility and assistance services appear as an optional step in passenger data (as in the reference).
