import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/money.ts";
import { useLang } from "@/i18n/i18n.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";

export type SessionReason = "idle" | "timeout";

/** Datos de la compra que se pierde, tomados justo antes de limpiarla. */
export interface SessionSummary {
  from: { name: string; nameEs: string; iata: string };
  to: { name: string; nameEs: string; iata: string };
  pax: number;
  reservationNumber?: string;
  totalUsd?: number;
}

interface Props {
  reason: SessionReason;
  /** Hay una compra en curso (se eligió un vuelo): cambia el texto de la inactividad. */
  hasPurchase: boolean;
  /** Minutos del plazo que venció (compra) o de la inactividad, según el motivo. */
  minutes: number;
  summary: SessionSummary | null;
  /** «Cerrar»: vuelve al inicio (con la compra descartada). */
  onClose: () => void;
  /** «Continuar»: con la inactividad deja al usuario donde estaba; con el tiempo agotado vuelve al inicio. */
  onContinue: () => void;
  /** Escape: lo no destructivo (con la inactividad, continuar; con el tiempo agotado, volver al inicio). */
  onEscape: () => void;
}

/**
 * Aviso de sesión inactiva o de tiempo de compra agotado. Centrado en pantalla (horizontal y vertical),
 * en el idioma actual, con foco atrapado y Escape. Con el tiempo de compra agotado la compra ya se descartó
 * antes de abrirlo; con la inactividad sigue intacta hasta que el usuario elija.
 */
export function SessionModal({
  reason,
  hasPurchase,
  minutes,
  summary,
  onClose,
  onContinue,
  onEscape,
}: Props) {
  const { lang, t } = useLang();
  const config = usePublicConfig();
  const primary = useRef<HTMLButtonElement>(null);
  const secondary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      } else if (event.key === "Tab") {
        // Solo hay dos botones: el foco no sale del modal.
        const first = secondary.current;
        const last = primary.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onEscape]);

  const key = reason === "idle" && !hasPurchase ? "idle.textNoPurchase" : `${reason}.text`;
  // Si el catálogo aún no estaba cargado, el nombre es el propio código y se muestra una sola vez.
  const place = (c: { name: string; nameEs: string; iata: string }) => {
    const name = lang === "es" ? c.nameEs : c.name;
    return name === c.iata ? c.iata : `${name} (${c.iata})`;
  };

  return createPortal(
    <div className="lx-overlay" role="presentation">
      <div
        className="lx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lxTitle"
        aria-describedby="lxText"
        data-reason={reason}
      >
        <div className="lx-head">
          <img className="lx-logo" src="/logo/lifex-reversed.svg" alt="lifex" />
        </div>
        <div className="lx-body">
          <span className="lx-badge">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2.5 18.5 17h-17L10 2.5Z" fill="#C8102E" />
              <path d="M10 8v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="10" cy="14.4" r="1" fill="#fff" />
            </svg>
            <span>{t(`session.${reason}.badge`)}</span>
          </span>
          <h2 className="lx-title" id="lxTitle">
            {t(`session.${reason}.title`)}
          </h2>
          <p
            className="lx-text"
            id="lxText"
            dangerouslySetInnerHTML={{ __html: t(`session.${key}`, { minutes }) }}
          />
          {summary && (
            <div className="lx-res">
              {summary.reservationNumber && (
                <div>
                  <small>{t("session.code")}</small>
                  <div className="lx-code">{summary.reservationNumber}</div>
                </div>
              )}
              <div className="lx-route">
                <span>{place(summary.from)}</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2 8h11M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{place(summary.to)}</span>
              </div>
              <div className="lx-meta">
                <span>
                  {t("session.pax")} <b>{summary.pax}</b>
                </span>
                {summary.totalUsd !== undefined && (
                  <span>
                    {t("session.total")}{" "}
                    <b>{formatMoney(summary.totalUsd, lang, config.iataTrm)}</b>
                  </span>
                )}
              </div>
            </div>
          )}
          <p
            className="lx-time"
            dangerouslySetInnerHTML={{ __html: t(`session.${reason}.time`, { minutes }) }}
          />
        </div>
        <div className="lx-foot">
          <button ref={secondary} type="button" className="btn btn-ghost" onClick={onClose}>
            {t("session.close")}
          </button>
          <button ref={primary} type="button" className="btn btn-primary" onClick={onContinue}>
            {t("session.continue")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
