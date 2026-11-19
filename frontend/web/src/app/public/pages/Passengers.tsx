import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { startBooking } from "@/api/bookings.ts";
import { countriesQuery } from "@/api/queries.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang, type TFunction } from "@/i18n/i18n.ts";
import { useWizard, type HolderForm, type PassengerForm } from "@/stores/booking-wizard.ts";
import { RequireStep } from "../guards.tsx";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { farePriceUsd } from "../fares.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import {
  validateHolder,
  validatePassenger,
  type HolderErrors,
  type PassengerErrors,
} from "../passenger-validation.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";
import { SummaryBar } from "../shell/SummaryBar.tsx";

const PREFIXES = ["+57", "+1", "+34", "+44", "+52", "+51", "+54", "+55", "+56", "+58"];
const DOC_TYPES = ["CC", "CE", "TI", "PASSPORT"] as const;

interface FieldProps {
  cls: string;
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
}
function Field({ cls, id, label, error, children }: FieldProps) {
  return (
    <div className={`field ${cls}${error ? " invalid" : ""}`} data-f={id}>
      <label htmlFor={id}>{label}</label>
      {children}
      <span className="err-msg">{error ?? ""}</span>
    </div>
  );
}

interface AccordionProps {
  index: number | "h";
  open: boolean;
  valid: boolean;
  title: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}
function Accordion({ index, open, valid, title, onToggle, children }: AccordionProps) {
  return (
    <section className={`acc${open ? " open" : ""}${valid ? " valid" : ""}`} data-i={index}>
      <button className="acc-head" type="button" aria-expanded={open} onClick={onToggle}>
        {title}
        <span className="done-mark">
          <Icon name="check" />
        </span>
        <span className="chev">
          <Icon name="chev" />
        </span>
      </button>
      <div className="acc-body">{children}</div>
    </section>
  );
}

