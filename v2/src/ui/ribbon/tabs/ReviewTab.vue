<template>
  <div class="ribbon-tab-pane review-tab">
    <!-- הגהה -->
    <RibbonGroup title="הגהה">
      <RibbonButton
        icon="proofing"
        label="בדיקת איות"
        variant="large"
        tooltip="בדיקת איות בעברית — תתווסף עם המילון התורני, בשלב נפרד"
        :disabled="true"
      />
    </RibbonGroup>

    <!-- תגובות -->
    <RibbonGroup title="תגובות">
      <RibbonButton
        icon="comment"
        label="תגובה חדשה"
        variant="large"
        tooltip="הוספת תגובה — תתווסף בשלב הבא, יחד עם זהות המחבר ופאנל התגובות"
        :disabled="true"
      />
    </RibbonGroup>

    <!-- מעקב -->
    <RibbonGroup title="מעקב אחר שינויים">
      <RibbonButton
        icon="trackChanges"
        label="עקוב אחר שינויים"
        variant="large"
        :tooltip="isSuggesting ? 'כיבוי מצב מעקב אחר שינויים' : 'הפעלת מצב מעקב אחר שינויים במסמך'"
        :active="isSuggesting"
        :disabled="!modeCmd.enabled.value"
        @click="onToggleTrackChanges"
      />
    </RibbonGroup>

    <!-- שינויים -->
    <RibbonGroup title="שינויים">
      <div class="column-items">
        <RibbonButton
          icon="accept"
          label="קבל שינוי"
          variant="small"
          tooltip="קבלת השינוי הנוכחי"
          :disabled="!acceptCmd.enabled.value"
          @click="acceptCmd.run()"
        />
        <RibbonButton
          icon="reject"
          label="דחה שינוי"
          variant="small"
          tooltip="דחיית השינוי הנוכחי"
          :disabled="!rejectCmd.enabled.value"
          @click="rejectCmd.run()"
        />
        <RibbonButton
          icon="accept"
          label="קבל את כל השינויים"
          variant="small"
          tooltip="קבלת כל השינויים במסמך"
          :disabled="!acceptAllCmd.enabled.value"
          @click="acceptAllCmd.run()"
        />
        <RibbonButton
          icon="reject"
          label="דחה את כל השינויים"
          variant="small"
          tooltip="דחיית כל השינויים במסמך"
          :disabled="!rejectAllCmd.enabled.value"
          @click="rejectAllCmd.run()"
        />
      </div>
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * „סקירה”.
 *
 * **„עקוב אחר שינויים” הוא מצב המסמך.** ב-v2 אין פקודת „track changes on/off”
 * נפרדת: `document-mode` עם `'suggesting'` *הוא* מצב המעקב, וזו הפקודה
 * שה-registry שלנו כבר מכיל. שני דברים שנמדדו בקטלוג של המנוע וקובעים את
 * המימוש כאן:
 *   - הפקודה מנותבת דרך `instanceRoute: setDocumentMode`, והמצב שלה מדווח
 *     `active: false` **תמיד** — `chromeActiveState` מחזיר `false` לכל מה שאינו
 *     סרגל או סימני עיצוב. המצב הדלוק נלקח לכן מ-`value`, שנושא את המצב
 *     הנוכחי של המסמך, ולא מ-state מקומי שיצא מסינכרון ברגע שמישהו אחר משנה
 *     את המצב.
 *   - ה-payload מנורמל: מחרוזת או `{ mode }`. נשלח `{ mode }` כדי שיהיה מפורש.
 *
 * מסמך במצב `viewing` יעבור ב-toggle ל-`suggesting`, כלומר גם ייצא מצפייה
 * בלבד. זה מכוון: המשתמש ביקש להתחיל לעקוב אחר שינויים.
 *
 * **שני פקדים מנוטרלים במפורש, ולא כפתור מת:**
 *   - „בדיקת איות” היא שלב שלם בתכנית (§13.2): ספק איות תורני, המרת המילון
 *     למודול נתונים, ו-offsets ב-UTF-16 שמכבדים ניקוד וטעמים. הקיצור `F7`
 *     שהוצג כאן לא היה רשום בשום מקום והוסר.
 *   - „תגובה חדשה” דורשת טקסט תגובה **וזהות מחבר קבועה מהגדרת משתמש מקומית**
 *     (§13.1). זהות המשתמש אינה קיימת עדיין בהגדרות, ותגובה בלי מחבר אינה
 *     תגובה. חצי מימוש כאן היה יוצר מערכת תגובות מקבילה — בדיוק מה שהתכנית
 *     אוסרת.
 */
import { computed } from 'vue';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';

const acceptCmd = useCommand('acceptChange');
const rejectCmd = useCommand('rejectChange');
const acceptAllCmd = useCommand('acceptAllChanges');
const rejectAllCmd = useCommand('rejectAllChanges');
const modeCmd = useCommand('document-mode');

const isSuggesting = computed(() => modeCmd.value.value === 'suggesting');

/** `run` של ה-composable כבר מדווח כשל למשתמש; אין כאן טיפול שני. */
function onToggleTrackChanges(): void {
  void modeCmd.run({ mode: isSuggesting.value ? 'editing' : 'suggesting' });
}
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
