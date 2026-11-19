import { randomInt } from "node:crypto";
import { AppError } from "../../../../shared/errors/app-error.ts";

export type TicketSeatClass = "ECONOMY" | "BUSINESS";

export interface LuggageOption {
  id: number;
  feePercentage: number;
  /** Business Classic y Business Flex solo se pueden elegir con un asiento BUSINESS. */
  businessOnly: boolean;
}

/** Regla de negocio, validada en el dominio y no solo en el front. */
export function assertLuggageAllowed(option: LuggageOption, seatClass: TicketSeatClass): void {
  if (option.businessOnly && seatClass !== "BUSINESS") {
    throw new AppError("validation", {
      code: "LUGGAGE_NOT_ALLOWED",
      details: { luggageTypeId: option.id, seatClass },
    });
  }
}

export interface NewTicket {
  ticketCode: string;
  passengerId: string;
  seatId: string;
  luggage: { luggageTypeId: number; feeAppliedPercentage: number }[];
}

/** Sin caracteres ambiguos (0/O, 1/I): el código se lee en voz alta y se teclea en el mostrador. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

export function generateTicketCode(): string {
  let code = "LX";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export interface TicketIssueInput {
  passengerId: string;
  seatId: string;
  seatClass: TicketSeatClass;
  luggage?: LuggageOption | undefined;
}

export const Ticket = {
  /** Único camino para emitir un ticket nuevo: valida el equipaje contra la clase del asiento. */
  issue(input: TicketIssueInput): NewTicket {
    const luggage: NewTicket["luggage"] = [];
    if (input.luggage) {
      assertLuggageAllowed(input.luggage, input.seatClass);
      luggage.push({
        luggageTypeId: input.luggage.id,
        feeAppliedPercentage: input.luggage.feePercentage,
      });
    }
    return {
      ticketCode: generateTicketCode(),
      passengerId: input.passengerId,
      seatId: input.seatId,
      luggage,
    };
  },
};
