<template>
  <div class="ribbon-tab-pane references-tab">
    <!--
      „תוכן עניינים”. הכפתור הראשון הוא הפקד שכבר היה כאן, ללא שינוי; ארבעת
      הנוספים הם מה שהופך אותו לקבוצה כמו ב-Word. ראו הערת הפתיחה.
    -->
    <RibbonGroup title="תוכן עניינים">
      <RibbonButton
        icon="toc"
        label="תוכן עניינים"
        variant="large"
        tooltip="הוספת תוכן עניינים למסמך"
        :disabled="!tocCmd.enabled.value"
        @click="tocCmd.run()"
      />
      <RibbonButton
        icon="updateFields"
        label="עדכן טבלה"
        variant="large"
        :tooltip="updateTooltip"
        :disabled="!can('canUpdateTableOfContents')"
        @click="onUpdateToc"
      />
      <!--
        „סמן ערך” הוא האייקון של הסימנייה: שני הפקדים מסמנים מקום במסמך בשדה
        בלתי נראה, ולסט אין גליף ייעודי לשדה `TC`. אייקון מושאל עדיף על
        אייקון חדש שמצויר מהזיכרון — ראו הבאנר ב-icons.ts.
      -->
      <RibbonButton
        icon="bookmark"
        label="סמן ערך"
        variant="large"
        :tooltip="tip('canMarkTocEntry', 'סימון טקסט שייכנס לתוכן העניינים')"
        :disabled="!can('canMarkTocEntry')"
        @click="onOpenEntryDialog"
      />
      <RibbonButton
        icon="toc"
        label="התאמה אישית"
        variant="large"
        :tooltip="configureTooltip"
        :disabled="!can('canConfigureTableOfContents')"
        @click="onOpenTocDialog"
      />
      <!--
        אייקון ה„דחייה” של הסקירה הוא ה-X של הסט, וזו המשמעות כאן: הסרה.
      -->
      <RibbonButton
        icon="reject"
        label="הסר"
        variant="large"
        :tooltip="removeTooltip"
        :disabled="!can('canRemoveTableOfContents')"
        @click="onRemoveToc"
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

    <TocDialog
      :is-open="tocDialogOpen"
      :levels="toc.levels"
      :hyperlinks="toc.hyperlinks"
      @close="tocDialogOpen = false"
      @submit="onConfigureToc"
    />

    <TocEntryDialog
      :is-open="entryDialogOpen"
      :entries="toc.entries"
      :selected-text="entrySuggestion"
      @close="entryDialogOpen = false"
      @mark="onMarkEntry"
      @unmark="onUnmarkEntry"
    />
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
 *
 * ## קבוצת „תוכן עניינים”, ומה שאין בה
 *
 * הכפתור „תוכן עניינים” הוא הפקד שהיה כאן מהיום הראשון, והוא לא שונה: אותה
 * פקודת registry, אותו tooltip, אותה התנהגות. לצידו ארבעה פקדים חדשים שכולם
 * רצים על `doc.toc` דרך engine/toc.ts — „עדכן טבלה”, „סמן ערך”, „התאמה
 * אישית” ו„הסר”.
 *
 * „עדכן טבלה” הוא החשוב שבהם, והוא נמדד בדפדפן לפני שנכתב: כותרת שנוספה
 * למסמך אחרי יצירת הטבלה נכנסה אליה אחרי `toc.update` — הטקסט של הטבלה
 * השתנה. (`entryCount` **אינו** העדות: הוא נספר מהמקורות ועולה כבר עם הוספת
 * הכותרת, לפני העדכון. ראו engine/toc.ts.) במסמך שיש בו כמה טבלאות שאינן
 * ניתנות להבחנה הפקד מדווח שהעדכון לא הושלם, ולא „בוצע”.
 *
 * „התאמה אישית” מריץ אחרי `configure` גם `update`, ולא רק מפני שזה נעים:
 * שינוי טווח הרמות משנה איזה כותרות **צריכות** להיות בטבלה, ובלי בנייה
 * מחדש היה נשאר על המסך מצב ביניים שאינו תואם את ההגדרות שהמשתמש הרגע
 * אישר. שני הכשלים מדווחים בנפרד, כי הם שני דברים שונים שיכולים להיכשל.
 *
 * מה שאין בקבוצה — „מנהיג נקודות” ו„הצג מספרי עמודים”, ששניהם פקדים אמיתיים
 * בדיאלוג של Word — אינו השמטה: המנוע מקבל את שניהם עם `success: true`
 * ואינו מיישם אותם, ומספרי העמודים הם בנוסף מתג חד-כיווני. ההנמקה המלאה,
 * כולל המדידה, ב-engine/toc.ts.
 */
