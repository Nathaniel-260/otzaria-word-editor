<template>
  <header class="topbar word-titlebar">
    <!-- צד ימין (RTL): מותג, שמירה אוטומטית, שמירה מהירה ושם מסמך -->
    <div class="titlebar-start">
      <div
        class="word-app-badge"
        title="וורד לאוצריא"
      >
        <SvgIcon
          name="word"
          :size="20"
        />
      </div>

      <!--
        מתג שמירה אוטומטית. `button` עם `role="switch"` ולא `div` עם `@click`:
        `div` אינו מקבל פוקוס, אינו מופעל ב-Enter/רווח, וקורא מסך מכריז עליו
        „שמירה אוטומטית” בלי לומר אם היא פועלת. ה-`button` נותן את שני הראשונים
        בחינם, ו-`aria-checked` את השלישי.
      -->
      <button
        type="button"
        class="autosave-toggle"
        :class="{ active: autosaveEnabled }"
        role="switch"
        :aria-checked="autosaveEnabled"
        :title="autosaveEnabled ? 'שמירה אוטומטית לדיסק — פועלת' : 'שמירה אוטומטית לדיסק — כבויה'"
        @click="$emit('toggle-autosave')"
      >
        <span class="autosave-label">שמירה אוטומטית</span>
        <span class="toggle-pill">
          <span class="toggle-thumb" />
        </span>
      </button>

      <!-- סרגל גישה מהירה (Quick Access Toolbar) -->
      <div class="quick-access-tools">
        <button
          type="button"
          class="qa-btn"
          :disabled="isSaving"
          :title="saveTitle"
          @pointerdown.prevent
          @click="$emit('save')"
        >
          <SvgIcon
            name="save"
            :size="15"
          />
          <span
            v-if="isDirty"
            class="dirty-badge"
          />
        </button>
        <button
          type="button"
          class="qa-btn"
          :title="`בטל ${label('undo')}`"
          :disabled="!canUndo"
          @pointerdown.prevent
          @click="$emit('undo')"
        >
          <SvgIcon
            name="undo"
            :size="15"
          />
        </button>
        <button
          type="button"
          class="qa-btn"
          :title="`חזור ${label('redo')}`"
          :disabled="!canRedo"
          @pointerdown.prevent
          @click="$emit('redo')"
        >
          <SvgIcon
            name="redo"
            :size="15"
          />
        </button>
      </div>

      <!-- שם המסמך והסטטוס -->
      <div class="doc-title-wrapper">
        <input
          :value="title"
          class="doc-title-input"
          :style="{ width: `${docTitleWidthCh(title)}ch` }"
          spellcheck="false"
          aria-label="שם המסמך"
          title="לחץ לעריכת שם המסמך"
          @change="$emit('update-title', ($event.target as HTMLInputElement).value)"
        >
        <span class="app-suffix">- Word</span>
        <span
          v-if="isDirty"
          class="dirty-indicator"
          title="שינויים לא שמורים"
        >•</span>
      </div>
    </div>

    <!--
      מרכז: חיפוש („Tell Me” ב-Word). `button` ולא `input readonly`: השדה שהיה
      כאן נראה כמו מקום להקליד בו ולא הגיב להקלדה, וה-`@click` יושב על ה-div
      העוטף — כלומר המקלדת לא הגיעה אליו בכלל.
    -->
    <div class="titlebar-center">
      <button
        type="button"
        class="search-box"
        aria-label="חיפוש והחלפה במסמך"
        :title="`חיפוש והחלפה ${label('find')}`"
        @click="$emit('open-find')"
      >
        <SvgIcon
          name="search"
          :size="14"
          class="search-icon"
        />
        <span class="search-placeholder">חפש</span>
      </button>
    </div>

    <!-- צד שמאל (סיום): מצב השמירה -->
    <div class="titlebar-end">
      <div
        v-if="saveStateText"
        class="save-state-pill"
        :class="{ error: isSaveError }"
      >
        {{ saveStateText }}
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '../icons/SvgIcon.vue';
import { docTitleWidthCh } from '../../composables/shell-format';
import { shortcutLabel, type ShortcutId } from '../shortcuts/registry';

const props = withDefaults(
  defineProps<{
    title?: string;
    isDirty?: boolean;
    isSaving?: boolean;
    isSaveError?: boolean;
    saveStateText?: string;
    autosaveEnabled?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
  }>(),
  {
    title: 'מסמך 1',
    isDirty: false,
    isSaving: false,
    isSaveError: false,
    saveStateText: '',
    autosaveEnabled: true,
    canUndo: true,
    canRedo: true,
  }
);

/**
 * הצירוף בא מהרג'יסטרי, לא ממחרוזת כתובה כאן. סרגל הגישה המהירה הכריז שנתיים
 * „בטל Ctrl+Z” בלי שאיש קשר את הצירוף — וזה בדיוק סוג ההבטחה שהרג'יסטרי בא
 * למנוע. מזהה שגוי נופל ב-typecheck.
 */
