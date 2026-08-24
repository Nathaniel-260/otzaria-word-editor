<template>
  <div class="ribbon-tab-pane insert-tab">
    <!-- קבוצה 1: עמודים -->
    <RibbonGroup
      title="עמודים"
      :launcher="false"
    >
      <RibbonButton
        icon="pageBreak"
        label="מעבר עמוד"
        variant="large"
        tooltip="הוספת מעבר עמוד במסמך"
        @click="insertPageBreak"
      />
    </RibbonGroup>

    <!-- קבוצה 2: טבלאות -->
    <RibbonGroup
      title="טבלאות"
      :launcher="false"
    >
      <TablePicker
        :disabled="!tableCmd.enabled.value"
        @select="onInsertTable"
      />
    </RibbonGroup>

    <!-- קבוצה 3: איורים ומדיה -->
    <RibbonGroup
      title="איורים"
      :launcher="false"
    >
      <RibbonButton
        icon="image"
        label="תמונות"
        variant="large"
        :tooltip="imageTooltip"
        :disabled="!imageCmd.enabled.value || imageBusy"
        @click="onInsertImage"
      />
    </RibbonGroup>

    <!-- קבוצה 4: קישורים -->
    <RibbonGroup
      title="קישורים"
      :launcher="false"
    >
      <RibbonButton
        icon="link"
        label="קישור"
        variant="large"
        tooltip="הוספת היפר-קישור לכתובת אינטרנט או לדואר"
        :disabled="!linkCmd.enabled.value"
        @click="onOpenLinkDialog"
      />
    </RibbonGroup>

    <!-- קבוצה 5: תוכן עניינים -->
    <RibbonGroup
      title="תוכן עניינים"
      :launcher="false"
    >
      <RibbonButton
        icon="toc"
        label="תוכן עניינים"
        variant="large"
        tooltip="יצירת תוכן עניינים אוטומטי"
        :disabled="!tocCmd.enabled.value"
        @click="tocCmd.run()"
      />
    </RibbonGroup>

    <LinkDialog
      :is-open="linkDialogOpen"
      :has-range="linkSelection.hasRange"
      :selected-text="linkSelection.text"
      @close="linkDialogOpen = false"
      @submit="onSubmitLink"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * „הוספה”.
 *
 * ## התמונה, וההכרעה שקדמה לה
 *
 * `create.image` **מטמיע בייטים ואינו מפנה ל-URL** — נמדד במימוש, וההסבר המלא
 * ב-engine/payloads.ts. בורר הקבצים של אוצריא מחזיר `url` של שרת loopback
 * שהפורט שלו משתנה בכל הפעלה, ולכן הזרימה כאן היא בורר → קריאת בייטים →
 * data URI → פקודה. ה-URL עצמו אינו מגיע למנוע בשום שלב.
 *
 * למה דרך פקודת ה-registry (`image`) ולא `doc.create.image` ישירות: הפקודה היא
 * שמחשבת את `at` מהסמן, כולל המקרים שאין להם מסלול פשוט — סמן בכותרת עליונה או
 * תחתונה מקבל `in: resolveActiveHeaderFooterSlot(story)`. קריאה ישירה הייתה
 * מחייבת אותנו לשחזר את החישוב הזה, ולטעות בו בשקט.
 *
 * ## הקישור, והסיבה שיש דיאלוג
 *
 * `executeLinkCommand` דורש `href`, ולכן `linkCmd.run()` בלי payload נכשל סגור.
 * הדיאלוג הוא מה שמספק אותו — אבל הוא גם מה שמכניס את הבעיה: ברגע שמקלידים
 * בשדה, המיקוד אינו בעורך והבחירה החיה של ה-controller אינה `ready`. לכן
 * הבחירה נתפסת **בלחיצה** ונמסרת חזרה כ-`target`; זה המסלול שהמנוע עצמו בנה
 * (`readLinkPayloadTarget` נבדק לפני הבחירה החיה, ו-
 * `linkPayloadHasExplicitTarget` מכריז על הפקודה כמוכנה בלעדיה).
 *
 * ## המצב הקודם
 *
 * שלושת הפקדים כאן לא עשו כלום: `imageCmd.run()` ו-`linkCmd.run()` נקראו **בלי
 * payload**, וכל אחת מהן נכשלת סגור במנוע (`create.image` דורש `src`,
 * `executeLinkCommand` דורש `href`), ו-`insertPageBreak` הייתה פונקציה ריקה.
 * אף אחד מהם לא היה מנוטרל ואף אחד לא דיווח כשל — כלומר שלושה כפתורים שנראים
 * עובדים.
 */
import { computed, inject, ref, shallowRef } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import TablePicker from '../common/TablePicker.vue';
import LinkDialog from '../../panels/LinkDialog.vue';
import { useCommand } from '../../../composables/useCommand';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import {
  emptySelectionSnapshot,
  readDocSelection,
  type DocSelectionSnapshot,
} from '../../../engine/doc-selection';
import { LINK_HREF_HINT, imagePayload, linkPayload } from '../../../engine/payloads';
import { pickImageFile, readImageAsDataUrl } from '../../../host/files';

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

