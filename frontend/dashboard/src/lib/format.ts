const usd = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("es-CO");

/** Dinero en dólares: "USD 1.234,50". */
export const formatUsd = (value: number): string => `USD ${usd.format(value)}`;
/** Número entero con separador de miles: "14.498". */
export const formatInteger = (value: number): string => integer.format(value);
