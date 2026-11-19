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
