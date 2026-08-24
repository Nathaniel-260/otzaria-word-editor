<template>
  <div
    class="ribbon-split-btn"
    :class="[`variant-${variant}`, { active, disabled }]"
  >
    <button
      type="button"
      class="split-main-btn"
      :disabled="disabled"
      :title="tooltip || label"
      @pointerdown.prevent
      @click="$emit('click', $event)"
    >
      <SvgIcon
        v-if="icon"
        :name="icon"
        :size="variant === 'large' ? 32 : 16"
      />
      <span
        v-if="label && variant !== 'icon-only'"
        class="btn-label"
      >{{ label }}</span>
    </button>
    <button
      type="button"
      class="split-arrow-btn"
      :disabled="disabled"
      title="אפשרויות נוספות"
      @pointerdown.prevent
      @click="$emit('toggle-dropdown', $event)"
    >
      <SvgIcon
        name="chevronDown"
        :size="10"
      />
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '../../icons/SvgIcon.vue';

withDefaults(
  defineProps<{
    icon?: string;
    label?: string;
    tooltip?: string;
    variant?: 'large' | 'small' | 'icon-only';
    active?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: 'small',
    active: false,
    disabled: false,
  }
);

defineEmits<{
  (e: 'click', event: MouseEvent): void;
  (e: 'toggle-dropdown', event: MouseEvent): void;
}>();
</script>

<style scoped>
.ribbon-split-btn {
  display: inline-flex;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  position: relative;
  align-items: stretch;
  transition: background 0.08s, border-color 0.08s;
}

.ribbon-split-btn:hover:not(.disabled) {
  background: var(--word-btn-hover);
  border-color: var(--color-outline-variant);
}

.ribbon-split-btn.active {
  background: var(--word-btn-active);
  border-color: var(--word-btn-active-border);
}

.ribbon-split-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.split-main-btn {
  background: none;
  border: none;
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: var(--font-size-ribbon-btn);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.variant-large {
  flex-direction: column;
  height: 68px;
  min-width: 48px;
}

.variant-large .split-main-btn {
  flex-direction: column;
  flex: 1;
  justify-content: center;
  padding: 4px 6px 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.variant-large .split-arrow-btn {
  height: 14px;
  width: 100%;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.split-arrow-btn {
  background: none;
  border: none;
  border-inline-start: 1px solid transparent;
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  cursor: pointer;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.ribbon-split-btn:hover .split-arrow-btn {
  border-inline-start-color: var(--color-outline-variant);
}

.btn-label {
  font-size: 11px;
  white-space: nowrap;
}
</style>
