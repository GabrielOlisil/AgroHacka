import { ref } from "vue";
import { createApi, type Api } from "./api/client";
import { analyzeInventory, type InventoryAnalysis } from "./offline/analysis";
import {
  nativeBackups,
  type Backup,
  type BackupService,
} from "./offline/backups";
import { openDatabase } from "./offline/database";
import { LocalStore } from "./offline/local-store";
import { pairingCredential } from "./offline/pairing";
import { SyncCoordinator } from "./offline/sync";
import {
  text,
  type LoginInput,
  type Movement,
  type MovementInput,
  type RegisterInput,
  type Session,
  type SyncReview,
  type PairedOperator,
} from "./offline/types";

interface WorkspaceDependencies {
  openStore?: () => Promise<LocalStore>;
  api?: Api;
  backups?: BackupService;
}
export function createWorkspace(dependencies: WorkspaceDependencies = {}) {
  const api = dependencies.api ?? createApi();
  const backupService = dependencies.backups ?? nativeBackups;
  let store: LocalStore | undefined;
  let coordinator: SyncCoordinator | undefined;
  let disposed = false;
  let restoring = false;
  let recording = false;
  const draftIds = new Map<string, string>();
  let maintainingBackups = false;
  let refreshVersion = 0;
  const ready = ref(false);
  const session = ref<Session | null>(null);
  const analysis = ref<InventoryAnalysis>(analyzeInventory([], []));
  const movements = ref<Movement[]>([]);
  const pendingCount = ref(0);
  const reviews = ref<SyncReview[]>([]);
  const confirmedBalances = ref<Record<string, number>>({});
  const lastSync = ref<string | null>(null);
  const syncing = ref(false);
  const error = ref("");
  const backups = ref<Backup[]>([]);
  const operators = ref<PairedOperator[]>([]);
  const operatorsLoading = ref(false);
  const operatorsError = ref("");
  let operatorsVersion = 0;
  function clearOperators() {
    operatorsVersion++;
    operators.value = [];
    operatorsLoading.value = false;
    operatorsError.value = "";
  }
  async function loadOperators(force = false) {
    const current = session.value;
    if (current?.role !== "GESTOR")
      throw new Error("Somente o gestor pode consultar operadores.");
    if (disposed || restoring || (operatorsLoading.value && force !== true))
      return;
    const version = ++operatorsVersion;
    operatorsLoading.value = true;
    operatorsError.value = "";
    operators.value = [];
    try {
      const result = await api.listOperators(current);
      if (
        !disposed &&
        version === operatorsVersion &&
        session.value === current
      )
        operators.value = result;
    } catch (cause) {
      if (
        !disposed &&
        version === operatorsVersion &&
        session.value === current
      )
        operatorsError.value = `Não foi possível consultar operadores: ${message(cause)} Conecte-se à API e tente novamente.`;
    } finally {
      if (version === operatorsVersion) operatorsLoading.value = false;
    }
  }
  async function deactivateOperator(deviceId: string) {
    const current = session.value;
    if (current?.role !== "GESTOR")
      throw new Error("Somente o gestor pode desativar operadores.");
    // Supersedes any listing in flight, so a late response cannot restore the old state.
    const version = ++operatorsVersion;
    operatorsError.value = "";
    try {
      const result = await api.deactivateOperator(current, deviceId);
      if (!disposed && version === operatorsVersion && session.value === current)
        operators.value = result;
    } catch (cause) {
      if (!disposed && version === operatorsVersion && session.value === current)
        operatorsError.value = `Não foi possível desativar o operador: ${message(cause)}`;
    }
  }
  const requireStore = () => {
    if (!store)
      throw new Error(
        "SQLite indisponível. Abra o aplicativo com npm run tauri:dev.",
      );
    return store;
  };
  async function refresh() {
    const version = ++refreshVersion;
    const current = session.value;
    if (!current) return;
    const db = requireStore();
    const [snapshot, pending, timestamp, reviewItems] = await Promise.all([
      db.snapshot(current.farmId),
      db.pending(current.farmId),
      db.lastSync(current.farmId),
      db.syncReviews(current.farmId),
    ]);
    if (
      disposed ||
      version !== refreshVersion ||
      session.value?.farmId !== current.farmId
    )
      return;
    analysis.value = analyzeInventory(snapshot.products, snapshot.movements);
    const pendingIds = new Set(pending.map((m) => m.id));
    const confirmed = analyzeInventory(
      snapshot.products,
      snapshot.movements.filter((m) => !pendingIds.has(m.id)),
    );
    confirmedBalances.value = Object.fromEntries(
      confirmed.products.map((p) => [p.id, p.saldo]),
    );
    movements.value = [...snapshot.movements].sort((a, b) =>
      b.dataMovimento.localeCompare(a.dataMovimento),
    );
    pendingCount.value = pending.length;
    reviews.value = reviewItems;
    lastSync.value = timestamp;
    await db.saveAlerts(current.farmId, analysis.value.alerts);
  }
  async function initialize() {
    try {
      const openedStore = await (dependencies.openStore
        ? dependencies.openStore()
        : openDatabase().then((db) => new LocalStore(db)));
      store = openedStore;
      coordinator = new SyncCoordinator(openedStore, api.sync);
      session.value = await openedStore.loadSession();
      await refresh();
      try {
        if (session.value) await backupService.create();
        backups.value = await backupService.list();
      } catch (cause) {
        error.value = `Não foi possível preparar o backup: ${message(cause)}`;
      }
    } catch (cause) {
      error.value = `Não foi possível abrir o armazenamento local. ${message(cause)} Execute pelo Tauri para usar o SQLite.`;
    } finally {
      ready.value = true;
    }
  }
  async function acceptSession(value: Session) {
    if (syncing.value || restoring)
      throw new Error("Aguarde a operação atual antes de trocar a sessão.");
    await requireStore().saveSession(value);
    clearOperators();
    session.value = value;
    error.value = "";
    await refresh();
  }
  async function sync() {
    if (
      !session.value ||
      !coordinator ||
      syncing.value ||
      disposed ||
      restoring
    )
      return;
    syncing.value = true;
    error.value = "";
    try {
      await coordinator.run(session.value);
      await refresh();
    } catch (cause) {
      error.value = `Sincronização não concluída: ${message(cause)} Os registros locais foram preservados.`;
    } finally {
      syncing.value = false;
    }
    await maintainBackups();
  }
  async function maintainBackups() {
    if (
      !session.value ||
      !store ||
      disposed ||
      syncing.value ||
      restoring ||
      maintainingBackups
    )
      return;
    maintainingBackups = true;
    try {
      await backupService.create();
      backups.value = await backupService.list();
    } catch (cause) {
      error.value = `Backup não concluído: ${message(cause)}`;
    } finally {
      maintainingBackups = false;
    }
  }
  return {
    ready,
    session,
    analysis,
    movements,
    pendingCount,
    reviews,
    confirmedBalances,
    lastSync,
    syncing,
    error,
    backups,
    operators,
    operatorsLoading,
    operatorsError,
    loadOperators,
    deactivateOperator,
    initialize,
    refresh,
    sync,
    maintainBackups,
    async login(input: LoginInput) {
      requireStore();
      await acceptSession(await api.login(input));
    },
    async register(input: RegisterInput) {
      requireStore();
      await acceptSession(await api.register(input));
    },
    async connect(input: string) {
      requireStore();
      await acceptSession(
        await api.connect({ tokenOrCode: pairingCredential(input) }),
      );
    },
    async logout() {
      if (syncing.value)
        throw new Error("Aguarde a sincronização terminar antes de sair.");
      await requireStore().clearSession();
      clearOperators();
      session.value = null;
      analysis.value = analyzeInventory([], []);
      movements.value = [];
      pendingCount.value = 0;
      reviews.value = [];
      confirmedBalances.value = {};
      lastSync.value = null;
    },
    async record(input: MovementInput) {
      if (restoring) throw new Error("Aguarde a restauração do backup.");
      if (recording) throw new Error("Aguarde o salvamento atual.");
      if (!session.value)
        throw new Error("Abra uma sessão antes de movimentar estoque.");
      recording = true;
      try {
        const db = requireStore();
        const current = session.value;
        const key = JSON.stringify([
          current.farmId,
          current.role,
          current.deviceId ?? current.userId ?? current.nome,
        ]);
        const id = input.id ?? draftIds.get(key) ?? (await db.draftId(current));
        draftIds.set(key, id);
        await db.recordMovement(current, { ...input, id });
        draftIds.delete(key);
        try {
          await refresh();
        } catch (cause) {
          error.value = `Movimentação salva neste aparelho, mas não foi possível atualizar a tela: ${message(cause)}`;
        }
      } finally {
        recording = false;
      }
    },
    async pair(name: string) {
      if (session.value?.role !== "GESTOR")
        throw new Error("Somente o gestor pode gerar um pareamento.");
      return api.pairing(
        {
          farmId: session.value.farmId,
          nomeOperador: text(name, "nome do operador"),
        },
        session.value,
      );
    },
    async testWhatsApp() {
      const current = session.value;
      if (current?.role !== "GESTOR")
        throw new Error("Somente o gestor pode testar os alertas de WhatsApp.");
      if (!current.telefone)
        throw new Error("Cadastre o WhatsApp do gestor para testar o envio.");
      return api.testWhatsApp(current, current.telefone);
    },
    async updateTelefone(raw: string) {
      const current = session.value;
      if (current?.role !== "GESTOR")
        throw new Error(
          "Somente o gestor pode alterar o WhatsApp dos alertas.",
        );
      const telefone = await api.updateTelefone(current, raw);
      // Saiu ou trocou de sessão enquanto aguardava: não recria a sessão antiga.
      if (session.value !== current) return telefone;
      const { telefone: _anterior, ...rest } = current;
      const updated: Session = telefone ? { ...rest, telefone } : rest;
      await requireStore().saveSession(updated);
      session.value = updated;
      return telefone;
    },
    async createBackup() {
      if (syncing.value) throw new Error("Aguarde a sincronização.");
      await backupService.create();
      backups.value = await backupService.list();
    },
    async restoreBackup(name: string) {
      if (syncing.value)
        throw new Error("Aguarde a sincronização antes de restaurar.");
      if (restoring) throw new Error("Uma restauração já está em andamento.");
      restoring = true;
      try {
        await backupService.restore(name);
        await refresh();
        backups.value = await backupService.list();
      } finally {
        restoring = false;
      }
    },
    dispose() {
      disposed = true;
      clearOperators();
    },
  };
}
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
export type Workspace = ReturnType<typeof createWorkspace>;
