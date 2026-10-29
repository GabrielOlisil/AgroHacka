<script setup lang="ts">
import { PAGE_SIZES, type paginate } from "../pagination";
import UiIcon from "./UiIcon.vue";

defineProps<{
  pagination: ReturnType<typeof paginate>;
  pageSize: number;
  label: string;
}>();
const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [size: number];
}>();
function changeSize(event: Event) {
  emit("update:pageSize", Number((event.target as HTMLSelectElement).value));
  emit("update:page", 1);
}
</script>

<template>
  <nav
    v-if="pagination.total > PAGE_SIZES[0]"
    class="pagination"
    data-testid="pagination"
    aria-label="Paginação"
  >
    <p class="muted">
      Mostrando {{ pagination.from }}–{{ pagination.to }} de
      {{ pagination.total }} {{ label }}
    </p>
    <label>
      Por página
      <select data-testid="page-size" :value="pageSize" @change="changeSize">
        <option v-for="size in PAGE_SIZES" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
    </label>
    <div class="pagination-pages">
      <button
        class="secondary"
        data-testid="page-prev"
        :disabled="pagination.page <= 1"
        @click="emit('update:page', pagination.page - 1)"
      >
        <UiIcon name="chevron-left" />Anterior
      </button>
      <span aria-live="polite"
        >Página {{ pagination.page }} de {{ pagination.totalPages }}</span
      >
      <button
        class="secondary"
        data-testid="page-next"
        :disabled="pagination.page >= pagination.totalPages"
        @click="emit('update:page', pagination.page + 1)"
      >
        Próxima<UiIcon name="chevron-right" />
      </button>
    </div>
  </nav>
</template>
