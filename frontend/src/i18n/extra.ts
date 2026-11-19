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
    "flight.soldOut": "Agotado",
    "flight.cancelled": "Cancelado",
    "flight.delayed": "Retrasado",
    "price.none": "Sin vuelos",
    "doc.type": "Tipo de documento*",
    "doc.number": "Número de documento*",
    "doc.CC": "Cédula de ciudadanía",
    "doc.CE": "Cédula de extranjería",
    "doc.TI": "Tarjeta de identidad",
    "doc.PASSPORT": "Pasaporte",
    "e.doc": "Revisa el número de documento (4 a 20 caracteres).",
    "e.name": "Usa solo letras.",
    "booking.error": "No pudimos abrir tu reserva.",
    "offers.date": "Precios por persona, impuestos incluidos, para el {date}.",
  },
  en: {
    "error.title": "We couldn't complete that",
    "error.network": "Can't reach the server. Check your connection and try again.",
    "error.rateLimit": "Too many attempts in a row. Wait a moment and try again.",
    "error.generic": "Something went wrong. Please try again.",
    "error.retry": "Retry",
    "flight.soldOut": "Sold out",
    "flight.cancelled": "Cancelled",
    "flight.delayed": "Delayed",
    "price.none": "No flights",
    "doc.type": "Document type*",
    "doc.number": "Document number*",
    "doc.CC": "National ID (CC)",
    "doc.CE": "Foreigner ID (CE)",
    "doc.TI": "Minor ID (TI)",
    "doc.PASSPORT": "Passport",
    "e.doc": "Check the document number (4 to 20 characters).",
    "e.name": "Use letters only.",
    "booking.error": "We couldn't open your booking.",
    "offers.date": "Prices per person, taxes included, for {date}.",
  },
};
