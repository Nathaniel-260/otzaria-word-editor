<template>
  <div
    class="ribbon-select-wrapper"
    :style="{ width }"
  >
    <select
      :value="modelValue"
      class="ribbon-select"
      :disabled="disabled"
      :data-tip-title="menuString(title)"
      :aria-label="menuString(title)"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <template
        v-for="group in groups"
        :key="group.label"
      >
        <!--
          קבוצה בלי כותרת נשארת אפשרויות חשופות ולא `<optgroup label="">`:
          האחרון מצייר שורה ריקה בראש הרשימה בכל דפדפן.
        -->
        <optgroup
          v-if="group.label"
          :label="menuString(group.label)"
        >
          <option
            v-for="opt in group.options"
            :key="opt.value"
            :value="opt.value"
            :style="opt.preview ? { fontFamily: opt.preview } : undefined"
          >
            {{ menuString(opt.label) }}
          </option>
        </optgroup>
        <template v-else>
          <option
            v-for="opt in group.options"
            :key="opt.value"
            :value="opt.value"
            :style="opt.preview ? { fontFamily: opt.preview } : undefined"
          >
            {{ menuString(opt.label) }}
          </option>
        </template>
      </template>
    </select>
    <SvgIcon
      name="chevronDown"
      :size="10"
      class="select-arrow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '../../icons/SvgIcon.vue';
import { menuString } from '../i18n';

export interface SelectOption {
  value: string;
  label: string;
  /**
   * מה שהאפשרות תוצג בו — `font-family` של CSS. כך בורר הגופן מציג כל שם
   * בגופן עצמו, כמו ב-Word, וגם עונה על השאלה „האם הגופן הזה בכלל קיים כאן”
   * לפני שהמשתמש בוחר בו.
   */
  preview?: string;
  /**
   * כותרת ה-`<optgroup>` שהאפשרות שייכת לו. חסר או ריק = אפשרות חשופה בראש
   * הרשימה. קיים בשביל בורר הגופן, שמציג מאות משפחות מרגע שהמכונה נמנתה
   * (engine/system-fonts.ts) — רשימה שטוחה בגודל כזה אינה שמישה. בורר בלי
   * קבוצות כלל, כמו בורר הגודל, נשאר בדיוק כפי שהיה.
   */
  group?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    /** `readonly` — האפשרויות מגיעות מהמנוע, ואין לפקד רשות לשנות אותן. */
    options: readonly SelectOption[];
    width?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  {
    modelValue: '',
    width: 'auto',
    disabled: false,
    title: '',
  }
);

defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

/**
 * האפשרויות מקובצות לפי `group`, **בסדר ההופעה** ולא בסדר האלפבית: מי שבנה
 * את הרשימה כבר הכריע מה בראש, וקיבוץ שממיין מחדש היה הופך את ההכרעה הזאת.
 * קבוצה שחוזרת אחרי אפשרויות של קבוצה אחרת מתמזגת עם המופע הראשון שלה.
 */
const groups = computed(() => {
  const byLabel = new Map<string, { label: string; options: SelectOption[] }>();
  for (const option of props.options) {
    const label = option.group ?? '';
    const existing = byLabel.get(label);
    if (existing) existing.options.push(option);
    else byLabel.set(label, { label, options: [option] });
  }
  return [...byLabel.values()];
});
</script>

<style scoped>
.ribbon-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.ribbon-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 11px;
  height: var(--ribbon-row-h);
  padding-inline-start: 6px;
  padding-inline-end: 18px;
  width: 100%;
  cursor: pointer;
  outline: none;
  transition: border-color 0.1s;
}

.ribbon-select:hover:not(:disabled) {
  border-color: var(--word-blue);
}

.ribbon-select:focus {
  border-color: var(--word-blue);
  box-shadow: 0 0 0 1px var(--word-blue);
}

.ribbon-select:disabled {
  opacity: 0.4;
  cursor: default;
}

.select-arrow {
  position: absolute;
  inset-inline-end: 4px;
  pointer-events: none;
  color: var(--color-on-surface-variant);
}
</style>
