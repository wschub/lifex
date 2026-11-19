import type { Lang } from "@/i18n/dictionary.ts";

/**
 * Precio para mostrar: los montos de la API vienen siempre en USD.
 * Español → COP (USD × `iataTrm`), inglés → USD. Sin decimales.
 */
export function formatMoney(usd: number, lang: Lang, iataTrm: number): string {
  const isEn = lang === "en";
  const amount = Math.round(isEn ? usd : usd * iataTrm);
  const digits = new Intl.NumberFormat(isEn ? "en-US" : "es-CO", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${isEn ? "USD" : "COP"} ${digits}`;
}
