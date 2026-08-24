<template>
  <div
    ref="containerRef"
    class="color-picker-container"
  >
    <div
      class="color-btn-wrapper"
      :class="{ active: isOpen }"
    >
      <button
        type="button"
        class="color-main-btn"
        :title="title"
        :disabled="disabled"
        @pointerdown.prevent
        @click="applyCurrentColor"
      >
        <SvgIcon
          :name="icon"
          :size="16"
        />
        <div
          class="color-indicator-bar"
          :style="{ backgroundColor: modelValue || defaultColor }"
        />
      </button>
      <button
        type="button"
        class="color-arrow-btn"
        :disabled="disabled"
        title="בחירת צבע"
        @pointerdown.prevent
        @click="toggleDropdown"
      >
        <SvgIcon
          name="chevronDown"
          :size="8"
        />
      </button>
    </div>

    <!-- פופאובר פלטת הצבעים של Office -->
    <div
      v-if="isOpen"
      class="color-palette-popover"
      @pointerdown.stop
    >
      <div
        v-if="allowClear"
        class="palette-section"
      >
        <button
          type="button"
          class="palette-clear-btn"
          @click="selectColor('')"
        >
          <span class="clear-icon" />
          ללא צבע
        </button>
      </div>

      <!-- צבעי ערכת נושא (Theme Colors) -->
      <div class="palette-section">
        <div class="palette-title">
          צבעי ערכת נושא
        </div>
        <div class="theme-colors-grid">
          <div
            v-for="(col, colIndex) in THEME_COLUMNS"
            :key="colIndex"
            class="theme-column"
          >
            <button
              v-for="(hex, rowIndex) in col"
              :key="rowIndex"
              type="button"
              class="color-swatch"
              :class="{ selected: modelValue?.toLowerCase() === hex.toLowerCase() }"
              :style="{ backgroundColor: hex }"
              :title="hex"
              @click="selectColor(hex)"
            />
          </div>
        </div>
      </div>

      <!-- צבעים סטנדרטיים (Standard Colors) -->
      <div class="palette-section">
        <div class="palette-title">
          צבעים רגילים
        </div>
        <div class="standard-colors-row">
          <button
            v-for="hex in STANDARD_COLORS"
            :key="hex"
            type="button"
            class="color-swatch"
            :class="{ selected: modelValue?.toLowerCase() === hex.toLowerCase() }"
            :style="{ backgroundColor: hex }"
            :title="hex"
            @click="selectColor(hex)"
          />
        </div>
      </div>

      <!-- צבע מותאם אישית -->
      <div class="palette-section custom-color-section">
        <label class="custom-color-label">
          <span>צבעים נוספים...</span>
          <input
            type="color"
            :value="modelValue || defaultColor"
            class="custom-color-input"
            @input="selectColor(($event.target as HTMLInputElement).value)"
          >
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import SvgIcon from '../../icons/SvgIcon.vue';

const THEME_COLUMNS = [
  ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'], // לבן/אפור בהיר
  ['#000000', '#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0c0c0c'], // שחור/אפור כהה
  ['#eeece1', '#ddd9c3', '#c4bd97', '#948a54', '#494429', '#1d1b10'], // חום בהיר
  ['#1f497d', '#c6d9f1', '#8db3e2', '#548dd4', '#366092', '#17365d'], // כחול כהה
  ['#4f81bd', '#dce6f1', '#b8cce4', '#95b3d7', '#376092', '#254061'], // כחול
  ['#c0504d', '#f2dcdb', '#e6b8b7', '#da9694', '#963634', '#632423'], // אדום
  ['#9bbb59', '#ebf1dd', '#d7e3bc', '#c3d69b', '#76933c', '#4f6228'], // ירוק זית
  ['#8064a2', '#e5e0ec', '#ccc1da', '#b2a2c7', '#604a7b', '#403151'], // סגול
  ['#4bacc6', '#dbeef3', '#b7dde8', '#92cddc', '#31859b', '#215967'], // טורקיז
  ['#f79646', '#fdeada', '#fbd5b5', '#fac08f', '#e36c09', '#974806'], // כתום
];

const STANDARD_COLORS = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050',
  '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'
];

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    icon: string;
    title: string;
    defaultColor?: string;
    allowClear?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: '',
    defaultColor: '#000000',
    allowClear: true,
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', color: string): void;
  (e: 'change', color: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);

function toggleDropdown(): void {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function selectColor(hex: string): void {
  emit('update:modelValue', hex);
  emit('change', hex);
  isOpen.value = false;
}

function applyCurrentColor(): void {
  if (props.disabled) return;
  const color = props.modelValue || props.defaultColor;
  emit('change', color);
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
.color-picker-container {
  position: relative;
  display: inline-flex;
}

.color-btn-wrapper {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: background 0.08s, border-color 0.08s;
  height: 22px;
}

.color-btn-wrapper:hover {
  background: var(--word-btn-hover);
  border-color: var(--color-outline-variant);
}

.color-btn-wrapper.active {
  background: var(--word-btn-active);
  border-color: var(--word-btn-active-border);
}

.color-main-btn {
  background: none;
  border: none;
  padding: 1px 3px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface);
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.color-indicator-bar {
  width: 14px;
  height: 3px;
  border-radius: 1px;
  margin-top: 1px;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.4);
}

.color-arrow-btn {
  background: none;
  border: none;
  padding: 0 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* פופאובר פלטת הצבעים */
.color-palette-popover {
  position: absolute;
  top: 100%;
  inset-inline-start: 0;
  z-index: 1000;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  padding: 8px;
  min-width: 176px;
  margin-top: 2px;
}

.palette-section {
  margin-bottom: 8px;
}

.palette-section:last-child {
  margin-bottom: 0;
}

.palette-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  margin-bottom: 4px;
}

.palette-clear-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  padding: 3px 6px;
  font-size: 11px;
  color: var(--color-on-surface);
  cursor: pointer;
  text-align: start;
}

.palette-clear-btn:hover {
  background: var(--word-btn-hover);
  border-color: var(--color-outline-variant);
}

.clear-icon {
  width: 12px;
  height: 12px;
  border: 1px dashed var(--color-outline);
  border-radius: 2px;
}

.theme-colors-grid {
  display: flex;
  gap: 2px;
}

.theme-column {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.standard-colors-row {
  display: flex;
  gap: 2px;
}

.color-swatch {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 1px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.08s;
}

.color-swatch:hover {
  transform: scale(1.2);
  z-index: 2;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.color-swatch.selected {
  outline: 2px solid var(--word-blue);
  outline-offset: 1px;
}

.custom-color-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-on-surface);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
}

.custom-color-label:hover {
  background: var(--word-btn-hover);
}

.custom-color-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
</style>
