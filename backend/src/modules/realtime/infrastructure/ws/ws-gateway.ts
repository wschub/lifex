import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type {
  RealtimeBroadcaster,
  RealtimeMessage,
} from "../../application/ports/realtime-broadcaster.ts";

export interface WsGatewayOptions {
  /** Ruta del endpoint WebSocket. */
  path?: string;
  /**
   * Decide si el cliente (con el JWT que presentó, si presentó alguno) puede suscribirse al tema.
   * Los temas públicos devuelven true sin mirar el token.
   */
  authorize(topic: string, token: string | undefined): Promise<boolean>;
  heartbeatMs?: number;
  onError?: (error: unknown) => void;
}

interface ClientState {
  token: string | undefined;
  topics: Set<string>;
  alive: boolean;
}

const TOPIC_PATTERN = /^(flight:[0-9a-f-]{36}|dashboard:[0-9a-f-]{36}|flights:search)$/i;
const MAX_TOPICS_PER_CLIENT = 20;

/**
 * Adaptador WebSocket (`ws`): registro manual de temas `Map<tema, Set<socket>>`, autenticación del
 * JWT en el upgrade (query `?token=`) y heartbeat ping/pong para limpiar conexiones muertas.
 *
 * Protocolo del cliente:  {"action":"subscribe","topic":"flight:<id>"}  /  {"action":"unsubscribe",...}
 * Mensajes del servidor:  {"type":"subscribed"|"error"|<EventName>, ...}
 */
export class WsGateway implements RealtimeBroadcaster {
  private readonly options: WsGatewayOptions;
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  private readonly topics = new Map<string, Set<WebSocket>>();
  private readonly clients = new Map<WebSocket, ClientState>();
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(options: WsGatewayOptions) {
    this.options = options;
  }

  attach(server: Server): void {
    const path = this.options.path ?? "/ws";
    server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== path) {
        socket.destroy();
        return;
      }
      const token = url.searchParams.get("token") ?? undefined;
      this.wss.handleUpgrade(request, socket, head, (ws) => this.onConnection(ws, token));
    });
    this.heartbeat = setInterval(() => this.sweep(), this.options.heartbeatMs ?? 30_000);
    this.heartbeat.unref();
  }

  publish(topic: string, message: RealtimeMessage): void {
    const subscribers = this.topics.get(topic);
    if (!subscribers) return;
    const payload = JSON.stringify(message);
    for (const socket of subscribers) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const socket of this.clients.keys()) socket.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  /** Para pruebas y métricas. */
  subscriberCount(topic: string): number {
    return this.topics.get(topic)?.size ?? 0;
  }

  private onConnection(ws: WebSocket, token: string | undefined): void {
    const state: ClientState = { token, topics: new Set(), alive: true };
    this.clients.set(ws, state);
    ws.on("pong", () => {
      state.alive = true;
    });
    ws.on("message", (raw) => {
      void this.onMessage(ws, state, raw.toString()).catch((error: unknown) => {
        this.options.onError?.(error);
      });
    });
    ws.on("close", () => this.drop(ws, state));
    ws.on("error", (error) => this.options.onError?.(error));
    this.send(ws, { type: "connected" });
  }

  private async onMessage(ws: WebSocket, state: ClientState, raw: string): Promise<void> {
    let message: { action?: unknown; topic?: unknown };
    try {
      message = JSON.parse(raw) as { action?: unknown; topic?: unknown };
    } catch {
      this.send(ws, { type: "error", code: "INVALID_JSON" });
      return;
    }
    const topic = message.topic;
    if (typeof topic !== "string" || !TOPIC_PATTERN.test(topic)) {
      this.send(ws, { type: "error", code: "INVALID_TOPIC" });
      return;
    }
    if (message.action === "unsubscribe") {
      this.unsubscribe(ws, state, topic);
      this.send(ws, { type: "unsubscribed", topic });
      return;
    }
    if (message.action !== "subscribe") {
      this.send(ws, { type: "error", code: "INVALID_ACTION" });
      return;
    }
    if (state.topics.size >= MAX_TOPICS_PER_CLIENT) {
      this.send(ws, { type: "error", code: "TOO_MANY_TOPICS", topic });
      return;
    }
    if (!(await this.options.authorize(topic, state.token))) {
      this.send(ws, { type: "error", code: "FORBIDDEN", topic });
      return;
    }
    state.topics.add(topic);
    const subscribers = this.topics.get(topic) ?? new Set<WebSocket>();
    subscribers.add(ws);
    this.topics.set(topic, subscribers);
    this.send(ws, { type: "subscribed", topic });
  }

  private unsubscribe(ws: WebSocket, state: ClientState, topic: string): void {
    state.topics.delete(topic);
    const subscribers = this.topics.get(topic);
    subscribers?.delete(ws);
    if (subscribers?.size === 0) this.topics.delete(topic);
  }

  private drop(ws: WebSocket, state: ClientState): void {
    for (const topic of [...state.topics]) this.unsubscribe(ws, state, topic);
    this.clients.delete(ws);
  }

  private sweep(): void {
    for (const [ws, state] of this.clients) {
      if (!state.alive) {
        ws.terminate();
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }

  private send(ws: WebSocket, message: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }
}
