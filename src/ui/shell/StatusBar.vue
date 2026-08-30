<template>
  <footer
    id="status"
    class="status word-statusbar"
    role="status"
    :class="{ 'status--error': isError }"
  >
    <!-- צד ימין (RTL): נתוני מסמך. כל פריט מוצג רק אם נמדד — ראו shell-format. -->
    <div class="statusbar-start">
      <div
        v-if="pageText"
        class="status-item"
        data-tip-title="עמודי המסמך"
      >
        <span>{{ pageText }}</span>
      </div>
      <div
        v-if="pageText && wordText"
        class="status-divider"
      />
      <div
        v-if="wordText"
        class="status-item"
        data-tip-title="מספר מילים במסמך"
      >
        <span>{{ wordText }}</span>
      </div>
      <div
        v-if="(pageText || wordText) && statusText"
        class="status-divider"
      />
      <div
        v-if="statusText"
        class="status-item status-message"
        :class="{ error: isError }"
      >
        <span>{{ statusText }}</span>
      </div>
    </div>

    <!-- צד שמאל (RTL): מצב תצוגה ובקרת זום -->
    <div class="statusbar-end">
      <div class="view-mode-buttons">
        <button
          type="button"
          class="sb-icon-btn"
          :class="{ active: isFocusMode }"
          :aria-pressed="isFocusMode"
          data-tip-title="מצב מיקוד"
          aria-label="מצב מיקוד"
          @pointerdown.prevent
          @click="$emit('toggle-focus')"
        >
          <SvgIcon
            name="focusMode"
            :size="13"
          />
        </button>
      </div>

      <div class="status-divider" />

      <!-- בקרת זום. הגבולות מגיעים מהמנוע ואינם מקודדים כאן. -->
      <div class="zoom-controls">
        <button
          type="button"
          class="zoom-step-btn"
          data-tip-title="הקטן תצוגה"
          aria-label="הקטן תצוגה"
          :disabled="zoomLevel <= zoomMin"
          @pointerdown.prevent
          @click="stepZoom(-ZOOM_STEP)"
        >
          -
        </button>
        <input
          type="range"
          :min="zoomMin"
          :max="zoomMax"
          :step="ZOOM_STEP"
          :value="zoomLevel"
          class="zoom-slider"
          data-tip-title="שינוי גודל תצוגה"
          aria-label="גודל תצוגה באחוזים"
          @input="onZoomSliderChange"
        >
        <button
          type="button"
          class="zoom-step-btn"
          data-tip-title="הגדל תצוגה"
          aria-label="הגדל תצוגה"
          :disabled="zoomLevel >= zoomMax"
          @pointerdown.prevent
          @click="stepZoom(ZOOM_STEP)"
        >
          +
        </button>
        <button
          type="button"
          class="zoom-pct-btn"
          data-tip-title="אפס ל-100%"
          aria-label="אפס ל-100%"
          @pointerdown.prevent
          @click="resetZoom"
        >
          {{ zoomLevel }}%
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '../icons/SvgIcon.vue';
import { pageLabel, wordCountLabel } from '../../composables/shell-format';
import { clampZoom, FALLBACK_ZOOM } from '../../engine/zoom';

/** צעד הזום של לחצני ± ושל הסרגל, באחוזים. */
const ZOOM_STEP = 10;

const props = withDefaults(
  defineProps<{
    /** עמוד הסמן, מבוסס 1. `null` = אין מקור אמין, ואז מוצג מספר העמודים בלבד. */
    currentPage?: number | null;
    /** מספר עמודי הפריסה. `null` = העימוד טרם דיווח. */
    totalPages?: number | null;
    /** מספר המילים. `null` = טרם נמדד; 0 הוא מסמך ריק, וזה לא אותו דבר. */
    wordCount?: number | null;
    statusText?: string;
    isError?: boolean;
    isFocusMode?: boolean;
    zoomLevel?: number;
    zoomMin?: number;
    zoomMax?: number;
  }>(),
  {
    currentPage: null,
    totalPages: null,
    wordCount: null,
    statusText: '',
    isError: false,
    isFocusMode: false,
    zoomLevel: FALLBACK_ZOOM.value,
    zoomMin: FALLBACK_ZOOM.min,
    zoomMax: FALLBACK_ZOOM.max,
  }
);

const emit = defineEmits<{
  (e: 'update:zoomLevel', zoom: number): void;
  (e: 'toggle-focus'): void;
}>();

const pageText = computed(() => pageLabel(props.currentPage, props.totalPages));
const wordText = computed(() => wordCountLabel(props.wordCount));

function emitZoom(value: number): void {
  emit('update:zoomLevel', clampZoom(value, props.zoomMin, props.zoomMax));
}

function onZoomSliderChange(event: Event): void {
  emitZoom(Number.parseInt((event.target as HTMLInputElement).value, 10));
}

function stepZoom(delta: number): void {
  emitZoom(props.zoomLevel + delta);
}

function resetZoom(): void {
  emitZoom(FALLBACK_ZOOM.value);
}
</script>

<style scoped>
.word-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--statusbar-height);
  padding-inline: 10px;
  background: var(--color-surface-container-high);
  border-block-start: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: 11px;
  user-select: none;
  flex-shrink: 0;
}

.statusbar-start,
.statusbar-end {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item {
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  cursor: default;
  white-space: nowrap;
}

.status-item:hover {
  background: var(--word-btn-hover);
}

.status-divider {
  width: 1px;
  height: 12px;
  background: var(--color-outline-variant);
}

.status-message {
  color: var(--color-on-surface);
  font-weight: 500;
}

.status-message.error {
  color: var(--color-error);
}

.view-mode-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sb-icon-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sb-icon-btn:hover {
  background: var(--word-btn-hover);
  color: var(--color-on-surface);
}

.sb-icon-btn.active {
  background: var(--word-btn-active);
  color: var(--word-blue);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-step-btn {
  background: none;
  border: none;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.zoom-step-btn:hover:not(:disabled) {
  color: var(--color-on-surface);
}

.zoom-step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.zoom-slider {
  -webkit-appearance: none;
  width: 72px;
  height: 3px;
  background: var(--color-outline);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--word-blue);
  cursor: pointer;
}

.zoom-pct-btn {
  background: none;
  border: none;
  padding: 1px 4px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  color: var(--color-on-surface);
  cursor: pointer;
  min-width: 36px;
  text-align: center;
}

.zoom-pct-btn:hover {
  background: var(--word-btn-hover);
}
</style>
