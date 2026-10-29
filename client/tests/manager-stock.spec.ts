// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
import { analyzeInventory } from "../src/offline/analysis";
import type { Product } from "../src/offline/types";

const products: Product[] = [
  {
    id: "diesel",
    farmId: "f",
    nome: "Diesel",
    categoria: "Combustíveis",
    unidadeMedida: "L",
    estoqueMinimo: 10,
    precoAquisicao: 6,
    validade: null,
  },
  {
    id: "milho",
    farmId: "f",
    nome: "Milho",
    categoria: "Sementes",
    unidadeMedida: "kg",
    estoqueMinimo: 5,
    precoAquisicao: null,
    validade: null,
  },
];
function controller(role: "GESTOR" | "OPERADOR" = "GESTOR", items = products) {
  const movements = items.map((p, i) => ({
    id: `e${i}`,
    farmId: "f",
    productId: p.id,
    tipo: "ENTRADA" as const,
    quantidade: i ? 20 : 2,
    responsavel: "Ana",
    dataMovimento: "2026-10-27T12:00:00Z",
  }));
  return {
    ready: ref(true),
    session: ref({ role, farmId: "f", farmNome: "Boa Vista", nome: "Ana" }),
    analysis: ref(analyzeInventory(items, movements)),
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
  };
}
async function stock(wrapper: ReturnType<typeof mount>) {
  await wrapper
    .get('nav[aria-label="Navegação principal"]')
    .findAll("button")
    .find((b) => b.text() === "Estoque")!
    .trigger("click");
}
describe("o que mudou depois de registrar pela aba Estoque (tarefa 12.17)", () => {
  it("a entrada que tira o Diesel do mínimo aparece como alerta resolvido", async () => {
    const state = controller();
    expect(state.analysis.value.alerts.map((a) => a.id)).toContain("FALTA:diesel");
    state.record.mockImplementation(async (input: { quantidade: number }) => {
      const movements = [
        ...state.movements.value,
        {
          id: "novo",
          farmId: "f",
          productId: "diesel",
          tipo: "ENTRADA" as const,
          quantidade: input.quantidade,
          responsavel: "Ana",
          dataMovimento: "2026-10-27T13:00:00Z",
        },
      ];
      state.movements.value = movements;
      state.analysis.value = analyzeInventory(products, movements);
    });
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    await wrapper.get('[data-testid="entrada-diesel"]').trigger("click");
    await wrapper.get('[role="dialog"] input[type="number"]').setValue(20);
    await wrapper.get('[role="dialog"] form').trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="alert-changes"]').text()).toContain("Resolvido: Diesel · Reposição");
    wrapper.unmount();
  });
});

