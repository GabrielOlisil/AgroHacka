import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, toWhatsApp } from "../src/phone";

// O gestor é do Brasil: o campo mostra (DD) 9XXXX-XXXX e o app guarda +55 sozinho.
describe("número do WhatsApp no formato brasileiro", () => {
  it.each([
    ["", ""],
    ["6", "(6"],
    ["69", "(69"],
    ["699", "(69) 9"],
    ["6991234", "(69) 91234"],
    ["69912341", "(69) 91234-1"],
    ["69912341234", "(69) 91234-1234"],
    ["(69) 91234-1234", "(69) 91234-1234"],
    ["+55 69 91234-1234", "(69) 91234-1234"],
    ["699123412349999", "(69) 91234-1234"],
    ["abc", ""],
  ])("formata %j enquanto digita como %j", (raw, masked) => {
    expect(maskPhone(raw)).toBe(masked);
  });

  it.each([
    ["(69) 91234-1234", "+5569912341234"],
    ["69912341234", "+5569912341234"],
    ["+55 (69) 91234-1234", "+5569912341234"],
    ["", ""],
    ["   ", ""],
  ])("converte %j em %j para enviar", (raw, e164) => {
    expect(toWhatsApp(raw)).toBe(e164);
  });

  it.each([
    "(69) 1234-1234",
    "(69) 81234-1234",
    "(09) 91234-1234",
    "(60) 91234-1234",
    "91234-1234",
  ])("recusa %j com orientação em português", (raw) => {
    expect(() => toWhatsApp(raw)).toThrow(
      "Digite o DDD e o celular com 9 dígitos, por exemplo (69) 91234-1234.",
    );
  });

  it.each([
    ["+5569912341234", "(69) 91234-1234"],
    ["+556999999999", "(69) 9999-9999"],
    ["", ""],
    [undefined, ""],
    ["+14155550100", "+14155550100"],
  ])("mostra o número salvo %j como %j", (stored, shown) => {
    expect(formatPhone(stored)).toBe(shown);
  });
});
