// Harness de revisão visual: fora da entrada de produção, sem API ou SQLite.
import { createApp, ref } from "vue";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "../src/style.css";
import App from "../src/App.vue";
import { analyzeInventory } from "../src/offline/analysis";
import type { Movement, Product, Session } from "../src/offline/types";
import type { Workspace } from "../src/workspace";
import type { PairedOperator } from "../src/offline/types";

const now = new Date();
const date = (days: number) =>
  new Date(now.getTime() + days * 86_400_000).toISOString();
const products: Product[] = [
  {
    id: "diesel",
    farmId: "f",
    nome: "Óleo diesel S10",
    categoria: "Combustíveis",
    unidadeMedida: "L",
    estoqueMinimo: 50,
    precoAquisicao: 6.4,
    validade: null,
    fornecedor: "Distribuidora Rural",
  },
  {
    id: "semente",
    farmId: "f",
    nome: "Sementes de milho",
    categoria: "Sementes",
    unidadeMedida: "kg",
    estoqueMinimo: 40,
    precoAquisicao: 26,
    validade: date(90),
    lote: "MIL-2026-04",
  },
  {
    id: "herbicida",
    farmId: "f",
    nome: "Herbicida seletivo",
    categoria: "Defensivos",
    unidadeMedida: "L",
    estoqueMinimo: 10,
    // Demonstrates partial valuation without using real inventory data.
    precoAquisicao: null,
    validade: date(3),
    lote: "HER-2026-09",
  },
];
const movement = (
  id: string,
  productId: string,
  tipo: "ENTRADA" | "SAIDA",
  quantidade: number,
  days: number,
): Movement => ({
  id,
  farmId: "f",
  productId,
  tipo,
  quantidade,
  dataMovimento: date(days),
  responsavel: "Ana Oliveira",
  destino: tipo === "SAIDA" ? "Talhão 03" : "Compra de insumos",
});
const movements = ref([
  movement("1", "diesel", "ENTRADA", 150, -25),
  ...[22, 18, 14, 10, 6].map((days, index) =>
    movement(`d${index}`, "diesel", "SAIDA", 26, -days),
  ),
  movement("2", "semente", "ENTRADA", 240, -20),
  movement("3", "semente", "SAIDA", 40, -3),
  movement("4", "herbicida", "ENTRADA", 80, -12),
  movement("5", "herbicida", "SAIDA", 5, -4),
]);
const gestor: Session = {
  role: "GESTOR",
  farmId: "f",
  farmNome: "Fazenda Boa Vista",
  nome: "Ana Oliveira",
  userId: "u",
  telefone: "+5569999999999",
};
const operador: Session = {
  ...gestor,
  role: "OPERADOR",
  nome: "Carlos Oliveira",
  deviceId: "d",
};
const profile = new URLSearchParams(location.search).get("profile");
const session = ref<Session | null>(
  profile === "guest" ? null : profile === "operador" ? operador : gestor,
);
const analysis = ref(analyzeInventory(products, movements.value, now));
const operators = ref<PairedOperator[]>([
  {
    id: "ana",
    farmId: "f",
    nomeOperador: "Ana Oliveira",
    ativo: true,
    pairingCode: "AGRO-TEST",
    createdAt: date(-3),
  },
  {
    id: "carlos",
    farmId: "f",
    nomeOperador: "Carlos Oliveira",
    ativo: true,
    pairingCode: "AGRO-DEMO",
    createdAt: date(-2),
  },
  {
    id: "bruno",
    farmId: "f",
    nomeOperador: "Bruno Santos",
    ativo: false,
    pairingCode: null,
    createdAt: date(-5),
  },
]);
const controller: Workspace = {
  operators,
  operatorsLoading: ref(false),
  operatorsError: ref(""),
  async loadOperators() {},
  ready: ref(true),
  session,
  analysis,
  movements,
  pendingCount: ref(2),
  reviews: ref([]),
  confirmedBalances: ref(
    Object.fromEntries(analysis.value.products.map((p) => [p.id, p.saldo])),
  ),
  lastSync: ref(date(-1)),
  error: ref(""),
  syncing: ref(false),
  backups: ref([
    { name: `backup-${date(0).slice(0, 10)}.db`, size: 131072 },
    { name: `backup-${date(-1).slice(0, 10)}.db`, size: 126976 },
  ]),
  async initialize() {},
  async refresh() {},
  async maintainBackups() {},
  async sync() {},
  async createProduct(input) {
    const product: Product = {
      ...input,
      farmId: "f",
      validade: input.validade ? new Date(input.validade).toISOString() : null,
      precoAquisicao: input.precoAquisicao ?? null,
    };
    products.push(product);
    analysis.value = analyzeInventory(products, movements.value);
    return product;
  },
  async login() {
    session.value = gestor;
  },
  async register() {
    session.value = gestor;
  },
  async connect() {
    session.value = operador;
  },
  async logout() {
    session.value = null;
  },
  async testWhatsApp() {
    return { simulado: true };
  },
  async updateTelefone(value: string) {
    return value.trim() || undefined;
  },
  async record(input) {
    movements.value.push({
      ...input,
      id: crypto.randomUUID(),
      farmId: "f",
      responsavel: session.value?.nome ?? gestor.nome,
    });
    analysis.value = analyzeInventory(products, movements.value);
  },
  async pair(nomeOperador) {
    operators.value.push({
      id: crypto.randomUUID(),
      farmId: "f",
      nomeOperador,
      ativo: true,
      pairingCode: "AGRO-DEMO",
      createdAt: date(0),
    });
    return {
      pairingCode: "AGRO-DEMO",
      deviceToken: "visual-test-token",
      qrPayload: {
        farmId: "f",
        farmNome: gestor.farmNome,
        nomeOperador,
        deviceToken: "visual-test-token",
      },
    };
  },
  async createBackup() {},
  async restoreBackup() {},
  dispose() {},
};
createApp(App, { controller }).mount("#app");
