import { Link } from "react-router";
import { formatDate } from "@/lib/dates.ts";
import { formatMoney } from "@/lib/money.ts";
import { useLang } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { Icon } from "./Icon.tsx";
import { fareLabel } from "../fares.ts";

interface SummaryBarProps {
  /** Total en USD con impuestos. */
  totalUsd: number;
  /** Ruta del paso anterior (botón "Volver"). */
  backTo?: string;
  /** Clave i18n del botón principal (por defecto "continue"). */
  label?: string;
  ready?: boolean;
  onNext: () => void;
  onBlocked?: () => void;
}

/** Barra fija inferior del checkout: ruta, pasajeros, total acumulado y acciones. */
export function SummaryBar({
  totalUsd,
  backTo,
  label = "continue",
  ready = true,
  onNext,
  onBlocked,
}: SummaryBarProps) {
  const { lang, t } = useLang();
  const { search, fareId } = useWizard();
  const config = usePublicConfig();
  return (
    <div className="summary-bar" id="summary">
      <div className="wrap">
        <div className="sb-route">
          <b>
            {search.from}
            <Icon name="arrow" />
            {search.to}
          </b>
          <small>
            {formatDate(`${search.date}T12:00:00Z`, lang, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </small>
        </div>
        <div className="sb-pax">
          <b>
            {search.pax} {t(search.pax > 1 ? "adults" : "adult")}
          </b>
          <small>{fareId ? fareLabel(fareId, t) : ""}</small>
        </div>
        <div className="sb-total">
          <b className="price">{formatMoney(totalUsd, lang, config.iataTrm)}</b>
          <small>{t("total.res")}</small>
        </div>
        <div className="sb-actions">
          {backTo ? (
            <Link className="btn btn-ghost" to={backTo}>
              {t("back")}
            </Link>
          ) : null}
          <button
            className="btn btn-dark"
            id="sb-next"
            type="button"
            aria-disabled={ready ? undefined : true}
            onClick={() => (ready ? onNext() : onBlocked?.())}
          >
            {t(label)}
          </button>
        </div>
      </div>
    </div>
  );
}
