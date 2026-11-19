import { Link } from "react-router";
import { useLang } from "@/i18n/i18n.ts";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  if (compact) {
    return (
      <footer className="site-footer compact">
        <div className="wrap foot-note" style={{ marginTop: 0, border: 0, paddingTop: 0 }}>
          <span>{t("foot.copy")}</span>
          <span>{t("taxes.incl")}</span>
        </div>
      </footer>
    );
  }
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <img src="/logo/lifex-horizontal.svg" alt="lifex" />
            <p>{t("foot.tag")}</p>
          </div>
          <div>
            <h4>{t("foot.links")}</h4>
            <ul>
              <li>
                <a href="/#ofertas">{t("foot.dest")}</a>
              </li>
              <li>
                <Link to="/confirmation">{t("foot.manage")}</Link>
              </li>
              <li>
                <a href="#">{t("foot.checkin")}</a>
              </li>
              <li>
                <a href="#">{t("foot.bags")}</a>
              </li>
              <li>
                <a href="#">{t("foot.status")}</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>{t("foot.about")}</h4>
            <ul>
              <li>
                <a href="#">{t("foot.who")}</a>
              </li>
              <li>
                <a href="/#lifexperience">lifexperience</a>
              </li>
              <li>
                <a href="#">{t("foot.access")}</a>
              </li>
              <li>
                <Link to="/credits">{t("foot.credits")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>{t("foot.legal")}</h4>
            <ul>
              <li>
                <a href="#">{t("foot.privacy")}</a>
              </li>
              <li>
                <a href="#">{t("foot.contract")}</a>
              </li>
              <li>
                <a href="#">{t("foot.cookies")}</a>
              </li>
              <li>
                <a href="#">{t("foot.contact")}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-note">
          <span>{t("foot.copy")}</span>
          <span>{t("sample")}</span>
        </div>
      </div>
    </footer>
  );
}
