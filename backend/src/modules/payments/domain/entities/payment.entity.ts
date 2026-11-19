export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Lo único de la tarjeta que se guarda: marca y últimos 4 dígitos. Nunca el número completo. */
export interface CardSummary {
  brand: string;
  last4: string;
}

export function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "UNKNOWN";
}

/** Algoritmo de Luhn: detecta números de tarjeta mal digitados. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** Reduce un número de tarjeta a lo que se puede guardar. */
export function summarizeCard(number: string): CardSummary {
  const digits = number.replaceAll(/[\s-]/g, "");
  return { brand: detectCardBrand(digits), last4: digits.slice(-4) };
}

export interface PaymentSnapshot {
  id: string;
  status: PaymentStatus;
}