import { computed, inject, ref, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import {
  readDocCapabilities,
  type DocCapabilityQuestion,
  type DocCapabilityReport,
} from '../../../engine/doc-capabilities';
import { insertNote, type NoteType } from '../../../engine/footnotes';
import {
  emptyCrossRefsState,
  readCrossRefsState,
  rebuildAllCrossRefs,
  type CrossRefsState,
} from '../../../engine/cross-refs';
import {
  configureTableOfContents,
  emptyTocState,
  markTocEntry,
  readTocState,
  removeTableOfContents,
  unmarkTocEntry,
  updateTableOfContents,
  type TocSettings,
  type TocState,
} from '../../../engine/toc';
import { readDocSelection } from '../../../engine/doc-selection';
import TocDialog from '../../panels/TocDialog.vue';
import TocEntryDialog from '../../panels/TocEntryDialog.vue';

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
/** מצב תוכן העניינים: כמה טבלאות, מה ההגדרות שלהן, ואילו ערכים ידניים סומנו. */
const toc = shallowRef<TocState>(emptyTocState());

const tocDialogOpen = ref(false);
const entryDialogOpen = ref(false);
/** הטקסט שהמשתמש סימן בעורך ברגע פתיחת הדיאלוג, כהצעה לטקסט הערך. */
const entrySuggestion = ref('');

/** ראו LayoutTab: קריאת היכולות א-סינכרונית, ותשובה של מסמך קודם לא תדרוס. */
let generation = 0;

watch(
  superdoc,
  async (host) => {
    const mine = ++generation;
    capabilities.value = null;
    crossRefs.value = emptyCrossRefsState();
    toc.value = emptyTocState();
    const [result, refs, tocState] = await Promise.all([
      readDocCapabilities(host),
      readCrossRefsState(host),
      readTocState(host),
    ]);
    if (mine !== generation) return;
    capabilities.value = result;
    crossRefs.value = refs;
    toc.value = tocState;
  },
  { immediate: true }
);

const can = (question: DocCapabilityQuestion): boolean =>
  capabilities.value?.can(question) ?? false;

/** ה-tooltip של פקד זמין, או ההסבר של היכולת כשאינו. כמו ב-InsertTab. */
function tip(question: DocCapabilityQuestion, enabledText: string): string {
  if (can(question)) return enabledText;
  return capabilities.value?.explain(question) || 'המסמך עדיין נטען';
}

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

/* ------------------------------------------------------------------ */
/* תוכן עניינים                                                        */
/* ------------------------------------------------------------------ */

const updateTooltip = computed(() =>
  tip(
    'canUpdateTableOfContents',
    toc.value.count > 0
      ? 'בניית תוכן העניינים מחדש מהכותרות שבמסמך'
      : 'אין במסמך תוכן עניינים לעדכן'
  )
);

const removeTooltip = computed(() =>
  tip(
    'canRemoveTableOfContents',
    toc.value.count > 0 ? 'מחיקת תוכן העניינים מהמסמך' : 'אין במסמך תוכן עניינים להסיר'
  )
);

const configureTooltip = computed(() =>
  tip(
    'canConfigureTableOfContents',
    toc.value.count > 0
      ? 'רמות הכותרות שייכללו, והאם הערכים יהיו קישורים'
      : 'אין במסמך תוכן עניינים להתאים'
  )
);

/**
 * קוראת מחדש את מצב הטבלה. נדרשת גם אחרי כשל: פעולה שנעצרה באמצע משאירה
 * מסמך שאינו במצב שה-tooltip והדיאלוגים מתארים. **קוראת** את המונה ואינה
 * מקדמת אותו — ראו ההסבר ב-InsertTab.
 */
async function refreshToc(): Promise<void> {
  const mine = generation;
  const next = await readTocState(superdoc.value);
  if (mine === generation) toc.value = next;
}

async function onUpdateToc(): Promise<void> {
  report(await updateTableOfContents(superdoc.value), 'toc-update');
  await refreshToc();
}

async function onRemoveToc(): Promise<void> {
  report(await removeTableOfContents(superdoc.value), 'toc-remove');
  await refreshToc();
}

/**
 * קוראת את ההגדרות מהמסמך **ברגע הפתיחה** ורק אז פותחת.
 *
 * המצב שבזיכרון נקרא בהחלפת מסמך ואחרי כל פעולה, אבל לא אחרי עריכה שהמשתמש
 * עשה בעורך עצמו — ודיאלוג שנפתח על טווח רמות ישן היה מציג הגדרות שאינן של
 * הטבלה שעל המסך, ומחזיר אותן לתוכה באישור. אותה החלטה כמו בדיאלוג הערכים,
 * שקורא את הבחירה ברגע הלחיצה.
 */
async function onOpenTocDialog(): Promise<void> {
  await refreshToc();
  tocDialogOpen.value = true;
}

/**
 * מחילה את ההגדרות ומיד בונה את הטבלה מחדש: שינוי טווח הרמות משנה איזה
 * כותרות צריכות להיות בה, ובלי העדכון היה נשאר על המסך מצב שאינו תואם את
 * ההגדרות שהמשתמש הרגע אישר. שני הכשלים מדווחים בנפרד — הם שני דברים.
 */
async function onConfigureToc(settings: TocSettings): Promise<void> {
  tocDialogOpen.value = false;
  const configured = await configureTableOfContents(superdoc.value, settings);
  report(configured, 'toc-configure');
  if (configured.ok) report(await updateTableOfContents(superdoc.value), 'toc-update');
  await refreshToc();
}

/**
 * פותחת את דיאלוג הערכים עם הטקסט שסומן בעורך כהצעה.
 *
 * הבחירה נקראת **ברגע הלחיצה** ולא כשהדיאלוג מאשר: מרגע שהמשתמש מקליד בשדה
 * המיקוד אינו בעורך, והבחירה החיה כבר אינה מה שהייתה. ראו doc-selection.ts.
 */
async function onOpenEntryDialog(): Promise<void> {
  const selection = await readDocSelection(superdoc.value, { includeText: true });
  entrySuggestion.value = selection.text;
  entryDialogOpen.value = true;
}

async function onMarkEntry(entry: { text: string; level: number }): Promise<void> {
  report(await markTocEntry(superdoc.value, entry.text, entry.level), 'toc-mark-entry');
  await refreshToc();
}

async function onUnmarkEntry(nodeId: string): Promise<void> {
  report(await unmarkTocEntry(superdoc.value, nodeId), 'toc-unmark-entry');
  await refreshToc();
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
