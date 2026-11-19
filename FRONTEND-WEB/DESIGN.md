---
name: lifex
description: A premium Colombian airline booking site seen through an airliner window, on a pale cabin-sky ground with one red voice.
colors:
  lifex-red: "#C8102E"
  lifex-red-deep: "#A30D25"
  red-tint: "#FBE9EC"
  ink: "#14161A"
  ink-soft: "#3A3F47"
  slogan-gray: "#5F6570"
  gray-soft: "#8A909A"
  line: "#DADDE2"
  line-soft: "#E8EAEE"
  cabin-sky: "#F2F3F5"
  cabin-sky-deep: "#E7E9ED"
  white: "#FFFFFF"
  confirm-green: "#1B7A45"
  confirm-tint: "#E5F3EB"
  caution-amber: "#8A5A00"
  caution-tint: "#FFF3DA"
typography:
  display:
    fontFamily: "Jost, Futura, Century Gothic, sans-serif"
    fontSize: "clamp(3.2rem, 7.2vw, 6rem)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Jost, Futura, Century Gothic, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.2rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Jost, Futura, Century Gothic, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "Jost, Futura, Century Gothic, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum, lnum"
  body:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  field: "12px"
  card: "20px"
  dock: "32px"
  pill: "999px"
  window: "50%"
spacing:
  sm: "10px"
  md: "18px"
  lg: "28px"
  section: "88px"
  gutter: "clamp(16px, 4vw, 56px)"
components:
  button-primary:
    backgroundColor: "{colors.lifex-red}"
    textColor: "{colors.white}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 28px"
  button-primary-hover:
    backgroundColor: "{colors.lifex-red-deep}"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "52px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "62px"
    padding: "9px 16px"
  search-dock:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.dock}"
    padding: "22px"
  flight-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "26px 30px"
  fare-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "26px"
  fare-card-business:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "26px"
  chip:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  summary-bar:
    backgroundColor: "{colors.white}"
    height: "92px"
  seat-selected:
    backgroundColor: "{colors.lifex-red}"
    textColor: "{colors.white}"
    rounded: "12px"
---

# Design System: lifex

## Overview

**Creative North Star: "La ventanilla"**

Every destination is seen from your window seat. The airliner window, a tall oval, is the system's one shape and its signature move. It holds the destination photo on the home page, it echoes in the stepper's step markers, the promise icons, the seat-map fuselage and the confirmation stamp, and it refuses the hero-photo-plus-search-bar template by making the window frame the search dock. Everything else is quiet: a pale cabin-sky ground, white surfaces, ink text, and a single red used in a few large fields.

The system is a light, calm booking surface. Density is moderate and roomy on the home page, tighter in checkout, where one decision per step keeps the running total visible in a fixed summary bar. Standard form controls are never costumed; the drama is in the window, the large Jost headlines and the photography, not in the inputs. Choice is shown by recession: the chosen option rises while alternatives dim and settle back.

The build carries two bilingual behaviors that shape every price and label: Spanish shows COP and the Colombian flag, English shows USD and the US flag, switched in the header and remembered.

