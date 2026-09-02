<template>
  <div
    ref="rootRef"
    class="ctx-font"
    :class="`ctx-font--${control}`"
    data-context-menu-control
  >
    <RibbonCombo
      v-if="control === 'font-family'"
      :model-value="fonts.family.value"
      :options="fonts.familyOptions.value"
      :disabled="!fonts.familyEnabled.value"
      width="100%"
      title="גופן"
      @update:model-value="onFamily"
      @preview="fonts.hoverFamily"
      @preview-end="fonts.endHoverFamily"
    />
    <!--
      אותם props בדיוק של תיבת הגודל ברצועה (HomeTab.vue), כולל `normalize`:
      תיבה שכאן מתנהגת כבורר סגור וכאן כתיבת ערך הייתה שני פקדים שנראים אחד.
    -->
    <RibbonCombo
      v-else
      :model-value="fonts.size.value"
      :options="fonts.sizeOptions.value"
      :disabled="!fonts.sizeEnabled.value"
      :normalize="fonts.normalizeSize"
      empty-text="Enter מחיל את הגודל שהוקלד"
      list-min-width="52px"
      width="100%"
      title="גודל גופן"
      @update:model-value="onSize"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * בורר גופן או בורר גודל, בתוך כרטיס תפריט ההקשר.
 *
 * ## מה כאן, ומה במפורש לא
 *
 * הפקד עצמו הוא `RibbonCombo` — **אותו** רכיב של הרצועה, עם אותם props. אין
 * כאן בורר שני שנראה כמו הראשון: לחיצה ימנית שמציגה רשימת גופנים מקובצת ורצועה
 * שמציגה אותה בסדר אחר היו שני פקדים לאותה שאלה.
 *
 * גם המצב אינו כאן: `useFontControls` קורא את `FONT_MEMORY` שהמעטפת מספקת, כלומר
 * הערך המוצג הוא בדיוק זה שברצועה — וזו כל הנקודה. גופן שהוחל מכאן מופיע מיד
 * למעלה, וגופן שהוחל למעלה מופיע כאן בפתיחה הבאה.
 *
 * ## למה יש כאן `div` עוטף
 *
 * שני דברים תלויים בו, ושניהם של הכרטיס ולא של הפקד:
 *
 * 1. **מיקוד מהחצים.** `ContextMenu.vue` מחזיק מפה של „מי מקבל מיקוד לפי
 *    מזהה”, והמשטח שמקבל מיקוד כאן הוא ה-`input` **בתוך** הפקד. `focusSelf`
 *    הוא מה שמוסר אותו, ולכן הכרטיס אינו צריך לדעת איך הפקד בנוי בפנים.
 * 2. **`data-context-menu-control`.** החצים בכרטיס מזיזים מיקוד; בתוך בורר הם
 *    פותחים רשימה ובוחרים בה. הכרטיס בודק את התכונה הזאת ומשאיר את המקלדת
 *    לפקד, אחרת החץ הראשון בתוך הרשימה היה קורע את המיקוד ממנה.
 */
import { ref } from 'vue';
import RibbonCombo from '../ribbon/common/RibbonCombo.vue';
import { useFontControls } from '../../composables/use-font-controls';
import type { ContextMenuControl } from './context-menu-model';

const props = defineProps<{
  control: ContextMenuControl;
}>();

const emit = defineEmits<{
  /** הוחל משהו — הכרטיס נסגר, כמו אחרי כל פריט אחר בתפריט. */
  (e: 'applied'): void;
}>();

const fonts = useFontControls();
const rootRef = ref<HTMLElement | null>(null);

function onFamily(family: string): void {
  fonts.setFamily(family);
  emit('applied');
}

function onSize(size: string): void {
  fonts.setSize(size);
  emit('applied');
}

/**
 * מיקוד למשטח שמקבל אותו בפועל.
 *
 * `defineExpose` ולא `tabindex` על השורש: הפקד הוא `input` אמיתי, ושורש שמקבל
 * מיקוד היה יוצר תחנת מיקוד שנייה לאותו פקד.
 */
function focusSelf(): void {
  rootRef.value?.querySelector<HTMLElement>('input, select')?.focus();
}

defineExpose({ focusSelf, control: props.control });
</script>

<style scoped>
.ctx-font {
  display: flex;
  align-items: center;
  min-width: 0;
}

/* הגופן לוקח את מה שנשאר, והגודל רוחב קבוע — כמו ברצועה, ובאותו יחס. */
.ctx-font--font-family {
  flex: 1 1 auto;
}

.ctx-font--font-size {
  flex: 0 0 56px;
}
</style>
