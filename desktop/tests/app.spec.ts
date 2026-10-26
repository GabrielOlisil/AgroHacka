// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
const scanner = vi.hoisted(() => ({ decode: vi.fn() }));
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice = scanner.decode;
  },
}));
vi.mock("../src/components/HelloWorld.vue", () => ({
  default: { template: "<div>Template inicial</div>" },
}));
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,dGVzdA=="),
  },
}));
import App from "../src/App.vue";

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
    reviews: ref([]),
    confirmedBalances: ref({}),
    lastSync: ref(null),
    error: ref(""),
    syncing: ref(false),
    backups: ref([]),
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
describe("telas responsivas dos perfis", () => {
  it("labels provisional and confirmed balances and surfaces a negative consolidated balance without clamping it", async () => {
    const state = controller("GESTOR");
    state.confirmedBalances.value = { p: -20 };
    state.analysis.value.products = [
      { id: "p", nome: "Diesel", unidadeMedida: "L", saldo: -25 },
    ] as never;
    state.pendingCount.value = 1;
    const wrapper = mount(App, { props: { controller: state as never } });
    expect(wrapper.get('[data-testid="sync-balances"]').text()).toContain(
      "Confirmado conhecido: -20 L",
    );
    expect(wrapper.get('[data-testid="sync-balances"]').text()).toContain(
      "Provisório neste aparelho: -25 L",
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
      "rejected-id",
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
  it("mostra estoque, alertas e pareamento para o gestor", () => {
    const wrapper = mount(App, {
      props: { controller: controller("GESTOR") as never },
    });
    expect(wrapper.text()).toContain("Alertas");
    expect(wrapper.text()).toContain("Estoque");
    expect(wrapper.find('[data-testid="pairing"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
