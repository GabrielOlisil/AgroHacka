// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProductForm from "../src/components/ProductForm.vue";

async function fill(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[name="nome"]').setValue("  Mangueira  ");
  await wrapper.get('[name="categoria"]').setValue("Irrigação especial");
  await wrapper.get('[name="unidadeMedida"]').setValue("m");
}
describe("cadastro de insumos", () => {
  it.each(["", "0", "12.5"])(
    "preserva preço vazio como null e preço informado %s",
    async (price) => {
      const save = vi.fn().mockResolvedValue({ id: "p" });
      const wrapper = mount(ProductForm, {
        props: { categories: ["Sementes"], save },
      });
      await fill(wrapper);
      await wrapper.get('[name="precoAquisicao"]').setValue(price);
      await wrapper.get('[name="lote"]').setValue("A-1");
      await wrapper.get('[name="fornecedor"]').setValue("Loja rural");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
          nome: "Mangueira",
          categoria: "Irrigação especial",
          unidadeMedida: "m",
          estoqueMinimo: 0,
          precoAquisicao: price === "" ? null : Number(price),
          validade: null,
          lote: "A-1",
          fornecedor: "Loja rural",
        }),
      );
      expect(wrapper.emitted("saved")).toHaveLength(1);
      wrapper.unmount();
    },
  );
  it("mantém o mesmo UUID e conteúdo após falha de conexão e impede clique duplo", async () => {
    let fail!: (reason: Error) => void;
    const save = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      )
      .mockResolvedValue({ id: "p" });
    const wrapper = mount(ProductForm, { props: { categories: [], save } });
    await fill(wrapper);
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(save).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    fail(new TypeError("Failed to fetch"));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Sem internet no momento",
    );
    expect(wrapper.emitted("saved")).toBeUndefined();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0]);
    expect(wrapper.emitted("saved")).toHaveLength(1);
    wrapper.unmount();
  });
  it.each([
    ["nome", ""],
    ["nome", "   "],
    ["categoria", ""],
    ["unidadeMedida", ""],
    ["estoqueMinimo", ""],
    ["estoqueMinimo", "-1"],
    ["precoAquisicao", "-2"],
  ])("não envia campo inválido %s=%s", async (field, value) => {
    const save = vi.fn();
    const wrapper = mount(ProductForm, { props: { categories: [], save } });
    await fill(wrapper);
    await wrapper.get(`[name="${field}"]`).setValue(value);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/inválid|preencha/i);
    wrapper.unmount();
  });
  it("aceita validade e mantém informações opcionais ausentes", async () => {
    const save = vi.fn().mockResolvedValue({ id: "p" });
    const wrapper = mount(ProductForm, { props: { categories: [], save } });
    await fill(wrapper);
    await wrapper.get('[name="validade"]').setValue("2027-05-01");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save.mock.calls[0]![0].validade).toBe("2027-05-01");
    expect(save.mock.calls[0]![0].lote).toBeUndefined();
    expect(save.mock.calls[0]![0].fornecedor).toBeUndefined();
    wrapper.unmount();
  });
  it("tocar em qualquer parte do campo Validade abre o calendário", async () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker,
    });
    const wrapper = mount(ProductForm, { props: { categories: [], save: vi.fn() } });
    await wrapper.get('[name="validade"]').trigger("click");
    expect(showPicker).toHaveBeenCalledTimes(1);
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", { configurable: true, value: undefined });
    wrapper.unmount();
  });
});
