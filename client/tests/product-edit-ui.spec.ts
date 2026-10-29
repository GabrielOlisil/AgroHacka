// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
import ProductForm from "../src/components/ProductForm.vue";
import { analyzeInventory } from "../src/offline/analysis";
import type { Product } from "../src/offline/types";

const D = "00000000-0000-4000-8000-000000000001";
const U = "00000000-0000-4000-8000-000000000002";
const U2 = "00000000-0000-4000-8000-000000000003";
const V = "00000000-0000-4000-8000-000000000004";
const diesel: Product = {
  id: D,
  farmId: "f",
  nome: "Diesel",
  categoria: "Combustíveis",
  unidadeMedida: "L",
  estoqueMinimo: 10,
  precoAquisicao: 6,
  validade: "2027-01-31T00:00:00.000Z",
  lote: "L-1",
  fornecedor: null,
};
// Cadastrado duas vezes, sem nenhuma movimentação.
const ureia: Product = {
  ...diesel,
  id: U,
  nome: "Uréia",
  categoria: "Fertilizantes",
  unidadeMedida: "kg",
  precoAquisicao: null,
  validade: null,
  lote: null,
};
const inativo: Product = { ...diesel, id: V, nome: "Adubo velho", ativo: false };

describe("formulário de insumo em modo de edição", () => {
  it("abre preenchido e salva o mesmo id, com opcionais vazios como null", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(ProductForm, {
      props: { categories: [], save, product: diesel },
    });
    expect(
      (wrapper.get('[name="nome"]').element as HTMLInputElement).value,
    ).toBe("Diesel");
    expect(
      (wrapper.get('[name="validade"]').element as HTMLInputElement).value,
    ).toBe("2027-01-31");
    expect(
      (wrapper.get('[name="lote"]').element as HTMLInputElement).value,
    ).toBe("L-1");
    await wrapper.get('[name="nome"]').setValue(" Óleo Diesel S10 ");
    await wrapper.get('[name="lote"]').setValue("");
    expect(wrapper.get('button[type="submit"]').text()).toContain(
      "Salvar alterações",
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(save).toHaveBeenCalledWith({
      id: D,
      nome: "Óleo Diesel S10",
      categoria: "Combustíveis",
      unidadeMedida: "L",
      estoqueMinimo: 10,
      precoAquisicao: 6,
      validade: "2027-01-31",
      lote: null,
      fornecedor: null,
    });
    expect(wrapper.emitted("saved")).toHaveLength(1);
    wrapper.unmount();
  });

  it("trava a unidade de insumo com movimentações e deixa tentar de novo após erro", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("Sem conexão"));
    const wrapper = mount(ProductForm, {
      props: { categories: [], save, product: diesel, lockUnit: true },
    });
    expect(
      wrapper.get('[name="unidadeMedida"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("A unidade não muda");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Sem conexão");
    expect(
      wrapper.get('[name="nome"]').attributes("disabled"),
    ).toBeUndefined();
    wrapper.unmount();
  });
});

function controller(role: "GESTOR" | "OPERADOR" = "GESTOR") {
  const items = [diesel, ureia, { ...ureia, id: U2, nome: "Ureia" }];
  const movements = [
    {
      id: "e1",
      farmId: "f",
      productId: D,
      tipo: "ENTRADA" as const,
      quantidade: 50,
      responsavel: "Ana",
      dataMovimento: "2026-10-27T12:00:00Z",
    },
    {
      id: "e2",
      farmId: "f",
      productId: V,
      tipo: "ENTRADA" as const,
      quantidade: 5,
      responsavel: "Ana",
      dataMovimento: "2026-10-26T12:00:00Z",
    },
  ];
  return {
    ready: ref(true),
    session: ref({ role, farmId: "f", farmNome: "Boa Vista", nome: "Ana" }),
    analysis: ref(analyzeInventory(items, movements.slice(0, 1))),
    inactiveProducts: ref([inativo]),
    movements: ref(movements),
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
    updateProduct: vi.fn().mockResolvedValue(undefined),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
  };
}
async function open(
  wrapper: ReturnType<typeof mount>,
  label: "Estoque" | "Histórico",
) {
  await wrapper
    .get('nav[aria-label="Navegação principal"]')
    .findAll("button")
    .find((b) => b.text() === label)!
    .trigger("click");
}

