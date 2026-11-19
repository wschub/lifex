import { useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n/i18n.ts";
import { Flag, Icon } from "./Icon.tsx";

/** Selector de idioma y moneda: bandera + "ES · COP" / "EN · USD" con menú de dos opciones. */
export function LangMenu() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && box.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={`lang${open ? " open" : ""}`} ref={box}>
      <button
        className="lang-btn"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("lang.label")}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag country={lang === "en" ? "us" : "co"} />
        <span>{lang === "en" ? "EN · USD" : "ES · COP"}</span>
        <Icon name="chev" className="chev" />
      </button>
      <div className="lang-menu" role="menu">
        <button
          type="button"
          role="menuitemradio"
          aria-checked={lang === "es"}
          onClick={() => {
            setLang("es");
            setOpen(false);
          }}
        >
          <Flag country="co" />
          {t("lang.es")}
          <small>COP</small>
        </button>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={lang === "en"}
          onClick={() => {
            setLang("en");
            setOpen(false);
          }}
        >
          <Flag country="us" />
          {t("lang.en")}
          <small>USD</small>
        </button>
      </div>
    </div>
  );
}
