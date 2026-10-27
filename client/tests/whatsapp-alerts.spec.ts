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
    updateTelefone: vi.fn(),
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
const testButton = (wrapper: ReturnType<typeof mountApp>) =>
  wrapper
    .get(panel)
    .findAll("button")
    .find((b) => b.text().includes("Testar envio") || b.text().includes("Enviando teste"));
async function clickTest(wrapper: ReturnType<typeof mountApp>) {
  await testButton(wrapper)!.trigger("click");
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
    expect(testButton(wrapper)!.text()).toContain("Testar envio de alerta");
    expect(card.text()).not.toContain("Twilio");
    wrapper.unmount();
  });

  it("mostra Não configurado e nenhum botão quando não há telefone", () => {
    const wrapper = mountApp(controller());

    const card = wrapper.get(panel);
    expect(card.text()).toContain("Não configurado");
    expect(card.text()).toContain("Nenhum número cadastrado");
    expect(testButton(wrapper)).toBeUndefined();
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
    for (const label of ["Estoque", "Histórico", "Cópias"]) {
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
    expect(card).toContain("ainda não está ativado");
    expect(card).toContain("nenhuma mensagem foi enviada");
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
    expect(alert).toContain("sem internet");
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

    await testButton(wrapper)!.trigger("click");
    const button = testButton(wrapper)!;
    expect(button.text()).toContain("Enviando teste");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(state.testWhatsApp).toHaveBeenCalledOnce();

    finish({ simulado: false });
    await flushPromises();
    expect(testButton(wrapper)!.attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  describe("posição e organização na Visão geral", () => {
    const actionRow = ".dashboard-grid > .action-row";

    it("alertas prioritários ocupam a largura toda e, embaixo, movimentação e WhatsApp ficam lado a lado", () => {
      expect(rule(".dashboard-grid")).toMatch(/display\s*:\s*grid/);
      expect(rule(".dashboard-grid")).not.toMatch(/grid-template-columns/);
      expect(rule(".action-row")).toMatch(/display\s*:\s*grid/);
      expect(rule(".action-row")).toMatch(/grid-template-columns\s*:\s*repeat\(auto-fit/);
      expect(rule(".action-row")).toMatch(/gap\s*:/);
      const wrapper = mountApp(controller({ telefone: "+5569999999999" }));
      const top = wrapper.findAll(".dashboard-grid > *");
      expect(top).toHaveLength(2);
      expect(top[0]!.text()).toContain("Alertas prioritários");
      expect(top[1]!.classes()).toContain("action-row");
      const children = wrapper.get(actionRow).findAll(":scope > section");
      expect(children.map((c) => c.classes())).toEqual([
        expect.arrayContaining(["movement-panel"]),
        expect.arrayContaining(["whatsapp-panel"]),
      ]);
      wrapper.unmount();
    });

    it("para o operador o registro vem antes dos alertas (tarefa 11.2)", () => {
      expect(rule(".actions-first > .action-row")).toMatch(/order\s*:\s*-1/);
      const operador = mountApp(controller({ role: "OPERADOR" }));
      expect(operador.get(".dashboard-grid").classes()).toContain("actions-first");
      operador.unmount();
      const gestor = mountApp(controller({ telefone: "+5569999999999" }));
      expect(gestor.get(".dashboard-grid").classes()).not.toContain("actions-first");
      gestor.unmount();
    });

    it("para o operador a linha de baixo tem só a movimentação", () => {
      const wrapper = mountApp(controller({ role: "OPERADOR" }));
      const children = wrapper.get(actionRow).findAll(":scope > section");
      expect(children).toHaveLength(1);
      expect(children[0]!.classes()).toContain("movement-panel");
      wrapper.unmount();
    });

    it("campo do número e botão Salvar ficam na mesma linha, com a dica embaixo", () => {
      expect(rule(".whatsapp-row")).toMatch(/display\s*:\s*flex/);
      const wrapper = mountApp(controller({ telefone: "+5569999999999" }));
      const row = wrapper.get(`${panel} .whatsapp-row`);
      expect(row.find('input[type="tel"]').exists()).toBe(true);
      expect(row.get("button").text()).toContain("Salvar número");
      const input = row.get('input[type="tel"]');
      expect(wrapper.get(`${panel} label[for="${input.attributes("id")}"]`).text()).toContain(
        "Número do WhatsApp",
      );
      expect(testButton(wrapper)!.classes()).toContain("full");
      wrapper.unmount();
    });
  });

  it("separa o botão e o resultado do texto com espaçamento", () => {
    expect(rule(".whatsapp-panel > button")).toMatch(/margin-top\s*:/);
    expect(rule(".whatsapp-panel .notice")).toMatch(/margin\s*:/);
    const wrapper = mountApp(controller({ telefone: "+5569999999999" }));
    expect(wrapper.get(panel).classes()).toContain("whatsapp-panel");
    wrapper.unmount();
  });

  describe("alterar o número do WhatsApp", () => {
    const numberInput = `${panel} input[type="tel"]`;
    const saveButton = (wrapper: ReturnType<typeof mountApp>) =>
      wrapper
        .get(panel)
        .findAll("button")
        .find(
          (b) => b.text().includes("Salvar número") || b.text().includes("Salvando"),
        )!;

    it("mostra o campo com o número atual e a dica de como desativar", () => {
      const wrapper = mountApp(controller({ telefone: "+5569999999999" }));

      expect(
        (wrapper.get(numberInput).element as HTMLInputElement).value,
      ).toBe("+5569999999999");
      expect(saveButton(wrapper).exists()).toBe(true);
      expect(wrapper.get(panel).text()).toContain("em branco");
      wrapper.unmount();
    });

    it("mostra o campo vazio quando ainda não há número cadastrado", () => {
      const wrapper = mountApp(controller());

      expect(
        (wrapper.get(numberInput).element as HTMLInputElement).value,
      ).toBe("");
      expect(saveButton(wrapper).exists()).toBe(true);
      wrapper.unmount();
    });

    it("envia o número digitado e confirma a atualização", async () => {
      const state = controller();
      state.updateTelefone.mockResolvedValue("+5569988887777");
      const wrapper = mountApp(state);

      await wrapper.get(numberInput).setValue("+55 69 98888-7777");
      await saveButton(wrapper).trigger("click");
      await flushPromises();

      expect(state.updateTelefone).toHaveBeenCalledWith("+55 69 98888-7777");
      expect(wrapper.get(panel).text()).toContain("WhatsApp atualizado");
      expect(wrapper.find(`${panel} .notice.success`).exists()).toBe(true);
      wrapper.unmount();
    });

    it("confirma a desativação quando o campo é salvo em branco", async () => {
      const state = controller({ telefone: "+5569999999999" });
      state.updateTelefone.mockResolvedValue(undefined);
      const wrapper = mountApp(state);

      await wrapper.get(numberInput).setValue("   ");
      await saveButton(wrapper).trigger("click");
      await flushPromises();

      expect(state.updateTelefone).toHaveBeenCalledWith("   ");
      expect(wrapper.get(panel).text()).toContain("desativados");
      wrapper.unmount();
    });

    it("mostra a orientação do servidor quando o número é recusado", async () => {
      const state = controller();
      state.updateTelefone.mockRejectedValue(
        new Error("Informe o WhatsApp com o código do país."),
      );
      const wrapper = mountApp(state);

      await wrapper.get(numberInput).setValue("abc");
      await saveButton(wrapper).trigger("click");
      await flushPromises();

      const alert = wrapper.get(`${panel} [role="alert"]`).text();
      expect(alert).toContain("Não foi possível salvar o número");
      expect(alert).toContain("código do país");
      wrapper.unmount();
    });

    it("troca o erro técnico de rede por uma orientação em português", async () => {
      const state = controller();
      state.updateTelefone.mockRejectedValue(new TypeError("Failed to fetch"));
      const wrapper = mountApp(state);

      await wrapper.get(numberInput).setValue("+5569999999999");
      await saveButton(wrapper).trigger("click");
      await flushPromises();

      const alert = wrapper.get(`${panel} [role="alert"]`).text();
      expect(alert).toContain("sem internet");
      expect(alert).not.toContain("Failed to fetch");
      wrapper.unmount();
    });

    it("bloqueia o botão enquanto salva e não envia duas vezes", async () => {
      const state = controller();
      let finish!: (value: string) => void;
      state.updateTelefone.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const wrapper = mountApp(state);
      await wrapper.get(numberInput).setValue("+5569999999999");

      await saveButton(wrapper).trigger("click");
      expect(saveButton(wrapper).text()).toContain("Salvando");
      expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
      await saveButton(wrapper).trigger("click");
      expect(state.updateTelefone).toHaveBeenCalledOnce();

      finish("+5569999999999");
      await flushPromises();
      expect(saveButton(wrapper).attributes("disabled")).toBeUndefined();
      wrapper.unmount();
    });

    it("atualiza o campo quando o número da sessão muda", async () => {
      const state = controller({ telefone: "+5569999999999" });
      const wrapper = mountApp(state);

      state.session.value = {
        ...state.session.value!,
        telefone: "+5569977776666",
      };
      await flushPromises();

      expect(
        (wrapper.get(numberInput).element as HTMLInputElement).value,
      ).toBe("+5569977776666");
      wrapper.unmount();
    });
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
