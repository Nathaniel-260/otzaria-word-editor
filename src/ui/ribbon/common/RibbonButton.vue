<template>
  <button
    type="button"
    class="word-btn"
    :class="[
      `btn-${variant}`,
      { active: active }
    ]"
    :disabled="disabled"
    :title="computedTitle"
    :aria-pressed="ariaPressed"
    @pointerdown.prevent
    @click="$emit('click', $event)"
  >
    <SvgIcon
      v-if="icon"
      :name="icon"
      :size="iconSize"
    />
    <span
      v-if="label && variant !== 'icon-only'"
      class="btn-label"
    >{{ label }}</span>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import { isToggleButton } from '../aria';
import SvgIcon from '../../icons/SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    icon?: string;
    label?: string;
    tooltip?: string;
    shortcut?: string;
    variant?: 'large' | 'small' | 'icon-only';
    active?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: 'icon-only',
    active: false,
    disabled: false,
  }
);

defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

// נמדד פעם אחת ב-setup, לא בכל render: אתר קריאה אינו מוסיף או מסיר את הקישור
// ל-active בזמן ריצה. ההסבר למה vnode.props ולא props — ב-isToggleButton.
const isToggle = isToggleButton(getCurrentInstance()?.vnode.props);

/** undefined מסיר את התכונה: כפתור פעולה אינו מתג, ואינו מדווח מצוב. */
const ariaPressed = computed<'true' | 'false' | undefined>(() => {
  if (!isToggle) return undefined;
  return props.active ? 'true' : 'false';
});

const iconSize = computed(() => {
  if (props.variant === 'large') return 32;
  if (props.variant === 'small') return 16;
  return 18;
});

const computedTitle = computed(() => {
  const base = props.tooltip || props.label || '';
  if (props.shortcut) return `${base} (${props.shortcut})`;
  return base;
});
</script>
