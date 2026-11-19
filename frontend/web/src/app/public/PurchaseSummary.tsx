import type { PublicBooking } from "@lifex/shared";
import { useLang } from "@/i18n/i18n.ts";
import { formatMoney } from "@/lib/money.ts";
import { usePublicConfig } from "./hooks/usePublicConfig.ts";
import { purchaseLines } from "./purchase-lines.ts";

/** Líneas (`<dl>`) y total de la compra con los valores de la reserva; mismas clases que el panel `.order`. */
export function PurchaseSummary({ booking }: { booking: PublicBooking | null }) {
  const { lang, t } = useLang();
  const config = usePublicConfig();
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);
  const lines = booking
    ? purchaseLines(booking)
    : purchaseLines({ seatsPriceUsd: 0, luggagePriceUsd: 0, taxesUsd: 0, totalPriceUsd: 0 });
  return (
    <>
      <dl id="lines">
        {lines.map((line) => (
          <div key={line.key}>
            <dt>{t(line.key)}</dt>
            <dd className="num" style={{ margin: 0 }}>
              {money(line.usd)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="total">
        <div>
          <small style={{ maxWidth: "none" }}>{t("sum.total")}</small>
          <b className="num" id="tot">
            {money(booking?.totalPriceUsd ?? 0)}
          </b>
        </div>
        <small>{t("sum.incl")}</small>
      </div>
    </>
  );
}
