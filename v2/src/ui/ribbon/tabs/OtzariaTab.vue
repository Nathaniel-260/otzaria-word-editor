<template>
  <div class="ribbon-tab-pane otzaria-tab">
    <!-- שילוב עם אוצריא -->
    <RibbonGroup
      title="אוצריא"
      :launcher="false"
    >
      <RibbonButton
        icon="book"
        label="ציטוט מהקורא"
        variant="large"
        :tooltip="citationTooltip"
        :disabled="!canInsertCitation"
        @click="$emit('insert-citation')"
      />
      <RibbonButton
        icon="search"
        label="חיפוש באוצריא"
        variant="large"
        :tooltip="searchTooltip"
        :disabled="!canSearch"
        @click="$emit('search-otzaria')"
      />
      <RibbonButton
        icon="otzaria"
        label="פתח ספרייה"
        variant="large"
        :tooltip="sdkAvailable ? 'פתיחת ספריית הספרים של אוצריא' : OUTSIDE_OTZARIA"
        :disabled="!sdkAvailable"
        @click="$emit('open-library')"
      />
    </RibbonGroup>

    <!-- תבניות תורניות -->
    <RibbonGroup
      title="סגנון תורני"
      :launcher="false"
    >
      <div class="column-items">
        <RibbonButton
          label="חידוש"
          variant="small"
          tooltip="החלת סגנון פסקת חידוש"
        />
        <RibbonButton
          label="קושיא"
          variant="small"
          tooltip="החלת סגנון פסקת קושיא"
        />
        <RibbonButton
          label="תירוץ"
          variant="small"
          tooltip="החלת סגנון פסקת תירוץ"
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
import { computed, inject, shallowRef } from 'vue';
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
 * המסמך הפתוח חושף אותו — ולא האם יש מסמך. בדיקה ישירה ולא דרך
 * `doc.capabilities`: `insert` אינו פעולה במרחב השאלות של engine/doc-capabilities.ts,
 * והוא נמצא על הפאסדה עצמה.
 */
const canInsertCitation = computed(() => sdkAvailable && canInsertText(superdoc.value));

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
