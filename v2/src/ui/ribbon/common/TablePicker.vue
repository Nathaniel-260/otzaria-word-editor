<template>
  <div
    ref="containerRef"
    class="table-picker-container"
  >
    <RibbonButton
      icon="table"
      label="טבלה"
      variant="large"
      :active="isOpen"
      :disabled="disabled"
      tooltip="הוספת טבלה"
      @click="toggleDropdown"
    />

    <div
      v-if="isOpen"
      class="table-picker-popover"
      @pointerdown.stop
    >
      <div class="table-picker-header">
        {{ hoveredRows > 0 ? `טבלה ${hoveredCols} × ${hoveredRows}` : 'הוסף טבלה' }}
      </div>
      <div
        class="table-grid"
        @mouseleave="onMouseLeave"
      >
        <div
          v-for="r in MAX_ROWS"
          :key="`row-${r}`"
          class="grid-row"
        >
          <div
            v-for="c in MAX_COLS"
            :key="`cell-${r}-${c}`"
            class="grid-cell"
            :class="{ highlighted: r <= hoveredRows && c <= hoveredCols }"
            @mouseenter="onCellHover(r, c)"
            @click="onCellClick(r, c)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import RibbonButton from './RibbonButton.vue';

const MAX_ROWS = 10;
const MAX_COLS = 10;

defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', dimensions: { rows: number; cols: number }): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const hoveredRows = ref(0);
const hoveredCols = ref(0);

function toggleDropdown(): void {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    hoveredRows.value = 0;
    hoveredCols.value = 0;
  }
}

function onCellHover(r: number, c: number): void {
  hoveredRows.value = r;
  hoveredCols.value = c;
}

function onMouseLeave(): void {
  hoveredRows.value = 0;
  hoveredCols.value = 0;
}

function onCellClick(r: number, c: number): void {
  emit('select', { rows: r, cols: c });
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleClickOutside);
});
</script>

<style scoped>
.table-picker-container {
  position: relative;
  display: inline-flex;
}

.table-picker-popover {
  position: absolute;
  top: 100%;
  inset-inline-start: 0;
  z-index: 1000;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  padding: 8px;
  margin-top: 2px;
}

.table-picker-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-on-surface);
  text-align: center;
  margin-bottom: 6px;
  min-height: 16px;
}

.table-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grid-row {
  display: flex;
  gap: 2px;
}

.grid-cell {
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 1px;
  background: var(--color-surface);
  cursor: pointer;
  transition: background 0.05s, border-color 0.05s;
}

.grid-cell.highlighted {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary);
}
</style>
