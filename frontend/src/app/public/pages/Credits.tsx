import { useLang } from "@/i18n/i18n.ts";
import { CREDITS_LIST_HTML } from "../credits-list.ts";
import { Shell } from "../shell/Shell.tsx";

export function Credits() {
  const { t } = useLang("credits");
  return (
    <Shell kind="site" title="lifex — Créditos de fotos">
      <main id="main" className="co-main" style={{ paddingBottom: 40 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h1 className="co-title">{t("h")}</h1>
          <p className="co-sub">{t("p")}</p>
          <ul className="credits-list" dangerouslySetInnerHTML={{ __html: CREDITS_LIST_HTML }} />
        </div>
      </main>
    </Shell>
  );
}
