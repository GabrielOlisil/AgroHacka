// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
import ProductForm from "../src/components/ProductForm.vue";
import { analyzeInventory } from "../src/offline/analysis";
import type { Product } from "../src/offline/types";

const ureia: Product = {
  id: "00000000-0000-4000-8000-000000000001",
  farmId: "f",
  nome: "Ureia 46%",
  categoria: "Fertilizantes",
  unidadeMedida: "kg",
  estoqueMinimo: 0,
  precoAquisicao: null,
  validade: null,
};
const calcario: Product = {
  ...ureia,
  id: "00000000-0000-4000-8000-000000000002",
  nome: "Calcário",
};

async function submitNew(existing: Product[], nome: string) {
  const save = vi.fn().mockResolvedValue(undefined);
  const wrapper = mount(ProductForm, {
    props: { categories: [], save, existing },
  });
  await wrapper.get('[name="nome"]').setValue(nome);
  await wrapper.get('[name="categoria"]').setValue("Adubos");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  return { wrapper, save };
}

describe("cadastro bloqueia nome de insumo existente", () => {
  it.each(["uréia 46 %", "UREIA 46%", " Ureia-46% "])(
    "não salva \"%s\" e diz qual insumo já existe",
    async (nome) => {
      const { wrapper, save } = await submitNew([ureia], nome);
      expect(save).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain(
        "Já existe o insumo “Ureia 46%” (kg)",
      );
      // O nome continua editável para corrigir.
      expect(
        wrapper.get('[name="nome"]').attributes("disabled"),
      ).toBeUndefined();
      await wrapper.get('[name="nome"]').setValue("Ureia granulada");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ nome: "Ureia granulada" }),
      );
      wrapper.unmount();
    },
  );

  it("orienta reativar quando o existente está desativado", async () => {
    const { wrapper, save } = await submitNew(
      [{ ...ureia, ativo: false }],
      "Ureia 46%",
    );
    expect(save).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("desativado");
    expect(wrapper.text()).toContain("Reative");
    wrapper.unmount();
  });

  it("sem catálogo ou com nome só parecido, salva normalmente", async () => {
    for (const [existing, nome] of [
      [[], "Ureia 46%"],
      [[ureia], "Ureia 46% granulada"],
    ] as const) {
      const { wrapper, save } = await submitNew([...existing], nome);
      expect(save).toHaveBeenCalledOnce();
      wrapper.unmount();
    }
  });

  it("na edição, recusa renomear para outro insumo mas aceita manter o próprio nome", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(ProductForm, {
      props: { categories: [], save, product: calcario, existing: [ureia, calcario] },
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save).toHaveBeenCalledOnce();
    await wrapper.get('[name="nome"]').setValue("ureia 46%");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="alert"]').text()).toContain("Já existe");
    wrapper.unmount();
  });

  it("deixa editar um duplicado antigo sem mudar o nome", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const antigo = { ...calcario, nome: "Uréia 46 %" };
    const wrapper = mount(ProductForm, {
      props: { categories: [], save, product: antigo, existing: [ureia, antigo] },
    });
    await wrapper.get('[name="estoqueMinimo"]').setValue(3);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});

describe("Novo insumo no app usa o catálogo da fazenda, incluindo desativados", () => {
  it("bloqueia o nome de um insumo desativado", async () => {
    const state = {
      ready: ref(true),
      session: ref({ role: "GESTOR", farmId: "f", farmNome: "Boa Vista", nome: "Ana" }),
      analysis: ref(analyzeInventory([calcario], [])),
      inactiveProducts: ref([{ ...ureia, ativo: false }]),
      movements: ref([]),
      pendingCount: ref(0),
      pendingIds: ref([]),
      reviews: ref([]),
      confirmedBalances: ref({}),
      lastSync: ref(null),
      error: ref(""),
      syncing: ref(false),
      backups: ref([]),
      operators: ref([]),
      operatorsLoading: ref(false),
      operatorsError: ref(""),
      initialize: vi.fn(),
      dispose: vi.fn(),
      loadOperators: vi.fn(),
      sync: vi.fn(),
      record: vi.fn(),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn(),
    };
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper
      .get('nav[aria-label="Navegação principal"]')
      .findAll("button")
      .find((b) => b.text() === "Estoque")!
      .trigger("click");
    await wrapper.get('[data-testid="new-product"]').trigger("click");
    await wrapper.get('[name="nome"]').setValue("ureia 46%");
    await wrapper.get('[name="categoria"]').setValue("Adubos");
    await wrapper.get(".product-form").trigger("submit");
    await flushPromises();
    expect(state.createProduct).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Já existe o insumo “Ureia 46%” (kg), desativado");
    wrapper.unmount();
  });
});
