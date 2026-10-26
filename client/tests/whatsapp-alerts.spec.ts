// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice = vi.fn();
    decodeFromImageUrl = vi.fn();
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

function controller(options: {
  role?: "GESTOR" | "OPERADOR" | null;
  telefone?: string;
} = {}) {
  const { role = "GESTOR", telefone } = options;
  return {
    ready: ref(true),
    session: ref(
      role
        ? {
            role,
            farmId: "farm-1",
            farmNome: "Fazenda Progresso",
            nome: "Produtor José",
            ...(telefone ? { telefone } : {}),
          }
        : null,
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
    operatorsLoading: ref(false),
    operatorsError: ref(""),
    loadOperators: vi.fn(),
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
    testWhatsApp: vi.fn(),
  };
}
const panel = '[data-testid="whatsapp-alerts"]';
const css = readFileSync(
  fileURLToPath(new NodeURL("../src/style.css", import.meta.url)),
  "utf-8",
);
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel!.trim() === selector)
    .map(([, , body]) => body!)
    .join("\n");
const mountApp = (state: ReturnType<typeof controller>) =>
  mount(App, { props: { controller: state as never } });
async function clickTest(wrapper: ReturnType<typeof mountApp>) {
  await wrapper.get(`${panel} button`).trigger("click");
  await flushPromises();
}

describe("Alertas de emergência via WhatsApp na interface do gestor", () => {
  it("explica o aviso no cadastro, sem termos técnicos", async () => {
    const wrapper = mountApp(controller({ role: null }));
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Criar nova fazenda"))!
      .trigger("click");

    const html = wrapper.html();
    expect(html).toContain("WhatsApp para alertas de emergência");
    expect(html).toContain("Receba avisos automáticos");
    expect(html).not.toContain("Twilio");
    wrapper.unmount();
  });

  it("mostra status Ativo, o número e o botão de teste quando há telefone", () => {
    const wrapper = mountApp(controller({ telefone: "+5569999999999" }));

    const card = wrapper.get(panel);
    expect(card.text()).toContain("Ativo");
    expect(card.text()).toContain("+5569999999999");
    expect(card.get("button").text()).toContain("Testar envio de alerta");
    expect(card.text()).not.toContain("Twilio");
    wrapper.unmount();
  });

  it("mostra Não configurado e nenhum botão quando não há telefone", () => {
    const wrapper = mountApp(controller());

    const card = wrapper.get(panel);
    expect(card.text()).toContain("Não configurado");
    expect(card.text()).toContain("Nenhum número cadastrado");
    expect(card.find("button").exists()).toBe(false);
    wrapper.unmount();
  });

  it("não aparece para o operador", () => {
    const wrapper = mountApp(
      controller({ role: "OPERADOR", telefone: "+5569999999999" }),
    );
    expect(wrapper.find(panel).exists()).toBe(false);
    wrapper.unmount();
  });

  it("fica só na Visão geral, sem repetir nas outras abas", async () => {
    const wrapper = mountApp(controller({ telefone: "+5569999999999" }));
    expect(wrapper.find(panel).exists()).toBe(true);
    for (const label of ["Estoque", "Histórico", "Backups"]) {
      await wrapper
        .get('nav[aria-label="Navegação principal"]')
        .findAll("button")
        .find((b) => b.text().includes(label))!
        .trigger("click");
      expect(wrapper.find(panel).exists(), label).toBe(false);
    }
    wrapper.unmount();
  });

  it("confirma o envio real ao clicar em testar", async () => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp.mockResolvedValue({ simulado: false });
    const wrapper = mountApp(state);

    await clickTest(wrapper);

    expect(state.testWhatsApp).toHaveBeenCalledOnce();
    const card = wrapper.get(panel).text();
    expect(card).toContain("Mensagem de teste enviada");
    expect(card).toContain("+5569999999999");
    wrapper.unmount();
  });

  it("avisa que nada foi enviado quando o servidor está em simulação", async () => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp.mockResolvedValue({ simulado: true });
    const wrapper = mountApp(state);

    await clickTest(wrapper);

    const card = wrapper.get(panel).text();
    expect(card).toContain("simulação");
    expect(card).toContain("nenhuma mensagem real");
    expect(card).not.toContain("Mensagem de teste enviada");
    // simulação não é sucesso: nada foi enviado, então não pode ter estilo verde
    expect(wrapper.find(`${panel} .notice.success`).exists()).toBe(false);
    expect(wrapper.find(`${panel} .notice`).exists()).toBe(true);
    wrapper.unmount();
  });

  it("o envio real usa o estilo de sucesso", async () => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp.mockResolvedValue({ simulado: false });
    const wrapper = mountApp(state);

    await clickTest(wrapper);

    expect(wrapper.find(`${panel} .notice.success`).exists()).toBe(true);
    wrapper.unmount();
  });

  it("mostra o motivo quando o servidor recusa o envio", async () => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp.mockRejectedValue(new Error("Número fora do Sandbox"));
    const wrapper = mountApp(state);

    await clickTest(wrapper);

    const alert = wrapper.get(`${panel} [role="alert"]`).text();
    expect(alert).toContain("Não foi possível enviar o teste");
    expect(alert).toContain("Número fora do Sandbox");
    expect(wrapper.get(panel).text()).not.toContain("Mensagem de teste enviada");
    wrapper.unmount();
  });

  it.each([
    new TypeError("Failed to fetch"),
    Object.assign(new Error("timeout"), { name: "TimeoutError" }),
  ])("troca o erro técnico de rede por uma orientação em português (%s)", async (cause) => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp.mockRejectedValue(cause);
    const wrapper = mountApp(state);

    await clickTest(wrapper);

    const alert = wrapper.get(`${panel} [role="alert"]`).text();
    expect(alert).toContain("sem conexão com o servidor");
    expect(alert).not.toContain("Failed to fetch");
    wrapper.unmount();
  });

  it("bloqueia o botão enquanto envia e não dispara duas vezes", async () => {
    const state = controller({ telefone: "+5569999999999" });
    let finish!: (value: { simulado: boolean }) => void;
    state.testWhatsApp.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountApp(state);

    await wrapper.get(`${panel} button`).trigger("click");
    const button = wrapper.get(`${panel} button`);
    expect(button.text()).toContain("Enviando teste");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(state.testWhatsApp).toHaveBeenCalledOnce();

    finish({ simulado: false });
    await flushPromises();
    expect(wrapper.get(`${panel} button`).attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("separa o botão e o resultado do texto com espaçamento", () => {
    expect(rule(".whatsapp-panel > button")).toMatch(/margin-top\s*:/);
    expect(rule(".whatsapp-panel .notice")).toMatch(/margin\s*:/);
    const wrapper = mountApp(controller({ telefone: "+5569999999999" }));
    expect(wrapper.get(panel).classes()).toContain("whatsapp-panel");
    wrapper.unmount();
  });

  it("limpa o resultado anterior a cada novo teste", async () => {
    const state = controller({ telefone: "+5569999999999" });
    state.testWhatsApp
      .mockResolvedValueOnce({ simulado: false })
      .mockRejectedValueOnce(new Error("falhou agora"));
    const wrapper = mountApp(state);

    await clickTest(wrapper);
    expect(wrapper.get(panel).text()).toContain("Mensagem de teste enviada");
    await clickTest(wrapper);

    const card = wrapper.get(panel).text();
    expect(card).toContain("falhou agora");
    expect(card).not.toContain("Mensagem de teste enviada");
    wrapper.unmount();
  });
});
