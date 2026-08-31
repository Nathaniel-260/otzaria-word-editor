<template>
  <div
    ref="rootRef"
    class="ribbon-combo"
    :style="{ width }"
  >
    <input
      ref="inputRef"
      class="ribbon-combo-input"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      :value="shown"
      :disabled="disabled"
      :title="menuString(title)"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :style="previewStyle"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
      @keydown="onKeydown"
    >
    <!--
      `mousedown.prevent` ולא `click`: בלי מניעת ברירת המחדל הלחיצה מוציאה את
      הפוקוס מהשדה, `blur` סוגר את הרשימה, והפתיחה מיד אחריה נראתה כהבהוב.
    -->
    <button
      type="button"
      class="ribbon-combo-arrow"
      tabindex="-1"
      :disabled="disabled"
      :aria-label="menuString('פתח את הרשימה')"
      @mousedown.prevent="toggle"
    >
      <SvgIcon
        name="chevronDown"
        :size="10"
      />
    </button>

    <ul
      v-if="open"
      :id="listId"
      ref="listRef"
      class="ribbon-combo-list"
      role="listbox"
      :style="popoverStyle"
    >
      <template
        v-for="(row, i) in built.rows"
        :key="row.type === 'group' ? `g:${row.label}:${i}` : `o:${row.option.value}`"
      >
        <li
          v-if="row.type === 'group'"
          class="ribbon-combo-group"
          role="presentation"
        >
          {{ menuString(row.label) }}
        </li>
        <li
          v-else
          :id="optionId(row.index)"
          class="ribbon-combo-option"
          :class="{ active: row.index === activeIndex, chosen: row.option.value === modelValue }"
          role="option"
          :aria-selected="row.option.value === modelValue"
          :data-value="row.option.value"
          :data-group="row.option.group ?? ''"
          :style="row.option.preview ? { fontFamily: row.option.preview } : undefined"
          @mousedown.prevent="choose(row.option.value)"
          @mousemove="activeIndex = row.index"
        >
          {{ menuString(row.option.label) }}
        </li>
      </template>
      <li
        v-if="built.count === 0"
        class="ribbon-combo-empty"
        role="presentation"
      >
        {{ menuString('אין גופן בשם הזה') }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * בורר עם חיפוש — הפקד של בורר הגופן.
 *
 * ## למה לא `<select>` נייטיב, שהיה כאן קודם
 *
 * מרגע שהמכונה נמנית (engine/system-fonts.ts) הבורר מציג מאות משפחות.
 * ב-`<select>` נייטיב אין חיפוש: יש „קפיצה לאות” שמתאפסת אחרי שנייה, ובעברית
 * היא כמעט חסרת ערך. מי שמחפש את „Narkisim” בין 300 שמות היה גולל.
 *
 * ## ומה שאבד בדרך, ולמה זה בסדר
 *
 * `<select>` נייטיב מצייר את הרשימה שלו **מחוץ** לחלון הדפדפן — היא אינה
 * נחתכת על ידי גבולות הרצועה, והמערכת מטפלת בגלילה. הרשימה כאן היא DOM רגיל,
 * ולכן היא זקוקה ל-`z-index` ול-`max-height` משלה. זה המחיר של חיפוש, והוא
 * שווה אותו: אין דרך לשים שדה קלט בתוך `<select>`.
 *
 * ההכרעות שאינן חיווט — מה נחשב התאמה, מה מדורג לפני מה, ומה Enter מחיל —
 * יושבות ב-`../font-search.ts` ונבדקות שם ישירות.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { usePopoverPosition } from '../../../composables/popover-position';
import SvgIcon from '../../icons/SvgIcon.vue';
import { menuString } from '../i18n';
import {
  buildComboRows,
  commitValue,
  nextOptionIndex,
  type ComboOption,
} from '../font-search';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    /** `readonly` — האפשרויות מגיעות מהמנוע ומהמנייה, ואין לפקד רשות לשנותן. */
    options: readonly ComboOption[];
    width?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  {
    modelValue: '',
    width: 'auto',
    disabled: false,
    title: '',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const open = ref(false);
const activeIndex = ref(-1);

/**
 * המיקום נמדד ואינו CSS, ומאותו טעם בדיוק שבו שאר הפופאוברים של הרצועה
 * נמדדים: `.word-ribbon-body` מוגדר `overflow-x: auto; overflow-y: hidden`
 * (styles/ribbon.css), והוא חותך אנכית בגובה הרצועה. רשימה של מאות גופנים
 * ב-`position: absolute` נראתה כשלוש שורות עם פס גלילה — בדיוק מה שדווח.
 *
 * ראו composables/popover-position.ts, כולל למה `overflow-y: visible` על
 * הרצועה אינו פתרון.
 */
const { popoverStyle } = usePopoverPosition(rootRef, listRef, open);

/**
 * מה שהוקלד, או `null` כשלא הוקלד דבר.
 *
 * `null` ולא מחרוזת ריקה, וזו ההבחנה שמחזיקה את הפקד: מחרוזת ריקה היא שאילתה
 * לגיטימית („מחקתי את התיבה”) שאמורה להציג את כל הרשימה, ואילו `null` פירושו
 * „לא נגעתי” — ואז התיבה מציגה את הגופן הנוכחי. בלי ההפרדה הזאת התיבה הייתה
 * מתרוקנת בכל פתיחה.
 */
const query = ref<string | null>(null);

/** מזהי DOM ייחודיים למופע — `aria-activedescendant` דורש מזהה אמיתי. */
const uid = `combo-${Math.random().toString(36).slice(2, 9)}`;
const listId = `${uid}-list`;
const optionId = (index: number) => `${uid}-opt-${index}`;

const shown = computed(() => query.value ?? props.modelValue);
const built = computed(() => buildComboRows(props.options, query.value ?? ''));

/** התיבה מציגה את הגופן הנבחר בגופן שלו — כמו ב-Word. לא בזמן הקלדה. */
const previewStyle = computed(() => {
  if (query.value !== null) return undefined;
  const current = props.options.find((option) => option.value === props.modelValue);
  return current?.preview ? { fontFamily: current.preview } : undefined;
});

/** מיקום הערך הנוכחי ברשימה, או -1. */
function indexOfCurrent(): number {
  for (const row of built.value.rows) {
    if (row.type === 'option' && row.option.value === props.modelValue) return row.index;
  }
  return -1;
}

function openList(): void {
  if (props.disabled) return;
  open.value = true;
  // נפתח על הגופן הנוכחי ולא על ראש הרשימה: זה מה שמאפשר לפתוח, ללחוץ חץ
  // פעם אחת ולקבל את השכן — במקום לקפוץ ל-Assistant מכל מקום.
  activeIndex.value = indexOfCurrent();
}

function closeList(): void {
  open.value = false;
  activeIndex.value = -1;
  query.value = null;
}

function toggle(): void {
  if (open.value) {
    closeList();
    return;
  }
  openList();
  inputRef.value?.focus();
}

function choose(value: string): void {
  closeList();
  if (value !== props.modelValue) emit('update:modelValue', value);
}

function onFocus(): void {
  openList();
  // בחירת כל הטקסט: הקלדה מחליפה את השם הקיים במקום להיצמד אליו — התנהגות
  // תיבת הגופן של Word, ומה שהופך „הקלד שלוש אותיות ו-Enter” לזרימה אחת.
  inputRef.value?.select();
}

function onBlur(): void {
  // בלי החלה: יציאה מהשדה אינה בחירה. מי שהקליד ולא אישר חוזר לגופן שהיה,
  // וזה עדיף על להחיל בטעות גופן על טקסט מסומן.
  closeList();
}

function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  open.value = true;
  // ראש התוצאות ולא „אין סימון”: אחרי הקלדה ההתאמה הראשונה היא מה שמדורג
  // הכי גבוה, ו-Enter אמור להחיל אותה בלי חץ נוסף.
  activeIndex.value = built.value.count > 0 ? 0 : -1;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (!open.value) return;
    // עוצר את ההתפשטות: Esc בתוך הרשימה סוגר אותה, ואינו אמור להגיע למי
    // שסוגר דיאלוגים מעל.
    event.stopPropagation();
    event.preventDefault();
    closeList();
    return;
  }

  if (event.key === 'Enter') {
    if (!open.value) return;
    event.preventDefault();
    const value = commitValue(built.value, activeIndex.value, query.value ?? '');
    if (value !== null) choose(value);
    else closeList();
    return;
  }

  const moved = nextOptionIndex(event.key, activeIndex.value, built.value.count);
  if (moved === null) return;

  event.preventDefault();
  if (!open.value) openList();
  activeIndex.value = moved;
}

