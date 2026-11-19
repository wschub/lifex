import { z } from "zod";
import { isValidDuration, parseDuration } from "../shared/duration.ts";

const postgresUrl = z.string().refine((value) => {
  if (!URL.canParse(value)) return false;
  return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
}, "must be a PostgreSQL connection URL");

const MAX_ACCESS_TOKEN_SECONDS = 24 * 60 * 60;
const MAX_REFRESH_TOKEN_SECONDS = 90 * 24 * 60 * 60;
const MAX_PASSWORD_RESET_SECONDS = 24 * 60 * 60;

/** Duración con unidad (30s, 50m, 1h, 7d) que se entrega ya convertida a segundos. */
function duration(fallback: string, maxSeconds: number) {
  return z.preprocess(
    (value) => value ?? fallback,
    z
      .string()
      .refine(isValidDuration, "must look like 30s, 50m, 1h or 7d")
      .transform(parseDuration)
      .refine((seconds) => seconds <= maxSeconds, "is too long"),
  );
}

/** Un origen es esquema + host (+ puerto), sin barra final ni ruta. */
function isOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}

/** URL http(s) completa de una página del front, por ejemplo la de cambio de contraseña. */
function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol);
}

function booleanFlag(fallback: "true" | "false") {
  return z.preprocess(
    (value) => value ?? fallback,
    z.enum(["true", "false"]).transform((value) => value === "true"),
  );
}

const originList = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : (value ?? []),
  z.array(z.string().refine(isOrigin, "must be an origin such as https://app.example.com")),
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: postgresUrl,
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "must be at least 32 characters")
    .refine((value) => !value.startsWith("change-me"), "must not be the example placeholder"),
  JWT_ISSUER: z.string().min(1).default("backend"),
  JWT_AUDIENCE: z.string().min(1).default("backend-api"),
  ACCESS_TOKEN_EXPIRATION_TIME: duration("60m", MAX_ACCESS_TOKEN_SECONDS),
  REFRESH_TOKEN_EXPIRATION_TIME: duration("7d", MAX_REFRESH_TOKEN_SECONDS),
  PASSWORD_RESET_EXPIRATION_TIME: duration("30m", MAX_PASSWORD_RESET_SECONDS),
  PASSWORD_RESET_URL: z
    .string()
    .refine(isHttpUrl, "must be an http(s) URL")
    .default("http://localhost:5173/reset-password"),
  PUBLIC_REGISTRATION: booleanFlag("true"),
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("strict"),
  CORS_ORIGINS: originList,
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // ── Dominio de reservas ──
  /** Minutos que dura el bloqueo temporal de un asiento. */
  MAX_SEAT_LOCK_TIME: z.coerce.number().int().min(1).max(120).default(15),
  /** Máximo de asientos que una misma sesión puede mantener bloqueados a la vez. */
  MAX_HELD_SEATS_PER_SESSION: z.coerce.number().int().min(1).max(20).default(6),
  /** Tasa de cambio USD→COP que el front usa para mostrar precios en español. */
  IATA_TRM: z.coerce.number().positive().default(3300),
  /** Vigencia del token de sesión de invitado (la reserva en curso). */
  BOOKING_TOKEN_EXPIRATION_TIME: duration("45m", MAX_ACCESS_TOKEN_SECONDS),
  /** Impuestos como porcentaje del precio del vuelo. */
  TAX_PERCENTAGE: z.coerce.number().min(0).max(100).default(19),
  /** Business parte de basePriceDefault × este multiplicador (precio dinámico). */
  BUSINESS_BASE_MULTIPLIER: z.coerce.number().min(1).max(20).default(3),
  /** Descuento fijo (%) de las ofertas; una oferta no acumula el precio dinámico. */
  OFFER_DISCOUNT_PERCENTAGE: z.coerce.number().min(0).max(100).default(15),
  /** Reintentos máximos de un evento del outbox antes de marcarlo FAILED. */
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  /** Correo: sin BREVO_API_KEY el envío solo se registra en el log. */
  BREVO_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  BREVO_SENDER_EMAIL: z.email().default("no-reply@lifex.test"),
  /** URL pública de esta API: los correos enlazan allí la imagen QR del ticket. */
  PUBLIC_API_URL: z
    .string()
    .refine(isHttpUrl, "must be an http(s) URL")
    .transform((value) => value.replace(/\/+$/, ""))
    .default("http://localhost:3000"),
  /** URL pública del frontend: los correos cargan allí el logo (`/mail/...`). */
  APP_URL: z
    .string()
    .refine(isHttpUrl, "must be an http(s) URL")
    .transform((value) => value.replace(/\/+$/, ""))
    .default("http://localhost:5173"),
  BREVO_SENDER_NAME: z.string().min(1).default("Lifex"),
  // start-stack:env-schema
});

/** Nombres de todas las variables que valida el esquema; .env.example debe documentar las mismas. */
export const ENV_VARIABLES: readonly string[] = Object.keys(schema.shape);

/** Las duraciones de los tokens están expresadas en segundos. */
export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  readonly variables: readonly string[];

  constructor(variables: readonly string[], reason?: string) {
    super(
      `Invalid or missing environment variables: ${variables.join(", ")}${reason ? ` (${reason})` : ""}`,
    );
    this.name = "EnvError";
    this.variables = variables;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvError(variables);
  }

  const env = result.data;
  if (env.REFRESH_TOKEN_EXPIRATION_TIME <= env.ACCESS_TOKEN_EXPIRATION_TIME) {
    throw new EnvError(
      ["REFRESH_TOKEN_EXPIRATION_TIME"],
      "must be longer than ACCESS_TOKEN_EXPIRATION_TIME",
    );
  }
  if (env.COOKIE_SAME_SITE === "none" && env.NODE_ENV !== "production") {
    throw new EnvError(
      ["COOKIE_SAME_SITE"],
      "none requires NODE_ENV=production because the cookie must be Secure",
    );
  }
  return env;
}
