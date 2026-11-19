import { useEffect, useRef } from "react";

/**
 * Llama a `onExpire` cuando llega el instante `deadlineMs` (si ya pasó, de inmediato). Se compara con el
 * reloj cada segundo: también salta al volver a una pestaña dormida o a un equipo que estuvo suspendido.
 */
export function useDeadline({
  deadlineMs,
  enabled,
  onExpire,
  now = Date.now,
}: {
  deadlineMs: number | null;
  enabled: boolean;
  onExpire: () => void;
  now?: () => number;
}): void {
  const handler = useRef(onExpire);
  useEffect(() => {
    handler.current = onExpire;
  });

  useEffect(() => {
    if (!enabled || deadlineMs === null) return;
    if (now() >= deadlineMs) {
      handler.current();
      return;
    }
    const id = setInterval(() => {
      if (now() >= deadlineMs) {
        clearInterval(id);
        handler.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, deadlineMs, now]);
}
