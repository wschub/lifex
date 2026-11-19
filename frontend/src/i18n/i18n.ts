import { useMemo } from "react";
import { create } from "zustand";
import { common, pages, type Lang, type PageKey } from "./dictionary.ts";

export type { Lang } from "./dictionary.ts";

export const LANG_STORAGE_KEY = "lx-lang";

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

interface LangState {
  lang: Lang;
  setLang(lang: Lang): void;
}

/** El idioma es global: todos los componentes lo comparten y se recuerda entre visitas. */
export const useLangStore = create<LangState>((set) => ({
  lang: readStoredLang(),
  setLang(lang) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // almacenamiento bloqueado: el idioma vale solo para esta sesión
    }
    set({ lang });
  },
}));

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Busca la clave en los textos de la página, luego en los comunes y, si falta en el idioma activo,
 * en español; si no existe en ningún sitio devuelve la clave (igual que el prototipo).
 */
export function createTranslator(lang: Lang, page?: PageKey): TFunction {
  const own = page ? pages[page] : undefined;
  return (key, vars) => {
    let text: string | undefined =
      own?.[lang][key] ?? common[lang][key] ?? own?.es[key] ?? common.es[key];
    if (text === undefined) return key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  };
}

export function useLang(page?: PageKey): { lang: Lang; setLang(l: Lang): void; t: TFunction } {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = useMemo(() => createTranslator(lang, page), [lang, page]);
  return { lang, setLang, t };
}
