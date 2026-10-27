// O gestor é do Brasil: a tela usa (DD) 9XXXX-XXXX e a API recebe +55DD9XXXXXXXX.
const FORMAT_HINT =
  "Digite o DDD e o celular com 9 dígitos, por exemplo (69) 91234-1234.";

function localDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}

/** Formata enquanto a pessoa digita, aceitando também um número colado com +55. */
export function maskPhone(raw: string) {
  const d = localDigits(raw).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Em branco desativa os alertas; senão exige DDD + celular de 9 dígitos. */
export function toWhatsApp(raw: string) {
  const d = localDigits(raw);
  if (!d) return "";
  if (!/^[1-9][1-9]9\d{8}$/.test(d)) throw new Error(FORMAT_HINT);
  return `+55${d}`;
}

/** Mostra o número salvo sem o +55; números de outro país ficam como estão. */
export function formatPhone(stored: string | undefined) {
  if (!stored) return "";
  if (!stored.startsWith("+55")) return stored;
  const d = stored.slice(3);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return stored;
}