function label(id: ShortcutId): string {
  return shortcutLabel(id);
}

const saveTitle = computed(() =>
  props.isDirty
    ? `שמור (ישנם שינויים שלא נשמרו) ${label('save')}`
    : `שמור ${label('save')}`,
);

defineEmits<{
  (e: 'save'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'open-find'): void;
  (e: 'toggle-autosave'): void;
  (e: 'update-title', newTitle: string): void;
}>();
</script>

<style scoped>
/**
 * הכלל היחיד שקובע את הפריסה כאן: **תיבת החיפוש במרכז החלון**, כמו ב-Word.
 * `justify-content: space-between` שהיה כאן מרכז את התיבה בין הצדדים ולא
 * בחלון — והצד הימני (מותג, מתג, סרגל מהיר, שם מסמך) רחב פי כמה מגלולת המצב
 * שמשמאל, ולכן מרכז התיבה נמדד ב-35% מרוחב החלון. שלוש עמודות שבהן שני
 * הצדדים `minmax(0, 1fr)` נשארות שוות תמיד, ולכן העמודה האמצעית מרוכזת בלי
 * תלות בתוכן הצדדים ובלי לזוז כששם המסמך מתארך.
 *
 * שאר המאפיינים של הפס — גובה, רקע, ריפוד, גבול, gap ויישור אנכי — מוגדרים
 * ב-`.topbar` שב-styles/shell.css על **אותו אלמנט**, ואינם חוזרים כאן: שתי
 * הגדרות לאותו מאפיין באותו אלמנט הן שני מקורות אמת שנפרדים בשקט (הם כבר
 * נפרדו: 12px מול 16px ריפוד, ושני צבעי גבול שונים). `display` הוא החריג
 * היחיד, ובכוונה — הוא דורס את ה-flex שם לטובת המרכוז.
 */
.word-titlebar {
  display: grid;
  /* עמודת אמצע הייתה `auto` (קשיחה ל-320px) וגלשה מחוץ למסך בחלון צר; `minmax(0, 320px)` מאפשר לה לכווץ כמו הצדדים. */
  /* `minmax(160px, 1fr)` בצדדים: תיבת החיפוש הכי פחות חיונית ולכן מוותרת ראשונה על מקום; 160px משאיר לבאדג', לכפתורי הגישה המהירה ולתו אחד משם המסמך. */
  grid-template-columns: minmax(160px, 1fr) minmax(0, 320px) minmax(160px, 1fr);
  user-select: none;
}

.titlebar-start {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  /* בלי זה הפריט לא נמתח לעמודת ה-grid שלו וגולש מחוץ לחלון בחלון צר. */
  width: 100%;
  justify-self: start;
  /* שם ארוך נחתך כאן ולא נדחק לתיבת החיפוש שבמרכז. */
  overflow: hidden;
}

/* באדג' המותג, מתג שמירה אוטומטית וסרגל הגישה המהירה לא מתכווצים לעולם — שם המסמך הוא זה שסופג את הלחץ. */
.word-app-badge,
.autosave-toggle,
.quick-access-tools {
  flex-shrink: 0;
}

/* שם המסמך סופג את הלחץ בחלון מצטמצם; `min-width: 0` דורס את `auto` שהיה מונע כיווץ מתחת לרוחב התוכן. */
.doc-title-wrapper {
  flex: 1 1 auto;
}

.word-app-badge {
  color: var(--word-blue);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* מתג שמירה אוטומטית. ה-reset נדרש: shell.css נותן ל-button ריפוד, גבול ורקע. */
.autosave-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 3px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-on-surface);
  font-size: inherit;
  transition: background 0.1s;
}

.autosave-toggle:hover {
  background: var(--word-btn-hover);
}

.autosave-label {
  font-size: 11px;
  color: var(--color-on-surface);
  white-space: nowrap;
}

/**
 * שני מצבי המתג צבועים בזוגות on/base מתועדים של M3 — כבוי
 * `on-surface-variant`/`surface`, דלוק `primary`/`on-primary` — ולא בצבע קבוע.
 * זו הסיבה שהוא נראה בשני המצבים: M3 מבטיח את הניגוד **בתוך** הזוג, ולכן
 * הכפתור נשאר מובחן מהמסילה בכל ערכה. מה שהיה כאן, `#ffffff` על
 * `--color-outline`, היה כפתור לבן על אפור בהיר במצב בהיר — כלומר מתג שלא
 * רואים אם הוא דלוק. גם המסילה בדרגת ה-`on` היא הבחירה של Word: שם המצב
 * הכבוי הוא פיל אפור-כהה עם כפתור לבן.
 */
.toggle-pill {
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-on-surface-variant);
  position: relative;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

