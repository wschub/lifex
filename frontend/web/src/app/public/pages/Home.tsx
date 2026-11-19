import { useQuery } from "@tanstack/react-query";
import type { OfferFlight } from "@lifex/shared";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { luggageTypesQuery, offersQuery } from "@/api/queries.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatMoney } from "@/lib/money.ts";
import { todayBogota } from "@/lib/search-date.ts";
import { useLang } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { useCities, type AirportEntry } from "../hooks/useCities.ts";
import { useLowestPrice } from "../hooks/useLowestPrice.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { AirportCombobox } from "../shell/AirportCombobox.tsx";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";
import { fareOptions, farePriceUsd, MILES_PER_USD, type FareOption } from "../fares.ts";
import { bogotaDay } from "../flight-view.ts";
import { pickDisplayOffers } from "../offers.ts";
import { cityImageSrc, fallbackToSky, SKY_IMAGE, useImageOrSky } from "../city-image.ts";

const SKY = SKY_IMAGE;
/** Orden de preferencia de los destinos destacados (los del prototipo). */
const DEST_ORDER = ["LHR", "MAD", "MIA", "CTG", "MDE", "SAI"];
const POS: Record<string, string> = {
  LHR: "50% 45%",
  MAD: "55% 50%",
  MIA: "50% 50%",
  CTG: "50% 50%",
  MDE: "50% 60%",
  SAI: "50% 55%",
};
const ORIGIN = "BOG";

type Pane = { src: string; pos: string };

function ordered(
  entries: AirportEntry[],
  order: string[],
  exclude: string,
  max: number,
): AirportEntry[] {
  const withImage = entries.filter((e) => e.imageName && e.iata !== exclude);
  const first = order.flatMap((iata) => withImage.filter((e) => e.iata === iata));
  const rest = withImage.filter((e) => !order.includes(e.iata));
  return [...first, ...rest].slice(0, max);
}

function ChipThumb({ imageName }: { imageName: string | null | undefined }) {
  const src = useImageOrSky(cityImageSrc(imageName));
  return <i style={{ backgroundImage: `url(${src})` }} />;
}

function OfferCard({
  offer,
  light,
  onPick,
}: {
  offer: OfferFlight;
  light: FareOption | undefined;
  onPick: (offer: OfferFlight) => void;
}) {
  const { lang, t } = useLang("home");
  const config = usePublicConfig();
  const city = lang === "es" ? offer.to.cityEs : offer.to.city;
  const origin = lang === "es" ? offer.from.cityEs : offer.from.city;
  const priceUsd = light ? farePriceUsd(light, offer, config.taxPercentage) : null;
  return (
    <a
      className="offer"
      href="#buscar"
      onClick={(e) => {
        e.preventDefault();
        onPick(offer);
      }}
    >
      <img
        src={cityImageSrc(offer.to.cityImageName)}
        alt=""
        loading="lazy"
        onError={fallbackToSky}
      />
      <div className="offer-body">
        <div>
          <h3>{city}</h3>
          <small>
            {t("offer.from", { city: origin })} · {t("oneway")} ·{" "}
            {formatDate(offer.departureDate, lang, { day: "numeric", month: "short" })}
          </small>
          <small>{t("offer.tag", { n: offer.offer.discountPercentage })}</small>
        </div>
        {priceUsd !== null ? (
          <div className="price">
            <small>{t("from.price")}</small>
            {formatMoney(priceUsd, lang, config.iataTrm)}
          </div>
        ) : null}
      </div>
    </a>
  );
}

