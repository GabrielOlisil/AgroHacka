import { describe, expect, it } from "vitest";
import { pairingCredential } from "../src/offline/pairing";

describe("pareamento por código ou QR", () => {
  it("aceita código manual sem depender de câmera e preserva tokens sensíveis a maiúsculas", () => {
    expect(pairingCredential(" agro-ab12 ")).toBe("agro-ab12");
    expect(pairingCredential("tok_aBc")).toBe("tok_aBc");
  });
  it("extrai somente o token do QR emitido pela API", () => {
    expect(
      pairingCredential(
        JSON.stringify({
          farmId: "f",
          deviceToken: "tok_abc",
          nomeOperador: "Ana",
        }),
      ),
    ).toBe("tok_abc");
  });
  it.each([
    "",
    " ",
    "{}",
    "{invalid",
    null,
    undefined,
    "https://site.example/token",
  ])("rejeita payload inválido %s", (value) => {
    expect(() => pairingCredential(value as never)).toThrow();
  });
});
