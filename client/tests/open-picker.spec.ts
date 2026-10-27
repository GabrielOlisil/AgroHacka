// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { openPicker } from "../src/open-picker";

// O ícone nativo (calendário/relógio) já abre o seletor sozinho em Chrome, Edge e
// Firefox. Chamar showPicker() por cima dele fechava o seletor (visto no Firefox).
function tap(offsetX: number, width = 200) {
  const input = document.createElement("input");
  input.type = "date";
  Object.defineProperty(input, "clientWidth", { value: width });
  const showPicker = vi.fn();
  Object.defineProperty(input, "showPicker", { value: showPicker });
  openPicker({ currentTarget: input, offsetX } as unknown as MouseEvent);
  return showPicker;
}

describe("abrir o seletor de data/hora ao tocar no campo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("toque no texto do campo abre o seletor", () => {
    expect(tap(20)).toHaveBeenCalledTimes(1);
    expect(tap(159)).toHaveBeenCalledTimes(1);
  });

  it("toque em cima do ícone nativo (últimos 40 px) fica com o navegador", () => {
    expect(tap(161)).not.toHaveBeenCalled();
    expect(tap(199)).not.toHaveBeenCalled();
  });

  it("sem largura conhecida, abre o seletor", () => {
    expect(tap(0, 0)).toHaveBeenCalledTimes(1);
  });
});
