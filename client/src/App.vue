<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { createWorkspace, type Workspace } from "./workspace";
import type { PairingResponse } from "./offline/types";
import UiIcon from "./components/UiIcon.vue";
import OperatorsPanel from "./components/OperatorsPanel.vue";
import ProductForm from "./components/ProductForm.vue";
import { APP_VERSION } from "./app-version";

const props = defineProps<{ controller?: Workspace }>();
const workspace = props.controller ?? createWorkspace();
const {
  session,
  ready,
  analysis,
  movements,
  pendingCount,
  pendingIds,
  reviews,
  confirmedBalances,
  lastSync,
  error,
  syncing,
  backups,
  operators,
  operatorsLoading,
  operatorsError,
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
const category = ref("");
const stockStatus = ref("");
const showProduct = ref(false);
const productFormKey = ref(0);
const productStarted = ref(false);
watch(showProduct, (value) => {
  if (value) productStarted.value = true;
});
const showMovement = ref(false);
const movementError = ref("");
const categories = computed(() =>
  [...new Set(analysis.value.products.map((p) => p.categoria))].sort(),
);
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
const testingWhatsApp = ref(false);
const savingPhone = ref(false);
const phoneDraft = ref(session.value?.telefone ?? "");
watch(
  () => session.value?.telefone,
  (telefone) => {
    phoneDraft.value = telefone ?? "";
  },
);
const whatsappFeedback = ref("");
const whatsappSimulated = ref(false);
const whatsappError = ref("");
let stopScanner: (() => void) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let backupTimer: ReturnType<typeof setInterval> | undefined;
watch(session, () => {
  pairing.value = null;
  qrImage.value = "";
  showPairing.value = false;
  operatorName.value = "";
  productId.value = "";
  chartProductId.value = "";
  quantity.value = "";
  destination.value = "";
  search.value = "";
  category.value = "";
  stockStatus.value = "";
  showProduct.value = false;
  productFormKey.value++;
  productStarted.value = false;
  showMovement.value = false;
  tab.value = "overview";
  code.value = "";
  password.value = "";
  whatsappFeedback.value = "";
  whatsappSimulated.value = false;
  whatsappError.value = "";
  stopScanner?.();
  camera.value = false;
});
const filteredProducts = computed(() =>
  analysis.value.products.filter(
    (p) =>
      `${p.nome} ${p.categoria} ${p.lote ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.value.trim().toLocaleLowerCase("pt-BR")) &&
      (!category.value || p.categoria === category.value) &&
      (!stockStatus.value ||
        (stockStatus.value === "low" && p.saldo <= p.estoqueMinimo) ||
        (stockStatus.value === "empty" && p.saldo <= 0) ||
        (stockStatus.value === "unpriced" && p.precoAquisicao === null)),
  ),
);
// The chart has its own selection: browsing consumption must not change the form.
const chartProductId = ref("");
const chartProduct = computed(
  () =>
    analysis.value.products.find((p) => p.id === chartProductId.value) ??
    analysis.value.products[0],
);
const financialPartial = computed(
  () => analysis.value.unpricedProductCount > 0,
);
const financialUnavailable = computed(
  () => financialPartial.value && analysis.value.pricedProductCount === 0,
);
const evidenceLabels = {
  BAIXA: "Poucos dados",
  MEDIA: "Dados razoáveis",
  ALTA: "Bons dados",
  INDISPONIVEL: "Estimativa indisponível",
};
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
// Conciliação só importa na aba Estoque e quando há o que conciliar.
const showReconciliation = computed(
  () =>
    tab.value === "stock" &&
    analysis.value.products.length > 0 &&
    (pendingCount.value > 0 || hasDeficit.value || reviews.value.length > 0),
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
  }, "Salvo neste aparelho. Será enviado quando houver internet.");
}
const formProduct = computed(() =>
  analysis.value.products.find((p) => p.id === productId.value),
);
// Offline-first records the fact even past the balance; warn, never block.
const exceedsBalance = computed(
  () =>
    kind.value === "SAIDA" &&
    !!formProduct.value &&
    Number(quantity.value) > formProduct.value.saldo,
);
// The overview form is far below the page notices on a phone: answer next to it.
const formFeedback = ref("");
const formError = ref("");
async function recordFromForm() {
  formFeedback.value = "";
  formError.value = "";
  await record();
  if (feedback.value) {
    formFeedback.value = feedback.value;
    feedback.value = "";
  } else if (error.value) {
    formError.value = error.value;
    error.value = "";
  }
}
function openMovement(id: string, type: "ENTRADA" | "SAIDA") {
  productId.value = id;
  kind.value = type;
  quantity.value = "";
  destination.value = "";
  movementDate.value = localDateTime();
  movementError.value = "";
  showMovement.value = true;
}
async function recordFromStock() {
  if (busy.value) return;
  movementError.value = "";
  await record();
  if (feedback.value) showMovement.value = false;
  else movementError.value = error.value;
}
function productSaved() {
  showProduct.value = false;
  productFormKey.value++;
  search.value = "";
  category.value = "";
  stockStatus.value = "";
  feedback.value =
    "Insumo cadastrado. Registre uma entrada para adicionar saldo.";
}
async function generatePairing() {
  await act(async () => {
    pairing.value = await workspace.pair(operatorName.value);
    if (tab.value === "operators") void workspace.loadOperators(true);
    const { default: QRCode } = await import("qrcode");
    qrImage.value = await QRCode.toDataURL(
      JSON.stringify(pairing.value.qrPayload),
      { width: 280, margin: 2, errorCorrectionLevel: "M" },
    );
  });
}
async function sendWhatsAppTest() {
  if (testingWhatsApp.value) return;
  const phone = session.value?.telefone;
  testingWhatsApp.value = true;
  whatsappFeedback.value = "";
  whatsappSimulated.value = false;
  whatsappError.value = "";
  try {
    const { simulado } = await workspace.testWhatsApp();
    whatsappSimulated.value = simulado;
    whatsappFeedback.value = simulado
      ? "O envio por WhatsApp ainda não está ativado no sistema, então nenhuma mensagem foi enviada."
      : `Mensagem de teste enviada para ${phone}. Confira o WhatsApp do gestor.`;
  } catch (cause) {
    whatsappError.value = `Não foi possível enviar o teste: ${describeWhatsAppFailure(cause)}`;
  } finally {
    testingWhatsApp.value = false;
  }
}
async function saveWhatsAppNumber() {
  if (savingPhone.value) return;
  savingPhone.value = true;
  whatsappFeedback.value = "";
  whatsappSimulated.value = false;
  whatsappError.value = "";
  try {
    const telefone = await workspace.updateTelefone(phoneDraft.value);
    whatsappFeedback.value = telefone
      ? `WhatsApp atualizado. Os alertas serão enviados para ${telefone}.`
      : "Alertas de WhatsApp desativados.";
  } catch (cause) {
    whatsappError.value = `Não foi possível salvar o número: ${describeWhatsAppFailure(cause)}`;
  } finally {
    savingPhone.value = false;
  }
}
function describeWhatsAppFailure(cause: unknown) {
  const offline =
    cause instanceof TypeError ||
    (cause instanceof Error &&
      (cause.name === "TimeoutError" || cause.name === "AbortError"));
  if (offline)
    return "sem internet no momento. Tente de novo quando tiver sinal.";
  return cause instanceof Error ? cause.message : String(cause);
}
const cameraFallback = " Digite o código ou escolha uma imagem do QR Code.";
const cameraErrors: Record<string, string> = {
  NotAllowedError:
    "Sem permissão para usar a câmera. Libere o acesso nas configurações do aparelho." +
    cameraFallback,
  NotFoundError:
    "Nenhuma câmera foi encontrada neste aparelho." + cameraFallback,
  NotReadableError:
    "A câmera está em uso por outro aplicativo ou não pôde ser aberta." +
    cameraFallback,
};
function openOperators() {
  tab.value = "operators";
  void workspace.loadOperators();
}
async function scanCamera() {
  await act(async () => {
    camera.value = true;
    try {
      await nextTick();
      if (!video.value) return;
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const controls = await new BrowserQRCodeReader().decodeFromVideoDevice(
        undefined,
        video.value,
        (result) => {
          if (!result || !camera.value) return;
          code.value = result.getText();
          stopScanner?.();
          camera.value = false;
          void authenticate();
        },
      );
      stopScanner = () => controls.stop();
      if (!camera.value) controls.stop();
    } catch (cause) {
      camera.value = false;
      const friendly = cause instanceof Error && cameraErrors[cause.name];
      throw friendly ? new Error(friendly) : cause;
    }
  });
}
async function scanImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  let scanned = false;
  await act(async () => {
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      code.value = (
        await new BrowserQRCodeReader().decodeFromImageUrl(url)
      ).getText();
      scanned = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  if (scanned) await authenticate();
}
// "backup-2026-10-27.db" → "27/10/2026"; other names are shown as they are.
function backupDate(name: string) {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(name);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : name;
}
async function restore(name: string) {
  if (
    !window.confirm(
      `Voltar para a cópia de ${backupDate(name)}? Os lançamentos feitos depois dela saem deste aparelho. Antes, o estado atual também é guardado.`,
    )
  )
    return;
  await act(
    () => workspace.restoreBackup(name),
    "Cópia restaurada. Confira o histórico antes de atualizar.",
  );
}
const online = () => {
  void workspace.sync();
};
// navigator.onLine only says there is a network, not that the API answers;
// pending records still tell what has not reached the cloud.
const isOnline = ref(navigator.onLine);
const updateOnline = () => {
  isOnline.value = navigator.onLine;
};
const syncLabel = computed(() => {
  if (syncing.value) return "Atualizando…";
  if (!isOnline.value)
    return pendingCount.value > 0
      ? `Sem internet · ${pendingCount.value} lançamento(s) esperando envio`
      : "Sem internet · tudo guardado neste aparelho";
  if (pendingCount.value > 0)
    return `${pendingCount.value} lançamento(s) esperando envio`;
  return lastSync.value
    ? `Tudo enviado · ${new Date(lastSync.value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "Tudo guardado neste aparelho";
});
const syncIcon = computed(() =>
  syncing.value
    ? "refresh"
    : !isOnline.value
      ? "wifi-off"
      : pendingCount.value > 0
        ? "hard-drive"
        : lastSync.value
          ? "circle-check"
          : "hard-drive",
);
onMounted(async () => {
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
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
  window.removeEventListener("online", updateOnline);
  window.removeEventListener("offline", updateOnline);
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
        <p>Seu estoque, no campo e no escritório.</p>
      </div>
      <div class="welcome-note">
        <UiIcon name="wifi-off" :size="20" /> Registre mesmo sem internet. Os
        dados são enviados quando o sinal voltar.
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
              ? "Peça ao gestor o QR Code ou o código de acesso."
              : "No primeiro acesso, é preciso internet."
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
              >WhatsApp para alertas de emergência
              <span class="muted">(opcional)</span
              ><input
                v-model="telefone"
                type="tel"
                autocomplete="tel"
                placeholder="+55 69 …"
              /><small class="muted"
                >Receba avisos automáticos de estoque e validade.</small
              ></label
            >
          </template>
          <template v-else>
            <label
              >Código de acesso<textarea
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
      <small
        >AgroHack 2026 · Gestão inteligente de insumos rurais · versão
        {{ APP_VERSION }}</small
      >
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
          v-if="session.role === 'GESTOR'"
          data-testid="operators-nav"
          :class="{ active: tab === 'operators' }"
          :aria-current="tab === 'operators' ? 'page' : undefined"
          @click="openOperators"
        >
          <UiIcon name="users" :size="18" /><span>Operadores</span></button
        ><button
          :class="{ active: tab === 'backups' }"
          :aria-current="tab === 'backups' ? 'page' : undefined"
          @click="tab = 'backups'"
        >
          <UiIcon name="database-backup" :size="18" /><span>Cópias</span>
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
        <span
          class="sync-status"
          :class="{ offline: !isOnline }"
          role="status"
          :aria-busy="syncing"
          ><UiIcon
            :name="syncIcon"
            :class="{ pending: pendingCount > 0 || !isOnline }"
          />
          {{ syncLabel }}</span
        ><button
          class="secondary"
          :disabled="syncing || busy"
          @click="workspace.sync"
        >
          <UiIcon name="refresh" />{{
            syncing ? "Atualizando…" : "Atualizar agora"
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
                    : tab === "operators"
                      ? "Operadores da fazenda"
                      : "Cópias de segurança"
            }}
          </h1>
          <p v-if="lastSync" class="muted">
            {{
              lastSync ? `Última atualização: ${formatDate(lastSync)}` : ""
            }}
          </p>
        </div>
        <button
          v-if="session.role === 'GESTOR' && tab === 'operators'"
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
        aria-label="Lançamentos para conferir"
      >
        <h2>Lançamentos para conferir</h2>
        <p class="muted">
          Estes lançamentos foram guardados, mas não entraram no saldo. Peça ao
          gestor para conferir.
        </p>
        <p v-for="review in reviews" :key="review.id" class="notice error">
          <UiIcon name="circle-alert" /><span>{{ review.message }}</span>
        </p>
      </section>
      <details
        v-if="showReconciliation"
        class="panel reconciliation"
        :open="hasDeficit || reviews.length > 0"
        data-testid="sync-balances"
        aria-label="Saldos a conferir"
      >
        <summary>
          Saldos a conferir
          <span class="badge">{{
            hasDeficit
              ? "Saldo negativo"
              : `${pendingCount} lançamento(s) esperando envio`
          }}</span>
        </summary>
        <p class="muted">
          Última atualização:
          {{ lastSync ? formatDate(lastSync) : "ainda nenhuma" }}. Outros
          celulares podem ter lançamentos que ainda não foram enviados.
        </p>
        <p v-for="p in analysis.products" :key="p.id">
          <strong>{{ p.nome }}</strong> · Saldo confirmado:
          {{ unitValue(confirmedBalances[p.id] ?? 0) }} {{ p.unidadeMedida }} ·
          Com os lançamentos deste aparelho: {{ unitValue(p.saldo) }}
          {{ p.unidadeMedida }}
        </p>
        <p
          v-if="hasDeficit"
          class="notice error"
          role="alert"
          data-testid="sync-deficit"
        >
          <UiIcon name="circle-alert" /><span
            >O saldo ficou negativo. Nenhum lançamento foi apagado: o gestor deve
            conferir entradas e saídas, inclusive se algo foi lançado duas vezes,
            antes de corrigir o estoque.</span
          >
        </p>
      </details>
      <template v-if="tab === 'overview'">
        <section class="metrics" aria-label="Resumo da propriedade">
          <article data-testid="stock-value">
            <span>{{
              financialPartial
                ? "CAPITAL CONHECIDO (PARCIAL)"
                : "CAPITAL EM ESTOQUE"
            }}</span
            ><strong>{{
              financialUnavailable
                ? "Não disponível"
                : money(analysis.totalValue)
            }}</strong>
            <small v-if="financialPartial"
              >{{ analysis.unpricedProductCount }} insumo(s) com saldo sem
              preço.</small
            >
          </article>
          <article>
            <span>INSUMOS ACOMPANHADOS</span
            ><strong>{{ analysis.products.length }}</strong>
          </article>
          <article :class="{ urgent: urgent > 0 }">
            <span>ATENÇÃO IMEDIATA</span
            ><strong>{{ urgent.toString().padStart(2, "0") }}</strong>
          </article>
        </section>
        <div
          class="dashboard-grid"
          :class="{ 'actions-first': session.role === 'OPERADOR' }"
        >
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
                    : "Nenhum insumo cadastrado"
                }}
              </h3>
              <p>
                {{
                  analysis.products.length
                    ? ""
                    : session.role === "GESTOR"
                      ? "Cadastre seu primeiro insumo na aba Estoque."
                      : "Com internet, toque em Atualizar agora para receber os insumos."
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
          <div class="action-row">
            <section class="panel movement-panel">
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
              <form @submit.prevent="recordFromForm">
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
                <small
                  v-if="formProduct"
                  class="helper"
                  data-testid="form-balance"
                  >Saldo: {{ unitValue(formProduct.saldo) }}
                  {{ formProduct.unidadeMedida }}</small
                >
                <div class="split">
                  <label
                    >Quantidade{{
                      formProduct ? ` (${formProduct.unidadeMedida})` : ""
                    }}<input
                      v-model="quantity"
                      type="number"
                      inputmode="decimal"
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
                <p
                  v-if="exceedsBalance && formProduct"
                  class="notice"
                  aria-live="polite"
                  data-testid="balance-warning"
                >
                  <UiIcon name="info" /><span
                    >A saída é maior que o saldo ({{
                      unitValue(formProduct.saldo)
                    }}
                    {{ formProduct.unidadeMedida }}). Ela será salva mesmo assim,
                    e o gestor vai conferir a diferença.</span
                  >
                </p>
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
                <p v-if="formFeedback" class="notice success" role="status">
                  <UiIcon name="circle-check" /><span>{{ formFeedback }}</span>
                </p>
                <p v-if="formError" class="notice error" role="alert">
                  <UiIcon name="circle-alert" /><span>{{ formError }}</span>
                </p>
              </form>
            </section>
            <section
              v-if="session.role === 'GESTOR'"
              class="panel whatsapp-panel"
              data-testid="whatsapp-alerts"
              aria-label="Alertas de emergência via WhatsApp"
            >
              <div class="section-heading">
                <h2>Alertas de emergência via WhatsApp</h2>
                <span class="badge" :class="{ success: session.telefone }">{{
                  session.telefone ? "Ativo" : "Não configurado"
                }}</span>
              </div>
              <p class="muted">
                {{
                  session.telefone
                    ? `Alertas para ${session.telefone}.`
                    : "Nenhum número cadastrado."
                }}
              </p>
              <div class="whatsapp-number">
                <label for="whatsapp-phone">Número do WhatsApp</label>
                <div class="whatsapp-row">
                  <input
                    id="whatsapp-phone"
                    v-model="phoneDraft"
                    type="tel"
                    autocomplete="tel"
                    placeholder="+55 69 99999-9999"
                    :disabled="savingPhone"
                    @keydown.enter.prevent="saveWhatsAppNumber"
                  />
                  <button
                    type="button"
                    class="secondary"
                    :disabled="busy || savingPhone"
                    @click="saveWhatsAppNumber"
                  >
                    {{ savingPhone ? "Salvando…" : "Salvar número" }}
                  </button>
                </div>
                <small class="muted"
                  >Código do país; em branco desativa os alertas.</small
                >
              </div>
              <button
                v-if="session.telefone"
                type="button"
                class="secondary full"
                :disabled="busy || testingWhatsApp"
                @click="sendWhatsAppTest"
              >
                <UiIcon name="circle-check" />
                {{
                  testingWhatsApp ? "Enviando teste…" : "Testar envio de alerta"
                }}
              </button>
              <p
                v-if="whatsappFeedback"
                class="notice"
                :class="{ success: !whatsappSimulated }"
                role="status"
              >
                <UiIcon
                  :name="whatsappSimulated ? 'info' : 'circle-check'"
                /><span>{{ whatsappFeedback }}</span>
              </p>
              <p v-if="whatsappError" class="notice error" role="alert">
                <UiIcon name="circle-alert" /><span>{{ whatsappError }}</span>
              </p>
            </section>
          </div>
        </div>
        <section class="panel consumption">
          <div class="section-heading">
            <div>
              <h2>Consumo ao longo do tempo</h2>
              <p class="muted">Últimos 30 dias</p>
            </div>
            <select v-model="chartProductId" aria-label="Insumo para analisar">
              <option value="" disabled>Selecione</option>
              <option v-for="p in analysis.products" :key="p.id" :value="p.id">
                {{ p.nome }}
              </option>
            </select>
          </div>
          <div
            v-if="chartProduct"
            class="chart"
            :aria-label="`Consumo diário de ${chartProduct.nome}`"
          >
            <div
              v-for="day in chartProduct.consumoDiario"
              :key="day.dia"
              class="chart-column"
            >
              <span
                class="chart-bar"
                :style="{
                  height: `${Math.max(2, (day.quantidade / Math.max(1, ...chartProduct.consumoDiario.map((d) => d.quantidade))) * 115)}px`,
                }"
                :title="`${day.dia}: ${day.quantidade} ${chartProduct.unidadeMedida}`"
              ></span
              ><small>{{ day.dia.slice(8) }}</small>
            </div>
          </div>
          <p v-else class="empty">Sem movimentações.</p>
        </section>
      </template>
      <section v-if="tab === 'stock'" class="panel stock-panel">
        <div class="section-heading">
          <div>
            <h2>
              Insumos
              <span class="badge"
                >{{ filteredProducts.length }} de
                {{ analysis.products.length }}</span
              >
            </h2>
            <p v-if="financialPartial" class="helper">
              Itens sem preço ficam fora da classe de valor (ABC).
            </p>
          </div>
          <button
            v-if="session.role === 'GESTOR'"
            class="primary"
            data-testid="new-product"
            @click="showProduct = true"
          >
            <UiIcon name="plus" />Novo insumo
          </button>
        </div>
        <div class="stock-filters">
          <div class="search-field">
            <UiIcon name="search" /><input
              v-model="search"
              type="search"
              aria-label="Buscar insumos"
              placeholder="Buscar insumo, categoria ou lote"
            />
          </div>
          <select v-model="category" aria-label="Filtrar categoria">
            <option value="">Todas as categorias</option>
            <option v-for="item in categories" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
          <select
            v-model="stockStatus"
            aria-label="Filtrar situação do estoque"
          >
            <option value="">Todas as situações</option>
            <option value="low">No mínimo ou abaixo</option>
            <option value="empty">Sem estoque</option>
            <option value="unpriced">Sem preço</option>
          </select>
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
                <th>Movimentar</th>
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
                <td data-label="Saldo">
                  {{ unitValue(p.saldo) }} {{ p.unidadeMedida }}
                </td>
                <td data-label="Mínimo">
                  {{ unitValue(p.estoqueMinimo) }} {{ p.unidadeMedida }}
                </td>
                <td
                  data-label="Duração estimada"
                  :data-testid="`estimate-${p.id}`"
                >
                  {{
                    p.diasRestantes === null
                      ? "Sem histórico"
                      : `${unitValue(p.diasRestantes)} dias`
                  }}
                  <small
                    v-if="p.diasRestantes === null"
                    class="estimate-context"
                    >Estimativa indisponível</small
                  >
                  <small v-else class="estimate-context"
                    >{{ evidenceLabels[p.confiabilidade] }} ·
                    {{ p.amostrasConsumo }} retirada(s)</small
                  >
                  <details
                    v-if="p.diasRestantes !== null"
                    class="estimate-details"
                  >
                    <summary>Detalhes</summary>
                    <p>
                      Calculado com as retiradas dos últimos
                      {{ p.diasAmostra }} dia(s). É uma estimativa, não uma
                      garantia.
                    </p>
                  </details>
                </td>
                <td data-label="Valor armazenado">
                  {{
                    p.valorEstoque === null
                      ? "Preço não informado"
                      : money(p.valorEstoque)
                  }}
                </td>
                <td data-label="ABC">
                  <span :data-testid="`abc-${p.id}`" class="badge">{{
                    p.classeAbc === null
                      ? "Não classificado"
                      : `${p.classeAbc}${financialPartial ? " (parcial)" : ""}`
                  }}</span>
                </td>
                <td data-label="Validade">
                  {{
                    p.validade
                      ? p.validade.slice(0, 10).split("-").reverse().join("/")
                      : "Não informada"
                  }}
                </td>
                <td class="movement-cell">
                  <div class="stock-actions">
                    <button
                      class="secondary"
                      :data-testid="`entrada-${p.id}`"
                      :aria-label="`Entrada de ${p.nome}`"
                      :disabled="busy"
                      @click="openMovement(p.id, 'ENTRADA')"
                    >
                      <UiIcon name="arrow-down-left" />Entrada
                    </button>
                    <button
                      class="secondary"
                      :data-testid="`saida-${p.id}`"
                      :aria-label="`Saída de ${p.nome}`"
                      :disabled="busy"
                      @click="openMovement(p.id, 'SAIDA')"
                    >
                      <UiIcon name="arrow-up-right" />Saída
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!filteredProducts.length" class="empty">
          Nenhum insumo encontrado.
        </p>
      </section>
      <section v-if="tab === 'history'" class="panel history-panel">
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
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td>{{ formatDate(m.dataMovimento) }}</td>
                <td data-label="Insumo">
                  {{
                    analysis.products.find((p) => p.id === m.productId)?.nome ??
                    m.productId
                  }}
                </td>
                <td data-label="Movimento">
                  <span
                    class="badge"
                    :class="m.tipo === 'ENTRADA' ? 'success' : ''"
                    >{{ m.tipo === "ENTRADA" ? "Entrada" : "Saída" }}</span
                  >
                </td>
                <td data-label="Quantidade">
                  {{ unitValue(m.quantidade) }}
                  {{
                    analysis.products.find((p) => p.id === m.productId)
                      ?.unidadeMedida
                  }}
                </td>
                <td data-label="Responsável">{{ m.responsavel }}</td>
                <td data-label="Destino">{{ m.destino || "—" }}</td>
                <td data-label="Situação">
                  <span
                    class="badge"
                    :class="pendingIds.includes(m.id) ? 'pending' : 'success'"
                    >{{
                      pendingIds.includes(m.id) ? "Esperando envio" : "Enviado"
                    }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!movements.length" class="empty">Nenhuma movimentação.</p>
      </section>
      <section v-if="tab === 'backups'" class="panel">
        <div class="section-heading">
          <div>
            <h2>Cópias de segurança deste aparelho</h2>
            <p class="muted">Uma cópia por dia · últimos 7 dias</p>
          </div>
          <button
            class="primary"
            :disabled="busy || syncing"
            @click="act(workspace.createBackup, 'Cópia de hoje guardada.')"
          >
            <UiIcon name="database-backup" /> Fazer cópia de hoje
          </button>
        </div>
        <p class="notice">
          As cópias ficam neste aparelho. Antes de voltar para uma cópia, o
          estado atual também é guardado.
        </p>
        <ul class="backup-list">
          <li v-for="backup in backups" :key="backup.name">
            <div>
              <strong>Cópia de {{ backupDate(backup.name) }}</strong
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
          Nenhuma cópia ainda.
        </p>
      </section>
      <OperatorsPanel
        v-if="tab === 'operators' && session.role === 'GESTOR'"
        :key="session.farmId"
        :operators="operators"
        :loading="operatorsLoading"
        :error="operatorsError"
        :refresh="workspace.loadOperators"
        :update="workspace.updateOperator"
        :remove="workspace.deleteOperator"
        :connect="
          () => {
            showPairing = true;
          }
        "
      />
      <footer class="page-footer">AgroHacka · versão {{ APP_VERSION }}</footer>
    </main>
    <div
      v-if="productStarted && session.role === 'GESTOR'"
      v-show="showProduct"
      class="modal-backdrop"
      @click.self="showProduct = false"
      @keydown.esc="showProduct = false"
    >
      <section
        :role="showProduct ? 'dialog' : undefined"
        :aria-hidden="!showProduct"
        aria-modal="true"
        aria-labelledby="product-title"
        class="modal product-modal"
      >
        <button
          class="modal-close"
          aria-label="Fechar cadastro"
          @click="showProduct = false"
        >
          <UiIcon name="x" />
        </button>
        <h2 id="product-title">Novo insumo</h2>
        <p class="muted">
          Precisa de internet para cadastrar. Depois, registre uma entrada com a
          quantidade em estoque.
        </p>
        <ProductForm
          :key="productFormKey"
          :categories="categories"
          :save="workspace.createProduct"
          @saved="productSaved"
        />
      </section>
    </div>
    <div
      v-if="showMovement"
      class="modal-backdrop"
      @click.self="!busy && (showMovement = false)"
      @keydown.esc="!busy && (showMovement = false)"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-title"
        class="modal"
      >
        <button
          class="modal-close"
          aria-label="Fechar movimentação"
          :disabled="busy"
          @click="showMovement = false"
        >
          <UiIcon name="x" />
        </button>
        <h2 id="movement-title">
          {{ kind === "ENTRADA" ? "Entrada" : "Saída" }} ·
          {{ formProduct?.nome }}
        </h2>
        <p class="muted">
          Saldo: {{ unitValue(formProduct?.saldo ?? 0) }}
          {{ formProduct?.unidadeMedida }}
        </p>
        <p v-if="movementError" class="notice error" role="alert">
          {{ movementError }}
        </p>
        <form @submit.prevent="recordFromStock">
          <label
            >Quantidade ({{ formProduct?.unidadeMedida }})<input
              v-model="quantity"
              type="number"
              inputmode="decimal"
              min="0.000001"
              step="any"
              required
              autofocus
              :disabled="busy"
          /></label>
          <p
            v-if="exceedsBalance && formProduct"
            class="notice"
            aria-live="polite"
            data-testid="balance-warning"
          >
            <UiIcon name="info" /><span
              >A saída é maior que o saldo ({{
                unitValue(formProduct.saldo)
              }}
              {{ formProduct.unidadeMedida }}). Ela será salva mesmo assim, e o
              gestor vai conferir a diferença.</span
            >
          </p>
          <label
            >Data e hora<input
              v-model="movementDate"
              type="datetime-local"
              required
              :disabled="busy"
          /></label>
          <label
            >Destino / observação<input
              v-model="destination"
              maxlength="300"
              placeholder="Opcional"
              :disabled="busy"
          /></label>
          <button class="primary full" :disabled="busy">
            <UiIcon name="save" />{{
              busy ? "Salvando…" : "Salvar neste aparelho"
            }}
          </button>
        </form>
      </section>
    </div>
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
          aria-label="Fechar"
          title="Fechar"
          @click="showPairing = false"
        >
          <UiIcon name="x" /></button
        ><span class="eyebrow">EQUIPE CONECTADA</span>
        <h2 id="pair-title">Conectar operador</h2>
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
          <img :src="qrImage" alt="QR Code de acesso à fazenda" />
          <p>Ou digite este código no celular</p>
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
