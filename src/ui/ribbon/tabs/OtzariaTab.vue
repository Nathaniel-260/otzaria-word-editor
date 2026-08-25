<template>
  <div class="ribbon-tab-pane otzaria-tab">
    <!-- שילוב עם אוצריא -->
    <RibbonGroup title="אוצריא">
      <RibbonButton
        icon="book"
        label="ציטוט מהקורא"
        shortcut-id="insert-citation"
        variant="large"
        :tooltip="citationTooltip"
        :disabled="!canInsertCitation"
        @click="$emit('insert-citation')"
      />
      <RibbonButton
        icon="search"
        label="חיפוש באוצריא"
        shortcut-id="search-otzaria"
        variant="large"
        :tooltip="searchTooltip"
        :disabled="!canSearch"
        @click="$emit('search-otzaria')"
      />
      <RibbonButton
        icon="otzaria"
        label="פתח ספרייה"
        shortcut-id="open-library"
        variant="large"
        :tooltip="sdkAvailable ? 'פתיחת ספריית הספרים של אוצריא' : OUTSIDE_OTZARIA"
        :disabled="!sdkAvailable"
        @click="$emit('open-library')"
      />
    </RibbonGroup>

    <!-- תבניות תורניות. ראו ההסבר ב-script: אין למנוע דרך ציבורית ליצור סגנון. -->
    <RibbonGroup title="סגנון תורני">
      <div class="column-items">
        <RibbonButton
          label="חידוש"
          variant="small"
          :tooltip="TORAH_STYLE_UNAVAILABLE"
          :disabled="true"
        />
        <RibbonButton
          label="קושיא"
          variant="small"
          :tooltip="TORAH_STYLE_UNAVAILABLE"
          :disabled="true"
        />
        <RibbonButton
          label="תירוץ"
          variant="small"
          :tooltip="TORAH_STYLE_UNAVAILABLE"
          :disabled="true"
        />
      </div>
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * „אוצריא” — הלשונית שמחברת את העורך לקורא.
 *
 * שלושת הכפתורים כאן פלטו event, ו-`App.vue` ענה עליו בהודעת סטטוס שמתארת
 * פעולה שלא קרתה („פותח את ספריית אוצריא...”). הפעולה עצמה עוברת עכשיו
 * ב-host/otzaria-reader.ts, וההודעה מגיעה רק כשיש מה לדווח.
 *
 * הזמינות נקבעת כאן ולא ב-`App.vue`, מאותו טעם כמו ב-ReferencesTab: כפתור
 * שאינו יכול לעבוד צריך להיראות כך לפני הלחיצה, לא אחריה.
 */
import { computed, inject, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { isAvailable } from '../../../host/otzaria-client';
import { canInsertText } from '../../../host/otzaria-reader';

defineEmits<{
  (e: 'insert-citation'): void;
  (e: 'search-otzaria'): void;
  (e: 'open-library'): void;
}>();

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));

const OUTSIDE_OTZARIA = 'זמין רק כשהעורך פועל בתוך אוצריא';

/**
 * „חידוש”, „קושיא” ו„תירוץ” היו שלושה כפתורים בלי `@click` — כלומר שלושה
 * כפתורים שנראים עובדים ואינם עושים כלום. הם מסומנים מעכשיו „לא זמין”, כפי
 * ש-§12 בתכנית דורשת, ולא מומשו — כי אין למנוע דרך ציבורית לממש אותם:
 *
 * - `doc.styles.apply` מקבל `target: { scope: 'docDefaults' }` **בלבד**, כלומר
 *   הוא משנה את ברירת המחדל של המסמך כולו. הוא אינו יוצר סגנון בשם.
 * - `doc.styles.paragraph.setStyle` מחיל סגנון **קיים** לפי `styleId`, או אחד
 *   מארבעה תפקידים סמנטיים (`defaultParagraph`, `heading`, `title`,
 *   `subtitle`). אין בהם „חידוש”.
 * - בקטלוג הפעולות של המנוע (2.8.0) אין שום פעולה שיוצרת סגנון: `styles.*`
 *   הוא `apply`, `getCatalog` ושלושת ה-`paragraph.*`.
 *
 * ולכן אין למה לחווט: `linked-style` עם מזהה שאינו קיים במסמך פשוט נכשל,
 * ומיפוי „קושיא” אל סגנון בנוי כמו Heading 2 היה כפתור שעושה משהו אחר ממה
 * שכתוב עליו. המשך אמיתי הוא הוספת הסגנונות לקטלוג ה-docx — פעולה אחרת
 * לגמרי, שאין לה מסלול ציבורי ואין לעשות אותה ב-XML ידני (§12).
 */
const TORAH_STYLE_UNAVAILABLE =
  'סגנונות תורניים יתווספו בשלב הבא — אין למנוע דרך ציבורית ליצור סגנון פסקה חדש במסמך';

/**
 * האם ה-SDK של אוצריא קיים. נקרא פעם אחת ב-setup ולא כערך reactive: הרצועה
 * היא „mount on active” (ראו Ribbon.vue) — הלשונית נבנית רק כשהמשתמש לוחץ
 * עליה, כלומר הרבה אחרי ה-boot, ובאותו רגע התשובה סופית. מחוץ לאוצריא
 * הכפתורים מנוטרלים במקום להיכשל בלחיצה.
 */
const sdkAvailable = isAvailable();

/**
 * השאילתה של „חיפוש באוצריא” היא הטקסט המסומן במסמך, ולכן בלי מסמך פתוח אין
 * מה לחפש. הבחירה עצמה נקראת ברגע הלחיצה (ראו `onSearchOtzaria`) — מנוי על
 * כל שינוי בחירה בשביל צביעת כפתור אינו שווה את המחיר.
 */
const canSearch = computed(() => sdkAvailable && superdoc.value !== null);

/**
 * הציטוט נכנס למסמך דרך `doc.insert`, ולכן השאלה היא האם ה-Document API של
 * המסמך הפתוח חושף אותו ומדווח אותו כזמין — ולא האם יש מסמך. התשובה נשאלת
 * במודול (`canInsertText`), ששואל את מרחב השאלות המשותף.
 *
 * `shallowRef` ולא `computed`, כי הקריאה למנוע א-סינכרונית. ראו ReferencesTab:
 * `generation` הוא מה שמונע מתשובה של מסמך קודם לדרוס את התשובה של המסמך
 * הנוכחי, ו-`false` בזמן ההמתנה הוא הכשל הסגור — כפתור שנראה זמין לפני
 * שהתשובה חזרה הוא בדיוק הכפתור המת.
 */
const canInsertCitation = shallowRef(false);

let generation = 0;

watch(
  superdoc,
  async (host) => {
    const mine = ++generation;
    canInsertCitation.value = false;
    const allowed = sdkAvailable && (await canInsertText(host));
    if (mine === generation) canInsertCitation.value = allowed;
  },
  { immediate: true }
);

const citationTooltip = computed(() => {
  if (!sdkAvailable) return OUTSIDE_OTZARIA;
  if (!canInsertCitation.value) return 'יש לפתוח מסמך שאפשר לכתוב בו';
  return 'הכנסת הקטע המסומן בקורא של אוצריא, עם המקור, במיקום הסמן';
});

const searchTooltip = computed(() => {
  if (!sdkAvailable) return OUTSIDE_OTZARIA;
  if (superdoc.value === null) return 'יש לפתוח מסמך ולסמן בו את הטקסט לחיפוש';
  return 'חיפוש הטקסט המסומן במסמך בכל ספריות אוצריא';
});
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
}

.column-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}
</style>
