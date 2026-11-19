import { wsUrl } from "@/api/config.ts";
import { createWsClient, type WsClient } from "./client.ts";

let instance: WsClient | undefined;

/** Un único socket público para toda la web (los temas de vuelos no exigen token). */
export function getWsClient(): WsClient {
  instance ??= createWsClient(wsUrl());
  return instance;
}
