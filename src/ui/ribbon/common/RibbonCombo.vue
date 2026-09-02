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
      :data-tip-title="menuString(title)"
      :aria-label="menuString(title)"
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
      `click` נוסף עליו בשביל הפעלה שאינה מעכבר — ראו `onArrowClick`.
    -->
    <button
      type="button"
      class="ribbon-combo-arrow"
      tabindex="-1"
      :disabled="disabled"
      :aria-label="menuString('פתח את הרשימה')"
      @mousedown.prevent="toggle"
      @click="onArrowClick"
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
      :style="[popoverStyle, { minWidth: listMinWidth }]"
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
          :class="{
            active: row.index === activeIndex,
            chosen: row.option.value === modelValue,
            hebrew: row.option.hebrew === true,
          }"
          role="option"
          :aria-selected="row.option.value === modelValue"
          :data-value="row.option.value"
          :data-group="row.option.group ?? ''"
          :aria-label="row.option.hebrew ? menuString(row.option.label) : undefined"
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
        {{ menuString(emptyText) }}
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
 *
 * ## שני מצבים: „בחר מהרשימה” ו„הקלד ערך”
 *
 * בבורר הגופן הרשימה היא **המלאי**: שם שאינו בה הוא כמעט תמיד שגיאת הקלדה,
 * ולכן Enter מחיל את ההתאמה המדורגת ראשונה. בבורר הגודל הרשימה היא **הצעה**:
 * 13pt הוא גודל לגיטימי לגמרי שפשוט אינו בסולם של Word, ומי שהקליד אותו
 * מתכוון אליו ולא ל-10 (ההתאמה הראשונה ל„1”).
 *
 * `normalize` הוא מה שמפריד ביניהם — פקד שמקבל אותו מחיל את מה שהוקלד, אחרי
 * שהקורא נרמל אותו (טווח, עיגול). בלעדיו ההתנהגות היא בורר השמות שהייתה כאן
 * מלכתחילה.
 *
 * ## הדגימה העברית, ולמה היא פסאודו-אלמנט
 *
 * שם לטיני של גופן עברי אינו מראה דבר: „Narkisim” ב-Narkisim ו„Gisha” ב-Gisha
 * נראים שניהם כמו אנגלית, ומי שמחפש כתב לספר עברי בוחר לפי שם. לכן שורה של
 * גופן שמכסה עברית (`option.hebrew`, נקבע ב-engine/font-options.ts) מקבלת לפני
 * השם כמה אותיות עבריות **בגופן של השורה עצמה**.
 *
 * הדגימה היא `::before` בגיליון ולא `<span>` בתבנית, וזה עניין של מחיר: הרשימה
 * מגיעה למאות שורות, ו-`<span>` היה מוסיף לכל אחת מהן צומת DOM, קישור מחרוזת
 * ו-patch של Vue. כאן אין אף אחד מהשלושה — התבנית מוסיפה מחלקה אחת, וכל השאר
 * הוא כלל CSS יחיד עם טקסט קבוע.
 *
 * ומה שאין בה גם כן במחיר: הגופן של השורה **כבר** נפתר בשביל השם, ולכן ארבע
 * אותיות נוספות ממנו אינן טעינה חדשה אלא רסטור של ארבעה גליפים. זו גם הסיבה
 * שהדגימה מותנית בכיסוי: בגופן שאין בו עברית היא הייתה נופלת ל-fallback —
 * כלומר מציגה את האותיות של גופן אחר תחת השם הזה, וזה גרוע מכלום.
 *
 * `aria-label` על השורה העברית: Chrome מכליל תוכן של `::before` בשם הנגיש,
 * וקורא מסך היה מכריז „אבגד Narkisim”. הדגימה היא מראה בלבד, והשם הוא השם.
 */
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
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
    /**
     * הופך את הפקד לתיבת **ערך**: מה שהוקלד מוחל אחרי שהפונקציה נרמלה אותו,
     * ו-`null` ממנה = אין מה להחיל, התיבה חוזרת לערך שהיה. ראו `commitValue`.
     */
    normalize?: (typed: string) => string | null;
    /** מה שמוצג כשלשאילתה אין אף התאמה. */
    emptyText?: string;
    /**
     * רוחב מזערי לרשימה. ברירת המחדל היא רוחב שם גופן („Franklin Gothic
     * Medium” אינו נכנס ברוחב התיבה); רשימת מספרים אינה זקוקה לו.
     */
    listMinWidth?: string;
  }>(),
  {
    modelValue: '',
    width: 'auto',
    disabled: false,
    title: '',
    normalize: undefined,
    emptyText: 'אין גופן בשם הזה',
    listMinWidth: '150px',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  /**
   * הסימון ברשימה עבר לאפשרות הזאת. `null` = אין סימון, או שהרשימה נסגרה.
   *
   * הפקד אינו יודע מה עושים עם זה — בבורר הגופן זו התצוגה החיה על המסמך
   * (composables/font-preview.ts), ובבורר הגודל אין מאזין בכלל. פקד שהיה מחיל
   * בעצמו היה גם צריך לדעת מה להחזיר, וזה כבר לא חיווט.
   */
  (e: 'preview', val: string | null): void;
  /** הרשימה נסגרה. `true` = נבחרה אפשרות, ולכן אין מה להחזיר. */
  (e: 'previewEnd', committed: boolean): void;
  /**
   * המשתמש סיים עם הפקד — אישר ערך, או ויתר ב-Escape.
   *
   * למה זה קיים: הפקד הזה הוא `input`, ולכן בניגוד לכפתורי הרצועה (שמונעים
   * את ברירת המחדל ב-`pointerdown` ולעולם אינם לוקחים מיקוד) הוא **חייב**
   * לקחת אותו. מי שמרכיב אותו צריך להחזיר אותו למסמך; בלי זה ההקלדה הבאה
   * נכנסת לתיבה שברצועה ולא לטקסט — „הסמן לא כותב” שדווח ב-Y-PLONI#14 סעיף א.
   *
   * נפלט **לפני** `update:modelValue`, כדי שההחלה תרוץ על מסמך שכבר ממוקד —
   * אותו סדר של `use-context-menu.ts` (`run()`). מה שנמדד, ובניגוד למה
   * שהיה כתוב כאן: הסדר עצמו **אינו** מה שמציל את העיצוב. תיבת הגודל שבתפריט
   * ההקשר מחילה לפני שהמיקוד חוזר, והעיצוב שורד גם שם
   * (`scripts/qa/context-font-focus-probe.mjs`). הקריטי הוא שהמיקוד יחזור
   * **בכלל**: בלעדיו החזרה למסמך היא לחיצת העכבר של המשתמש, ולחיצה קובעת
   * בחירה חדשה — וזו מה שמוחקת עיצוב שהוחל על סמן מכווץ.
   */
  (e: 'done'): void;
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

/**
 * האפשרויות כפי שהיו ברגע הפתיחה — והרשימה אינה מסתכלת על אחרות עד שתיסגר.
 *
 * זו רגרסיה שנצפתה, ולא זהירות: המנוע מרכיב את קבוצת „אחרונים” מהגופנים
 * שהמסמך משתמש בהם, והתצוגה החיה משנה בדיוק את זה. כלומר כל שורה שרוחפים
 * מעליה קופצת אחרי רגע לראש הרשימה — והשורה שמתחת לעכבר מתחלפת באמצע התנועה.
 * מי שרצה את השורה השלישית לחץ על משהו אחר לגמרי.
 *
 * ההקפאה נכונה גם בלי התצוגה החיה: רשימה נפתחת שמשנה סדר תחת היד היא רשימה
 * שאי אפשר לכוון אליה. מנייה שנוחתת בזמן שהיא פתוחה תיראה בפתיחה הבאה.
 */
const frozen = shallowRef<readonly ComboOption[] | null>(null);
const built = computed(() => buildComboRows(frozen.value ?? props.options, query.value ?? ''));

/**
 * מה שהסימון עומד עליו, כל עוד הרשימה פתוחה.
 *
 * `computed` ולא פליטה מכל אתר שמזיז את הסימון, ואלה חמישה: פתיחה, חץ, עכבר,
 * הקלדה וסגירה. חמש פליטות היו חמש הזדמנויות לשכוח אחת.
 */
const highlighted = computed<string | null>(() => {
  if (!open.value) return null;
  for (const row of built.value.rows) {
    if (row.type === 'option' && row.index === activeIndex.value) return row.option.value;
  }
  return null;
});

watch(highlighted, (value) => emit('preview', value));

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
  frozen.value = props.options;
  open.value = true;
  // נפתח על הגופן הנוכחי ולא על ראש הרשימה: זה מה שמאפשר לפתוח, ללחוץ חץ
  // פעם אחת ולקבל את השכן — במקום לקפוץ ל-Assistant מכל מקום.
  activeIndex.value = indexOfCurrent();
}

