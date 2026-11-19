import { AppError } from "../../../../shared/errors/app-error.ts";

export const DOCUMENT_TYPES = ["CC", "CE", "TI", "PASSPORT"] as const;
export const GENDERS = ["MASCULINO", "FEMENINO"] as const;
export type PassengerType = "ADULT" | "CHILD";

export interface PassengerInput {
  fullName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  gender: string;
  /** AAAA-MM-DD */
  dateBirth: string;
  nationalityCountryId: number;
  seatId: string;
  luggageTypeId?: number | undefined;
}

export interface Passenger {
  fullName: string;
  lastName: string;
  documentType: (typeof DOCUMENT_TYPES)[number];
  documentNumber: string;
  gender: (typeof GENDERS)[number];
  dateBirth: Date;
  nationalityCountryId: number;
  passengerType: PassengerType;
  seatId: string;
  luggageTypeId: number | null;
}

const CHILD_UNDER_YEARS = 12;
const NAME = /^[\p{L}][\p{L} '.-]{0,79}$/u;
const DOCUMENT_NUMBER = /^[A-Za-z0-9-]{4,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(field: string): AppError {
  return new AppError("validation", { code: "INVALID_PASSENGER", details: { field } });
}

function isOneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

function ageInYears(birth: Date, now: Date): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const Passenger = {
  /** Valida los datos de un pasajero y deriva si es adulto o niño. */
  create(input: PassengerInput, now: Date = new Date()): Passenger {
    const fullName = input.fullName.trim();
    const lastName = input.lastName.trim();
    if (!NAME.test(fullName)) throw invalid("fullName");
    if (!NAME.test(lastName)) throw invalid("lastName");
    if (!isOneOf(DOCUMENT_TYPES, input.documentType)) throw invalid("documentType");
    const documentNumber = input.documentNumber.trim();
    if (!DOCUMENT_NUMBER.test(documentNumber)) throw invalid("documentNumber");
    if (!isOneOf(GENDERS, input.gender)) throw invalid("gender");
    const dateBirth = new Date(`${input.dateBirth}T00:00:00Z`);
    if (!DATE.test(input.dateBirth) || Number.isNaN(dateBirth.getTime()) || dateBirth > now) {
      throw invalid("dateBirth");
    }
    const age = ageInYears(dateBirth, now);
    if (age > 120) throw invalid("dateBirth");
    return {
      fullName,
      lastName,
      documentType: input.documentType,
      documentNumber,
      gender: input.gender,
      dateBirth,
      nationalityCountryId: input.nationalityCountryId,
      passengerType: age < CHILD_UNDER_YEARS ? "CHILD" : "ADULT",
      seatId: input.seatId,
      luggageTypeId: input.luggageTypeId ?? null,
    };
  },
};
