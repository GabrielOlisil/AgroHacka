// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
const scanner = vi.hoisted(() => ({
  decode: vi.fn(),
  decodeImage: vi.fn(),
}));
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice = scanner.decode;
    decodeFromImageUrl = scanner.decodeImage;
  },
}));
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,dGVzdA=="),
  },
}));
import App from "../src/App.vue";
import { analyzeInventory } from "../src/offline/analysis";

function controller(role?: "GESTOR" | "OPERADOR") {
  return {
    ready: ref(true),
    session: ref(
      role ? { role, farmId: "f", farmNome: "Boa Vista", nome: "Ana" } : null,
    ),
    analysis: ref({
      products: [],
      alerts: [],
      totalValue: 0,
      balancesByUnit: {},
    }),
    movements: ref([]),
    pendingCount: ref(0),
    pendingIds: ref<string[]>([]),
    reviews: ref([]),
    confirmedBalances: ref({}),
    lastSync: ref(null),
    error: ref(""),
    syncing: ref(false),
    backups: ref([]),
    operators: ref([]),
    loadOperators: vi.fn(),
    operatorsLoading: ref(false),
    operatorsError: ref(""),
    initialize: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    connect: vi.fn(),
    logout: vi.fn(),
    sync: vi.fn(),
    record: vi.fn(),
    pair: vi.fn(),
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    dispose: vi.fn(),
  };
}
async function goToTab(wrapper: ReturnType<typeof mount>, label: string) {
  await wrapper
    .get('nav[aria-label="Navegação principal"]')
    .findAll("button")
    .find((button) => button.text().includes(label))!
    .trigger("click");
}
const balancesPanel = '[data-testid="sync-balances"]';
describe("versão do aplicativo", () => {
  const version = JSON.parse(
    // happy-dom does not expose a file: import.meta.url; Vitest runs from client/.
    readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf-8"),
  ).version as string;

  it("mostra no rodapé a mesma versão dos instaladores (tauri.conf.json)", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const wrapper = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    expect(wrapper.get(".page-footer").text()).toBe(
      `AgroHacka · versão ${version}`,
    );
    wrapper.unmount();
  });

  it("mostra a versão também na tela de entrada, antes do login", () => {
    const wrapper = mount(App, { props: { controller: controller() as never } });
    expect(wrapper.get(".welcome").text()).toContain(`versão ${version}`);
    wrapper.unmount();
  });
});
// Tarefa 12.8: a fazenda carregada pela base de demonstração avisa, em toda tela,
// que os dados são simulados. O nome é o da carga (api/src/stock/official-seed.data.ts).
describe("aviso de dados simulados na fazenda de demonstração (tarefa 12.8)", () => {
  const notice = '[data-testid="demo-notice"]';
  const mountFarm = (role: "GESTOR" | "OPERADOR", farmNome: string) => {
    const state = controller(role);
    state.session.value = { role, farmId: "f", farmNome, nome: "Ana" } as never;
    return mount(App, { props: { controller: state as never } });
  };

  it("aparece para o gestor e o operador da fazenda de demonstração, em todas as abas", async () => {
    for (const role of ["GESTOR", "OPERADOR"] as const) {
      const wrapper = mountFarm(role, "Fazenda Modelo AgroHack");
      for (const tab of ["Visão geral", "Estoque", "Histórico"]) {
        await goToTab(wrapper, tab);
        expect(wrapper.get(notice).attributes("role")).toBe("note");
        expect(wrapper.get(notice).text()).toBe(
          "Dados simulados: esta fazenda de demonstração e seus números foram criados pela equipe, não são de uma propriedade real.",
        );
      }
      wrapper.unmount();
    }
  });

  it("reconhece o nome mesmo com espaços ou letras diferentes", () => {
    const wrapper = mountFarm("GESTOR", "  fazenda modelo agrohack ");
    expect(wrapper.find(notice).exists()).toBe(true);
    wrapper.unmount();
  });

  it("não aparece numa fazenda real nem na tela de entrada", () => {
    const real = mountFarm("GESTOR", "Boa Vista");
    expect(real.find(notice).exists()).toBe(false);
    real.unmount();
    const welcome = mount(App, { props: { controller: controller() as never } });
    expect(welcome.find(notice).exists()).toBe(false);
    welcome.unmount();
  });
});
function withDiesel(state: ReturnType<typeof controller>, saldo = 10) {
  state.analysis.value.products = [
    { id: "p", nome: "Diesel", unidadeMedida: "L", saldo },
  ] as never;
  return state;
}
describe("formulário de movimentação mais rápido (tarefas 11.11 a 11.13)", () => {
  const names = ["Diesel", "Ureia", "Glifosato", "Semente de soja", "Calcário", "Óleo 2T", "Adubo NPK"];
  function withProducts(count: number) {
    const state = controller("OPERADOR");
    state.analysis.value.products = names.slice(0, count).map((nome, i) => ({
      id: `p${i}`,
      nome,
      categoria: "Geral",
      unidadeMedida: "L",
      saldo: 10,
    })) as never;
    return state;
  }
  const options = (wrapper: ReturnType<typeof mount>) =>
    wrapper
      .get(".movement-panel select")
      .findAll("option:not([disabled])")
      .map((o) => o.text().split(" · ")[0]);

  it("11.11: com lista longa, busca o insumo pelo nome, sem perder o já escolhido", async () => {
    const short = mount(App, { props: { controller: withProducts(5) as never } });
    expect(short.find('[data-testid="product-search"]').exists()).toBe(false);
    short.unmount();
    const wrapper = mount(App, { props: { controller: withProducts(7) as never } });
    const search = wrapper.get('[data-testid="product-search"]');
    await search.setValue("URE");
    expect(options(wrapper)).toEqual(["Ureia"]);
    await search.setValue("");
    await wrapper.get(".movement-panel select").setValue("p0");
    await search.setValue("calc");
    expect(options(wrapper)).toEqual(["Diesel", "Calcário"]);
    wrapper.unmount();
  });

  it("11.12: sugere até 4 destinos recentes, sem repetir, e preenche ao tocar", async () => {
    const state = withDiesel(controller("OPERADOR"));
    const base = { productId: "p", farmId: "f", tipo: "SAIDA", quantidade: 1, responsavel: "Ana" };
    state.movements.value = [
      { ...base, id: "1", dataMovimento: "2026-10-27T10:00:00Z", destino: "Talhão 04" },
      { ...base, id: "2", dataMovimento: "2026-10-26T10:00:00Z", destino: "Trator" },
      { ...base, id: "3", dataMovimento: "2026-10-25T10:00:00Z", destino: "talhão 04 " },
      { ...base, id: "4", dataMovimento: "2026-10-24T10:00:00Z" },
      { ...base, id: "5", dataMovimento: "2026-10-23T10:00:00Z", destino: "Pulverizador" },
      { ...base, id: "6", dataMovimento: "2026-10-22T10:00:00Z", destino: "Sede" },
      { ...base, id: "7", dataMovimento: "2026-10-21T10:00:00Z", destino: "Galpão" },
    ] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    const chips = wrapper.findAll('.movement-panel [data-testid="recent-destination"]');
    expect(chips.map((c) => c.text())).toEqual(["Talhão 04", "Trator", "Pulverizador", "Sede"]);
    expect(chips[1]!.attributes("type")).toBe("button");
    await chips[1]!.trigger("click");
    expect(
      (wrapper.get('.movement-panel input[maxlength="300"]').element as HTMLInputElement).value,
    ).toBe("Trator");
    wrapper.unmount();
  });

  it("11.13: a data é 'agora' na hora de salvar, e só abre o campo ao tocar em alterar", async () => {
    const state = withDiesel(controller("OPERADOR"));
    const wrapper = mount(App, { props: { controller: state as never } });
    const panel = wrapper.get(".movement-panel");
    expect(panel.find('input[type="datetime-local"]').exists()).toBe(false);
    expect(panel.get('[data-testid="movement-date"]').text()).toContain("agora");
    await panel.get("select").setValue("p");
    await panel.get('input[type="number"]').setValue(1);
    await panel.get("form").trigger("submit");
    await flushPromises();
    const first = state.record.mock.calls[0]![0] as { dataMovimento: string };
    expect(Math.abs(new Date(first.dataMovimento).getTime() - Date.now())).toBeLessThan(5_000);

    await panel.get('[data-testid="change-date"]').trigger("click");
    // Data e hora separadas: o seletor de cada uma cabe na tela do celular.
    expect(panel.find('input[type="datetime-local"]').exists()).toBe(false);
    await panel.get('input[type="date"]').setValue("2026-10-20");
    await panel.get('input[type="time"]').setValue("08:30");
    await panel.get('input[type="number"]').setValue(2);
    await panel.get("form").trigger("submit");
    await flushPromises();
    expect(state.record.mock.calls[1]![0]).toMatchObject({
      dataMovimento: new Date("2026-10-20T08:30").toISOString(),
    });
    expect(panel.find('input[type="date"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("tocar em qualquer parte do campo de data abre o calendário, mesmo sem suporte do navegador", async () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker,
    });
    const wrapper = mount(App, { props: { controller: withDiesel(controller("OPERADOR")) as never } });
    const panel = wrapper.get(".movement-panel");
    await panel.get('[data-testid="change-date"]').trigger("click");
    await panel.get('input[type="date"]').trigger("click");
    await panel.get('input[type="time"]').trigger("click");
    expect(showPicker).toHaveBeenCalledTimes(2);
    // Navegador que recusa (sem gesto do usuário) ou não tem showPicker: o campo segue normal.
    showPicker.mockImplementation(() => {
      throw new DOMException("sem gesto", "NotAllowedError");
    });
    await panel.get('input[type="date"]').trigger("click");
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", { configurable: true, value: undefined });
    await panel.get('input[type="date"]').trigger("click");
    expect(panel.find('input[type="date"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("a janela de entrada/saída do Estoque segue o mesmo padrão de data e destinos", async () => {
    const state = controller("OPERADOR");
    const product = {
      id: "p",
      farmId: "f",
      nome: "Diesel",
      categoria: "Combustível",
      unidadeMedida: "L",
      estoqueMinimo: 0,
      precoAquisicao: 6,
      validade: null,
    };
    const entry = {
      id: "e",
      productId: "p",
      farmId: "f",
      tipo: "ENTRADA" as const,
      quantidade: 100,
      dataMovimento: "2026-10-01T12:00:00Z",
      responsavel: "Ana",
      destino: "Galpão",
    };
    state.analysis.value = analyzeInventory([product], [entry], new Date("2026-10-16T12:00:00Z")) as never;
    state.movements.value = [entry] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    await wrapper.get('[data-testid="saida-p"]').trigger("click");
    const modal = wrapper.get('[aria-labelledby="movement-title"]');
    expect(modal.find('input[type="date"]').exists()).toBe(false);
    expect(modal.get('[data-testid="movement-date"]').text()).toContain("agora");
    await modal.get('[data-testid="change-date"]').trigger("click");
    expect(modal.find('input[type="datetime-local"]').exists()).toBe(false);
    expect(modal.find('input[type="date"]').exists()).toBe(true);
    expect(modal.find('input[type="time"]').exists()).toBe(true);
    expect(modal.findAll('[data-testid="recent-destination"]').map((c) => c.text())).toEqual(["Galpão"]);
    wrapper.unmount();
  });
});
describe("visão geral por perfil (tarefa 11.10)", () => {
  it("o capital em estoque aparece só para o gestor; o operador vê insumos e alertas", () => {
    const operator = mount(App, { props: { controller: controller("OPERADOR") as never } });
    expect(operator.find('[data-testid="stock-value"]').exists()).toBe(false);
    expect(operator.get(".metrics").classes()).toContain("two");
    expect(operator.get(".metrics").text()).toContain("INSUMOS ACOMPANHADOS");
    expect(operator.get(".metrics").text()).toContain("ATENÇÃO IMEDIATA");
    operator.unmount();
    const manager = mount(App, { props: { controller: controller("GESTOR") as never } });
    expect(manager.find('[data-testid="stock-value"]').exists()).toBe(true);
    expect(manager.get(".metrics").classes()).not.toContain("two");
    manager.unmount();
  });
});
describe("navegação inferior no celular (tarefa 11.9)", () => {
  const nav = (wrapper: ReturnType<typeof mount>) =>
    wrapper.get('nav[aria-label="Navegação principal"]');

  it("o gestor tem Mais, que abre Operadores e Cópias e fecha ao escolher", async () => {
    const wrapper = mount(App, { props: { controller: controller("GESTOR") as never } });
    const secondary = nav(wrapper).findAll("button.nav-secondary").map((b) => b.text());
    expect(secondary).toEqual(["Operadores", "Cópias"]);
    const more = nav(wrapper).get('[data-testid="more-nav"]');
    expect(more.text()).toBe("Mais");
    expect(more.attributes("aria-expanded")).toBe("false");
    await more.trigger("click");
    expect(more.attributes("aria-expanded")).toBe("true");
    const menu = wrapper.get(".more-menu");
    expect(menu.findAll("button").map((b) => b.text())).toEqual(["Operadores", "Cópias"]);
    await menu.findAll("button")[1]!.trigger("click");
    expect(wrapper.find(".more-menu").exists()).toBe(false);
    expect(wrapper.text()).toContain("Cópias de segurança deste aparelho");
    expect(nav(wrapper).get('[data-testid="more-nav"]').classes()).toContain("active");
    wrapper.unmount();
  });

  it("o menu Mais fecha ao tocar fora dele ou apertar Esc, mas não ao tocar dentro", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("GESTOR") as never },
      attachTo: document.body,
    });
    const more = () => nav(wrapper).get('[data-testid="more-nav"]');
    await more().trigger("click");
    await wrapper.get(".more-menu").trigger("click");
    expect(wrapper.find(".more-menu").exists()).toBe(true);
    await wrapper.get(".page-heading").trigger("click");
    expect(wrapper.find(".more-menu").exists()).toBe(false);
    expect(more().attributes("aria-expanded")).toBe("false");
    await more().trigger("click");
    expect(wrapper.find(".more-menu").exists()).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find(".more-menu").exists()).toBe(false);
    wrapper.unmount();
  });

  it("o operador já cabe em 4 abas: sem Mais, Cópias continua no menu", () => {
    const wrapper = mount(App, { props: { controller: controller("OPERADOR") as never } });
    expect(nav(wrapper).find('[data-testid="more-nav"]').exists()).toBe(false);
    expect(nav(wrapper).findAll("button.nav-secondary")).toHaveLength(0);
    expect(nav(wrapper).findAll("button").map((b) => b.text())).toEqual([
      "Visão geral",
      "Estoque",
      "Histórico",
      "Cópias",
    ]);
    wrapper.unmount();
  });
});
describe("histórico em cartões com situação de envio (tarefa 11.8)", () => {
  it("marca cada registro como enviado ou esperando envio e rotula os campos do cartão", async () => {
    const state = withDiesel(controller("OPERADOR"));
    const movement = {
      productId: "p",
      farmId: "f",
      tipo: "SAIDA",
      quantidade: 5,
      dataMovimento: "2026-10-27T12:00:00Z",
      responsavel: "Ana",
    };
    state.movements.value = [
      { ...movement, id: "local" },
      { ...movement, id: "sent" },
    ] as never;
    state.pendingIds.value = ["local"];
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Histórico");
    const rows = wrapper.findAll(".history-panel tbody tr");
    expect(rows.map((row) => row.get('[data-label="Situação"]').text())).toEqual([
      "Esperando envio",
      "Enviado",
    ]);
    const labels = rows[0]!.findAll("td[data-label]").map((td) => td.attributes("data-label"));
    expect(labels).toEqual(["Insumo", "Movimento", "Quantidade", "Responsável", "Destino", "Situação"]);
    wrapper.unmount();
  });
});
describe("status de sincronização claro (tarefa 11.7)", () => {
  function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => value,
    });
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  }
  const status = (wrapper: ReturnType<typeof mount>) =>
    wrapper.get(".sync-status").text();
  afterEach(() => setOnline(true));

  it("online e sem pendências: tudo enviado, com a hora da última sincronização", () => {
    setOnline(true);
    const state = controller("OPERADOR");
    state.lastSync.value = "2026-10-27T15:40:00.000Z" as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    const hour = new Date("2026-10-27T15:40:00.000Z").toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(status(wrapper)).toBe(`Tudo enviado · ${hour}`);
    wrapper.unmount();
  });

  it("online com pendências: diz quantos registros aguardam envio", () => {
    setOnline(true);
    const state = controller("OPERADOR");
    state.pendingCount.value = 2;
    const wrapper = mount(App, { props: { controller: state as never } });
    expect(status(wrapper)).toBe("2 lançamento(s) esperando envio");
    wrapper.unmount();
  });

  it("offline: avisa e conta as pendências, e muda quando a conexão cai ou volta", async () => {
    setOnline(true);
    const state = controller("OPERADOR");
    state.pendingCount.value = 2;
    const wrapper = mount(App, { props: { controller: state as never } });
    setOnline(false);
    await flushPromises();
    expect(status(wrapper)).toBe("Sem internet · 2 lançamento(s) esperando envio");
    state.pendingCount.value = 0;
    await flushPromises();
    expect(status(wrapper)).toBe("Sem internet · tudo guardado neste aparelho");
    setOnline(true);
    await flushPromises();
    expect(status(wrapper)).toBe("Tudo guardado neste aparelho");
    wrapper.unmount();
  });

  it("durante o envio mostra Atualizando…", () => {
    const state = controller("OPERADOR");
    state.syncing.value = true;
    const wrapper = mount(App, { props: { controller: state as never } });
    expect(status(wrapper)).toBe("Atualizando…");
    wrapper.unmount();
  });
});
describe("formulário de movimentação da Visão geral", () => {
  async function submitOverviewForm(state: ReturnType<typeof controller>) {
    const wrapper = mount(App, { props: { controller: state as never } });
    const panel = wrapper.get(".movement-panel");
    await panel.get("select").setValue("p");
    await panel.get('input[type="number"]').setValue(3);
    await panel.get("form").trigger("submit");
    await flushPromises();
    return wrapper;
  }

  it("confirma o salvamento logo abaixo do botão, não só no topo (tarefa 11.3)", async () => {
    const wrapper = await submitOverviewForm(withDiesel(controller("OPERADOR")));
    expect(wrapper.get(".movement-panel [role='status']").text()).toContain(
      "Salvo neste aparelho",
    );
    expect(wrapper.find(".page-heading + .notice.success").exists()).toBe(false);
    wrapper.unmount();
  });

  it("mostra saldo e unidade do insumo escolhido e avisa, sem bloquear, saída maior que o saldo (tarefa 11.4)", async () => {
    const state = withDiesel(controller("OPERADOR"), 10);
    const wrapper = mount(App, { props: { controller: state as never } });
    const panel = wrapper.get(".movement-panel");
    const quantity = panel.get('input[type="number"]');
    expect(quantity.attributes("inputmode")).toBe("decimal");
    expect(panel.find('[data-testid="form-balance"]').exists()).toBe(false);
    await panel.get("select").setValue("p");
    expect(panel.get('[data-testid="form-balance"]').text()).toBe("Saldo: 10 L");
    expect(panel.text()).toContain("Quantidade (L)");
    await quantity.setValue(5);
    expect(panel.find('[data-testid="balance-warning"]').exists()).toBe(false);
    await quantity.setValue(12);
    expect(panel.get('[data-testid="balance-warning"]').text()).toContain("maior que o saldo");
    await panel.findAll(".movement-kind button")[1]!.trigger("click");
    expect(panel.find('[data-testid="balance-warning"]').exists()).toBe(false);
    await panel.findAll(".movement-kind button")[0]!.trigger("click");
    await panel.get("form").trigger("submit");
    await flushPromises();
    expect(state.record).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p", tipo: "SAIDA", quantidade: 12 }),
    );
    wrapper.unmount();
  });

  it("o seletor do gráfico não muda o insumo do formulário, nem o contrário (tarefa 11.5)", async () => {
    const state = controller("GESTOR");
    state.analysis.value.products = [
      { id: "p", nome: "Diesel", unidadeMedida: "L", saldo: 10, consumoDiario: [] },
      { id: "q", nome: "Ureia", unidadeMedida: "sc", saldo: 5, consumoDiario: [] },
    ] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    const formSelect = wrapper.get(".movement-panel select");
    const chartSelect = wrapper.get('select[aria-label="Insumo para analisar"]');
    await chartSelect.setValue("q");
    expect((formSelect.element as HTMLSelectElement).value).toBe("");
    expect(wrapper.get(".chart").attributes("aria-label")).toContain("Ureia");
    await formSelect.setValue("p");
    expect((chartSelect.element as HTMLSelectElement).value).toBe("q");
    expect(wrapper.get(".chart").attributes("aria-label")).toContain("Ureia");
    wrapper.unmount();
  });

  it("mostra o erro do salvamento junto ao formulário", async () => {
    const state = withDiesel(controller("OPERADOR"));
    state.record.mockRejectedValueOnce(new Error("Quantidade inválida."));
    const wrapper = await submitOverviewForm(state);
    expect(wrapper.get(".movement-panel [role='alert']").text()).toContain(
      "Quantidade inválida.",
    );
    wrapper.unmount();
  });
});
describe("telas responsivas dos perfis", () => {
  it.each([
    [0, "Estimativa indisponível"],
    [1, "Poucos dados"],
    [3, "Dados razoáveis"],
    [5, "Bons dados"],
  ] as const)(
    "qualifica a autonomia junto ao produto com %i retiradas",
    async (count, label) => {
      const state = controller("GESTOR");
      const product = {
        id: "p",
        farmId: "f",
        nome: "Diesel",
        categoria: "Combustível",
        unidadeMedida: "L",
        estoqueMinimo: 0,
        precoAquisicao: 6,
        validade: null,
      };
      const entry = {
        id: "e",
        productId: "p",
        farmId: "f",
        tipo: "ENTRADA" as const,
        quantidade: 100,
        dataMovimento: "2026-10-01",
        responsavel: "Ana",
      };
      const withdrawals = Array.from({ length: count }, (_, i) => ({
        ...entry,
        id: `s${i}`,
        tipo: "SAIDA" as const,
        quantidade: 1,
        dataMovimento: `2026-10-${16 - i}T10:00:00Z`,
      }));
      state.analysis.value = analyzeInventory(
        [product],
        [entry, ...withdrawals],
        new Date("2026-10-16T12:00:00Z"),
      ) as never;
      const wrapper = mount(App, { props: { controller: state as never } });
      await goToTab(wrapper, "Estoque");
      const estimate = wrapper.get('[data-testid="estimate-p"]');
      expect(estimate.text()).toContain(label);
      expect(estimate.get("small").classes()).toContain("estimate-context");
      if (count) {
        expect(estimate.text()).toContain(`${count} retirada(s)`);
        expect(estimate.text()).toContain("dia(s)");
        expect(estimate.text()).toContain("não uma garantia");
      }
      wrapper.unmount();
    },
  );
  it.each([6, null, 0])(
    "apresenta cobertura financeira sem transformar preço ausente em zero: %s",
    async (price) => {
      const state = controller("GESTOR");
      const product = {
        id: "p",
        farmId: "f",
        nome: "Diesel",
        categoria: "Combustível",
        unidadeMedida: "L",
        estoqueMinimo: 0,
        precoAquisicao: price,
        validade: null,
      };
      const unknown = {
        ...product,
        id: "unknown",
        nome: "Insumo sem preço",
        precoAquisicao: null,
      };
      const entry = {
        id: "e",
        productId: "p",
        farmId: "f",
        tipo: "ENTRADA" as const,
        quantidade: 10,
        dataMovimento: "2026-10-01",
        responsavel: "Ana",
      };
      state.analysis.value = analyzeInventory(
        [product, unknown],
        [entry, { ...entry, id: "e2", productId: "unknown" }],
        new Date("2026-10-16T12:00:00Z"),
      ) as never;
      const wrapper = mount(App, { props: { controller: state as never } });
      const value = wrapper.get('[data-testid="stock-value"]');
      expect(value.text()).toContain("PARCIAL");
      expect(value.text()).toContain("com saldo sem preço");
      expect(value.text().includes("Não disponível")).toBe(price === null);
      await goToTab(wrapper, "Estoque");
      expect(wrapper.get('[data-testid="abc-unknown"]').text()).toBe(
        "Não classificado",
      );
      expect(wrapper.text()).toContain("fora da classe de valor");
      expect(wrapper.text()).toContain("Preço não informado");
      wrapper.unmount();
    },
  );
  it("refreshes existing pairings after connecting a new operator using the same dialog", async () => {
    const state = controller("GESTOR");
    state.pair.mockResolvedValue({
      pairingCode: "AGRO-NEW",
      deviceToken: "token",
      qrPayload: {
        farmId: "f",
        farmNome: "Boa Vista",
        nomeOperador: "Ana",
        deviceToken: "token",
      },
    });
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper.get('[data-testid="operators-nav"]').trigger("click");
    await wrapper.get('[data-testid="pairing"]').trigger("click");
    await wrapper.get('[role="dialog"] input').setValue("Ana");
    await wrapper.get('[role="dialog"] form').trigger("submit");
    await flushPromises();
    expect(state.pair).toHaveBeenCalledOnce();
    expect(state.loadOperators).toHaveBeenCalledTimes(2);
    expect(state.loadOperators).toHaveBeenLastCalledWith(true);
    expect(wrapper.text()).toContain("AGRO-NEW");
    wrapper.unmount();
  });
  it("offers paired operator code recovery only to the manager", async () => {
    const state = controller("GESTOR");
    state.analysis.value.products = [
      {
        id: "p",
        nome: "Diesel",
        saldo: 5,
        unidadeMedida: "L",
        consumoDiario: [],
      },
    ] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper.get('[data-testid="operators-nav"]').trigger("click");
    expect(wrapper.get("h1").text()).toBe("Operadores da fazenda");
    expect(wrapper.text()).toContain("Operadores conectados");
    expect(state.loadOperators).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="sync-balances"]').exists()).toBe(false);
    wrapper.unmount();
    const operator = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    expect(operator.find('[data-testid="operators-nav"]').exists()).toBe(false);
    operator.unmount();
  });
  it("só mostra o painel de conciliação na aba Estoque, mesmo com pendência e saldo negativo", async () => {
    const state = withDiesel(controller("GESTOR"), -25);
    state.confirmedBalances.value = { p: -20 };
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    for (const label of ["Visão geral", "Histórico", "Cópias"]) {
      await goToTab(wrapper, label);
      expect(wrapper.find(balancesPanel).exists(), label).toBe(false);
    }
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(true);
    wrapper.unmount();
  });
  it("mostra o painel na aba Estoque quando há registros pendentes neste aparelho", async () => {
    const state = withDiesel(controller("OPERADOR"));
    state.pendingCount.value = 2;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(true);
    wrapper.unmount();
  });
  it("mostra o painel na aba Estoque quando o saldo confirmado é negativo, mesmo sem pendências", async () => {
    const state = withDiesel(controller("GESTOR"));
    state.confirmedBalances.value = { p: -5 };
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(true);
    expect(wrapper.find('[data-testid="sync-deficit"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it("mostra o painel na aba Estoque quando há registros para revisão", async () => {
    const state = withDiesel(controller("GESTOR"));
    state.reviews.value = [
      { id: "r1", status: "VALIDATION_REJECTED", message: "x", movement: {} },
    ] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(true);
    wrapper.unmount();
  });
  it("esconde o painel quando está tudo conciliado: sem pendências, saldo negativo ou revisões", async () => {
    const state = withDiesel(controller("GESTOR"));
    state.confirmedBalances.value = { p: 10 };
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(false);
    wrapper.unmount();
  });
  it("esconde o painel quando não há produtos, mesmo com pendências", async () => {
    const state = controller("GESTOR");
    state.pendingCount.value = 3;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.find(balancesPanel).exists()).toBe(false);
    wrapper.unmount();
  });
  it("labels provisional and confirmed balances and surfaces a negative consolidated balance without clamping it", async () => {
    const state = controller("GESTOR");
    state.confirmedBalances.value = { p: -20 };
    state.analysis.value.products = [
      { id: "p", nome: "Diesel", unidadeMedida: "L", saldo: -25 },
    ] as never;
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    await goToTab(wrapper, "Estoque");
    expect(wrapper.get('[data-testid="sync-balances"]').text()).toContain(
      "Saldo confirmado: -20 L",
    );
    expect(wrapper.get('[data-testid="sync-balances"]').text()).toContain(
      "Com os lançamentos deste aparelho: -25 L",
    );
    expect(wrapper.get('[data-testid="sync-deficit"]').text()).toMatch(
      /gestor/i,
    );
    wrapper.unmount();
  });
  it("shows rejected local attempts as preserved review items, not as unsent or confirmed stock", async () => {
    const state = controller("GESTOR");
    state.reviews.value = [
      {
        id: "rejected-id",
        status: "VALIDATION_REJECTED",
        message: "Produto indisponível",
        movement: { quantidade: 5 },
      },
    ] as never;
    const wrapper = mount(App, { props: { controller: state as never } });
    expect(wrapper.get('[data-testid="sync-reviews"]').text()).toContain(
      "Produto indisponível",
    );
    expect(wrapper.get('[data-testid="sync-reviews"]').text()).toContain(
      "não entraram no saldo",
    );
    wrapper.unmount();
  });
  it("identifica a página atual na navegação para leitores de tela", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("GESTOR") as never },
    });
    const navigation = wrapper.get('nav[aria-label="Navegação principal"]');
    const overview = navigation
      .findAll("button")
      .find((button) => button.text().includes("Visão geral"))!;
    const stock = navigation
      .findAll("button")
      .find((button) => button.text().includes("Estoque"))!;
    expect(overview.attributes("aria-current")).toBe("page");
    await stock.trigger("click");
    expect(stock.attributes("aria-current")).toBe("page");
    expect(overview.attributes("aria-current")).toBeUndefined();
    expect(wrapper.get("h1").text()).toContain("Estoque");
    wrapper.unmount();
  });
  it("expõe o estado das ações de entrada e saída sem depender somente de cor", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    const buttons = wrapper.get(".movement-kind").findAll("button");
    expect(buttons[0]!.attributes("aria-pressed")).toBe("true");
    expect(buttons[1]!.attributes("aria-pressed")).toBe("false");
    await buttons[1]!.trigger("click");
    expect(buttons[1]!.attributes("aria-pressed")).toBe("true");
    expect(buttons[0]!.attributes("aria-pressed")).toBe("false");
    wrapper.unmount();
  });
  it("encerra a câmera quando a tela fecha antes de terminar a abertura do leitor", async () => {
    let finish!: (controls: { stop: () => void }) => void;
    scanner.decode.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Ler com a câmera")!
      .trigger("click");
    await flushPromises();
    expect(scanner.decode).toHaveBeenCalledOnce();
    wrapper.unmount();
    const stop = vi.fn();
    finish({ stop });
    await flushPromises();
    expect(stop).toHaveBeenCalledOnce();
  });
  it.each([
    ["NotAllowedError", /permiss[ãa]o.*c[âa]mera/i],
    ["NotFoundError", /nenhuma c[âa]mera/i],
    ["NotReadableError", /em uso|n[ãa]o p[ôo]de ser aberta/i],
  ])(
    "fecha a câmera e orienta o operador quando a abertura falha com %s",
    async (name, message) => {
      scanner.decode.mockRejectedValue(
        new DOMException("falha do dispositivo", name),
      );
      const wrapper = mount(App, {
        props: { controller: controller() as never },
      });
      await wrapper
        .findAll("button")
        .find((b) => b.text() === "Conectar a uma fazenda")!
        .trigger("click");
      await wrapper
        .findAll("button")
        .find((b) => b.text() === "Ler com a câmera")!
        .trigger("click");
      await flushPromises();
      expect(wrapper.find("video.camera").exists()).toBe(false);
      const alert = wrapper.get('[role="alert"]').text();
      expect(alert).toMatch(message);
      expect(alert).toMatch(/c[óo]digo|imagem/i);
      wrapper.unmount();
    },
  );
  it("mantém a mensagem original quando a falha da câmera é desconhecida", async () => {
    scanner.decode.mockRejectedValue(new Error("falha inesperada"));
    const wrapper = mount(App, {
      props: { controller: controller() as never },
    });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Ler com a câmera")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find("video.camera").exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain("falha inesperada");
    wrapper.unmount();
  });
  async function openCamera(state: ReturnType<typeof controller>) {
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Ler com a câmera")!
      .trigger("click");
    await flushPromises();
    return wrapper;
  }
  it("conecta automaticamente ao ler o QR Code pela câmera, uma única vez", async () => {
    let onResult!: (result: { getText(): string } | undefined) => void;
    const stop = vi.fn();
    scanner.decode.mockImplementation(async (_device, _video, callback) => {
      onResult = callback;
      return { stop };
    });
    const state = controller();
    const wrapper = await openCamera(state);
    const qr = '{"code":"AGRO-AB12","farmId":"f"}';
    onResult({ getText: () => qr });
    onResult({ getText: () => qr });
    await flushPromises();
    expect(state.connect).toHaveBeenCalledTimes(1);
    expect(state.connect).toHaveBeenCalledWith(qr);
    expect(stop).toHaveBeenCalled();
    expect(wrapper.find("video.camera").exists()).toBe(false);
    wrapper.unmount();
  });
  it("não conecta enquanto a câmera ainda não leu nenhum QR Code", async () => {
    let onResult!: (result: { getText(): string } | undefined) => void;
    scanner.decode.mockImplementation(async (_device, _video, callback) => {
      onResult = callback;
      return { stop: vi.fn() };
    });
    const state = controller();
    const wrapper = await openCamera(state);
    onResult(undefined);
    await flushPromises();
    expect(state.connect).not.toHaveBeenCalled();
    expect(wrapper.find("video.camera").exists()).toBe(true);
    wrapper.unmount();
  });
  it("mostra o erro da API e fecha a câmera quando o QR lido não conecta", async () => {
    let onResult!: (result: { getText(): string } | undefined) => void;
    scanner.decode.mockImplementation(async (_device, _video, callback) => {
      onResult = callback;
      return { stop: vi.fn() };
    });
    const state = controller();
    state.connect.mockRejectedValue(
      new Error("Código de pareamento inválido."),
    );
    const wrapper = await openCamera(state);
    onResult({ getText: () => "lixo" });
    await flushPromises();
    expect(state.connect).toHaveBeenCalledWith("lixo");
    expect(wrapper.find("video.camera").exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Código de pareamento inválido.",
    );
    wrapper.unmount();
  });
  it("conecta automaticamente ao escolher uma imagem de QR Code", async () => {
    scanner.decodeImage.mockResolvedValue({ getText: () => "AGRO-IMG1" });
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["x"], "qr.png", { type: "image/png" })],
    });
    URL.createObjectURL ??= () => "blob:qr";
    URL.revokeObjectURL ??= () => undefined;
    await input.trigger("change");
    await flushPromises();
    expect(state.connect).toHaveBeenCalledTimes(1);
    expect(state.connect).toHaveBeenCalledWith("AGRO-IMG1");
    wrapper.unmount();
  });
  it("não conecta quando a imagem escolhida não tem QR Code legível", async () => {
    scanner.decodeImage.mockRejectedValue(new Error("QR não encontrado"));
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["x"], "foto.png", { type: "image/png" })],
    });
    URL.createObjectURL ??= () => "blob:qr";
    URL.revokeObjectURL ??= () => undefined;
    await input.trigger("change");
    await flushPromises();
    expect(state.connect).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("QR não encontrado");
    wrapper.unmount();
  });
  it("encaminha login e conexão manual pelo controlador sem persistir senha na tela", async () => {
    const state = controller();
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper.get('input[type="email"]').setValue("ana@fazenda.com");
    await wrapper.get('input[type="password"]').setValue("senha");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(state.login).toHaveBeenCalledWith({
      email: "ana@fazenda.com",
      senha: "senha",
    });
    expect(
      (wrapper.get('input[type="password"]').element as HTMLInputElement).value,
    ).toBe("");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Conectar a uma fazenda")!
      .trigger("click");
    await wrapper.get("textarea").setValue("AGRO-AB12");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(state.connect).toHaveBeenCalledWith("AGRO-AB12");
    wrapper.unmount();
  });
  it("limpa o QR de uma sessão anterior ao trocar de fazenda", async () => {
    const state = controller("GESTOR");
    state.pair.mockResolvedValue({
      pairingCode: "AGRO-AB12",
      deviceToken: "tok",
      qrPayload: {
        farmId: "f",
        farmNome: "Boa Vista",
        nomeOperador: "João",
        deviceToken: "tok",
      },
    });
    const wrapper = mount(App, { props: { controller: state as never } });
    await wrapper.get('[data-testid="operators-nav"]').trigger("click");
    await wrapper.get('[data-testid="pairing"]').trigger("click");
    await wrapper.get('[role="dialog"] input').setValue("João");
    await wrapper.get('[role="dialog"] form').trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("AGRO-AB12");
    state.session.value = {
      role: "GESTOR",
      farmId: "outra",
      farmNome: "Outra Fazenda",
      nome: "Ana",
    };
    await flushPromises();
    await wrapper.get('[data-testid="operators-nav"]').trigger("click");
    await wrapper.get('[data-testid="pairing"]').trigger("click");
    expect(wrapper.text()).not.toContain("AGRO-AB12");
    wrapper.unmount();
  });
  it("oferece criação de fazenda, login e conexão por código", () => {
    const wrapper = mount(App, {
      props: { controller: controller() as never },
    });
    expect(wrapper.text()).toContain("Criar nova fazenda");
    expect(wrapper.text()).toContain("Conectar a uma fazenda");
    expect(wrapper.text()).toContain("Entrar");
    wrapper.unmount();
  });
  it("mostra perfil operador com responsável bloqueado e botões de entrada/saída", () => {
    const wrapper = mount(App, {
      props: { controller: controller("OPERADOR") as never },
    });
    expect(wrapper.text()).toContain("Ana");
    expect(wrapper.text()).toContain("Baixa rápida");
    expect(wrapper.text()).toContain("Entrada de compra");
    expect(
      wrapper.find('[data-testid="responsavel"]').attributes("readonly"),
    ).toBeDefined();
    expect(wrapper.find('[data-testid="pairing"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("mostra estoque e alertas para o gestor; Conectar operador só na aba Operadores", async () => {
    const wrapper = mount(App, {
      props: { controller: controller("GESTOR") as never },
    });
    expect(wrapper.text()).toContain("Alertas");
    expect(wrapper.text()).toContain("Estoque");
    for (const label of ["Visão geral", "Estoque", "Histórico", "Cópias"]) {
      await goToTab(wrapper, label);
      expect(wrapper.find('[data-testid="pairing"]').exists(), label).toBe(false);
    }
    await wrapper.get('[data-testid="operators-nav"]').trigger("click");
    expect(wrapper.find('[data-testid="pairing"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
