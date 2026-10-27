// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
vi.mock("@zxing/browser", () => ({ BrowserQRCodeReader: class {} }));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,dGVzdA==") },
}));
import App from "../src/App.vue";
import { analyzeInventory } from "../src/offline/analysis";

// Tarefas 11.14 e 11.15: o público é rural, não técnico. Nenhuma tela, alerta
// incluído, mostra jargão de informática ou de estatística.
const JARGON =
  /sincroniz|nuvem|servidor|\bAPI\b|backup|pareamento|concilia|provisório|consolidado|requer internet|offline|amostragem|calendário|simulação|\bID:|token|autonomia|base (limitada|intermediária|ampliada)|crit[ée]rio|sazonalidade/i;

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
};
const out = { ...entry, id: "s", tipo: "SAIDA" as const, quantidade: 5, dataMovimento: "2026-10-15T12:00:00Z" };

function controller(role: "GESTOR" | "OPERADOR" | null) {
  const analysis = analyzeInventory([product], [entry, out], new Date("2026-10-16T12:00:00Z"));
  return {
    ready: ref(true),
    session: ref(role ? { role, farmId: "f", farmNome: "Boa Vista", nome: "Ana", telefone: "+5569999999999" } : null),
    analysis: ref(analysis),
    movements: ref([entry, out]),
    pendingCount: ref(2),
    pendingIds: ref(["e", "s"]),
    reviews: ref([{ id: "r1", message: "Lançamento recusado." }]),
    confirmedBalances: ref({ p: -1 }),
    lastSync: ref("2026-10-16T12:00:00Z"),
    error: ref(""),
    syncing: ref(false),
    backups: ref([{ name: "backup-2026-10-16.db", size: 2048 }]),
    operators: ref([{ id: "o", farmId: "f", nomeOperador: "João", ativo: true, pairingCode: "AGRO-1234", createdAt: "2026-10-01T12:00:00Z" }]),
    operatorsLoading: ref(false),
    operatorsError: ref(""),
    loadOperators: vi.fn(),
    updateOperator: vi.fn(),
    deleteOperator: vi.fn(),
    initialize: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    connect: vi.fn(),
    logout: vi.fn(),
    sync: vi.fn(),
    record: vi.fn(),
    pair: vi.fn().mockResolvedValue({ deviceToken: "t", pairingCode: "AGRO-1234", qrPayload: { farmId: "f", farmNome: "Boa Vista", nomeOperador: "João", deviceToken: "t" } }),
    createProduct: vi.fn(),
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    testWhatsApp: vi.fn(),
    updateTelefone: vi.fn(),
    dispose: vi.fn(),
  };
}

async function visibleTexts(role: "GESTOR" | "OPERADOR") {
  const wrapper = mount(App, { props: { controller: controller(role) as never } });
  const texts: string[] = [];
  const nav = () => wrapper.get('nav[aria-label="Navegação principal"]').findAll("button");
  for (let i = 0; i < nav().length; i++) {
    await nav()[i]!.trigger("click");
    await flushPromises();
    texts.push(wrapper.text());
    if (wrapper.find('[data-testid="saida-p"]').exists()) {
      await wrapper.get('[data-testid="saida-p"]').trigger("click");
      texts.push(wrapper.text());
    }
  }
  if (role === "GESTOR") {
    await nav().find((b) => b.text().includes("Estoque"))!.trigger("click");
    await wrapper.get('[data-testid="new-product"]').trigger("click");
    texts.push(wrapper.text());
    await nav().find((b) => b.text().includes("Operadores"))!.trigger("click");
    await wrapper.get('[data-testid="pairing"]').trigger("click");
    texts.push(wrapper.text());
  }
  wrapper.unmount();
  return texts.join("\n");
}

describe("linguagem simples, sem termos técnicos (tarefa 11.14)", () => {
  it.each(["GESTOR", "OPERADOR"] as const)("nenhuma tela do %s usa jargão de informática", async (role) => {
    const text = await visibleTexts(role);
    expect(text.match(JARGON)?.[0] ?? null).toBeNull();
  });

  it("a tela de entrada também evita jargão, nos três modos", async () => {
    const wrapper = mount(App, { props: { controller: controller(null) as never } });
    const texts = [wrapper.text()];
    for (const button of wrapper.findAll(".auth-options button")) {
      await button.trigger("click");
      texts.push(wrapper.text());
    }
    expect(texts.join("\n").match(JARGON)?.[0] ?? null).toBeNull();
    wrapper.unmount();
  });
});
