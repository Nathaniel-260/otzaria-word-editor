<template>
  <header class="topbar word-titlebar">
    <!-- כפתורים נסתרים לשמירה על חוזי בדיקות ה-boot -->
    <button
      id="open"
      type="button"
      style="display: none;"
      :disabled="isOpening"
      @click="$emit('open')"
    />

    <!-- צד ימין (RTL): מותג, שמירה אוטומטית, שמירה מהירה ושם מסמך -->
    <div class="titlebar-start">
      <div
        class="word-app-badge"
        title="וורד לאוצריא"
      >
        <SvgIcon
          name="word"
          :size="20"
        />
      </div>

      <!-- מתג שמירה אוטומטית -->
      <div
        class="autosave-toggle"
        :class="{ active: autosaveEnabled }"
        title="שמירה אוטומטית לדיסק"
        @click="$emit('toggle-autosave')"
      >
        <span class="autosave-label">שמירה אוטומטית</span>
        <div class="toggle-pill">
          <div class="toggle-thumb" />
        </div>
      </div>

      <!-- סרגל גישה מהירה (Quick Access Toolbar) -->
      <div class="quick-access-tools">
        <button
          type="button"
          class="qa-btn"
          :disabled="isSaving"
          :title="isDirty ? 'שמור (ישנם שינויים שלא נשמרו) Ctrl+S' : 'שמור Ctrl+S'"
          @pointerdown.prevent
          @click="$emit('save')"
        >
          <SvgIcon
            name="save"
            :size="15"
          />
          <span
            v-if="isDirty"
            class="dirty-badge"
          />
        </button>
        <button
          type="button"
          class="qa-btn"
          title="בטל Ctrl+Z"
          :disabled="!canUndo"
          @pointerdown.prevent
          @click="$emit('undo')"
        >
          <SvgIcon
            name="undo"
            :size="15"
          />
        </button>
        <button
          type="button"
          class="qa-btn"
          title="חזור Ctrl+Y"
          :disabled="!canRedo"
          @pointerdown.prevent
          @click="$emit('redo')"
        >
          <SvgIcon
            name="redo"
            :size="15"
          />
        </button>
      </div>

      <!-- שם המסמך והסטטוס -->
      <div class="doc-title-wrapper">
        <input
          :value="title"
          class="doc-title-input"
          spellcheck="false"
          title="לחץ לעריכת שם המסמך"
          @change="$emit('update-title', ($event.target as HTMLInputElement).value)"
        >
        <span class="app-suffix">- Word</span>
        <span
          v-if="isDirty"
          class="dirty-indicator"
          title="שינויים לא שמורים"
        >•</span>
        <SvgIcon
          name="chevronDown"
          :size="10"
          class="title-dropdown-icon"
        />
      </div>
    </div>

    <!-- מרכז: תיבת חיפוש (Search / Tell Me) -->
    <div class="titlebar-center">
      <div
        class="search-box"
        @click="$emit('open-find')"
      >
        <SvgIcon
          name="search"
          :size="14"
          class="search-icon"
        />
        <input
          type="text"
          class="search-input"
          placeholder="חפש"
          readonly
        >
      </div>
    </div>

    <!-- צד שמאל (סיום): פעולות נוספות -->
    <div class="titlebar-end">
      <div
        v-if="saveStateText"
        class="save-state-pill"
        :class="{ error: isSaveError }"
      >
        {{ saveStateText }}
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import SvgIcon from '../icons/SvgIcon.vue';

withDefaults(
  defineProps<{
    title?: string;
    isDirty?: boolean;
    isSaving?: boolean;
    isSaveError?: boolean;
    saveStateText?: string;
    autosaveEnabled?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    isOpening?: boolean;
  }>(),
  {
    title: 'מסמך 1',
    isDirty: false,
    isSaving: false,
    isSaveError: false,
    saveStateText: '',
    autosaveEnabled: true,
    canUndo: true,
    canRedo: true,
    isOpening: false,
  }
);

defineEmits<{
  (e: 'save'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'open'): void;
  (e: 'open-find'): void;
  (e: 'toggle-autosave'): void;
  (e: 'update-title', newTitle: string): void;
}>();
</script>

<style scoped>
.word-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding-inline: 12px;
  background: var(--color-surface-container-high);
  border-block-end: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface);
  user-select: none;
  gap: 12px;
  flex-shrink: 0;
}

.titlebar-start {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.word-app-badge {
  color: var(--word-blue);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* מתג שמירה אוטומטית */
.autosave-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  transition: background 0.1s;
}

.autosave-toggle:hover {
  background: var(--word-btn-hover);
}

.autosave-label {
  font-size: 11px;
  color: var(--color-on-surface);
}

.toggle-pill {
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-outline);
  position: relative;
  transition: background 0.15s ease;
}

.toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 2px;
  inset-inline-start: 2px;
  transition: transform 0.15s ease;
}

.autosave-toggle.active .toggle-pill {
  background: var(--word-blue);
}

.autosave-toggle.active .toggle-thumb {
  transform: translateX(-12px);
}

[dir="rtl"] .autosave-toggle.active .toggle-thumb {
  transform: translateX(-12px);
}

/* גישה מהירה */
.quick-access-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-inline-start: 4px;
  border-inline-start: 1px solid var(--color-outline-variant);
}

.qa-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  color: var(--color-on-surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.08s;
}

.qa-btn:hover:not(:disabled) {
  background: var(--word-btn-hover);
}

.qa-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.dirty-badge {
  position: absolute;
  top: 3px;
  inset-inline-end: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e67e22;
}

/* שם המסמך */
.doc-title-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.1s;
  cursor: pointer;
}

.doc-title-wrapper:hover {
  background: var(--word-btn-hover);
}

.doc-title-input {
  background: transparent;
  border: none;
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  width: 110px;
  text-align: start;
}

.app-suffix {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.dirty-indicator {
  font-size: 16px;
  color: #e67e22;
  line-height: 1;
}

.title-dropdown-icon {
  color: var(--color-on-surface-variant);
}

/* מרכז: חיפוש */
.titlebar-center {
  flex: 0 1 360px;
  display: flex;
  justify-content: center;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: 4px 12px;
  width: 100%;
  max-width: 320px;
  cursor: pointer;
  transition: all 0.1s;
}

.search-box:hover {
  background: var(--color-surface);
  border-color: var(--word-blue);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.search-icon {
  color: var(--color-on-surface-variant);
}

.search-input {
  background: transparent;
  border: none;
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 12px;
  outline: none;
  width: 100%;
  cursor: pointer;
}

.titlebar-end {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-state-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(24, 90, 189, 0.08);
  color: var(--word-blue);
}

.save-state-pill.error {
  background: rgba(176, 0, 32, 0.1);
  color: var(--color-error);
}
</style>