interface PassengerFormProps {
  index: number;
  saved: PassengerForm | undefined;
  onValid: (p: PassengerForm) => void;
  register: (submit: () => void) => void | (() => void);
}
function PassengerFields({ index, saved, onValid, register }: PassengerFormProps) {
  const { lang, t } = useLang("passengers");
  const countries = useQuery(countriesQuery());
  const [g, setG] = useState<"m" | "f">(saved?.g ?? "m");
  const [first, setFirst] = useState(saved?.first ?? "");
  const [last, setLast] = useState(saved?.last ?? "");
  const [dd, setDd] = useState(saved?.dd ?? 0);
  const [dm, setDm] = useState(saved?.dm ?? 0);
  const [dy, setDy] = useState(saved?.dy ?? 0);
  const [nat, setNat] = useState(saved?.nat ?? "");
  const [docType, setDocType] = useState<PassengerForm["docType"]>(saved?.docType ?? "CC");
  const [docNumber, setDocNumber] = useState(saved?.docNumber ?? "");
  const [hasLx, setHasLx] = useState(saved?.hasLx ?? false);
  const [lx, setLx] = useState(saved?.lx ?? "");
  const [assist, setAssist] = useState(saved?.assist ?? false);
  const [errors, setErrors] = useState<PassengerErrors>({});

  const months = t("months").split(",");
  const maxYear = new Date().getFullYear() - 12;
  const years = Array.from({ length: maxYear - 1930 + 1 }, (_, i) => maxYear - i);
  const options = [...(countries.data?.countries ?? [])].sort((a, b) =>
    a.isoCode === "CO"
      ? -1
      : b.isoCode === "CO"
        ? 1
        : (lang === "es" ? a.nameEs : a.name).localeCompare(lang === "es" ? b.nameEs : b.name),
  );
  const msg = (e: PassengerErrors[keyof PassengerErrors]) =>
    e === "req"
      ? t("e.req")
      : e === "dob"
        ? t("e.dob")
        : e === "name"
          ? t("e.name")
          : e === "docFormat"
            ? t("e.doc")
            : undefined;

  const submit = () => {
    const found = validatePassenger({ first, last, dd, dm, dy, nat, docType, docNumber });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onValid({
      ok: true,
      g,
      first: first.trim(),
      last: last.trim(),
      dd,
      dm,
      dy,
      nat,
      docType,
      docNumber: docNumber.trim(),
      hasLx,
      lx,
      assist,
    });
  };
  useEffect(() => register(submit));
  const clear = (key: keyof PassengerErrors) => setErrors((e) => ({ ...e, [key]: undefined }));
  const i = index;

  return (
    <form
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="form-grid">
        <Field cls="c2" id={`g${i}`} label={t("gender")}>
          <select id={`g${i}`} value={g} onChange={(e) => setG(e.target.value as "m" | "f")}>
            <option value="m">{t("g.m")}</option>
            <option value="f">{t("g.f")}</option>
          </select>
        </Field>
        <Field cls="c2" id={`n${i}`} label={t("names")} error={msg(errors.first)}>
          <input
            id={`n${i}`}
            autoComplete="given-name"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              clear("first");
            }}
          />
        </Field>
        <Field cls="c2" id={`l${i}`} label={t("last")} error={msg(errors.last)}>
          <input
            id={`l${i}`}
            autoComplete="family-name"
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              clear("last");
            }}
          />
        </Field>
        <div className={`field c4${errors.dob ? " invalid" : ""}`} data-f={`dob${i}`}>
          <label>{t("dob")}</label>
          <div className="dob">
            <select
              aria-label={t("day")}
              id={`dd${i}`}
              value={dd || ""}
              onChange={(e) => {
                setDd(Number(e.target.value));
                clear("dob");
              }}
            >
              <option value="">{t("day")}</option>
              {Array.from({ length: 31 }, (_, k) => k + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              aria-label={t("month")}
              id={`dm${i}`}
              value={dm || ""}
              onChange={(e) => {
                setDm(Number(e.target.value));
                clear("dob");
              }}
            >
              <option value="">{t("month")}</option>
              {months.map((m, j) => (
                <option key={m} value={j + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label={t("year")}
              id={`dy${i}`}
              value={dy || ""}
              onChange={(e) => {
                setDy(Number(e.target.value));
                clear("dob");
              }}
            >
              <option value="">{t("year")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <span className="err-msg">{msg(errors.dob) ?? ""}</span>
        </div>
        <Field cls="c2" id={`nat${i}`} label={t("nat")} error={msg(errors.nat)}>
          <select
            id={`nat${i}`}
            value={nat}
            onChange={(e) => {
              setNat(e.target.value);
              clear("nat");
            }}
          >
            <option value="">{t("nat.ph")}</option>
            {options.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {lang === "es" ? c.nameEs : c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field cls="c2" id={`dt${i}`} label={t("doc.type")}>
          <select
            id={`dt${i}`}
            value={docType}
            onChange={(e) => setDocType(e.target.value as PassengerForm["docType"])}
          >
            {DOC_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`doc.${d}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field cls="c4" id={`dn${i}`} label={t("doc.number")} error={msg(errors.doc)}>
          <input
            id={`dn${i}`}
            autoComplete="off"
            value={docNumber}
            onChange={(e) => {
              setDocNumber(e.target.value);
              clear("doc");
            }}
          />
        </Field>
        <div className="c6">
          <label className="check">
            <input
              type="checkbox"
              id={`hl${i}`}
              checked={hasLx}
              onChange={(e) => setHasLx(e.target.checked)}
            />
            <span>{t("hasLx")}</span>
          </label>
        </div>
        <div className="field c3" data-f={`lx${i}`} style={{ display: hasLx ? "" : "none" }}>
          <label htmlFor={`lx${i}`}>{t("lxNo")}</label>
          <input
            id={`lx${i}`}
            inputMode="numeric"
            value={lx}
            onChange={(e) => setLx(e.target.value)}
          />
          <span className="err-msg" />
        </div>
        <div className="c6">
          <label className="switch">
            <input
              type="checkbox"
              id={`as${i}`}
              checked={assist}
              onChange={(e) => setAssist(e.target.checked)}
            />
            <span>{t("assist")}</span>
          </label>
        </div>
      </div>
      <div className="form-actions">
        <span />
        <button className="btn btn-ghost" type="submit" data-submit>
          {t("next")}
        </button>
      </div>
    </form>
  );
}

interface HolderFormProps {
  saved: HolderForm | null;
  passengers: PassengerForm[];
  count: number;
  t: TFunction;
  onValid: (h: HolderForm) => void;
  register: (submit: () => void) => void | (() => void);
}
function HolderFields({ saved, passengers, count, t, onValid, register }: HolderFormProps) {
  const [p, setP] = useState(saved?.p ?? 0);
  const [pre, setPre] = useState(saved?.pre ?? "+57");
  const [ph, setPh] = useState(saved?.ph ?? "");
  const [em, setEm] = useState(saved?.em ?? "");
  const [em2, setEm2] = useState(saved?.em2 ?? "");
  const [c1, setC1] = useState(saved?.c1 ?? false);
  const [c2, setC2] = useState(saved?.c2 ?? false);
  const [errors, setErrors] = useState<HolderErrors>({});
  const msg = (e: HolderErrors[keyof HolderErrors]) =>
    e === "req"
      ? t("e.req")
      : e === "phone"
        ? t("e.phone")
        : e === "mail"
          ? t("e.mail")
          : e === "mail2"
            ? t("e.mail2")
            : undefined;

  const submit = () => {
    const found = validateHolder({ ph, em, em2, c1 });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onValid({
      ok: true,
      p,
      pre,
      ph: ph.replace(/[\s-]/g, ""),
      em: em.trim(),
      em2: em2.trim(),
      c1,
      c2,
    });
  };
  useEffect(() => register(submit));
  const clear = (key: keyof HolderErrors) => setErrors((e) => ({ ...e, [key]: undefined }));

  return (
    <>
      <p>{t("holder.p")}</p>
      <form
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="form-grid">
          <Field cls="c6" id="hp" label={t("pax")}>
            <select id="hp" value={p} onChange={(e) => setP(Number(e.target.value))}>
              {Array.from({ length: count }, (_, i) => (
                <option key={i} value={i}>
                  {passengers[i]?.ok
                    ? `${passengers[i]!.first} ${passengers[i]!.last}`
                    : t("adult.n", { n: i + 1 })}
                </option>
              ))}
            </select>
          </Field>
          <Field cls="c2" id="pre" label={t("prefix")}>
            <select id="pre" value={pre} onChange={(e) => setPre(e.target.value)}>
              {PREFIXES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field cls="c4" id="ph" label={t("phone")} error={msg(errors.ph)}>
            <input
              id="ph"
              inputMode="tel"
              autoComplete="tel-national"
              value={ph}
              onChange={(e) => {
                setPh(e.target.value);
                clear("ph");
              }}
            />
          </Field>
          <Field cls="c3" id="em" label={t("email")} error={msg(errors.em)}>
            <input
              id="em"
              type="email"
              autoComplete="email"
              value={em}
              onChange={(e) => {
                setEm(e.target.value);
                clear("em");
              }}
            />
          </Field>
          <Field cls="c3" id="em2" label={t("email2")} error={msg(errors.em2)}>
            <input
              id="em2"
              type="email"
              value={em2}
              onChange={(e) => {
                setEm2(e.target.value);
                clear("em2");
              }}
            />
          </Field>
          <div className="c6">
            <label className="check">
              <input
                type="checkbox"
                id="c1"
                checked={c1}
                onChange={(e) => {
                  setC1(e.target.checked);
                  clear("c1");
                }}
              />
              <span>{t("c1")}</span>
            </label>
            <span className="err-msg" id="c1e" style={{ marginLeft: 32 }}>
              {errors.c1 ? t("e.c1") : ""}
            </span>
          </div>
          <div className="c6">
            <label className="check">
              <input
                type="checkbox"
                id="c2"
                checked={c2}
                onChange={(e) => setC2(e.target.checked)}
              />
              <span>{t("c2")}</span>
            </label>
          </div>
        </div>
        <div className="form-actions">
          <span />
          <button className="btn btn-ghost" type="submit" data-submit>
            {t("next")}
          </button>
        </div>
      </form>
    </>
  );
}

function PassengersContent() {
  const { t } = useLang("passengers");
  const navigate = useNavigate();
  const config = usePublicConfig();
  const wizard = useWizard();
  const { search, flightId, booking } = wizard;
  const { flight, fare } = useSelectedFlight();
  const count = search.pax;

  const [pax, setPax] = useState<PassengerForm[]>(wizard.passengers.slice(0, count));
  const [holder, setHolder] = useState<HolderForm | null>(wizard.holder);
  const [open, setOpen] = useState<number | "h" | null>(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const locked = useRef(false);
  const submitters = useRef<Record<string, () => void>>({});

  const allOk = Array.from({ length: count }, (_, i) => pax[i]?.ok).every(Boolean) && !!holder?.ok;
  const unit = flight && fare ? farePriceUsd(fare, flight, config.taxPercentage) : 0;

  const savePassenger = (i: number, p: PassengerForm) => {
    const next = [...pax];
    next[i] = p;
    setPax(next);
    wizard.setPassengers(next);
    setOpen(i + 1 < count ? i + 1 : "h");
  };
  const saveHolder = (h: HolderForm) => {
    setHolder(h);
    wizard.setHolder(h);
    setOpen(null);
  };

  const onBlocked = () => {
    const target = Array.from({ length: count }, (_, i) => i).find((i) => !pax[i]?.ok);
    const key = target !== undefined ? String(target) : "h";
    setOpen(target !== undefined ? target : "h");
    submitters.current[key]?.();
  };

  const next = async () => {
    if (!holder || !flightId || locked.current) return;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      const contactPhone = `${holder.pre}${holder.ph}`;
      const same =
        booking && booking.contactEmail === holder.em && booking.contactPhone === contactPhone;
      if (!same) {
        // El contacto de una reserva abierta no se puede editar: si cambió, se abre otra y se sueltan los asientos.
        const started = await startBooking({ flightId, contactEmail: holder.em, contactPhone });
        wizard.setSeats([]);
        wizard.attachBooking({
          id: started.booking.id,
          token: started.token,
          expiresAt: started.booking.expiresAt,
          contactEmail: holder.em,
          contactPhone,
        });
      }
      navigate("/customize");
    } catch (e) {
      setError(e);
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return (
    <Shell
      kind="co"
      step={2}
      title="lifex — Pasajeros"
      bar={
        <SummaryBar
          totalUsd={unit * count}
          backTo="/summary"
          ready={allOk && !pending}
          onNext={() => void next()}
          onBlocked={onBlocked}
        />
      }
    >
      <main id="main" className="co-main">
        <div className="wrap" style={{ maxWidth: 1000 }}>
          <h1 className="co-title">{t("title")}</h1>
          <div className="note info" style={{ margin: "18px 0 22px" }}>
            <span>
              <Icon name="info" />
            </span>
            <span>{t("hint")}</span>
          </div>
          {error ? <ErrorNotice error={error} onRetry={() => void next()} /> : null}
          <div className="stack" id="forms">
            {Array.from({ length: count }, (_, i) => {
              const d = pax[i];
              return (
                <Accordion
                  key={i}
                  index={i}
                  open={open === i}
                  valid={!!d?.ok}
                  onToggle={() => setOpen(open === i ? null : i)}
                  title={
                    <>
                      {t("adult.n", { n: i + 1 })}
                      {d?.ok ? (
                        <b style={{ fontWeight: 500, marginLeft: 6 }}>
                          {" "}
                          {d.first} {d.last}
                        </b>
                      ) : null}
                    </>
                  }
                >
                  <PassengerFields
                    index={i}
                    saved={d}
                    onValid={(p) => savePassenger(i, p)}
                    register={(fn) => {
                      submitters.current[String(i)] = fn;
                    }}
                  />
                </Accordion>
              );
            })}
            <Accordion
              index="h"
              open={open === "h"}
              valid={!!holder?.ok}
              onToggle={() => setOpen(open === "h" ? null : "h")}
              title={t("holder")}
            >
              <HolderFields
                saved={holder}
                passengers={pax}
                count={count}
                t={t}
                onValid={saveHolder}
                register={(fn) => {
                  submitters.current.h = fn;
                }}
              />
            </Accordion>
          </div>
        </div>
      </main>
    </Shell>
  );
}

export function Passengers() {
  return (
    <RequireStep step="passengers">
      <PassengersContent />
    </RequireStep>
  );
}
