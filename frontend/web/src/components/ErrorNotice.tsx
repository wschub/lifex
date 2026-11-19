import { isApiError } from "@/api/errors.ts";
import { useLang } from "@/i18n/i18n.ts";

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
}

/** Aviso de error con los estilos existentes del prototipo (`.note.warn`) y botón de reintento. */
export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const { t } = useLang();
  let message = t("error.generic");
  if (isApiError(error)) {
    if (error.code === "NETWORK") message = t("error.network");
    else if (error.status === 429) message = t("error.rateLimit");
    else if (error.problem) message = error.problem.detail;
  }
  return (
    <div className="note warn" role="alert">
      <div>
        <b>{t("error.title")}</b>
        <div>{message}</div>
        {onRetry ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            {t("error.retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
