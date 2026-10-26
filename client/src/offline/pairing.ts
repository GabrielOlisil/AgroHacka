import { object, text } from "./types";

export function pairingCredential(value: string): string {
  const source = text(value, "código de pareamento");
  if (/^https?:/i.test(source))
    throw new Error("Use o código ou o QR Code gerado pelo gestor.");
  if (source.startsWith("{")) {
    try {
      return text(object(JSON.parse(source)).deviceToken, "token do QR Code");
    } catch {
      throw new Error("QR Code inválido. Use o código manual.");
    }
  }
  return source;
}
