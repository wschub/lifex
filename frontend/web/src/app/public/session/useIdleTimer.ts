import { useEffect, useRef } from "react";

/** Eventos que cuentan como actividad del usuario (el movimiento del puntero se trata aparte). */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Llama a `onIdle` cuando pasan `timeoutMs` sin actividad (ratón, teclado, desplazamiento o toque).
 *  - Compara marcas de tiempo cada segundo (y al volver a la pestaña), en vez de confiar en un solo
 *    temporizador, que el navegador ralentiza en las pestañas en segundo plano.
 *  - El movimiento del puntero solo cuenta si cambió de posición: con el cursor quieto, el navegador genera
 *    eventos de movimiento cuando el contenido se anima o cambia debajo de él, y reiniciarían el reloj sin
 *    que el usuario haya hecho nada.
 * Con `enabled = false` no escucha nada; al volver a activarse, el reloj empieza de cero.
 */
export function useIdleTimer({
  timeoutMs,
  enabled,
  onIdle,
  now = Date.now,
}: {
  timeoutMs: number;
  enabled: boolean;
  onIdle: () => void;
  now?: () => number;
}): void {
  const handler = useRef(onIdle);
  useEffect(() => {
    handler.current = onIdle;
  });

  useEffect(() => {
    if (!enabled) return;
    let lastActivity = now();
    let lastX: number | undefined;
    let lastY: number | undefined;
    const mark = () => {
      lastActivity = now();
    };
    const onMove = (event: Event) => {
      const { clientX, clientY } = event as PointerEvent;
      if (clientX === lastX && clientY === lastY) return; // cursor quieto: no es actividad
      lastX = clientX;
      lastY = clientY;
      mark();
    };
    const check = () => {
      if (now() - lastActivity >= timeoutMs) {
        stop();
        handler.current();
      }
    };
    const id = setInterval(check, 1000);
    const stop = () => {
      clearInterval(id);
      window.removeEventListener("pointermove", onMove, { capture: true });
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark, { capture: true });
      document.removeEventListener("visibilitychange", check);
    };
    window.addEventListener("pointermove", onMove, { passive: true, capture: true });
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, mark, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", check);
    return stop;
  }, [enabled, timeoutMs, now]);
}
