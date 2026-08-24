<template>
  <footer
    id="status"
    class="status word-statusbar"
    role="status"
    :class="{ 'status--error': isError }"
  >
    <!-- צד ימין (RTL): נתוני מסמך -->
    <div class="statusbar-start">
      <div
        class="status-item"
        title="מספר עמוד"
      >
        <span>עמוד {{ currentPage }} מתוך {{ totalPages }}</span>
      </div>
      <div class="status-divider" />
      <div
        class="status-item"
        title="מספר מילים במסמך"
      >
        <span>{{ wordCount }} מילים</span>
      </div>
      <div class="status-divider" />
      <div
        class="status-item"
        title="שפת הגהה"
      >
        <span>{{ language }}</span>
      </div>
      <div class="status-divider" />
      <div
        v-if="statusText"
        class="status-item status-message"
        :class="{ error: isError }"
      >
        <span>{{ statusText }}</span>
      </div>
    </div>

    <!-- צד שמאל (RTL): מצבי תצוגה ובקרת זום -->
    <div class="statusbar-end">
      <!-- מצבי תצוגה -->
      <div class="view-mode-buttons">
        <button
          type="button"
          class="sb-icon-btn"
          title="מצב מיקוד"
          @pointerdown.prevent
          @click="$emit('toggle-focus')"
        >
          <SvgIcon
            name="focusMode"
            :size="13"
          />
        </button>
        <button
          type="button"
          class="sb-icon-btn active"
          title="פריסת הדפסה"
        >
          <SvgIcon
            name="paperSize"
            :size="13"
          />
        </button>
      </div>

      <div class="status-divider" />

      <!-- בקרת זום (Zoom Slider) -->
      <div class="zoom-controls">
        <button
          type="button"
          class="zoom-step-btn"
          title="הקטן תצוגה"
          @pointerdown.prevent
          @click="stepZoom(-10)"
        >
          -
        </button>
        <input
          type="range"
          min="50"
          max="200"
          step="5"
          :value="zoomLevel"
          class="zoom-slider"
          title="שינוי גודל תצוגה"
          @input="onZoomSliderChange"
        >
        <button
          type="button"
          class="zoom-step-btn"
          title="הגדל תצוגה"
          @pointerdown.prevent
          @click="stepZoom(10)"
        >
          +
        </button>
        <button
          type="button"
          class="zoom-pct-btn"
          title="אפס ל-100%"
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
import SvgIcon from '../icons/SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    currentPage?: number;
    totalPages?: number;
    wordCount?: number;
    language?: string;
    statusText?: string;
    isError?: boolean;
    zoomLevel?: number;
  }>(),
  {
    currentPage: 1,
    totalPages: 1,
    wordCount: 0,
    language: 'עברית',
    statusText: '',
    isError: false,
    zoomLevel: 100,
  }
);

const emit = defineEmits<{
  (e: 'update:zoomLevel', zoom: number): void;
  (e: 'toggle-focus'): void;
}>();

function onZoomSliderChange(event: Event): void {
  const val = parseInt((event.target as HTMLInputElement).value, 10) || 100;
  emit('update:zoomLevel', val);
}

function stepZoom(delta: number): void {
  const next = Math.min(200, Math.max(50, props.zoomLevel + delta));
  emit('update:zoomLevel', next);
}

function resetZoom(): void {
  emit('update:zoomLevel', 100);
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

.zoom-step-btn:hover {
  color: var(--color-on-surface);
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
