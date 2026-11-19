import QRCode from "qrcode";
import type { QrCodeGenerator } from "../../application/ports/qr-code-generator.ts";

export class QrcodeGenerator implements QrCodeGenerator {
  png(text: string): Promise<Buffer> {
    return QRCode.toBuffer(text, { type: "png", width: 240, margin: 1, errorCorrectionLevel: "M" });
  }
}
