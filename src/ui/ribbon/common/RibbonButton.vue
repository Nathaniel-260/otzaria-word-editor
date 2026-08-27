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
    :data-tip-title="tip.title"
    :data-tip-shortcut="tip.shortcut || undefined"
    :data-tip-desc="tip.description || undefined"
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
    >{{ menuString(label) }}</span>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import { isToggleButton } from '../aria';
import { menuString } from '../i18n';
import SvgIcon from '../../icons/SvgIcon.vue';
import { shortcutLabel, type ShortcutId } from '../../shortcuts/registry';
import { tipParts } from '../../tooltip/tooltip-content';

const props = withDefaults(
  defineProps<{
    icon?: string;
    label?: string;
    tooltip?: string;
    /**
     * שורת ההסבר בטולטיפ — מה שהפקד *עושה*, מתחת לשמו ולצירוף.
     *
     * כשהיא חסרה היא נגזרת: `tooltip` שאינו זהה ל-`label` הוא ההסבר, וה-`label`
     * הוא הכותרת. הכלל ולמה הוא כזה — ב-ui/tooltip/tooltip-content.ts.
     */
    description?: string;
    /**
     * מזהה מהרג'יסטרי של הקיצורים, לא מחרוזת חופשית. כך אי אפשר להבטיח
     * למשתמש „Ctrl+B” שאין לו מאזין: מזהה שאינו ברג'יסטרי נופל בבנייה.
     */
    shortcutId?: ShortcutId;
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
  const base = menuString(props.tooltip || props.label || '');
  if (!props.shortcutId) return base;
  return `${base} (${shortcutLabel(props.shortcutId)})`;
});

/**
 * שלושת שדות הטולטיפ המעוצב, כתכונות `data-tip-*` שהשכבה קוראת
 * (ui/tooltip/TooltipLayer.vue).
 *
 * `title` נשאר לצדן ואינו מוחלף: הוא השם הנגיש של כפתור חסר תווית, והוא הנפילה
 * לאחור אם השכבה אינה מורכבת. השכבה היא שמכבה אותו — היא מסירה אותו מהעוגן
 * הפעיל בלבד, כדי שמערכת ההפעלה לא תצייר טולטיפ שני מעל הכרטיס.
 */
const tip = computed(() =>
  tipParts({
    label: menuString(props.label || ''),
    tooltip: menuString(props.tooltip || ''),
    description: menuString(props.description || ''),
    shortcut: props.shortcutId ? shortcutLabel(props.shortcutId) : '',
  }),
);
</script>
