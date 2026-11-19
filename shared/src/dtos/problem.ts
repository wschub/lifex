import { z } from "zod";

/** Cuerpo de todo error de la API (RFC 9457, "problem details"). `code` es estable; `detail` viene traducido. */
export const problemSchema = z.object({
  type: z.literal("about:blank"),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string(),
  errors: z.array(z.object({ field: z.string(), code: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;
