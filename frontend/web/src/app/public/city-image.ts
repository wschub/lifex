import { useEffect, useState } from "react";

export const SKY_IMAGE = "/img/sky.jpg";

const FILE_NAME = /^[\w.-]+$/;

/**
 * La BD guarda solo el nombre del archivo (`cities.imageName`); las imágenes viven en
 * `public/img/destinations/`. Sin nombre válido se usa la imagen genérica del cielo.
 */
export function cityImageSrc(imageName: string | null | undefined): string {
  if (!imageName || !FILE_NAME.test(imageName) || imageName.includes("..")) return SKY_IMAGE;
  return `/img/destinations/${imageName}`;
}

/** `onError` de un `<img>` de ciudad: si el archivo aún no existe, muestra el cielo (sin bucle). */
export function fallbackToSky(event: { currentTarget: HTMLImageElement }): void {
  const img = event.currentTarget;
  if (img.getAttribute("src") !== SKY_IMAGE) img.setAttribute("src", SKY_IMAGE);
}

/** Para fondos CSS: precarga la imagen y cae al cielo si el archivo no existe. */
export function useImageOrSky(src: string): string {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (src === SKY_IMAGE) return;
    let alive = true;
    const probe = new Image();
    probe.onerror = () => {
      if (alive) setFailed(src);
    };
    probe.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return failed === src ? SKY_IMAGE : src;
}
