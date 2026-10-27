<script setup lang="ts">
import { ref } from "vue";
import { parseProductInput, type ProductInput } from "../offline/types";
import UiIcon from "./UiIcon.vue";
import { openPicker } from "../open-picker";

const props = defineProps<{
  categories: string[];
  save: (input: ProductInput) => Promise<unknown>;
}>();
const emit = defineEmits<{ saved: [] }>();
const nome = ref("");
const categoria = ref("");
const unidadeMedida = ref("kg");
const estoqueMinimo = ref<number | "">(0);
const precoAquisicao = ref<number | "">("");
const validade = ref("");
const lote = ref("");
const fornecedor = ref("");
const saving = ref(false);
const error = ref("");
const submitted = ref(false);
const id = crypto.randomUUID();
let pending: ProductInput | undefined;
async function submit() {
  if (saving.value) return;
  error.value = "";
  try {
    pending ??= parseProductInput({
      id,
      nome: nome.value,
      categoria: categoria.value,
      unidadeMedida: unidadeMedida.value,
      estoqueMinimo: estoqueMinimo.value,
      precoAquisicao: precoAquisicao.value === "" ? null : precoAquisicao.value,
      validade: validade.value || null,
      ...(lote.value.trim() ? { lote: lote.value.trim() } : {}),
      ...(fornecedor.value.trim()
        ? { fornecedor: fornecedor.value.trim() }
        : {}),
    });
    saving.value = true;
    submitted.value = true;
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
        /></label>
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