**Key Characteristics:**
- One shape: the window oval (and its pill and fuselage cousins) carries the brand.
- Cabin-sky ground (#F2F3F5) with white surfaces and ink (#14161A) text; red is rare and large.
- Jost for headlines, prices and numerals; Hanken Grotesk for everything read.
- Soft, ambient shadows only; no hard offsets.
- Chosen option rises, alternatives recede (opacity .55 to .75, slight scale).
- Ticket vocabulary: dashed dividers and perforated stubs on flight and boarding cards.

## Colors

A cool pale-gray cabin with one disciplined red and an ink black; semantic green and amber appear only for state.

### Primary
- **Lifex Red** (#C8102E): the brand voice. Primary buttons, the featured fare outline and its tag, the selected seat, active leg-tab underline, completed stepper markers, links, focus ring, selection and the accent word in the home headline. Used on a small share of any screen, in large flat fields rather than scattered.
- **Lifex Red Deep** (#A30D25): hover and pressed state of red, and text on the Business zone tint.
- **Red Tint** (#FBE9EC): invalid-field wash and the Business zone band in the seat map.

### Neutral
- **Ink** (#14161A): text, the dark button, selected chips and date tiles, the Business fare card, the lifexperience band and the boarding-pass stub.
- **Ink Soft** (#3A3F47): body copy on white, nav links, secondary paragraphs.
- **Slogan Gray** (#5F6570): secondary text, labels, captions (brand gray).
- **Gray Soft** (#8A909A): disabled text, dotted flight line, unavailable features, switch track off.
- **Cabin Sky** (#F2F3F5): the page ground and the quiet inset fill (toggles, avatars, option art).
- **Cabin Sky Deep** (#E7E9ED): disabled buttons, neutral notes, avatar fill.
- **Line** (#DADDE2) and **Line Soft** (#E8EAEE): field and card borders, dividers.
- **White** (#FFFFFF): cards, header, dock, summary bar.

### Semantic
- **Confirm Green** (#1B7A45) with tint (#E5F3EB): chosen flight outline, completed accordion mark, lowest-price date, success notes.
- **Caution Amber** (#8A5A00) with tint (#FFF3DA): warnings and the emergency-exit zone band.

### Named Rules
**The Few Large Fields Rule.** Red lands in a handful of big, flat places per screen (the Search button, the featured fare, the selected seat), never as scattered trim.
**The Cool Ground Rule.** Ground and neutrals stay in the cool blue-gray family of cabin plastic; no warm cream or tinted-brown surfaces.

## Typography

**Display Font:** Jost (with Futura, Century Gothic, sans-serif), variable 100-900, self-hosted
**Body Font:** Hanken Grotesk (with Helvetica Neue, Arial, sans-serif), variable, self-hosted

**Character:** Jost is geometric and airy, a direct cousin of the wordmark and slogan, so headlines and prices read as brand. Hanken Grotesk is a clear humanist grotesque that keeps forms and fare lists easy.

### Hierarchy
- **Display** (500, clamp(3.2rem, 7.2vw, 6rem), 0.98, -0.035em): the monumental home headline only; one accent word in red.
- **Headline** (500, clamp(2rem, 4vw, 3.2rem), 1.08, -0.03em): section titles; checkout page titles run smaller at clamp(1.9rem, 3.4vw, 2.6rem).
- **Title** (500, 20 to 34px, 1.08): card titles, fare names (30px), accordion heads (21px), offer cities (32px, 46px on the lead offer).
- **Numeral** (500, 20 to 34px Jost, tabular lining): prices, times (34px), totals (28 to 30px), boarding route (54px).
- **Body** (400, 16px, 1.5): copy at 15 to 19px; paragraphs use balanced/pretty wrapping, ledes capped near 34ch, descriptions 40 to 52ch.
- **Label** (400 to 500, 12.5 to 14.5px): field labels, captions, per-passenger notes, in Slogan Gray.
- **Button** (Jost 500, 17px, +0.01em): buttons set in the display face.

### Named Rules
**The Numerals Are Display Rule.** Prices, times, codes and totals are set in Jost with tabular lining figures so columns and totals align.
**The Headline Stays Tight Rule.** Headlines run negative tracking (-0.01 to -0.035em) and a line height of 1.08 or less; body never does.

## Layout

A single centered wrap (max 1240px, side gutter clamp(16px, 4vw, 56px)); the seat page widens to 1440px. Home sections breathe at 88px vertical padding (56px on phones). Checkout is a content column above a fixed summary bar; its main area reserves 150px of bottom padding for the bar. The home hero is a two-column grid (copy 1.05fr, window 1fr) with the window bleeding off the right edge, and the search dock overlaps upward into the window's frame by 118px (90px tablet, 28px phone).

Rhythm is 10px between fields, 18 to 20px between cards, 28px between panels. Grids: offers 1.3fr/1/1 with a tall lead card; cabins 1/1; fares three columns (Economy) or two (Business); options three columns; payment 1.4fr/1fr with a sticky order panel. Breakpoints: 1100px (nav hides, grids collapse to one or two columns, search row to two columns) and 720px (phone: stacked search fields, hidden lede, scrolling date strip, compact two-line summary bar, stacked boarding pass).

## Elevation & Depth

Hybrid: borders and tone carry most separation, soft ambient shadows lift the surfaces that matter. Shadows are blue-black ink at low alpha with large negative spread; there are no hard offset shadows. The window itself is the one place depth is staged as an object: a double ring (14px pale frame plus a 1px line), a drop shadow, and an inner vignette.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(20,22,26,.06), 0 6px 16px -6px rgba(20,22,26,.10)`): flight cards, panels, fare panel, seat cabin.
- **Lifted** (`box-shadow: 0 2px 4px rgba(20,22,26,.06), 0 24px 48px -16px rgba(20,22,26,.22)`): search dock, hovered fare and option cards, menus, tooltips, boarding pass.
- **Bar** (`box-shadow: 0 -10px 30px -18px rgba(20,22,26,.25)`): the fixed summary bar.
- **Window** (`box-shadow: 0 0 0 14px #ECEEF1, 0 0 0 15px var(--line), 0 40px 80px -30px rgba(20,22,26,.35), inset 0 0 0 1px rgba(20,22,26,.1)`): the home window only.
- **Selected seat ring** (`box-shadow: 0 0 0 4px rgba(200,16,46,.22), inset 0 -6px 0 rgba(0,0,0,.2)`): the chosen seat.

### Named Rules
**The Rise And Recede Rule.** Hover or selection raises the chosen element (translateY -3 to -6px, Lifted shadow) while siblings fall to .55 to .75 opacity and scale .985. Motion uses `cubic-bezier(.16, 1, .3, 1)` at .3 to .45s; the window shade (1.5s) and photo crossfade (.9s) are the slow moments. Reduced motion removes the shade animation and pane transition.

## Shapes

The window oval is the system's one shape: `border-radius: 50% / 50%` on the hero window, `50% / 36%` on small window icons and stepper markers (28x36px), and a 120px-top / 36px-bottom fuselage curve on the seat-map cabin. Surfaces step down in a calm ladder: fields 12px, cards 20px, the search dock and fare panel 32px, the lifexperience band 40px, all buttons, chips and toggles fully pill (999px). Seats are small cabin-plastic tabs (12px top, 6px bottom corners). Borders are 1px Line, 1.5px for choosable cards (Ink on hover, Red when featured, Green when chosen), and dashed (1 to 2px) for ticket perforations between a flight and its price, or a boarding pass and its stub.

## Components

### Buttons
- **Shape:** full pill (999px), 52px tall (40px small), Jost 500 17px.
- **Primary:** Lifex Red fill, white text, 28px side padding; hover deepens to Red Deep; active scales .98.
- **Dark:** Ink fill, hover pure black. **Ghost:** transparent, 1.5px Ink border, fills Ink on hover.
- **Disabled:** Cabin Sky Deep fill, Gray Soft text, not-allowed cursor.
- **Focus:** 2px Red outline offset 3px on every interactive element.

### Chips and Toggles
- **Style:** white pill with 1px Line border; hover border turns Ink. Destination chips carry a 30px round photo thumbnail.
- **State:** pressed inverts to Ink fill with white text. Segmented toggles (trip type, cabin) sit in a pill track with the active segment raised white or filled Ink.

### Search Dock (signature)
White 32px-radius panel straddling the window frame: trip toggle, then a five-column row (origin, destination, dates, passengers, red Search button). Fields are bordered white boxes with a small gray label above a 16.5px medium value; focus shifts the border to Ink with a 3px soft ring, invalid fields take Red border and Red Tint. Destination chips below swap the window photo (crossfade) and prefill the destination.

### Flight and Fare Cards
- **Flight card:** white 20px card; times at 34px Jost, a dotted gray flight line carrying a red plane glyph, and a dashed vertical divider before the price block (min 260px).
- **Fare card:** 20px, 1.5px Line border, 26px padding, feature list with check or muted cross icons, price row pinned to the bottom with a full-width button. The featured fare has a Red border and a small red pill tag overlapping its top edge. Business fares invert to Ink with white text and a white button that turns red on hover. The Economy/Business toggle sits above, centered.

### Date Strip and Filters
Seven equal 16px-radius tiles; the pressed day turns Ink and lifts 3px; the lowest price is Confirm Green. Filter chips follow the chip rule at 38px.

### Inputs / Fields
Standard controls: white, 1px Line, 12px radius, 62px minimum height, native select with a drawn chevron, checkbox and radio at 20 to 22px. Switches use Red when on. Errors show a 13px Red message under the field.

### Accordions and Option Cards
Passenger and contact data live in 20px-radius accordions (21px Jost heads, green check once valid). Personalize options are three 20px cards with a Sky art well; hovered card rises while siblings dim, a chosen card takes a Green border; quantities use a pill stepper.

### Summary Bar (signature)
Fixed to the bottom of every checkout step: white, top border and Bar shadow, 92px tall, four columns: route (22px Jost), passengers, running total (28px Jost with a small note that taxes are included) and actions. On phones it collapses to route and total with actions at right, hiding the passenger column. The checkout header above it is sticky and holds the logo, a stepper of window-shaped markers (done red, current ink-ringed, upcoming line) and a trip pill.

### Seat Map (signature)
A white cabin shell with a fuselage-curved top and a small overhead-light slot, sticky column letters, row numbers and zone bands (Plus slate-blue, standard sky, exit amber, Business red tint). Economy is 3-3-3 on a 520px shell; Business is 1-2-1 on 440px with larger dark-burgundy flatbed seats marked with an inner ring. Seat states: zone color at rest, hover lifts 3px with a tooltip card, taken seats are outlined with a cross, selected seat is Lifex Red with a ring, lift and scale 1.06, and unselected seats dim to .6 once one is chosen. Passenger cards (border Green when active), a legend and a sticky side-info panel flank the map; a fixed footer shows the total.

### Boarding Pass and Confirmation
A red window badge with a check, an 880px boarding pass (28px radius, Lifted shadow) split into a white main part with a 54px route and an Ink stub, divided by a dashed line, plus a dashed code box set in 34px Jost with wide tracking.

### Navigation and Language
White header, 76px, logo left, centered pill nav links (hover or current fills Sky), tools right. The language control is a pill showing flag plus "ES · COP" or "EN · USD" with a menu (radio items, flags, currency note). Selecting a language switches all copy and every price (COP in Spanish, USD in English at a sample rate), persists it, and re-renders the page.

## Do's and Don'ts

### Do:
- **Do** keep the ground Cabin Sky (#F2F3F5) and put content on white; reserve Ink (#14161A) for the one dark moment per screen (selected state, Business fare, stub, lifexperience band).
- **Do** use Lifex Red (#C8102E) only for the primary action, the featured or selected thing, links and focus.
- **Do** set every price, time and code in Jost with tabular lining figures, and label totals as taxes included; show COP in Spanish and USD in English.
- **Do** build new shapes from the window language: oval icon wells, pill controls, 20px cards, fuselage curves.
- **Do** show choice by rise and recede: lift the chosen item, dim the rest, ease with `cubic-bezier(.16, 1, .3, 1)`.
- **Do** keep the running total visible in the fixed summary bar on every checkout step.
- **Do** keep form controls standard, with Line borders and an Ink focus ring on fields, Red outline on everything else focusable.
- **Do** honor reduced motion by removing the shade animation and pane transitions.

### Don't:
- **Don't** add hard offset shadows, outlines-with-offset, or glow; shadows are ambient, low-alpha ink.
- **Don't** use warm cream, tinted-brown or colored page grounds; the cabin is cool gray.
- **Don't** spread red as trim across headings, icons and borders; it belongs to a few large fields.
- **Don't** costume inputs with decorative shapes; the window belongs to the hero, markers and seat map, not to form fields.
- **Don't** use a display face other than Jost or a text face other than Hanken Grotesk, and never a system font for display.
- **Don't** copy Avianca assets, names or copy; fare names Light, Classic and Flex are generic and kept.
- **Don't** use stock-looking emoji or glyph icons; icons are the stroked inline SVG set (1.7px stroke, round caps).
