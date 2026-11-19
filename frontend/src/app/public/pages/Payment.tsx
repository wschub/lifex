import { TOPIC, type FlightEvent } from "@lifex/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { requestPayment } from "@/api/payments.ts";
import { bookingQuery } from "@/api/queries.ts";
import { keys } from "@/api/keys.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatMoney } from "@/lib/money.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { getWsClient } from "@/ws/shared-client.ts";
import { fareLabel } from "../fares.ts";
import { flightTimes } from "../flight-view.ts";
import { RequireStep } from "../guards.tsx";
import { useHoldCountdown } from "../hooks/useHoldCountdown.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";

type Phase = "form" | "processing" | "confirmed" | "rejected" | "expired";
type Errors = Partial<Record<"cn" | "cname" | "cexp" | "ccvv", "card" | "req" | "exp" | "cvv">>;

/** Valida los datos de tarjeta como el prototipo; el número lo valida de verdad el backend (Luhn). */
export function validateCard(card: {
  number: string;
  name: string;
  exp: string;
  cvv: string;
}): Errors {
  const errors: Errors = {};
  if (!/^\d{13,16}$/.test(card.number.replace(/\s/g, ""))) errors.cn = "card";
  if (!card.name.trim()) errors.cname = "req";
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp)) errors.cexp = "exp";
  if (!/^\d{3,4}$/.test(card.cvv)) errors.ccvv = "cvv";
  return errors;
}