/**
 * גלילת האפשרות המסומנת לתוך התצוגה.
 *
 * `block: 'nearest'` ולא `'center'`: האחרון מזיז את הרשימה בכל חץ גם כשהיעד
 * כבר נראה, והתחושה היא של רשימה שקופצת מתחת לאצבע.
 */
watch(activeIndex, async (index) => {
  if (!open.value || index < 0) return;
  await nextTick();
  // `getElementById` ולא בורר CSS: המזהה נבנה כאן מאותיות, ספרות ומקפים
  // (`optionId`), ולכן אין מה לברוח ממנו — ו-`CSS.escape` אינו קיים ב-jsdom,
  // כלומר בורר עם בריחה היה מפיל את בדיקות הקומפוננטה בלי לשפר דבר.
  document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' });
});
</script>

<style scoped>
.ribbon-combo {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.ribbon-combo-input {
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 11px;
  height: 22px;
  padding-inline-start: 6px;
  padding-inline-end: 18px;
  width: 100%;
  outline: none;
  transition: border-color 0.1s;
}

.ribbon-combo-input:hover:not(:disabled) {
  border-color: var(--word-blue);
}

.ribbon-combo-input:focus {
  border-color: var(--word-blue);
  box-shadow: 0 0 0 1px var(--word-blue);
}

.ribbon-combo-input:disabled {
  opacity: 0.4;
  cursor: default;
}

.ribbon-combo-arrow {
  position: absolute;
  inset-inline-end: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 18px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.ribbon-combo-arrow:disabled {
  opacity: 0.4;
  cursor: default;
}

/*
  אותה שכבה של ColorPickerPopover: הרשימה חייבת לצוף מעל גוף הרצועה ומעל
  המסמך, ו-`<select>` נייטיב קיבל את זה מהמערכת בחינם.
*/
.ribbon-combo-list {
  /*
    `top`/`left`/`max-height` מגיעים מ-`popoverStyle` — ראו ההסבר ב-script.
    מה שנשאר כאן הוא מה שאינו תלוי במדידה.
  */
  z-index: 1000;
  margin: 0;
  padding: 4px 0;
  /* רחב מהתיבה בכוונה: „Franklin Gothic Medium” אינו נכנס ב-130 פיקסלים. */
  width: max-content;
  min-width: 150px;
  max-width: 260px;
  overflow-y: auto;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}

.ribbon-combo-group {
  padding: 4px 8px 2px;
  font-family: var(--font-main);
  font-size: 10px;
  font-weight: 600;
  color: var(--word-group-label-color);
  border-block-start: 1px solid var(--word-group-border);
}

.ribbon-combo-group:first-child {
  border-block-start: none;
}

.ribbon-combo-option {
  padding: 3px 8px;
  font-size: 12px;
  color: var(--color-on-surface);
  cursor: pointer;
  white-space: nowrap;
}

.ribbon-combo-option.chosen {
  font-weight: 600;
}

.ribbon-combo-option.active {
  background: var(--word-btn-active);
}

.ribbon-combo-empty {
  padding: 6px 8px;
  font-family: var(--font-main);
  font-size: 11px;
  color: var(--color-on-surface-variant);
}
</style>