/**
 * הכפתור נע על `inset-inline-start` ולא ב-`translateX`: `translateX(-12px)`
 * שהיה כאן הוא תנועה שמאלה בשתי הכיווניות, ולכן ב-LTR הוא יצא מהפיל. הכלל
 * ההגיוני חוסך גם את הכלל הכפול ל-[dir="rtl"] שהיה כאן זהה לו בדיוק.
 * 14px = 28 (הפיל) − 12 (הכפתור) − 2 (הריפוד בצד השני).
 */
.toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-surface);
  position: absolute;
  top: 2px;
  inset-inline-start: 2px;
  transition: inset-inline-start 0.15s ease;
}

.autosave-toggle.active .toggle-pill {
  background: var(--word-blue);
}

.autosave-toggle.active .toggle-thumb {
  inset-inline-start: 14px;
  background: var(--color-on-primary);
}

/* גישה מהירה */
.quick-access-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-inline-start: 4px;
  border-inline-start: 1px solid var(--color-outline-variant);
}

.qa-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  color: var(--color-on-surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.08s;
}

.qa-btn:hover:not(:disabled) {
  background: var(--word-btn-hover);
}

.qa-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/**
 * שני סמני „שינויים לא שמורים” (הנקודה על כפתור השמירה, והבולט ליד שם המסמך)
 * ב-`--color-secondary` ולא בכתום קבוע.
 *
 * ההכרעה: M3 אינו מגדיר תפקיד לכתום, ולכן `#e67e22` שהיה כאן היה צבע שאינו
 * זז עם הערכה ואינו מובטח להיראות על שום רקע. `--color-error` נשקל ונדחה —
 * „טרם נשמר” אינו כשל, וגלולת המצב שממש לידו כן משתמשת ב-error כשהשמירה
 * נכשלת; אותו צבע לשני הדברים היה מוחק את ההבדל. `--color-secondary` הוא
 * התפקיד שמדריך העיצוב נוקב בו במפורש עבור „אינדיקטורים”, והוא צבע מילוי
 * שהערכה מבטיחה את הניגוד שלו מול המשטח.
 */
.dirty-badge {
  position: absolute;
  top: 3px;
  inset-inline-end: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-secondary);
}

/* שם המסמך */
.doc-title-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.1s;
  min-width: 0;
}

.doc-title-wrapper:hover {
  background: var(--word-btn-hover);
}

/* הרוחב נקבע בתבנית לפי אורך השם — ראו composables/shell-format.ts. */
.doc-title-input {
  background: transparent;
  border: none;
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  text-align: start;
  min-width: 0;
}

.app-suffix {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

.dirty-indicator {
  font-size: 16px;
  color: var(--color-secondary);
  line-height: 1;
}

/* מרכז: חיפוש */
.titlebar-center {
  justify-self: center;
  display: flex;
  justify-content: center;
  /* אותה הנמקה כמו titlebar-start/end: בלי זה תיבת החיפוש נשארת ברוחב המועדף שלה במקום לרדת עם העמודה. */
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: 4px 12px;
  width: 320px;
  max-width: 100%;
  cursor: text;
  color: var(--color-on-surface-variant);
  font-family: var(--font-main);
  font-size: 12px;
  transition: border-color 0.1s, box-shadow 0.1s;
}

.search-box:hover {
  border-color: var(--word-blue);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.search-icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.search-placeholder {
  color: var(--color-on-surface-variant);
}

.titlebar-end {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
  /* אותה הנמקה כמו titlebar-start: בלי זה הפריט יכול לגלוש מחוץ לחלון בחלון צר. */
  min-width: 0;
  width: 100%;
  justify-content: flex-end;
  overflow: hidden;
}

.save-state-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  white-space: nowrap;
}

/* הרקע נגזר מ-`error` של הערכה, כמו הטקסט שמעליו. `rgba(176, 0, 32, .1)`
   שהיה כאן הוא ה-error של *ברירת המחדל* — כלומר במצב כהה הטקסט זז לאדום
   הבהיר של הערכה והרקע נשאר בורדו הקפוא של המצב הבהיר. ראו --color-error-subtle
   ב-tokens.css. */
.save-state-pill.error {
  background: var(--color-error-subtle);
  color: var(--color-error);
}

/* שני סף רספונסיביות: הסרת תוכן "נחמד שיהיה" (סיומת "- Word", תווית "שמירה אוטומטית") לפני שהוא נדחק וחותך את מה שחשוב. */
@media (max-width: 760px) {
  .app-suffix {
    display: none;
  }

  .autosave-label {
    display: none;
  }
}

@media (max-width: 560px) {
  /* מוריד את הרוחב המועדף של תיבת החיפוש, כדי שהיא תוותר על מקום לפני שהיא נדחקת בכוח. */
  .search-placeholder {
    display: none;
  }

  .search-box {
    padding-inline: 8px;
    min-width: 0;
  }
}
</style>
