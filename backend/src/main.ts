import type { Server } from "node:http";
import { composeApp } from "./composition.ts";
import { type Env, EnvError, loadEnv } from "./config/env.ts";
import { startServer } from "./shared/http/start-server.ts";
import { scheduleEvery } from "./shared/scheduler.ts";

const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Libera los bloqueos de asientos vencidos (criterio: máximo 30 s tras la expiración). */
const SEAT_RELEASE_INTERVAL_MS = 30 * 1000;
/** El outbox se lee con frecuencia para que un evento llegue a los clientes en menos de 1 s. */
const OUTBOX_INTERVAL_MS = 300;

function readEnv(): Env {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const env = readEnv();
const composed = composeApp(env);
const {
  app,
  logger,
  shutdown,
  purgeExpiredTokens,
  purgeExpiredPasswordResets,
  realtime,
  processOutbox,
  releaseExpiredHolds,
} = composed;

let server: Server;
try {
  server = await startServer(app, env.PORT);
} catch (error) {
  logger.fatal({ err: error }, "could not start the server");
  process.exit(1);
}
realtime.attach(server);
logger.info({ port: env.PORT }, "API listening");

const cleanup = scheduleEvery(
  TOKEN_CLEANUP_INTERVAL_MS,
  async () => {
    const removed = await purgeExpiredTokens.execute();
    const removedResets = await purgeExpiredPasswordResets.execute();
    logger.info({ removed, removedResets }, "expired refresh tokens and password resets purged");
  },
  (error) => logger.error({ err: error }, "expired token cleanup failed"),
  { runImmediately: true },
);

const seatReleaser = scheduleEvery(
  SEAT_RELEASE_INTERVAL_MS,
  async () => {
    const released = await releaseExpiredHolds.execute();
    if (released > 0) logger.info({ released }, "expired seat holds released");
  },
  (error) => logger.error({ err: error }, "seat hold release failed"),
  { runImmediately: true },
);

const outboxWorker = scheduleEvery(
  OUTBOX_INTERVAL_MS,
  async () => {
    await processOutbox.execute();
  },
  (error) => logger.error({ err: error }, "outbox processing failed"),
  { runImmediately: true },
);

// start-stack:workers

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    cleanup.stop();
    seatReleaser.stop();
    outboxWorker.stop();
    // start-stack:stop
    void realtime.close();
    server.close(() => {
      void shutdown().finally(() => process.exit(0));
    });
  });
}
