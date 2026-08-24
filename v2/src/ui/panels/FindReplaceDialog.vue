<template>
  <div
    v-if="isOpen"
    class="find-replace-dialog"
    role="dialog"
    aria-label="חיפוש והחלפה"
    @keydown.esc="$emit('close')"
  >
    <div class="fr-header">
      <div class="fr-tabs">
        <button
          type="button"
          class="fr-tab"
          :class="{ active: mode === 'find' }"
          @click="mode = 'find'"
        >
          חפש
        </button>
        <button
          type="button"
          class="fr-tab"
          :class="{ active: mode === 'replace' }"
          @click="mode = 'replace'"
        >
          החלף
        </button>
      </div>
      <button
        type="button"
        class="fr-close-btn"
        title="סגור (Esc)"
        @click="$emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="fr-body">
      <!-- שורת חיפוש -->
      <div class="fr-input-row">
        <label
          for="fr-search-input"
          class="fr-label"
        >חפש את:</label>
        <div class="fr-input-wrapper">
          <input
            id="fr-search-input"
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="fr-input"
            placeholder="הזן מילת חיפוש..."
            @keydown.enter.exact="findNext"
            @keydown.enter.shift="findPrev"
            @input="onSearchInput"
          >
          <span
            v-if="resultText"
            class="fr-counter"
          >{{ resultText }}</span>
        </div>
      </div>

      <!-- שורת החלפה (אם מצב החלפה פעיל) -->
      <div
        v-if="mode === 'replace'"
        class="fr-input-row"
      >
        <label
          for="fr-replace-input"
          class="fr-label"
        >החלף ב:</label>
        <div class="fr-input-wrapper">
          <input
            id="fr-replace-input"
            v-model="replaceQuery"
            type="text"
            class="fr-input"
            placeholder="טקסט חלופי..."
            @keydown.enter="doReplace"
          >
        </div>
      </div>
    </div>

    <!-- כפתורי פעולה -->
    <div class="fr-footer">
      <button
        type="button"
        class="fr-btn fr-btn-primary"
        :disabled="!searchQuery"
        @click="findNext"
      >
        מצא הבא
      </button>
      <button
        type="button"
        class="fr-btn"
        :disabled="!searchQuery"
        @click="findPrev"
      >
        מצא קודם
      </button>
      <button
        v-if="mode === 'replace'"
        type="button"
        class="fr-btn"
        :disabled="!searchQuery"
        @click="doReplace"
      >
        החלף
      </button>
      <button
        v-if="mode === 'replace'"
        type="button"
        class="fr-btn"
        :disabled="!searchQuery"
        @click="doReplaceAll"
      >
        החלף הכל
      </button>
      <button
        type="button"
        class="fr-btn fr-btn-secondary"
        @click="$emit('close')"
      >
        ביטול
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = withDefaults(
  defineProps<{
    isOpen?: boolean;
    initialMode?: 'find' | 'replace';
  }>(),
  {
    isOpen: false,
    initialMode: 'find',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'find', query: string, direction: 'next' | 'prev'): void;
  (e: 'replace', search: string, replace: string): void;
  (e: 'replace-all', search: string, replace: string): void;
}>();

const mode = ref<'find' | 'replace'>(props.initialMode);
const searchQuery = ref('');
const replaceQuery = ref('');
const resultText = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.initialMode,
  (newMode) => {
    mode.value = newMode;
  }
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        searchInputRef.value?.focus();
        searchInputRef.value?.select();
      });
    }
  }
);

function onSearchInput(): void {
  resultText.value = '';
  if (searchQuery.value) {
    emit('find', searchQuery.value, 'next');
  }
}

function findNext(): void {
  if (!searchQuery.value) return;
  emit('find', searchQuery.value, 'next');
}

function findPrev(): void {
  if (!searchQuery.value) return;
  emit('find', searchQuery.value, 'prev');
}

function doReplace(): void {
  if (!searchQuery.value) return;
  emit('replace', searchQuery.value, replaceQuery.value);
}

function doReplaceAll(): void {
  if (!searchQuery.value) return;
  emit('replace-all', searchQuery.value, replaceQuery.value);
}
</script>

<style scoped>
.find-replace-dialog {
  position: absolute;
  top: 140px;
  inset-inline-start: 40px;
  z-index: 2000;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  width: 380px;
  font-family: var(--font-main);
  user-select: none;
}

.fr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-block-end: 1px solid var(--color-outline-variant);
  padding-inline: 8px;
  background: var(--color-surface-container-high);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.fr-tabs {
  display: flex;
  gap: 2px;
}

.fr-tab {
  background: none;
  border: none;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  border-block-end: 2px solid transparent;
}

.fr-tab.active {
  color: var(--word-blue);
  font-weight: 600;
  border-block-end-color: var(--word-blue);
}

.fr-close-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-xs);
}

.fr-close-btn:hover {
  background: var(--word-btn-hover);
  color: var(--color-error);
}

.fr-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fr-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fr-label {
  width: 65px;
  font-size: 11px;
  color: var(--color-on-surface);
  flex-shrink: 0;
}

.fr-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.fr-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 12px;
  outline: none;
}

.fr-input:focus {
  border-color: var(--word-blue);
  box-shadow: 0 0 0 1px var(--word-blue);
}

.fr-counter {
  position: absolute;
  inset-inline-end: 6px;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  pointer-events: none;
}

.fr-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-block-start: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  flex-wrap: wrap;
}

.fr-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--font-main);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-on-surface);
  cursor: pointer;
  transition: all 0.08s;
}

.fr-btn:hover:not(:disabled) {
  background: var(--word-btn-hover);
  border-color: var(--word-blue);
}

.fr-btn-primary {
  background: var(--word-blue);
  color: #ffffff;
  border-color: var(--word-blue);
}

.fr-btn-primary:hover:not(:disabled) {
  background: var(--word-blue-dark);
}

.fr-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
