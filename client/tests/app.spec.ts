// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
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
async function goToTab(
  wrapper: ReturnType<typeof mount>,
  label: string,
) {
  await wrapper
    .get('nav[aria-label="Navegação principal"]')
    .findAll("button")
    .find((button) => button.text().includes(label))!
    .trigger("click");
}
const balancesPanel = '[data-testid="sync-balances"]';
function withDiesel(state: ReturnType<typeof controller>, saldo = 10) {
  state.analysis.value.products = [
    { id: "p", nome: "Diesel", unidadeMedida: "L", saldo },
  ] as never;
  return state;
}
describe("telas responsivas dos perfis", () => {
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
    expect(wrapper.text()).toContain("Operadores pareados");
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
    for (const label of ["Visão geral", "Histórico", "Backups"]) {
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
    state.connect.mockRejectedValue(new Error("Código de pareamento inválido."));
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