/**
 * `committed` הוא ההבדל בין „בחרתי” לבין „יצאתי”: הראשון משאיר את מה שהוחל,
 * והשני מחזיר את מה שהיה. ברירת המחדל היא היציאה — Esc, `blur`, ולחיצה על
 * החץ — מפני שהיא הרוב, ומפני שהיא גם הצד שבו טעות עולה במסמך.
 */
function closeList(committed = false): void {
  open.value = false;
  activeIndex.value = -1;
  query.value = null;
  frozen.value = null;
  emit('previewEnd', committed);
}

function toggle(): void {
  if (open.value) {
    closeList();
    return;
  }
  openList();
  inputRef.value?.focus();
}

/**
 * הפעלת החץ שאינה מעכבר: מקלדת, או `click()` תכנותי.
 *
 * `detail === 0` הוא מה שמפריד ביניהן ללחיצת עכבר אמיתית, וההבחנה נדרשת מפני
 * ש-`mousedown` כבר טיפל בזו: בלעדיה לחיצת עכבר הייתה פותחת ב-`mousedown`
 * וסוגרת מיד ב-`click` שאחריו.
 */
function onArrowClick(event: MouseEvent): void {
  if (event.detail !== 0) return;
  toggle();
}

function choose(value: string): void {
  closeList(true);
  emit('done');
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
  //
  // בתיבת ערך (`normalize`) זה הפוך בדיוק: סימון אוטומטי היה גורם ל-Enter
  // להחיל את „10” על מי שהקליד „13”. שם הרשימה נשארת הצעה בלבד עד שבוחרים
  // בה בחץ או בעכבר.
  activeIndex.value = props.normalize ? -1 : built.value.count > 0 ? 0 : -1;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (!open.value) return;
    // עוצר את ההתפשטות: Esc בתוך הרשימה סוגר אותה, ואינו אמור להגיע למי
    // שסוגר דיאלוגים מעל.
    event.stopPropagation();
    event.preventDefault();
    closeList();
    // גם ויתור הוא סיום: מי שלחץ Escape רוצה לחזור לכתוב, לא להישאר בתיבה.
    emit('done');
    return;
  }

  if (event.key === 'Enter') {
    if (!open.value) return;
    event.preventDefault();
    const value = commitValue(built.value, activeIndex.value, query.value ?? '', props.normalize);
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
  // `?.scrollIntoView?.` — jsdom אינו מממש אותה כלל, וגלילה שאינה זמינה אינה
  // סיבה להפיל את הפקד.
  document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' });
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
  /* `min-width` מגיע מ-`listMinWidth` — רשימת גדלים צרה מרשימת שמות. */
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

/*
  גובה קבוע, ו-flex — שניהם בשביל הדגימה.

  הדגימה גדולה מהשם, ובזרימת שורה רגילה הגובה נגזר מהגליפים: הבסיס של קופסה
  פנימית גבוהה נדחף כלפי מטה, וכל שורה יוצאת בגובה מעט אחר לפי הגופן שלה
  (נמדד: 28, 29 ו-30 פיקסלים באותה רשימה). רשימה שנעה בפיקסל בין שורה לשורה
  נראית רועדת בגלילה.

  `align-items: baseline` הוא מה ששומר על ההיגיון החזותי: הדגימה והשם יושבים
  על אותו קו בסיס, בדיוק כמו בזרימת טקסט — רק בלי שהגובה תלוי בהם.

  `box-sizing: border-box` גלובלי (styles/shell.css), ולכן הגובה בולע את הריפוד.
*/
.ribbon-combo-option {
  display: flex;
  align-items: baseline;
  height: 28px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 22px;
  color: var(--color-on-surface);
  cursor: pointer;
  white-space: nowrap;
}

/*
  הגופן שמוחל כרגע — בצבע, ולא במשקל.

  `font-weight: 600` היה כאן, וזה מה שדווח: התצוגה החיה משנה את הגופן שהמנוע
  מדווח, כלומר הסימון הזה נודד לשורה שרוחפים מעליה — ומשקל שמתחלף משנה רוחב,
  כלומר השורות קופצות תחת העכבר. צבע נושא בדיוק את אותה ידיעה בלי לגעת
  בפריסה.
*/
.ribbon-combo-option.chosen {
  color: var(--word-blue);
}

/*
  הדגימה העברית — ההסבר למה היא כאן ולא בתבנית בראש הקומפוננטה.

  התוכן במרכאות כפולות ובכוונה: מחרוזת עברית בגרשיים בתוך `src/ui/ribbon`
  נסרקת בידי tests/unit/menu-locale-coverage.test.ts כמחרוזת תפריט שחייבת
  תרגום, וזו אינה כזו — דגימת גליפים עבריים נשארת עברית גם בממשק האנגלי, שכן
  מי שבוחר גופן לספר עברי צריך לראות את האותיות ולא את שפת הכפתורים.

  ## הגודל

  18px, ולא גודל השם (12px). דגימה בגודל השם נמדדה כבלתי קריאה — ובגופן עברי
  ההבדל בין David לבין Frank Ruhl הוא בעובי המשיכה ובזווית הראש, וזה בדיוק מה
  שנעלם בגליף של 12 פיקסלים. הדגימה **היא** התוכן כאן; השם הוא התווית.

  הגובה אינו קופץ מזה: `line-height` של השורה קבוע (למעלה), ולכן שורה עם דגימה
  ושורה בלעדיה שוות גובה בדיוק.

  `min-width`: השמות מתחילים באותו קו לאורך הקבוצה, במקום לרקוד לפי רוחב
  הדגימה בכל גופן. `em` ולא פיקסלים — היחידה נגזרת מ-18px של הדגימה עצמה,
  ולכן שינוי הגודל אינו מחייב לחשב מחדש את העמודה.

  `flex-shrink: 0`: השורה היא flex, ורשימה צרה הייתה מכווצת דווקא את הדגימה —
  כלומר מוחקת את מה שהיא קיימת בשבילו.
*/
.ribbon-combo-option.hebrew::before {
  content: "אבגד";
  min-width: 3em;
  margin-inline-end: 8px;
  flex-shrink: 0;
  font-size: 18px;
  line-height: inherit;
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
