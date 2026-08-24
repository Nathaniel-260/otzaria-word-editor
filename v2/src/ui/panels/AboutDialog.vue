<template>
  <div
    v-if="isOpen"
    class="modal-backdrop"
    @click.self="$emit('close')"
  >
    <div
      class="about-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div class="about-header">
        <div class="about-header-title">
          <SvgIcon
            name="word"
            :size="24"
            class="about-icon"
          />
          <span>וורד לאוצריא</span>
        </div>
        <button
          type="button"
          class="about-close-btn"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="about-body">
        <p class="about-version">
          גרסה 2.0.0 (SuperDoc v2)
        </p>
        <p class="about-desc">
          עורך מסמכי Word (.docx) מתקדם, מעוצב ומותאם במיוחד עבור אפליקציית אוצריא.
        </p>

        <div class="about-details">
          <div class="detail-row">
            <span class="detail-key">מנוע מסמכים:</span>
            <span class="detail-val">SuperDoc 2.8.0</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">תמיכה מלאה:</span>
            <span class="detail-val">עברית, RTL ועימוד עמודים</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">רישיון:</span>
            <span class="detail-val">AGPL-3.0</span>
          </div>
        </div>
      </div>

      <div class="about-footer">
        <button
          type="button"
          class="about-btn"
          @click="$emit('close')"
        >
          סגור
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '../icons/SvgIcon.vue';

defineProps<{
  isOpen?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-scrim);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.24);
  width: 360px;
  max-width: 90vw;
  font-family: var(--font-main);
  overflow: hidden;
}

.about-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-surface-container-high);
  border-block-end: 1px solid var(--color-outline-variant);
}

.about-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-on-surface);
}

.about-icon {
  color: var(--word-blue);
}

.about-close-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.about-close-btn:hover {
  background: var(--word-btn-hover);
  color: var(--color-error);
}

.about-body {
  padding: 16px;
}

.about-version {
  font-size: 12px;
  font-weight: 600;
  color: var(--word-blue);
  margin-bottom: 6px;
}

.about-desc {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
  margin-bottom: 14px;
}

.about-details {
  background: var(--color-surface-container-high);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
}

.detail-key {
  color: var(--color-on-surface-variant);
}

.detail-val {
  color: var(--color-on-surface);
  font-weight: 500;
}

.about-footer {
  padding: 10px 16px;
  border-block-start: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  display: flex;
  justify-content: flex-end;
}

.about-btn {
  padding: 4px 16px;
  font-size: 12px;
  font-family: var(--font-main);
  background: var(--word-blue);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.about-btn:hover {
  background: var(--word-blue-dark);
}
</style>
