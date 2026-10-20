<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { createWorkspace, type Workspace } from "./workspace";
import type { PairingResponse } from "./offline/types";
import UiIcon from "./components/UiIcon.vue";

const props = defineProps<{ controller?: Workspace }>();
const workspace = props.controller ?? createWorkspace();
const {
  session,
  ready,
  analysis,
  movements,
  pendingCount,
  reviews,
  confirmedBalances,
  lastSync,
  error,
  syncing,
  backups,
} = workspace;
const mode = ref<"login" | "register" | "connect">("login");
const tab = ref("overview");
const busy = ref(false);
const feedback = ref("");
const email = ref("");
const password = ref("");
const nome = ref("");
const farmName = ref("");
const telefone = ref("");
const code = ref("");
const search = ref("");
const productId = ref("");
const kind = ref<"ENTRADA" | "SAIDA">("SAIDA");
const quantity = ref<number | "">("");
const destination = ref("");
const movementDate = ref(localDateTime());
const operatorName = ref("");
const pairing = ref<PairingResponse | null>(null);
const qrImage = ref("");
const showPairing = ref(false);
const video = ref<HTMLVideoElement | null>(null);
const camera = ref(false);
let stopScanner: (() => void) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let backupTimer: ReturnType<typeof setInterval> | undefined;
watch(session, () => {
  pairing.value = null;
  qrImage.value = "";
  showPairing.value = false;
  operatorName.value = "";
  productId.value = "";
  quantity.value = "";
  destination.value = "";
  search.value = "";
  tab.value = "overview";
  code.value = "";
  password.value = "";
  stopScanner?.();
  camera.value = false;
});
const filteredProducts = computed(() =>
  analysis.value.products.filter((p) =>
    `${p.nome} ${p.categoria} ${p.lote ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.value.toLocaleLowerCase("pt-BR")),
  ),
);
const selectedProduct = computed(
  () =>
    analysis.value.products.find((p) => p.id === productId.value) ??
    analysis.value.products[0],
);
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR");
const unitValue = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const urgent = computed(
  () => analysis.value.alerts.filter((a) => a.nivel === "URGENTE").length,
);
const hasDeficit = computed(() =>
  Object.values(confirmedBalances.value).some((saldo) => saldo < 0),
);
function localDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
async function act(action: () => Promise<unknown>, success = "") {
  busy.value = true;
  feedback.value = "";
  error.value = "";
  try {
    await action();
    feedback.value = success;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    busy.value = false;
  }
}
async function authenticate() {
  await act(async () => {
    if (mode.value === "connect") await workspace.connect(code.value);
    else if (mode.value === "register")
      await workspace.register({
        nome: nome.value,
        email: email.value,
        senha: password.value,
        nomeFazenda: farmName.value,
        ...(telefone.value ? { telefone: telefone.value } : {}),
      });
    else await workspace.login({ email: email.value, senha: password.value });
    password.value = "";
    code.value = "";
    tab.value = "overview";
    void workspace.sync();
  });
}
async function record() {
  await act(async () => {
    await workspace.record({
      productId: productId.value,
      tipo: kind.value,
      quantidade: Number(quantity.value),
      dataMovimento: new Date(movementDate.value).toISOString(),
      ...(destination.value ? { destino: destination.value } : {}),
    });
    quantity.value = "";
    destination.value = "";
    movementDate.value = localDateTime();
  }, "Movimentação salva neste aparelho. Ela está na fila de sincronização.");
}
async function generatePairing() {
  await act(async () => {
    pairing.value = await workspace.pair(operatorName.value);
    const { default: QRCode } = await import("qrcode");
    qrImage.value = await QRCode.toDataURL(
      JSON.stringify(pairing.value.qrPayload),
      { width: 280, margin: 2, errorCorrectionLevel: "M" },
    );
  });
}
async function scanCamera() {
  await act(async () => {
    camera.value = true;
    await nextTick();
    if (!video.value) return;
    const { BrowserQRCodeReader } = await import("@zxing/browser");
    const controls = await new BrowserQRCodeReader().decodeFromVideoDevice(
      undefined,
      video.value,
      (result) => {
        if (result) {
          code.value = result.getText();
          stopScanner?.();
          camera.value = false;
        }
      },
    );
    stopScanner = () => controls.stop();
    if (!camera.value) controls.stop();
  });
}
async function scanImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await act(async () => {
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      code.value = (
        await new BrowserQRCodeReader().decodeFromImageUrl(url)
      ).getText();
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
async function restore(name: string) {
  if (
    !window.confirm(
      "Restaurar este backup? O estado atual terá uma cópia de recuperação. Movimentações posteriores ao backup sairão do banco ativo; confira as pendências antes de continuar.",
    )
  )
    return;
  await act(
    () => workspace.restoreBackup(name),
    "Backup restaurado. Confira o histórico antes de sincronizar.",
  );
}
const online = () => {
  void workspace.sync();
};
onMounted(async () => {
  await workspace.initialize();
  if (!props.controller) {
    void workspace.sync();
    timer = setInterval(online, 30_000);
    backupTimer = setInterval(() => {
      void workspace.maintainBackups();
    }, 60_000);
    window.addEventListener("online", online);
  }
});
onUnmounted(() => {
  camera.value = false;
  if (timer) clearInterval(timer);
  if (backupTimer) clearInterval(backupTimer);
  window.removeEventListener("online", online);
  stopScanner?.();
  workspace.dispose();
});
</script>

<template>
  <div v-if="!ready" class="opening" role="status">
    <span class="brand-icon"><UiIcon name="tractor" :size="24" /></span>
    <h1>Abrindo sua fazenda…</h1>
    <p>Preparando os dados deste aparelho.</p>
  </div>
  <div v-else-if="!session" class="welcome">
    <section class="welcome-story">
      <a class="brand" href="#"
        ><span class="brand-icon"><UiIcon name="tractor" :size="24" /></span>
        AgroHacka</a
      >
      <div>
        <span class="eyebrow">GESTÃO RURAL · DO CAMPO À DECISÃO</span>
        <h1>Gestão de insumos da propriedade rural.</h1>
        <p>
          Saiba o que precisa de atenção, acompanhe seus insumos e registre o
          trabalho, mesmo sem internet.
        </p>
      </div>
      <div class="welcome-note">
        <UiIcon name="wifi-off" :size="20" /> Os registros ficam neste aparelho
        e sincronizam quando houver conexão.
      </div>
    </section>
    <section class="welcome-form">
      <div class="form-card">
        <span class="eyebrow">BEM-VINDO À PROPRIEDADE</span>
        <h2>
          {{
            mode === "register"
              ? "Comece pela sua fazenda"
              : mode === "connect"
                ? "Conecte seu aparelho"
                : "Bom ter você por aqui"
          }}
        </h2>
        <p class="muted">
          {{
            mode === "connect"
              ? "Peça ao gestor o QR Code ou código de pareamento."
              : "O primeiro acesso precisa de conexão. Depois, continue trabalhando offline."
          }}
        </p>
        <div class="auth-options">
          <button
            :class="{ active: mode === 'login' }"
            :aria-pressed="mode === 'login'"
            @click="mode = 'login'"
          >
            Entrar</button
          ><button
            :class="{ active: mode === 'register' }"
            :aria-pressed="mode === 'register'"
            @click="mode = 'register'"
          >
            Criar nova fazenda</button
          ><button
            :class="{ active: mode === 'connect' }"
            :aria-pressed="mode === 'connect'"
            @click="mode = 'connect'"
          >
            Conectar a uma fazenda
          </button>
        </div>
        <p v-if="error" class="notice error" role="alert">
          <UiIcon name="circle-alert" /><span>{{ error }}</span>
        </p>
        <form @submit.prevent="authenticate">
          <template v-if="mode !== 'connect'">
            <label v-if="mode === 'register'"
              >Seu nome<input
                v-model="nome"
                autocomplete="name"
                required
                maxlength="100"
            /></label>
            <label v-if="mode === 'register'"
              >Nome da fazenda<input
                v-model="farmName"
                required
                maxlength="150"
                placeholder="Ex.: Fazenda Boa Vista"
            /></label>
            <label
              >E-mail<input
                v-model="email"
                type="email"
                autocomplete="username"
                required
            /></label>
            <label
              >Senha<input
                v-model="password"
                type="password"
                :autocomplete="
                  mode === 'register' ? 'new-password' : 'current-password'
                "
                required
            /></label>
            <label v-if="mode === 'register'"
              >WhatsApp do gestor <span class="muted">(opcional)</span
              ><input
                v-model="telefone"
                type="tel"
                autocomplete="tel"
                placeholder="+55 69 …"
            /></label>
          </template>
          <template v-else>
            <label
              >Código ou conteúdo do QR Code<textarea
                v-model="code"
                required
                rows="3"
                placeholder="AGRO-XXXX"
              ></textarea>
            </label>
            <div class="split">
              <button
                type="button"
                class="secondary"
                :disabled="busy"
                @click="scanCamera"
              >
                <UiIcon name="camera" /> Ler com a câmera</button
              ><label class="file-button secondary"
                ><UiIcon name="image" /> Escolher imagem QR<input
                  type="file"
                  accept="image/*"
                  @change="scanImage"
              /></label>
            </div>
            <video
              v-if="camera"
              ref="video"
              class="camera"
              muted
              playsinline
            ></video>
            <button
              v-if="camera"
              type="button"
              class="text-button"
              @click="
                stopScanner?.();
                camera = false;
              "
            >
              <UiIcon name="x" /> Fechar câmera
            </button>
          </template>
          <button class="primary full" :disabled="busy">
            {{
              busy
                ? "Aguarde…"
                : mode === "register"
                  ? "Criar fazenda"
                  : mode === "connect"
                    ? "Conectar aparelho"
                    : "Entrar na fazenda"
            }}
            <UiIcon :name="busy ? 'refresh' : 'chevron-right'" />
          </button>
        </form>
      </div>
      <small>AgroHack 2026 · Gestão inteligente de insumos rurais</small>
    </section>
  </div>
  <div v-else class="workspace">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="tab = 'overview'"
        ><span class="brand-icon"><UiIcon name="tractor" :size="24" /></span>
        AgroHacka</a
      >
      <div class="farm-card">
        <span class="eyebrow">SUA PROPRIEDADE</span
        ><strong>{{ session.farmNome }}</strong
        ><span>{{
          session.role === "GESTOR" ? "Painel do gestor" : "Painel do operador"
        }}</span>
      </div>
      <nav aria-label="Navegação principal">
        <button
          :class="{ active: tab === 'overview' }"
          :aria-current="tab === 'overview' ? 'page' : undefined"
          @click="tab = 'overview'"
        >
          <UiIcon name="dashboard" :size="18" /><span>Visão geral</span></button
        ><button
          :class="{ active: tab === 'stock' }"
          :aria-current="tab === 'stock' ? 'page' : undefined"
          @click="tab = 'stock'"
        >
          <UiIcon name="package" :size="18" /><span>Estoque</span></button
        ><button
          :class="{ active: tab === 'history' }"
          :aria-current="tab === 'history' ? 'page' : undefined"
          @click="tab = 'history'"
        >
          <UiIcon name="history" :size="18" /><span>Histórico</span></button
        ><button
          :class="{ active: tab === 'backups' }"
          :aria-current="tab === 'backups' ? 'page' : undefined"
          @click="tab = 'backups'"
        >
          <UiIcon name="database-backup" :size="18" /><span>Backups</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="avatar"><UiIcon name="user" :size="18" /></div>
        <div>
          <strong>{{ session.nome }}</strong
          ><small>{{
            session.role === "GESTOR" ? "Gestor" : "Operador"
          }}</small>
        </div>
        <button
          class="text-button"
          :disabled="syncing || busy"
          @click="act(workspace.logout)"
        >
          <UiIcon name="log-out" /> Sair
        </button>
      </div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <span class="sync-status" role="status" :aria-busy="syncing"
          ><UiIcon
            :name="
              syncing ? 'refresh' : pendingCount > 0 ? 'wifi-off' : 'hard-drive'
            "
            :class="{ pending: pendingCount > 0 }"
          />
          {{
            syncing
              ? "Sincronizando…"
              : pendingCount > 0
                ? `${pendingCount} registro(s) pendente(s)`
                : "Dados salvos neste aparelho"
          }}</span
        ><button
          class="secondary"
          :disabled="syncing || busy"
          @click="workspace.sync"
        >
          <UiIcon name="refresh" />{{
            syncing ? "Sincronizando…" : "Sincronizar agora"
          }}
        </button>
      </header>
      <div class="page-heading">
        <div>
          <span class="eyebrow">{{
            new Date().toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          }}</span>
          <h1>
            {{
              tab === "overview"
                ? "Visão geral da propriedade"
                : tab === "stock"
                  ? "Estoque de insumos"
                  : tab === "history"
                    ? "Histórico de movimentações"
                    : "Backups e recuperação"
            }}
          </h1>
          <p class="muted">
            {{
              lastSync
                ? `Última sincronização: ${formatDate(lastSync)}`
                : "Os dados deste aparelho estão disponíveis offline."
            }}
          </p>
        </div>
        <button
          v-if="session.role === 'GESTOR'"
          data-testid="pairing"
          class="primary"
          @click="showPairing = true"
        >
          <UiIcon name="plus" /> Conectar operador
        </button>
      </div>
      <p v-if="error" class="notice error" role="alert">
        <UiIcon name="circle-alert" /><span>{{ error }}</span>
      </p>
      <p v-if="feedback" class="notice success" role="status">
        <UiIcon name="circle-check" /><span>{{ feedback }}</span>
      </p>
      <section
        v-if="reviews.length"
        class="panel"
        data-testid="sync-reviews"
        aria-label="Registros para revisão"
      >
        <h2>Registros para revisão</h2>
        <p class="muted">
          As tentativas foram preservadas, mas não compõem o saldo confirmado.
          Confira com o gestor antes de registrar uma correção.
        </p>
        <p v-for="review in reviews" :key="review.id" class="notice error">
          <UiIcon name="circle-alert" /><span
            >{{ review.message }} <small>ID: {{ review.id }}</small></span
          >
        </p>
      </section>
      <section
        v-if="analysis.products.length"
        class="panel"
        data-testid="sync-balances"
        aria-label="Conciliação do estoque"
      >
        <h2>Estoque conhecido e registros locais</h2>
        <p class="muted">
          Última atualização da nuvem:
          {{ lastSync ? formatDate(lastSync) : "ainda não confirmada" }}. Outros
          aparelhos podem ter registros offline ainda não recebidos.
        </p>
        <p v-for="p in analysis.products" :key="p.id">
          <strong>{{ p.nome }}</strong> · Confirmado conhecido:
          {{ unitValue(confirmedBalances[p.id] ?? 0) }} {{ p.unidadeMedida }} ·
          Provisório neste aparelho: {{ unitValue(p.saldo) }}
          {{ p.unidadeMedida }}
        </p>
        <p
          v-if="hasDeficit"
          class="notice error"
          role="alert"
          data-testid="sync-deficit"
        >
          <UiIcon name="circle-alert" /><span
            >Saldo consolidado negativo. Os registros foram preservados. O
            gestor deve conferir entradas, retiradas e possíveis duplicidades
            antes de corrigir o estoque.</span
          >
        </p>
      </section>
      <template v-if="tab === 'overview'">
        <section class="metrics" aria-label="Resumo da propriedade">
          <article>
            <span>CAPITAL EM ESTOQUE</span
            ><strong>{{ money(analysis.totalValue) }}</strong
            ><small>Quantidade disponível × preço de aquisição</small>
          </article>
          <article>
            <span>INSUMOS ACOMPANHADOS</span
            ><strong>{{ analysis.products.length }}</strong
            ><small
              >{{ Object.keys(analysis.balancesByUnit).length }} unidade(s) de
              medida, saldos separados</small
            >
          </article>
          <article :class="{ urgent: urgent > 0 }">
            <span>ATENÇÃO IMEDIATA</span
            ><strong>{{ urgent.toString().padStart(2, "0") }}</strong
            ><small>Alertas classificados como urgentes</small>
          </article>
        </section>
        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-heading">
              <h2>Alertas prioritários</h2>
              <span class="badge">{{ analysis.alerts.length }} alertas</span>
            </div>
            <div v-if="!analysis.alerts.length" class="empty">
              <UiIcon name="circle-check" :size="24" />
              <h3>
                {{
                  analysis.products.length
                    ? "Nenhum alerta nesta análise"
                    : "Tudo começa pelos seus dados"
                }}
              </h3>
              <p>
                {{
                  analysis.products.length
                    ? "Continue acompanhando as movimentações da propriedade."
                    : "Sincronize para receber o catálogo cadastrado na API. Depois, registre entradas e saídas neste aparelho."
                }}
              </p>
            </div>
            <article
              v-for="alert in analysis.alerts"
              :key="alert.id"
              class="alert-card"
              :class="alert.nivel.toLowerCase()"
            >
              <span class="severity"
                ><UiIcon
                  :name="
                    alert.nivel === 'URGENTE'
                      ? 'circle-alert'
                      : alert.nivel === 'ATENCAO'
                        ? 'info'
                        : 'check'
                  "
                  :size="14"
                />{{
                  alert.nivel === "URGENTE"
                    ? "Urgente"
                    : alert.nivel === "ATENCAO"
                      ? "Atenção"
                      : "Acompanhar"
                }}</span
              >
              <h3>{{ alert.titulo }}</h3>
              <p>{{ alert.justificativa }}</p>
            </article>
          </section>
          <section class="panel movement-panel">
            <span class="eyebrow">REGISTRO OFFLINE</span>
            <h2>Movimente seu estoque</h2>
            <div class="movement-kind">
              <button
                :class="{ active: kind === 'SAIDA' }"
                :aria-pressed="kind === 'SAIDA'"
                @click="kind = 'SAIDA'"
              >
                <UiIcon name="arrow-up-right" /> Baixa rápida</button
              ><button
                :class="{ active: kind === 'ENTRADA' }"
                :aria-pressed="kind === 'ENTRADA'"
                @click="kind = 'ENTRADA'"
              >
                <UiIcon name="arrow-down-left" /> Entrada de compra
              </button>
            </div>
            <form @submit.prevent="record">
              <label
                >Insumo<select v-model="productId" required>
                  <option value="" disabled>Selecione um insumo</option>
                  <option
                    v-for="p in analysis.products"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nome }} · {{ unitValue(p.saldo) }}
                    {{ p.unidadeMedida }}
                  </option>
                </select></label
              >
              <div class="split">
                <label
                  >Quantidade<input
                    v-model="quantity"
                    type="number"
                    min="0.000001"
                    step="any"
                    required /></label
                ><label
                  >Responsável<input
                    data-testid="responsavel"
                    :value="session.nome"
                    readonly
                    aria-readonly="true"
                /></label>
              </div>
              <label
                >Data e hora<input
                  v-model="movementDate"
                  type="datetime-local"
                  required /></label
              ><label
                >Destino / observação <span class="muted">(opcional)</span
                ><input
                  v-model="destination"
                  maxlength="300"
                  placeholder="Talhão, equipamento…" /></label
              ><button
                class="primary full"
                :disabled="busy || !analysis.products.length"
              >
                <UiIcon name="save" />{{
                  busy ? "Salvando…" : "Salvar neste aparelho"
                }}
              </button>
            </form>
            <p class="helper">
              O responsável é vinculado à sessão. Não é necessário ter conexão
              para salvar.
            </p>
          </section>
        </div>
        <section class="panel consumption">
          <div class="section-heading">
            <div>
              <h2>Consumo ao longo do tempo</h2>
              <p class="muted">
                Até 30 dias; dias sem retirada também entram na média.
              </p>
            </div>
            <select v-model="productId" aria-label="Insumo para analisar">
              <option value="" disabled>Selecione</option>
              <option v-for="p in analysis.products" :key="p.id" :value="p.id">
                {{ p.nome }}
              </option>
            </select>
          </div>
          <div
            v-if="selectedProduct"
            class="chart"
            :aria-label="`Consumo diário de ${selectedProduct.nome}`"
          >
            <div
              v-for="day in selectedProduct.consumoDiario"
              :key="day.dia"
              class="chart-column"
            >
              <span
                class="chart-bar"
                :style="{
                  height: `${Math.max(2, (day.quantidade / Math.max(1, ...selectedProduct.consumoDiario.map((d) => d.quantidade))) * 115)}px`,
                }"
                :title="`${day.dia}: ${day.quantidade} ${selectedProduct.unidadeMedida}`"
              ></span
              ><small>{{ day.dia.slice(8) }}</small>
            </div>
          </div>
          <p v-else class="empty">
            O histórico aparecerá após receber ou registrar movimentações.
          </p>
        </section>
      </template>
      <section v-if="tab === 'stock'" class="panel">
        <div class="section-heading">
          <div>
            <h2>Estoque e curva ABC</h2>
            <p class="muted">
              Classificação pelo valor financeiro armazenado: faixas acumuladas
              de 80%, 95% e 100%.
            </p>
          </div>
          <div class="search-field">
            <UiIcon name="search" /><input
              v-model="search"
              type="search"
              aria-label="Buscar insumos"
              placeholder="Buscar insumo, categoria ou lote"
            />
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Saldo</th>
                <th>Mínimo</th>
                <th>Duração estimada</th>
                <th>Valor armazenado</th>
                <th>ABC</th>
                <th>Validade</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in filteredProducts" :key="p.id">
                <td>
                  <strong>{{ p.nome }}</strong
                  ><small
                    >{{ p.categoria
                    }}{{ p.lote ? ` · Lote ${p.lote}` : "" }}</small
                  >
                </td>
                <td>{{ unitValue(p.saldo) }} {{ p.unidadeMedida }}</td>
                <td>{{ unitValue(p.estoqueMinimo) }} {{ p.unidadeMedida }}</td>
                <td>
                  {{
                    p.diasRestantes === null
                      ? "Sem histórico"
                      : `${unitValue(p.diasRestantes)} dias`
                  }}
                </td>
                <td>
                  {{
                    p.precoAquisicao === null
                      ? "Preço não informado"
                      : money(p.valorEstoque)
                  }}
                </td>
                <td>
                  <span class="badge">{{ p.classeAbc }}</span>
                </td>
                <td>
                  {{
                    p.validade
                      ? p.validade.slice(0, 10).split("-").reverse().join("/")
                      : "Não informada"
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!filteredProducts.length" class="empty">
          Nenhum insumo encontrado. O cadastro de produtos é recebido da API.
        </p>
      </section>
      <section v-if="tab === 'history'" class="panel">
        <div class="section-heading">
          <h2>Histórico de movimentações</h2>
          <span class="badge">{{ movements.length }} registros</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Insumo</th>
                <th>Movimento</th>
                <th>Quantidade</th>
                <th>Responsável</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td>{{ formatDate(m.dataMovimento) }}</td>
                <td>
                  {{
                    analysis.products.find((p) => p.id === m.productId)?.nome ??
                    m.productId
                  }}
                </td>
                <td>
                  <span
                    class="badge"
                    :class="m.tipo === 'ENTRADA' ? 'success' : ''"
                    >{{ m.tipo === "ENTRADA" ? "Entrada" : "Saída" }}</span
                  >
                </td>
                <td>
                  {{ unitValue(m.quantidade) }}
                  {{
                    analysis.products.find((p) => p.id === m.productId)
                      ?.unidadeMedida
                  }}
                </td>
                <td>{{ m.responsavel }}</td>
                <td>{{ m.destino || "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!movements.length" class="empty">
          As entradas e saídas da propriedade aparecerão aqui.
        </p>
      </section>
      <section v-if="tab === 'backups'" class="panel">
        <div class="section-heading">
          <div>
            <h2>Backups locais</h2>
            <p class="muted">
              Uma cópia automática por dia, com retenção dos últimos 7 dias
              neste aparelho.
            </p>
          </div>
          <button
            class="primary"
            :disabled="busy || syncing"
            @click="act(workspace.createBackup, 'Backup do dia disponível.')"
          >
            <UiIcon name="database-backup" /> Criar backup do dia
          </button>
        </div>
        <p class="notice">
          A restauração cria primeiro uma cópia de recuperação do estado atual.
          Os backups ficam neste aparelho.
        </p>
        <ul class="backup-list">
          <li v-for="backup in backups" :key="backup.name">
            <div>
              <strong>{{ backup.name }}</strong
              ><small>{{ unitValue(backup.size / 1024) }} KB</small>
            </div>
            <button
              class="secondary"
              :disabled="busy || syncing"
              @click="restore(backup.name)"
            >
              <UiIcon name="history" /> Restaurar
            </button>
          </li>
        </ul>
        <p v-if="!backups.length" class="empty">
          Nenhum backup disponível ainda.
        </p>
      </section>
      <footer class="page-footer">
        AgroHacka · Decisões fundamentadas nos registros da propriedade.<span
          >Estimativas dependem da qualidade e da quantidade do histórico.</span
        >
      </footer>
    </main>
    <div
      v-if="showPairing"
      class="modal-backdrop"
      @click.self="showPairing = false"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pair-title"
        class="modal"
      >
        <button
          class="modal-close"
          aria-label="Fechar pareamento"
          title="Fechar pareamento"
          @click="showPairing = false"
        >
          <UiIcon name="x" /></button
        ><span class="eyebrow">EQUIPE CONECTADA</span>
        <h2 id="pair-title">Conectar operador</h2>
        <p class="muted">
          O código vincula o aparelho e identifica quem registra cada
          movimentação.
        </p>
        <form @submit.prevent="generatePairing">
          <label
            >Nome do operador<input
              v-model="operatorName"
              required
              maxlength="100" /></label
          ><button class="primary full" :disabled="busy">
            <UiIcon name="qr-code" />{{
              busy ? "Gerando…" : "Gerar código e QR Code"
            }}
          </button>
        </form>
        <div v-if="pairing" class="pairing-result">
          <img :src="qrImage" alt="QR Code de pareamento com a fazenda" />
          <p>Código manual</p>
          <strong class="pairing-code">{{ pairing.pairingCode }}</strong
          ><small
            >Compartilhe somente com
            {{ pairing.qrPayload.nomeOperador }}.</small
          >
        </div>
      </section>
    </div>
  </div>
</template>
