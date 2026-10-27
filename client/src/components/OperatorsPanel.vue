<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PairedOperator } from "../offline/types";
import UiIcon from "./UiIcon.vue";

const props = defineProps<{
  operators: PairedOperator[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  connect: () => void;
  deactivate: (id: string) => Promise<void>;
}>();
const deactivatingId = ref<string | null>(null);
async function confirmDeactivate(operator: PairedOperator) {
  if (
    !window.confirm(
      `Desativar ${operator.nomeOperador}? O aparelho deixa de sincronizar com a fazenda e o código para de funcionar. Os registros já enviados continuam no histórico.`,
    )
  )
    return;
  deactivatingId.value = operator.id;
  try {
    await props.deactivate(operator.id);
  } finally {
    deactivatingId.value = null;
  }
}
const search = ref("");
const status = ref("all");
const revealedId = ref<string | null>(null);
watch([() => props.operators, () => props.loading, () => props.error], () => {
  revealedId.value = null;
});
const filtered = computed(() =>
  props.operators.filter(
    (operator) =>
      operator.nomeOperador
        .toLocaleLowerCase("pt-BR")
        .includes(search.value.trim().toLocaleLowerCase("pt-BR")) &&
      (status.value === "all" ||
        operator.ativo === (status.value === "active")),
  ),
);
const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");
</script>

<template>
  <section class="panel" aria-labelledby="operators-title">
    <div class="section-heading">
      <div>
        <h2 id="operators-title">Operadores pareados</h2>
        <p>
          São os mesmos registros criados em “Conectar operador”. Consulte
          novamente o código sem criar outro pareamento.
        </p>
      </div>
      <button
        class="secondary"
        data-testid="refresh-operators"
        :disabled="loading"
        @click="refresh()"
      >
        <UiIcon name="refresh" />Atualizar lista
      </button>
    </div>
    <p class="notice" role="note">
      <UiIcon name="info" /><span
        >A consulta exige conexão com a API e acesso de gestor. O código permite
        conectar um aparelho: compartilhe somente com o operador
        responsável.</span
      >
    </p>
    <p v-if="error" class="notice error" role="alert">
      <UiIcon name="circle-alert" /><span>{{ error }}</span>
    </p>
    <p v-if="loading" class="empty" role="status">Consultando operadores…</p>
    <template v-else-if="!error">
      <div class="operator-filters">
        <div class="search-field">
          <UiIcon name="search" /><input
            v-model="search"
            type="search"
            aria-label="Buscar operadores"
            placeholder="Buscar pelo nome"
          />
        </div>
        <select v-model="status" aria-label="Filtrar situação">
          <option value="all">Todos os pareamentos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>
      <div v-if="!operators.length" class="empty">
        <p>Nenhum operador pareado nesta fazenda.</p>
        <button
          class="primary"
          data-testid="connect-existing-flow"
          @click="connect"
        >
          <UiIcon name="plus" />Conectar primeiro operador
        </button>
      </div>
      <p v-else-if="!filtered.length" class="empty">
        Nenhum operador corresponde aos filtros.
      </p>
      <ul v-else class="operator-list">
        <li
          v-for="operator in filtered"
          :key="operator.id"
          :data-testid="`operator-${operator.id}`"
        >
          <div class="operator-summary">
            <div>
              <strong>{{ operator.nomeOperador }}</strong
              ><small
                >Pareamento criado em
                {{ formatDate(operator.createdAt) }}</small
              >
            </div>
            <span class="badge" :class="{ success: operator.ativo }">{{
              operator.ativo ? "Ativo" : "Inativo"
            }}</span>
          </div>
          <button
            v-if="operator.ativo && operator.pairingCode"
            class="secondary"
            :data-testid="`reveal-${operator.id}`"
            :aria-expanded="revealedId === operator.id"
            :aria-controls="`code-${operator.id}`"
            @click="
              revealedId = revealedId === operator.id ? null : operator.id
            "
          >
            <UiIcon :name="revealedId === operator.id ? 'eye-off' : 'eye'" />{{
              revealedId === operator.id ? "Ocultar código" : "Ver código"
            }}
          </button>
          <button
            v-if="operator.ativo"
            class="secondary"
            :data-testid="`deactivate-${operator.id}`"
            :disabled="loading || deactivatingId !== null"
            @click="confirmDeactivate(operator)"
          >
            <UiIcon name="circle-alert" />{{
              deactivatingId === operator.id ? "Desativando…" : "Desativar"
            }}
          </button>
          <p v-else class="helper">
            Pareamento inativo. Não é possível usar este código para conectar um
            aparelho.
          </p>
          <div
            v-if="operator.ativo && revealedId === operator.id"
            :id="`code-${operator.id}`"
            class="operator-code"
          >
            <small>CÓDIGO DE PAREAMENTO</small>
            <strong>{{ operator.pairingCode }}</strong>
            <p class="helper">
              Este é o mesmo código já gerado. Consultá-lo não cria um novo
              operador nem altera o acesso existente.
            </p>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.operator-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.operator-filters .search-field {
  flex: 1 1 50%;
}
.operator-filters select {
  flex: 1 1 30%;
  width: auto;
}
.operator-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.operator-list li {
  border-top: 1px solid var(--border-subtle);
  padding-block: var(--space-4);
}
.operator-summary {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.operator-summary > div {
  min-width: 0;
}
.operator-summary strong {
  overflow-wrap: anywhere;
}
.operator-summary small {
  display: block;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}
.operator-code {
  margin-top: var(--space-3);
  padding: var(--space-4);
  background: var(--color-background);
  border: 1px solid var(--border-default);
}
.operator-code > small {
  display: block;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}
.operator-code > strong {
  display: block;
  font-size: var(--font-size-xl);
  letter-spacing: 1px;
  user-select: all;
  overflow-wrap: anywhere;
}
.empty .primary {
  margin-top: var(--space-4);
}
@media (max-width: 760px) {
  .section-heading {
    align-items: start;
  }
  .section-heading > button {
    flex-shrink: 0;
  }
}
</style>