export function Home() {
  const { lang, t } = useLang("home");
  const navigate = useNavigate();
  const config = usePublicConfig();
  const { entries, byIata, cityName } = useCities();
  const wizardSearch = useWizard((s) => s.search);
  const setSearch = useWizard((s) => s.setSearch);
  const reset = useWizard((s) => s.reset);

  const [from, setFrom] = useState(wizardSearch.from || ORIGIN);
  const [to, setTo] = useState("");
  const [date, setDate] = useState(() =>
    wizardSearch.date < todayBogota() ? todayBogota() : wizardSearch.date,
  );
  const [pax, setPax] = useState(wizardSearch.pax || 1);
  const [invalid, setInvalid] = useState(false);
  const [cur, setCur] = useState<string | null>(null);
  const [panes, setPanes] = useState<{ front: "a" | "b"; a: Pane; b: Pane }>({
    front: "a",
    a: { src: SKY, pos: "50% 50%" },
    b: { src: SKY, pos: "50% 50%" },
  });
  const toRef = useRef<HTMLInputElement>(null);

  // Origen y destino ofrecen todos los aeropuertos (nacionales e internacionales); el destino excluye el origen.
  const destinations = useMemo(() => entries.filter((e) => e.iata !== from), [entries, from]);
  const chips = useMemo(() => ordered(entries, DEST_ORDER, from, 6), [entries, from]);
  const offersQ = useQuery(offersQuery());
  const types = useQuery(luggageTypesQuery());
  const light = useMemo(
    () => fareOptions(types.data?.luggageTypes ?? []).find((f) => f.id === "light"),
    [types.data],
  );
  const offers = useMemo(() => pickDisplayOffers(offersQ.data?.offers ?? [], 5), [offersQ.data]);
  const chooseFlight = useWizard((s) => s.chooseFlight);
  const today = todayBogota();

  const windowTo = (src: string, pos?: string) =>
    setPanes((p) => {
      const back = p.front === "a" ? "b" : "a";
      return { ...p, [back]: { src, pos: pos ?? "50% 50%" }, front: back };
    });

  const pick = (iata: string) => {
    const next = cur === iata ? null : iata;
    setCur(next);
    if (next) {
      setTo(next === from ? "" : next);
      windowTo(cityImageSrc(byIata.get(next)?.imageName), POS[next]);
    } else {
      setTo("");
      windowTo(SKY);
    }
    setInvalid(false);
  };

  const captionPrice = useLowestPrice(from, cur ?? "", date, !!cur && cur !== from);

  const onFrom = (value: string) => {
    setFrom(value);
    // El destino no puede ser igual al origen: si coincide, se limpia (y la imagen vuelve al cielo).
    if (value === to) {
      setTo("");
      if (cur === value) {
        setCur(null);
        windowTo(SKY);
      }
    }
  };
  const onTo = (value: string) => {
    if (value) {
      if (value !== cur) pick(value);
    } else if (cur) pick(cur);
    setTo(value);
    setInvalid(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!to) {
      setInvalid(true);
      toRef.current?.focus();
      return;
    }
    reset();
    setSearch({ from, to, date: date || wizardSearch.date, pax });
    navigate(`/results?from=${from}&to=${to}&date=${date || wizardSearch.date}&pax=${pax}`);
  };

  return (
    <Shell kind="site" page="home" title="lifex — The best experience, always.">
      <main id="main">
        <section className="hero" aria-labelledby="h1">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1 id="h1" dangerouslySetInnerHTML={{ __html: t("h1") }} />
              <p className="lede">{t("lede")}</p>
            </div>
            <div className="hero-window" aria-hidden="false">
              <div
                className="window"
                role="img"
                aria-label={cur ? cityName(cur, lang) : t("win.alt")}
              >
                <img
                  className={`pane${panes.front === "a" ? "" : " is-off"}`}
                  src={panes.a.src}
                  style={{ objectPosition: panes.a.pos }}
                  alt=""
                  onError={fallbackToSky}
                />
                <img
                  className={`pane${panes.front === "b" ? "" : " is-off"}`}
                  src={panes.b.src}
                  style={{ objectPosition: panes.b.pos }}
                  alt=""
                  onError={fallbackToSky}
                />
                <div className="shade" aria-hidden="true" />
                <div className="dest-caption" hidden={!cur}>
                  <b>{cur ? cityName(cur, lang) : ""}</b>
                  <span>
                    {captionPrice.priceUsd !== null
                      ? `${t("from.price")} ${formatMoney(captionPrice.priceUsd, lang, config.iataTrm)}`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="wrap" id="buscar">
            <form className="search-dock" noValidate aria-label="Buscar vuelos" onSubmit={submit}>
              <div className="trip-toggle" role="group" aria-label="Tipo de viaje">
                <button type="button" aria-pressed="false" disabled title={t("soon")}>
                  {t("trip.rt")}
                </button>
                <button type="button" aria-pressed="true">
                  {t("trip.ow")}
                </button>
              </div>
              <div className="search-row">
                <div className="field">
                  <label htmlFor="from">{t("f.from")}</label>
                  <AirportCombobox
                    id="from"
                    name="from"
                    value={from}
                    options={entries}
                    placeholder={t("ac.hint")}
                    onChange={onFrom}
                  />
                </div>
                <div className={`field${invalid ? " invalid" : ""}`}>
                  <label htmlFor="to">{t("f.to")}</label>
                  <AirportCombobox
                    id="to"
                    name="to"
                    inputRef={toRef}
                    value={to}
                    options={destinations}
                    placeholder={t("to.ph")}
                    allowEmpty
                    onChange={onTo}
                  />
                  <span className="err-msg">{t("err.to")}</span>
                </div>
                <div className="field">
                  <label htmlFor="dep">{t("f.dep")}</label>
                  <input
                    id="dep"
                    name="dep"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pax">{t("f.pax")}</label>
                  <select
                    id="pax"
                    name="pax"
                    value={pax}
                    onChange={(e) => setPax(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? t("pax.n1") : t("pax.n", { n })}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit">
                  <span>{t("search")}</span>
                </button>
              </div>
              <div className="dest-strip" id="chips">
                <span>{t("see")}</span>
                {chips.map((c) => (
                  <button
                    key={c.iata}
                    className="chip"
                    type="button"
                    aria-pressed={cur === c.iata}
                    onClick={() => pick(c.iata)}
                  >
                    <ChipThumb imageName={c.imageName} />
                    {lang === "es" ? c.nameEs : c.name}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        {offers.length > 0 ? (
          <section className="section" id="ofertas" aria-labelledby="h-offers">
            <div className="wrap">
              <div className="section-head">
                <div>
                  <h2 id="h-offers">{t("offers.title")}</h2>
                  <p>{t("offers.prices")}</p>
                </div>
              </div>
              <div className="offers" id="offers">
                {offers.map((o) => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    light={light}
                    onPick={(offer) => {
                      setSearch({
                        from: offer.from.iataCode,
                        to: offer.to.iataCode,
                        date: bogotaDay(offer.departureDate),
                        pax,
                      });
                      chooseFlight(offer.id);
                      navigate("/fares");
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="section promise" aria-labelledby="h-promise">
          <div className="wrap promise-grid">
            <h2 id="h-promise">{t("promise.h")}</h2>
            <ul className="promise-list">
              {(
                [
                  ["globe", "p1"],
                  ["seat", "p2"],
                  ["wing", "p3"],
                ] as const
              ).map(([icon, key]) => (
                <li key={key}>
                  <span className="win-ico" aria-hidden="true">
                    <Icon name={icon} style={{ width: 26, height: 26 }} />
                  </span>
                  <div>
                    <h3>{t(`${key}.h`)}</h3>
                    <p>{t(`${key}.p`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" aria-labelledby="h-cabins">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h2 id="h-cabins">{t("cabins.h")}</h2>
              </div>
            </div>
            <div className="cabins">
              <article className="cabin">
                <img src="/img/economy-cabin.jpg" alt="" loading="lazy" />
                <div>
                  <h3>Economy</h3>
                  <p>{t("cabin.e")}</p>
                </div>
              </article>
              <article className="cabin">
                <img src="/img/business-seat.jpg" alt="" loading="lazy" />
                <div>
                  <h3>Business</h3>
                  <p>{t("cabin.b")}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="lifexperience" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="lifexp">
              <div>
                <h2>{t("lx.h")}</h2>
                <p>{t("lx.p")}</p>
                <a className="btn btn-primary" href="#">
                  {t("lx.cta")}
                </a>
              </div>
              <ul className="earn" aria-label="lifexperience">
                {(["light", "classic", "flex", "elite", "royal"] as const).map((id) => (
                  <li key={id}>
                    <span>
                      {id === "elite" || id === "royal" ? "Business " : "Economy "}
                      {t(`fare.${id}`)}
                    </span>
                    <b className="num">
                      {MILES_PER_USD[id]} {t("lx.miles")}
                    </b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
