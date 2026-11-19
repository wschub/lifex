import { z } from "zod";

export const requestPaymentSchema = z
  .object({
    card: z
      .object({
        number: z.string().max(25),
        holderName: z.string().max(100),
        expMonth: z.number().int(),
        expYear: z.number().int(),
        cvv: z.string().max(4),
      })
      .strict(),
  })
  .strict();
