import type { Bundle } from "./dictionary.ts";

/**
 * Textos que el prototipo no tenía (estados de error de la app conectada a la API).
 * Van aparte de `dictionary.ts`, que se mantiene idéntico al prototipo.
 */
export const extra: Bundle = {
  es: {
    "error.title": "No pudimos completar la acción",
    "error.network": "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.",
    "error.rateLimit": "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.",
    "error.generic": "Algo salió mal. Inténtalo de nuevo.",
    "error.retry": "Reintentar",
    "offers.date": "Precios por persona, impuestos incluidos, para el {date}.",
  },
  en: {
    "error.title": "We couldn't complete that",
    "error.network": "Can't reach the server. Check your connection and try again.",
    "error.rateLimit": "Too many attempts in a row. Wait a moment and try again.",
    "error.generic": "Something went wrong. Please try again.",
    "error.retry": "Retry",
    "offers.date": "Prices per person, taxes included, for {date}.",
  },
};
