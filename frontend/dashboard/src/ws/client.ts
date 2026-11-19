import { serverMessageSchema, type FlightEvent, type Topic } from "@lifex/shared";

export interface WsHandlers {
  /** Evento de vuelo recibido en el tema. */
  onEvent?(event: FlightEvent): void;
  /** El servidor confirmó la suscripción (primera vez o tras reconectar): pedir el snapshot por REST. */
  onResync?(): void;
}

export interface WsClientOptions {
  /** JWT del staff, necesario para `dashboard:{id}`. */
  token?: string;
  /** Aviso global de resincronización, además del de cada suscripción. */
  onResync?(topic: Topic): void;
  /** Para pruebas. */
  WebSocketImpl?: typeof WebSocket;
}

export interface WsClient {
  subscribe(topic: Topic, handlers?: WsHandlers): () => void;
  close(): void;
}

const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;
const OPEN = 1;

/**
 * Cliente WebSocket con reconexión exponencial (500 ms → 8 s). Cada vez que el servidor confirma una
 * suscripción (`subscribed`) avisa con `onResync`, porque el socket solo no garantiza la entrega:
 * tras conectar o reconectar hay que volver a leer el snapshot y aplicar solo eventos con `version` mayor.
 */
export function createWsClient(url: string, options: WsClientOptions = {}): WsClient {
  const Impl = options.WebSocketImpl ?? WebSocket;
  const subscriptions = new Map<Topic, Set<WsHandlers>>();
  let socket: WebSocket | undefined;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const send = (message: { action: "subscribe" | "unsubscribe"; topic: Topic }) => {
    if (socket?.readyState === OPEN) socket.send(JSON.stringify(message));
  };

  const handle = (raw: unknown) => {
    if (typeof raw !== "string") return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = serverMessageSchema.safeParse(json);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === "subscribed") {
      options.onResync?.(message.topic);
      for (const h of [...(subscriptions.get(message.topic) ?? [])]) h.onResync?.();
    } else if ("flightId" in message) {
      for (const h of [...(subscriptions.get(message.topic) ?? [])]) h.onEvent?.(message);
    }
  };

  const connect = () => {
    const target = options.token ? `${url}?token=${encodeURIComponent(options.token)}` : url;
    const ws = new Impl(target);
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      for (const topic of subscriptions.keys()) send({ action: "subscribe", topic });
    };
    ws.onmessage = (event) => handle(event.data);
    ws.onclose = () => {
      if (socket === ws) socket = undefined;
      if (closed) return;
      const delay = Math.min(MIN_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
      attempt += 1;
      timer = setTimeout(connect, delay);
    };
  };

  return {
    subscribe(topic, handlers = {}) {
      if (closed) return () => {};
      let set = subscriptions.get(topic);
      if (!set) {
        set = new Set();
        subscriptions.set(topic, set);
        send({ action: "subscribe", topic });
      }
      set.add(handlers);
      if (!socket && timer === undefined) connect();
      return () => {
        const current = subscriptions.get(topic);
        if (!current?.delete(handlers)) return;
        if (current.size === 0) {
          subscriptions.delete(topic);
          send({ action: "unsubscribe", topic });
        }
      };
    },
    close() {
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      subscriptions.clear();
      socket?.close();
      socket = undefined;
    },
  };
}
