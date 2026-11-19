/** Genera la imagen QR (PNG) de un texto. */
export interface QrCodeGenerator {
  png(text: string): Promise<Buffer>;
}
