<script setup lang="ts">
import { ref } from "vue";
import {
  parseProductInput,
  type Product,
  type ProductInput,
} from "../offline/types";
import UiIcon from "./UiIcon.vue";
import { openPicker } from "../open-picker";
import { nameKey } from "../offline/analysis";

const props = defineProps<{
  categories: string[];
  save: (input: ProductInput) => Promise<unknown>;
  /** Com produto, o formulário edita esse cadastro em vez de criar outro. */
  product?: Product;
  lockUnit?: boolean;
  /** Catálogo da fazenda, inclusive desativados: bloqueia nome repetido. */
  existing?: Product[];
}>();
// Mesma regra do alerta de cadastro duplicado. Na edição, só confere se o nome
// mudar, para que um duplicado antigo ainda possa ser corrigido.
function sameName(input: ProductInput) {
  const key = nameKey(input.nome);
  if (!key || (editing && key === nameKey(editing.nome))) return;
  const same = props.existing?.find(
    (p) => p.id !== input.id && nameKey(p.nome) === key,
  );
  if (same)
    throw new Error(
      same.ativo === false
        ? `Já existe o insumo “${same.nome}” (${same.unidadeMedida}), desativado. Reative-o em Insumos desativados, no fim do Estoque, ou mude o nome.`
        : `Já existe o insumo “${same.nome}” (${same.unidadeMedida}). Use o cadastro existente ou mude o nome.`,
    );
}
const emit = defineEmits<{ saved: [] }>();
const editing = props.product;
const nome = ref(editing?.nome ?? "");
const categoria = ref(editing?.categoria ?? "");
const unidadeMedida = ref(editing?.unidadeMedida ?? "kg");
const estoqueMinimo = ref<number | "">(editing?.estoqueMinimo ?? 0);
const precoAquisicao = ref<number | "">(editing?.precoAquisicao ?? "");
const validade = ref(editing?.validade?.slice(0, 10) ?? "");
const lote = ref(editing?.lote ?? "");
const fornecedor = ref(editing?.fornecedor ?? "");
const saving = ref(false);
const error = ref("");
const submitted = ref(false);
const id = editing?.id ?? crypto.randomUUID();
let pending: ProductInput | undefined;
async function submit() {
  if (saving.value) return;
  error.value = "";
  try {
    const input = () =>
      parseProductInput({
        id,
        nome: nome.value,
        categoria: categoria.value,
        unidadeMedida: unidadeMedida.value,
        estoqueMinimo: estoqueMinimo.value,
        precoAquisicao:
          precoAquisicao.value === "" ? null : precoAquisicao.value,
        validade: validade.value || null,
        // Na edição, campo apagado vira null para apagar no servidor.
        ...(lote.value.trim() || editing
          ? { lote: lote.value.trim() || null }
          : {}),
        ...(fornecedor.value.trim() || editing
          ? { fornecedor: fornecedor.value.trim() || null }
          : {}),
      });
    // O cadastro novo repete o mesmo conteúdo na nova tentativa; a edição não.
    const draft = editing || !pending ? input() : pending;
    sameName(draft);
    pending = draft;
    saving.value = true;
    submitted.value = !editing;
    await props.save(pending);
    emit("saved");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="product-form" @submit.prevent="submit">
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <fieldset :disabled="submitted">
      <label
        >Nome do insumo<input
          v-model="nome"
          name="nome"
          required
          maxlength="150"
          autofocus
      /></label>
      <div class="split">
        <label
          >Categoria<input
            v-model="categoria"
            name="categoria"
            list="product-categories"
            required
            maxlength="100"
            placeholder="Digite ou selecione"
        /></label>
        <datalist id="product-categories">
          <option
            v-for="category in categories"
            :key="category"
            :value="category"
          />
        </datalist>
        <label
          >Unidade<input
            v-model="unidadeMedida"
            name="unidadeMedida"
            list="product-units"
            required
            maxlength="20"
            :disabled="lockUnit"
          /><small v-if="lockUnit" class="helper"
            >A unidade não muda depois da primeira movimentação.</small
          ></label
        >
        <datalist id="product-units">
          <option
            v-for="unit in ['kg', 'L', 'un', 'saca', 'm', 'm²', 'm³']"
            :key="unit"
            :value="unit"
          />
        </datalist>
      </div>
      <div class="split">
        <label
          >Estoque mínimo<input
            v-model="estoqueMinimo"
            name="estoqueMinimo"
            type="number"
            min="0"
            step="any"
            required
        /></label>
        <label
          >Preço por unidade (R$)<input
            v-model="precoAquisicao"
            name="precoAquisicao"
            type="number"
            min="0"
            step="any"
            placeholder="Opcional"
        /></label>
      </div>
      <div class="split">
        <label
          >Validade<input
            v-model="validade"
            name="validade"
            type="date"
            @click="openPicker"
        /></label>
        <label
          >Lote<input
            v-model="lote"
            name="lote"
            maxlength="100"
            placeholder="Opcional"
        /></label>
      </div>
      <label
        >Fornecedor<input
          v-model="fornecedor"
          name="fornecedor"
          maxlength="150"
          placeholder="Opcional"
      /></label>
    </fieldset>
    <p v-if="error && submitted" class="helper">
      Tente novamente para confirmar o mesmo cadastro.
    </p>
    <button type="submit" class="primary full" :disabled="saving">
      <UiIcon name="save" />{{
        saving
          ? "Salvando…"
          : error && submitted
            ? "Tentar novamente"
            : editing
              ? "Salvar alterações"
              : "Cadastrar insumo"
      }}
    </button>
  </form>
</template>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
fieldset:disabled {
  opacity: 0.7;
}
.split {
  flex-wrap: wrap;
}
.split > label {
  flex: 1 1 160px;
}
</style>
