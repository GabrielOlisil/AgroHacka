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
  parseProduct,
  parseProductInput,
  text,
  type LoginInput,
  type Movement,
  type MovementInput,
  type RegisterInput,
  type Session,
  type SyncReview,
  type PairedOperator,
  type Product,
  type ProductInput,
  type UpdateOperatorInput,
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
  let catalogVersion = 0;
  let changingSession = false;
  const catalogWrites = new Set<Promise<void>>();
  const productDrafts = new Map<
    string,
    { payload: string; version: number; pending?: Promise<Product> }
  >();
  async function invalidateCatalog() {
    catalogVersion++;
    refreshVersion++;
    // Uma transação já iniciada termina antes de trocar sessão/restaurar o banco.
    // Escritas ainda na fila serão recusadas pelo guard de upsertProducts.
    await Promise.allSettled([...catalogWrites]);
  }
  const ready = ref(false);
  const session = ref<Session | null>(null);
  const analysis = ref<InventoryAnalysis>(analyzeInventory([], []));
  const movements = ref<Movement[]>([]);
  const pendingCount = ref(0);
  const pendingIds = ref<string[]>([]);
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
  let operatorMutationVersion = 0;
  let changingOperator = false;
  function clearOperators() {
    operatorsVersion++;
    operatorMutationVersion++;
    changingOperator = false;
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
  async function manageOperator(id: string, patch?: UpdateOperatorInput) {
    const current = session.value;
    if (current?.role !== "GESTOR")
      throw new Error("Somente o gestor pode gerenciar operadores.");
    if (disposed || restoring)
      throw new Error("Aguarde a restauração ou abra novamente a sessão.");
    if (changingOperator)
      throw new Error("Aguarde a alteração atual do operador.");
    const version = ++operatorMutationVersion;
    changingOperator = true;
    operatorsVersion++;
    operatorsLoading.value = false;
    const active = () =>
      !disposed &&
      !restoring &&
      session.value === current &&
      operatorMutationVersion === version;
    try {
      if (patch) await api.updateOperator(current, id, patch);
      else await api.deleteOperator(current, id);
      if (!active())
        throw new Error(
          "Sessão alterada durante a operação; atualize a lista ao retornar.",
        );
      await loadOperators(true);
      if (!active()) throw new Error("Sessão alterada durante a operação.");
    } finally {
      if (operatorMutationVersion === version) changingOperator = false;
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
    const pendingSet = new Set(pending.map((m) => m.id));
    const confirmed = analyzeInventory(
      snapshot.products,
      snapshot.movements.filter((m) => !pendingSet.has(m.id)),
    );
    confirmedBalances.value = Object.fromEntries(
      confirmed.products.map((p) => [p.id, p.saldo]),
    );
    movements.value = [...snapshot.movements].sort((a, b) =>
      b.dataMovimento.localeCompare(a.dataMovimento),
    );
    pendingCount.value = pending.length;
    pendingIds.value = [...pendingSet];
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
    changingSession = true;
    try {
      await invalidateCatalog();
      await requireStore().saveSession(value);
      clearOperators();
      session.value = value;
      error.value = "";
      await refresh();
    } finally {
      changingSession = false;
    }
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
    pendingIds,
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
    updateOperator: (id: string, patch: UpdateOperatorInput) =>
      manageOperator(id, patch),
    deleteOperator: (id: string) => manageOperator(id),
    initialize,
    refresh,
    sync,
    maintainBackups,
    async createProduct(input: ProductInput): Promise<Product> {
      if (disposed)
        throw new Error("Workspace encerrado; abra uma sessão novamente.");
      if (restoring) throw new Error("Aguarde a restauração do backup.");
      if (changingSession) throw new Error("Aguarde a troca de sessão.");
      const current = session.value;
      if (current?.role !== "GESTOR")
        throw new Error("Somente o gestor pode cadastrar produtos.");
      text(current.accessToken, "token do gestor");
      const db = requireStore();
      const body = Object.freeze(parseProductInput(input));
      const key = JSON.stringify([current.farmId, body.id]);
      const payload = JSON.stringify({
        ...body,
        lote: body.lote ?? null,
        fornecedor: body.fornecedor ?? null,
      });
      let draft = productDrafts.get(key);
      if (draft && draft.payload !== payload)
        throw new Error(
          "Identificador já utilizado com outro conteúdo. Preserve o cadastro original para tentar novamente.",
        );
      if (draft?.pending && draft.version === catalogVersion)
        return draft.pending;
      draft = { payload, version: catalogVersion };
      productDrafts.set(key, draft);
      const version = catalogVersion;
      const isCurrent = () =>
        !disposed &&
        !restoring &&
        catalogVersion === version &&
        session.value === current;
      const assertCurrent = () => {
        if (!isCurrent())
          throw new Error(
            "Sessão alterada durante o cadastro; sincronize o catálogo ao retornar.",
          );
      };
      const pending = (async () => {
        const response = await api.createProduct(body, current);
        assertCurrent();
        const product = parseProduct(response, current.farmId);
        if (product.id !== body.id)
          throw new Error("Resposta de outro identificador de produto.");
        const writing = db.upsertProducts(current.farmId, [product], isCurrent);
        catalogWrites.add(writing);
        try {
          await writing;
        } finally {
          catalogWrites.delete(writing);
        }
        assertCurrent();
        try {
          await refresh();
        } catch (cause) {
          assertCurrent();
          error.value = `Produto salvo, mas não foi possível atualizar a tela: ${message(cause)}`;
        }
        assertCurrent();
        return product;
      })();
      draft.pending = pending;
      try {
        return await pending;
      } finally {
        draft.pending = undefined;
      }
    },
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
      changingSession = true;
      try {
        await invalidateCatalog();
        await requireStore().clearSession();
        clearOperators();
        session.value = null;
        analysis.value = analyzeInventory([], []);
        movements.value = [];
        pendingCount.value = 0;
        pendingIds.value = [];
        reviews.value = [];
        confirmedBalances.value = {};
        lastSync.value = null;
      } finally {
        changingSession = false;
      }
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
      clearOperators();
      try {
        await invalidateCatalog();
        await backupService.restore(name);
        await refresh();
        backups.value = await backupService.list();
      } finally {
        restoring = false;
      }
    },
    dispose() {
      disposed = true;
      catalogVersion++;
      clearOperators();
    },
  };
}
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
export type Workspace = ReturnType<typeof createWorkspace>;