const tableCmd = useCommand('table-insert');
const imageCmd = useCommand('image');
const linkCmd = useCommand('link');
const tocCmd = useCommand('table-of-contents-insert');

/**
 * בורר הקבצים והורדת הבייטים אינם מיידיים. בלי הדגל הזה לחיצה שנייה בזמן
 * שהדיאלוג פתוח פותחת דיאלוג שני, ושתי התמונות נכנסות לאותו מקום.
 */
const imageBusy = ref(false);

const imageTooltip = computed(() =>
  imageBusy.value ? 'התמונה נוספת למסמך…' : 'הוספת תמונה מקובץ (PNG או JPEG)'
);

function onInsertTable(dimensions: { rows: number; cols: number }): void {
  void tableCmd.run({ rows: dimensions.rows, cols: dimensions.cols });
}

async function onInsertImage(): Promise<void> {
  if (imageBusy.value) return;
  imageBusy.value = true;
  try {
    const file = await pickImage();
    // ביטול. לא כשל, ואין להציג עליו שום דבר.
    if (!file) return;

    const bytes = await readImageAsDataUrl(file);
    if (!bytes.ok) {
      report({ ok: false, message: bytes.message, reason: bytes.reason }, 'image');
      return;
    }

    // `alt` הוא שם הקובץ: זה המידע היחיד שיש, והמנוע כותב אותו גם ל-
    // `wp:docPr/@name` וגם ל-`@descr` (נמדד). טוב יותר מ-descr ריק, ופחות
    // טוב מתיאור שהמשתמש כתב — עריכת ה-alt דורשת `images.setAltText`, פקד
    // שאינו בלשונית הזאת.
    const payload = imagePayload({ src: bytes.dataUrl, alt: file.name });
    if (!payload) {
      // הגנה על החוזה, לא מצב שאפשר להגיע אליו: `readImageAsDataUrl` בונה
      // את ה-src. אם הצורה תשתנה, עדיף שהמשתמש יקבל הודעה מאשר שהמנוע
      // ידחה בשקט.
      report(
        { ok: false, message: 'לא ניתן להטמיע את התמונה הזאת במסמך', reason: 'invalid-src' },
        'image',
      );
      return;
    }

    // `run` מדווח בעצמו על כשל של הפקודה — אין להוסיף כאן דיווח שני.
    await imageCmd.run(payload);
  } finally {
    imageBusy.value = false;
  }
}

/** `pickUserFile` זורק על שגיאת Host; הזריקה הופכת להודעה ולא למסך לבן. */
async function pickImage(): ReturnType<typeof pickImageFile> {
  try {
    return await pickImageFile();
  } catch (error) {
    report(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'בחירת התמונה נכשלה',
        reason: 'threw',
      },
      'image',
    );
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* קישור                                                              */
/* ------------------------------------------------------------------ */

const linkDialogOpen = ref(false);

/**
 * הבחירה כפי שהייתה **ברגע הלחיצה**, לא כפי שהיא כשהמשתמש מאשר. הדיאלוג גוזל
 * את המיקוד מהעורך ברגע שמקלידים בו, ובלי התצלום הזה הקישור היה נכתב על טווח
 * שאינו קיים או לא נכתב בכלל. `readLinkPayloadTarget` נבדק במנוע לפני הבחירה
 * החיה בדיוק בשביל המקרה הזה.
 */
const linkSelection = shallowRef<DocSelectionSnapshot>(emptySelectionSnapshot());

async function onOpenLinkDialog(): Promise<void> {
  linkSelection.value = await readDocSelection(superdoc.value, { includeText: true });
  linkDialogOpen.value = true;
}

function onSubmitLink(link: { href: string; text: string }): void {
  const snapshot = linkSelection.value;

  const payload = linkPayload({
    href: link.href,
    // עם טווח מסומן המסלול הוא `hyperlinks.wrap`, שמתעלם מ-`text`. שליחתו
    // הייתה יוצרת ציפייה שהטקסט המסומן יוחלף.
    text: snapshot.hasRange ? undefined : link.text,
    target: snapshot.target ?? undefined,
  });

  if (!payload) {
    // הדיאלוג אינו מאפשר אישור של כתובת פסולה, ולכן זו הגנה על החוזה ולא
    // מצב שאפשר להגיע אליו דרך הממשק.
    report({ ok: false, message: LINK_HREF_HINT, reason: 'invalid-href' }, 'link');
    return;
  }

  linkDialogOpen.value = false;
  // `run` מדווח בעצמו על כשל של הפקודה — אין להוסיף כאן דיווח שני.
  void linkCmd.run(payload);
}

function insertPageBreak(): void {
  // מעבר עמוד דרך קיצור מקלדת Ctrl+Enter
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
