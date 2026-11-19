import { useEffect, useRef } from "react";

/** Eventos que cuentan como actividad del usuario en cualquier sección del sitio. */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

/**
 * Llama a `onIdle` cuando pasan `timeoutMs` sin actividad (ratón, teclado, desplazamiento o toque).
 * Compara marcas de tiempo cada segundo en vez de confiar en un solo temporizador, así también detecta la
 * inactividad si el navegador ralentiza los temporizadores de una pestaña en segundo plano.
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
    const mark = () => {
      lastActivity = now();
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, mark, { passive: true, capture: true });
    }
    const id = setInterval(() => {
      if (now() - lastActivity >= timeoutMs) {
        clearInterval(id);
        handler.current();
      }
    }, 1000);
    return () => {
      clearInterval(id);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark, { capture: true });
    };
  }, [enabled, timeoutMs, now]);
}
