<template>
  <div class="ribbon-tab-pane references-tab">
    <RibbonGroup title="תוכן עניינים">
      <RibbonButton
        icon="toc"
        label="תוכן עניינים"
        variant="large"
        tooltip="הוספת תוכן עניינים למסמך"
        :disabled="!tocCmd.enabled.value"
        @click="tocCmd.run()"
      />
    </RibbonGroup>

    <RibbonGroup title="הערות שוליים">
      <RibbonButton
        icon="footnote"
        label="הערת שוליים"
        variant="large"
        :tooltip="noteTooltip('הוספת הערת שוליים בתחתית העמוד')"
        :disabled="!canInsertNote"
        @click="onInsert('footnote')"
      />
      <RibbonButton
        icon="footnote"
        label="הערת סיום"
        variant="large"
        :tooltip="noteTooltip('הוספת הערת סיום בסוף המסמך')"
        :disabled="!canInsertNote"
        @click="onInsert('endnote')"
      />
    </RibbonGroup>

    <!--
      „הפניות מקושרות”. הפקד היחיד בקבוצה הוא עדכון, ולא הוספה: ראו הערת
      הפתיחה.
    -->
    <RibbonGroup title="הפניות מקושרות">
      <RibbonButton
        icon="updateFields"
        label="עדכן הפניות"
        variant="large"
        :tooltip="rebuildTooltip"
        :disabled="!canRebuildCrossRefs"
        @click="onRebuildCrossRefs"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * „הפניות”.
 *
 * שני כפתורי ההערות היו בלי `@click`, והציגו קיצורים — `Alt+Ctrl+F`
 * ו-`Alt+Ctrl+D` — שלא נרשמו בשום מקום. קיצור שמוצג ואינו קיים הוא שקר קטן
 * שמצטבר, ולכן הוא הוסר ולא „תוקן”: רישום קיצור גלובלי הוא שינוי במעטפת, לא
 * בלשונית.
 *
 * ## „עדכן הפניות”, ולמה אין „הפניה מקושרת” לצידו
 *
 * ב-Word העברי „הפניה מקושרת” יושבת בשתי לשוניות — „הוספה” ו„הפניות” — והיא
 * אינה כאן באף אחת מהן. `crossRefs.insert` מוצהר זמין ומחזיר `success: true`,
 * אבל קוד השדה שהוא כותב אינו קוד Word (`REF SDXREF kind=…`), ו-`resolvedText`
 * נשאר ריק גם אחרי `crossRefs.rebuild` על סימנייה קיימת. הכול נמדד בדפדפן,
 * וההנמקה המלאה ב-engine/cross-refs.ts.
 *
 * מה שכן כאן הוא הצד השני של אותו API: `crossRefs.list` מחזיר גם את ההפניות
 * שנוצרו **ב-Word** במסמך שנפתח כאן, ו-`rebuild` עליהן עובד. זה המסלול
 * שהפקד משרת — מסמך שהגיע מ-Word וההפניות בו התיישנו אחרי עריכה.
 *
 * זמינות ההערות נקבעת מ-`doc.capabilities` ולא מהנחה: `footnotes` הוא adapter
 * אופציונלי בחוזה של המנוע, וכשהוא חסר הפקד מנוטרל עם ההסבר „אינו זמין בגרסה
 * זו” — בדיוק כפי ש-§12 דורש. „תוכן עניינים” ממשיך לרוץ דרך פקודת ה-registry;
 * מה שנוסף לו הוא `:disabled` מהמצב שהמנוע מדווח.
 */
import { computed, inject, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { readDocCapabilities, type DocCapabilityReport } from '../../../engine/doc-capabilities';
import { insertNote, type NoteType } from '../../../engine/footnotes';
import {
  emptyCrossRefsState,
  readCrossRefsState,
  rebuildAllCrossRefs,
  type CrossRefsState,
} from '../../../engine/cross-refs';

const tocCmd = useCommand('table-of-contents-insert');

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

const capabilities = shallowRef<DocCapabilityReport | null>(null);
/**
 * מספר ההפניות במסמך. נקרא מהמסמך ולא מוחזק כדגל מקומי, כדי שמסמך שנפתח וכבר
 * יש בו הפניות לא יציג „אין מה לעדכן”. אותה החלטה כמו `fieldsState` ב-InsertTab.
 */
const crossRefs = shallowRef<CrossRefsState>(emptyCrossRefsState());

/** ראו LayoutTab: קריאת היכולות א-סינכרונית, ותשובה של מסמך קודם לא תדרוס. */
let generation = 0;

watch(
  superdoc,
  async (host) => {
    const mine = ++generation;
    capabilities.value = null;
    crossRefs.value = emptyCrossRefsState();
    const [result, refs] = await Promise.all([
      readDocCapabilities(host),
      readCrossRefsState(host),
    ]);
    if (mine !== generation) return;
    capabilities.value = result;
    crossRefs.value = refs;
  },
  { immediate: true }
);

const canInsertNote = computed(() => capabilities.value?.can('canInsertFootnote') ?? false);

function noteTooltip(enabledText: string): string {
  if (canInsertNote.value) return enabledText;
  return capabilities.value?.explain('canInsertFootnote') || 'המסמך עדיין נטען';
}

async function onInsert(type: NoteType): Promise<void> {
  report(await insertNote(superdoc.value, type), `footnotes-insert-${type}`);
}

const canRebuildCrossRefs = computed(
  () => capabilities.value?.can('canRebuildCrossRefs') ?? false
);

const rebuildTooltip = computed(() => {
  if (!canRebuildCrossRefs.value) {
    return capabilities.value?.explain('canRebuildCrossRefs') || 'המסמך עדיין נטען';
  }
  return crossRefs.value.count > 0
    ? 'חישוב מחדש של ההפניות המקושרות במסמך'
    : 'אין במסמך הפניות מקושרות לעדכן';
});

/**
 * מריצה את העדכון, מדווחת עליו, וקוראת מחדש את המונה. הקריאה מחדש נדרשת גם
 * בכשל: עדכון שנעצר באמצע משאיר מסמך שאינו במצב שה-tooltip מתאר.
 */
async function onRebuildCrossRefs(): Promise<void> {
  report(await rebuildAllCrossRefs(superdoc.value), 'cross-refs-rebuild');
  // **קורא** את המונה ואינו מקדם אותו — ראו ההסבר ב-InsertTab.
  const mine = generation;
  const refs = await readCrossRefsState(superdoc.value);
  if (mine === generation) crossRefs.value = refs;
}
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
}
</style>