describe("controle de estoque do gestor", () => {
  it("preserva rascunho e identidade ao fechar e reabrir cadastro com resposta perdida", async () => {
    const state = controller();
    state.createProduct.mockRejectedValue(new TypeError("Sem conexão"));
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    await wrapper.get('[data-testid="new-product"]').trigger("click");
    await wrapper.get('[name="nome"]').setValue("Mangueira");
    await wrapper.get('[name="categoria"]').setValue("Irrigação");
    await wrapper.get(".product-form").trigger("submit");
    await flushPromises();
    await wrapper.get('[aria-label="Fechar cadastro"]').trigger("click");
    await wrapper.get('[data-testid="new-product"]').trigger("click");
    expect(
      (wrapper.get('[name="nome"]').element as HTMLInputElement).value,
    ).toBe("Mangueira");
    await wrapper.get(".product-form").trigger("submit");
    await flushPromises();
    expect(state.createProduct).toHaveBeenCalledTimes(2);
    expect(state.createProduct.mock.calls[1]![0]).toEqual(
      state.createProduct.mock.calls[0]![0],
    );
    wrapper.unmount();
  });
  it("oferece cadastro e filtros combinados por categoria, situação e busca", async () => {
    const wrapper = mount(App, {
      props: { controller: controller() as never },
    });
    await stock(wrapper);
    expect(wrapper.get('[data-testid="new-product"]').text()).toContain(
      "Novo insumo",
    );
    await wrapper.get('[aria-label="Filtrar categoria"]').setValue("Sementes");
    expect(wrapper.findAll("tbody tr").map((r) => r.text())).toHaveLength(1);
    expect(wrapper.get("tbody").text()).toContain("Milho");
    await wrapper
      .get('[aria-label="Filtrar situação do estoque"]')
      .setValue("low");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    await wrapper.get('[aria-label="Filtrar categoria"]').setValue("");
    expect(wrapper.get("tbody").text()).toContain("Diesel");
    await wrapper.get('[aria-label="Buscar insumos"]').setValue("inexistente");
    expect(wrapper.text()).toContain("Nenhum insumo encontrado");
    wrapper.unmount();
  });
  it.each(["ENTRADA", "SAIDA"] as const)(
    "registra %s no item sem sair da aba Estoque",
    async (tipo) => {
      const state = controller();
      const wrapper = mount(App, { props: { controller: state as never } });
      await stock(wrapper);
      await wrapper
        .get(`[data-testid="${tipo.toLowerCase()}-diesel"]`)
        .trigger("click");
      const dialog = wrapper.get('[role="dialog"]');
      expect(dialog.text()).toContain("Diesel");
      await dialog.get('input[type="number"]').setValue(1);
      await dialog.get("form").trigger("submit");
      await flushPromises();
      expect(state.record).toHaveBeenCalledWith(
        expect.objectContaining({ productId: "diesel", tipo, quantidade: 1 }),
      );
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      expect(wrapper.get("h1").text()).toBe("Estoque de insumos");
      expect(wrapper.text()).toContain("Salvo neste aparelho");
      wrapper.unmount();
    },
  );
  it("no modal, avisa sem bloquear quando a saída passa do saldo (tarefa 11.4)", async () => {
    const wrapper = mount(App, { props: { controller: controller() as never } });
    await stock(wrapper);
    await wrapper.get('[data-testid="saida-diesel"]').trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    const quantity = dialog.get('input[type="number"]');
    expect(quantity.attributes("inputmode")).toBe("decimal");
    await quantity.setValue(10);
    expect(dialog.get('[data-testid="balance-warning"]').text()).toContain("maior que o saldo");
    expect(dialog.get('button.primary').attributes("disabled")).toBeUndefined();
    await quantity.setValue(1);
    expect(dialog.find('[data-testid="balance-warning"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("não fecha nem perde a quantidade quando o salvamento falha", async () => {
    const state = controller();
    state.record.mockRejectedValue(new Error("Saldo insuficiente"));
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    await wrapper.get('[data-testid="saida-diesel"]').trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    await dialog.get('input[type="number"]').setValue(10);
    await dialog.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Saldo insuficiente",
    );
    expect(
      (dialog.get('input[type="number"]').element as HTMLInputElement).value,
    ).toBe("10");
    wrapper.unmount();
  });
  it("fecha após commit local mesmo quando a atualização da tela falha", async () => {
    const state = controller();
    state.record.mockImplementation(async () => {
      state.error.value =
        "Movimentação salva, mas não foi possível atualizar a tela";
    });
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    await wrapper.get('[data-testid="entrada-diesel"]').trigger("click");
    await wrapper.get('[role="dialog"] input[type="number"]').setValue(2);
    await wrapper.get('[role="dialog"] form').trigger("submit");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(state.record).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Movimentação salva",
    );
    wrapper.unmount();
  });
  it("esconde o cadastro de insumo do operador", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    await stock(wrapper);
    expect(wrapper.find('[data-testid="new-product"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("o operador registra entrada e saída direto pela aba Estoque", async () => {
    const state = controller("OPERADOR");
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    expect(wrapper.find('[data-testid="entrada-diesel"]').exists()).toBe(true);
    await wrapper.get('[data-testid="saida-diesel"]').trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain("Saída");
    await dialog.get('input[type="number"]').setValue(1);
    await dialog.get("form").trigger("submit");
    await flushPromises();
    expect(state.record).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "diesel", tipo: "SAIDA", quantidade: 1 }),
    );
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("permite iniciar um catálogo vazio pelo cadastro", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("GESTOR", []) as never },
    });
    await stock(wrapper);
    await wrapper.get('[data-testid="new-product"]').trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Novo insumo");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Precisa de internet");
    wrapper.unmount();
  });
  it("retira explicações repetitivas e preserva alertas de estado", async () => {
    const state = controller();
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    expect(wrapper.text()).not.toContain("O responsável é vinculado à sessão");
    expect(wrapper.text()).not.toContain(
      "Decisões fundamentadas nos registros",
    );
    expect(wrapper.text()).not.toContain(
      "Quantidade disponível × preço de aquisição",
    );
    expect(wrapper.text()).toContain("esperando envio");
    await stock(wrapper);
    expect(wrapper.text()).toContain("Preço não informado");
    expect(wrapper.find('[data-testid="sync-balances"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it("recolhe conciliação sem divergência e mantém saldo negativo expandido", async () => {
    const state = controller();
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    await stock(wrapper);
    const details = wrapper.get('details[data-testid="sync-balances"]');
    expect(details.attributes("open")).toBeUndefined();
    expect(details.get("summary").text()).toContain("esperando envio");
    state.confirmedBalances.value = { diesel: -1 };
    await flushPromises();
    expect(details.attributes("open")).toBeDefined();
    expect(details.find('[data-testid="sync-deficit"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