describe("editar, desativar e excluir pela aba Estoque", () => {
  it("operador não vê o botão de editar", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    await open(wrapper, "Estoque");
    expect(wrapper.find(`[data-testid="editar-${D}"]`).exists()).toBe(false);
    expect(wrapper.find('[data-testid="inactive-products"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it("o gestor edita o cadastro", async () => {
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await open(wrapper, "Estoque");
    await wrapper.get(`[data-testid="editar-${U}"]`).trigger("click");
    const dialog = wrapper.get('[aria-labelledby="edit-product-title"]');
    expect(dialog.text()).toContain("Editar insumo");
    await dialog.get('[name="nome"]').setValue("Ureia 46% N");
    await dialog.get("form").trigger("submit");
    await flushPromises();
    expect(state.updateProduct).toHaveBeenCalledWith(
      U,
      expect.objectContaining({
        nome: "Ureia 46% N",
        unidadeMedida: "kg",
        lote: null,
      }),
    );
    expect(state.updateProduct.mock.calls[0][1]).not.toHaveProperty("id");
    expect(wrapper.text()).toContain("Insumo atualizado.");
    expect(wrapper.find('[aria-labelledby="edit-product-title"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it("insumo com histórico: unidade travada e só desativar", async () => {
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await open(wrapper, "Estoque");
    await wrapper.get(`[data-testid="editar-${D}"]`).trigger("click");
    const dialog = wrapper.get('[aria-labelledby="edit-product-title"]');
    expect(
      dialog.get('[name="unidadeMedida"]').attributes("disabled"),
    ).toBeDefined();
    expect(dialog.find('[data-testid="delete-product"]').exists()).toBe(false);
    await dialog.get('[data-testid="deactivate-product"]').trigger("click");
    await flushPromises();
    expect(state.updateProduct).toHaveBeenCalledWith(D, {
      ativo: false,
    });
    expect(wrapper.text()).toContain("Insumo desativado.");
    wrapper.unmount();
  });

  it("insumo sem movimentações: exclui depois de confirmar", async () => {
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await open(wrapper, "Estoque");
    await wrapper.get(`[data-testid="editar-${U2}"]`).trigger("click");
    const dialog = wrapper.get('[aria-labelledby="edit-product-title"]');
    expect(dialog.find('[data-testid="deactivate-product"]').exists()).toBe(
      false,
    );
    await dialog.get('[data-testid="delete-product"]').trigger("click");
    expect(state.deleteProduct).not.toHaveBeenCalled();
    expect(dialog.text()).toContain("Excluir Ureia?");
    await dialog.get('[data-testid="confirm-delete-product"]').trigger("click");
    await flushPromises();
    expect(state.deleteProduct).toHaveBeenCalledWith(U2);
    expect(wrapper.text()).toContain("Insumo excluído.");
    wrapper.unmount();
  });

  it("mostra o erro da API sem fechar a edição", async () => {
    const state = controller();
    state.deleteProduct.mockRejectedValueOnce(new Error("Sem conexão"));
    const wrapper = mount(App, { props: { controller: state as never } });
    await open(wrapper, "Estoque");
    await wrapper.get(`[data-testid="editar-${U2}"]`).trigger("click");
    await wrapper.get('[data-testid="delete-product"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-product"]').trigger("click");
    await flushPromises();
    const dialog = wrapper.get('[aria-labelledby="edit-product-title"]');
    expect(dialog.get('[role="alert"]').text()).toContain("Sem conexão");
    wrapper.unmount();
  });

  it("lista os desativados e reativa", async () => {
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await open(wrapper, "Estoque");
    const section = wrapper.get('[data-testid="inactive-products"]');
    expect(section.text()).toContain("Adubo velho");
    await section.get(`[data-testid="reativar-${V}"]`).trigger("click");
    await flushPromises();
    expect(state.updateProduct).toHaveBeenCalledWith(V, { ativo: true });
    expect(wrapper.text()).toContain("Insumo reativado.");
    wrapper.unmount();
  });

  it("o histórico continua mostrando o nome do insumo desativado", async () => {
    const wrapper = mount(App, { props: { controller: controller() as never } });
    await open(wrapper, "Histórico");
    expect(wrapper.text()).toContain("Adubo velho");
    wrapper.unmount();
  });
});