function PaymentContent() {
  const { lang, t } = useLang("payment");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const config = usePublicConfig();
  const wizard = useWizard();
  const { booking, flightId, fareId, paymentKey } = wizard;
  const { flight } = useSelectedFlight();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [method, setMethod] = useState<"card" | "pse" | "apple">("card");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const sending = useRef(false);
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);

  // Con el pago en curso el asiento ya no vence: el temporizador solo corre mientras se llena el formulario.
  useHoldCountdown(!submitted);

  const current = useQuery({
    ...bookingQuery(booking?.id ?? "", booking?.token ?? ""),
    enabled: !!booking,
    // Mientras se procesa, se sondea la reserva; el socket solo lo adelanta.
    refetchInterval: (query) => {
      if (!submitted) return false;
      const status = query.state.data?.booking.status;
      return status === "CONFIRMED" || status === "CANCELLED" || status === "EXPIRED"
        ? false
        : 1500;
    },
  });
  const order = current.data?.booking ?? null;
  const phase: Phase = !submitted
    ? "form"
    : order?.status === "CONFIRMED"
      ? "confirmed"
      : order?.status === "CANCELLED" || order?.payment?.status === "REJECTED"
        ? "rejected"
        : order?.status === "EXPIRED"
          ? "expired"
          : "processing";

  // El resultado también llega por el socket: se refresca la reserva al instante en vez de esperar al sondeo.
  useEffect(() => {
    if (phase !== "processing" || !flightId || !booking) return;
    return getWsClient().subscribe(TOPIC.flight(flightId), {
      onEvent: (event: FlightEvent) => {
        if (event.type === "BookingConfirmed" && event.data.orderId === booking.id) {
          void queryClient.invalidateQueries({ queryKey: keys.booking(booking.id) });
        }
      },
    });
  }, [phase, flightId, booking, queryClient]);

  // Pago aprobado: la reserva queda confirmada y se pasa al boleto.
  const confirmedId = phase === "confirmed" ? order?.id : undefined;
  useEffect(() => {
    if (!confirmedId) return;
    useWizard.getState().confirm(confirmedId);
    navigate("/confirmation");
  }, [confirmedId, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current || !booking) return;
    if (method !== "card") return;
    const found = validateCard({ number, name, exp, cvv });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    sending.current = true;
    setError(null);
    // Una sola clave por intento de pago: un reintento tras un corte de red no cobra dos veces.
    const key = paymentKey ?? crypto.randomUUID();
    if (!paymentKey) wizard.setPaymentKey(key);
    const [month, year] = exp.split("/") as [string, string];
    try {
      await requestPayment(
        booking.id,
        booking.token,
        {
          number: number.replace(/\s/g, ""),
          holderName: name.trim(),
          expMonth: Number(month),
          expYear: 2000 + Number(year),
          cvv,
        },
        key,
      );
      setNumber("");
      setCvv("");
      setSubmitted(true);
    } catch (err) {
      setError(err);
    } finally {
      sending.current = false;
    }
  };

  const restart = () => {
    wizard.dropBooking();
    navigate("/passengers");
  };

  const ft = flight ? flightTimes(flight) : null;
  const err = (key: keyof Errors) => {
    const e = errors[key];
    return e === "card"
      ? t("e.card")
      : e === "req"
        ? t("e.req")
        : e === "exp"
          ? t("e.exp")
          : e === "cvv"
            ? t("e.cvv")
            : "";
  };
  const field = (
    key: keyof Errors,
    cls: string,
    id: string,
    label: string,
    input: React.ReactNode,
  ) => (
    <div className={`field ${cls}${errors[key] ? " invalid" : ""}`} data-f={key}>
      <label htmlFor={id}>{label}</label>
      {input}
      <span className="err-msg">{err(key)}</span>
    </div>
  );
  const clear = (key: keyof Errors) => setErrors((x) => ({ ...x, [key]: undefined }));
  const total = order?.totalPriceUsd ?? 0;

  return (
    <Shell kind="co" step={4} title="lifex — Pago">
      <main id="main" className="co-main" style={{ paddingBottom: 60 }}>
        <div className="wrap">
          <Link className="back-link" to="/customize">
            <span>
              <Icon name="arrow-left" />
            </span>
            <span>{t("back")}</span>
          </Link>
          <h1 className="co-title">{t("title")}</h1>
          {phase === "rejected" ? (
            <div className="note warn" role="alert">
              <div>
                <b>{t("pay.rejected.h")}</b>
                <div>{t("pay.rejected.p")}</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
                  {t("pay.restart")}
                </button>
              </div>
            </div>
          ) : null}
          {phase === "expired" ? (
            <div className="note warn" role="alert">
              <div>
                <b>{t("pay.expired.h")}</b>
                <div>{t("pay.expired.p")}</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
                  {t("pay.restart")}
                </button>
              </div>
            </div>
          ) : null}
          {error ? <ErrorNotice error={error} /> : null}
          {current.isError ? (
            <ErrorNotice error={current.error} onRetry={() => void current.refetch()} />
          ) : null}
          <div className="pay-grid" style={{ marginTop: 24 }}>
            <form id="payForm" noValidate onSubmit={(e) => void submit(e)}>
              <div className="pay-methods">
                <label className="pay-method">
                  <div className="row">
                    <input
                      type="radio"
                      name="pm"
                      value="card"
                      checked={method === "card"}
                      onChange={() => setMethod("card")}
                    />
                    <span>{t("m.card")}</span>
                    <span className="logos" aria-hidden="true">
                      <span>VISA</span>
                      <span>MC</span>
                      <span>AMEX</span>
                    </span>
                  </div>
                  <div className="pay-detail">
                    <div className="form-grid">
                      {field(
                        "cn",
                        "c6",
                        "cn",
                        t("c.num"),
                        <input
                          id="cn"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="0000 0000 0000 0000"
                          value={number}
                          onChange={(e) => {
                            setNumber(
                              e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 16)
                                .replace(/(.{4})/g, "$1 ")
                                .trim(),
                            );
                            clear("cn");
                          }}
                        />,
                      )}
                      {field(
                        "cname",
                        "c6",
                        "cname",
                        t("c.name"),
                        <input
                          id="cname"
                          autoComplete="cc-name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            clear("cname");
                          }}
                        />,
                      )}
                      {field(
                        "cexp",
                        "c3",
                        "cexp",
                        t("c.exp"),
                        <input
                          id="cexp"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder={t("c.expph")}
                          value={exp}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                            clear("cexp");
                          }}
                        />,
                      )}
                      {field(
                        "ccvv",
                        "c3",
                        "ccvv",
                        t("c.cvv"),
                        <input
                          id="ccvv"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="123"
                          value={cvv}
                          onChange={(e) => {
                            setCvv(e.target.value);
                            clear("ccvv");
                          }}
                        />,
                      )}
                    </div>
                  </div>
                </label>
                <label className="pay-method" hidden={lang === "en"}>
                  <div className="row">
                    <input type="radio" name="pm" value="pse" disabled title={t("soon.short")} />
                    <span>{t("m.pse")}</span>
                    <span className="logos" aria-hidden="true">
                      <span>PSE</span>
                    </span>
                  </div>
                </label>
                <label className="pay-method">
                  <div className="row">
                    <input type="radio" name="pm" value="apple" disabled title={t("soon.short")} />
                    <span>Apple Pay</span>
                    <span className="logos" aria-hidden="true">
                      <span>Pay</span>
                    </span>
                  </div>
                </label>
              </div>
              <div className="note ok" style={{ margin: "18px 0" }}>
                <span>
                  <Icon name="lock" />
                </span>
                <span>{t("secure")}</span>
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                style={{ width: "100%" }}
                disabled={phase !== "form" || !order}
              >
                <span id="payBtn">
                  {phase === "processing" ? t("pay.processing") : t("pay", { total: money(total) })}
                </span>
              </button>
            </form>
            <aside className="order" aria-label="Resumen">
              <div className="panel">
                <h2>{t("o.h")}</h2>
                <dl id="lines">
                  {(
                    [
                      ["o.tickets", order?.flightPriceUsd ?? 0],
                      ["o.taxes", order?.taxesUsd ?? 0],
                      ["o.services", null],
                    ] as const
                  ).map(([key, usd]) => (
                    <div key={key}>
                      <dt>{t(key)}</dt>
                      <dd className="num" style={{ margin: 0 }}>
                        {/* El backend suma el equipaje al precio de tiquetes y no lo devuelve aparte. */}
                        {usd === null ? t("o.services.incl") : money(usd)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="total">
                  <div>
                    <small style={{ maxWidth: "none" }}>{t("o.total")}</small>
                    <b className="num" id="tot">
                      {money(total)}
                    </b>
                  </div>
                  <small>{t("o.incl")}</small>
                </div>
                <div className="sel">
                  <h3>{t("o.sel")}</h3>
                  <div id="mini">
                    {flight && ft ? (
                      <>
                        <small style={{ color: "var(--gray)", display: "block", marginBottom: 8 }}>
                          {t("o.out")} ·{" "}
                          {formatDate(flight.departureDate, lang, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </small>
                        <div className="mini-flight">
                          <span className="num">
                            {ft.dep}
                            <small>{flight.from.iataCode}</small>
                          </span>
                          <span style={{ color: "var(--red)" }}>
                            <Icon name="plane" />
                          </span>
                          <span className="num" style={{ textAlign: "right" }}>
                            {ft.arr}
                            <small>{flight.to.iataCode}</small>
                          </span>
                        </div>
                        {fareId ? <span className="badge">{fareLabel(fareId, t)}</span> : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </Shell>
  );
}

export function Payment() {
  return (
    <RequireStep step="payment">
      <PaymentContent />
    </RequireStep>
  );
}
