<template>
  <div class="ribbon-tab-pane layout-tab">
    <!-- קבוצה 1: הגדרת עמוד -->
    <RibbonGroup title="הגדרת עמוד">
      <RibbonMenuButton
        icon="margins"
        label="שוליים"
        :tooltip="tip('canSetPageMargins', 'הגדרת שולי הדף (רגיל, צר, רחב)')"
        :disabled="!can('canSetPageMargins')"
        :items="marginItems"
        @select="onMargins"
      />
      <RibbonMenuButton
        icon="orientation"
        label="כיוון"
        :tooltip="tip('canSetPageSetup', 'כיוון הדף: לאורך או לרוחב')"
        :disabled="!can('canSetPageSetup')"
        :items="orientationItems"
        @select="onOrientation"
      />
      <RibbonMenuButton
        icon="paperSize"
        label="גודל"
        :tooltip="tip('canSetPageSetup', 'בחירת גודל נייר (A4, Letter)')"
        :disabled="!can('canSetPageSetup')"
        :items="paperItems"
        @select="onPaperSize"
      />
      <RibbonMenuButton
        icon="columns"
        label="עמודות"
        :tooltip="tip('canSetColumns', 'פיצול הטקסט לשתי עמודות או יותר')"
        :disabled="!can('canSetColumns')"
        :items="columnItems"
        @select="onColumns"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * „פריסה” — כל ארבעת הפקדים דרך `doc.sections`, ולא דרך פקודת Ribbon.
 *
 * למה לא דרך ה-registry: אין ב-`COMMAND_CATALOG` של המנוע פקודות לשוליים,
 * לכיוון, לגודל נייר או לעמודות. המסלול הציבורי היחיד הוא ה-Document API,
 * והוא יושב על המופע ולא על ה-controller — ומכאן ההזרקה של `ACTIVE_SUPERDOC`
 * במקום `useCommand`.
 *
 * שלוש התוצאות של „לבדוק capability בעת boot” (§12) גלויות כאן:
 *   1. `:disabled` מגיע מהיכולת שהמנוע מדווח, ולא מהנחה שלנו.
 *   2. tooltip של פקד מנוטרל מסביר **למה** הוא מנוטרל.
 *   3. כשל של קבלה מגיע למשתמש בעברית, דרך אותו מדווח שכל פקודה משתמשת בו —
 *      ולא דרך מנגנון דיווח שני.
 */
import { inject, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonMenuButton from '../common/RibbonMenuButton.vue';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import {
  COMMAND_REPORTER,
  type CommandReporter,
} from '../../../composables/keys';
import type { CommandOutcome } from '../../../engine/command-adapter';
import {
  readDocCapabilities,
  type DocCapabilityQuestion,
  type DocCapabilityReport,
} from '../../../engine/doc-capabilities';
import {
  COLUMN_CHOICES,
  MARGIN_PRESETS,
  ORIENTATIONS,
  PAPER_SIZES,
  applyColumns,
  applyMarginPreset,
  applyOrientation,
  applyPaperSize,
  type PageOrientation,
} from '../../../engine/page-setup';

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

const capabilities = shallowRef<DocCapabilityReport | null>(null);

/**
 * מונה דורות: קריאת היכולות א-סינכרונית, ומסמך שנפתח אחרי מסמך אחר עשוי
 * להשיב לפניו. בלי המונה התשובה של המסמך הקודם הייתה דורסת את זו של הנוכחי.
 */
let generation = 0;

watch(
  superdoc,
  async (host) => {
    const mine = ++generation;
    capabilities.value = null;
    const result = await readDocCapabilities(host);
    if (mine === generation) capabilities.value = result;
  },
  { immediate: true }
);

/** עד שהיכולות נקראו — הכול מנוטרל. „אולי כן” הוא בדיוק הכפתור המת. */
function can(question: DocCapabilityQuestion): boolean {
  return capabilities.value?.can(question) ?? false;
}

function tip(question: DocCapabilityQuestion, enabledText: string): string {
  const explanation = capabilities.value?.explain(question);
  return can(question) ? enabledText : explanation || 'המסמך עדיין נטען';
}

const marginItems = MARGIN_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  hint: preset.hint,
}));

const orientationItems = ORIENTATIONS.map((item) => ({
  id: item.id,
  label: item.label,
  hint: item.hint,
}));

const paperItems = PAPER_SIZES.map((size) => ({
  id: size.id,
  label: size.label,
  hint: size.hint,
}));

const columnItems = COLUMN_CHOICES.map((choice) => ({
  id: String(choice.count),
  label: choice.label,
  hint: choice.hint,
}));

/** מריצה פעולה ומדווחת עליה. הדיווח כאן ולא במודול: המודול אינו יודע להציג. */
async function run(id: string, action: Promise<CommandOutcome>): Promise<void> {
  report(await action, id);
}

function onMargins(id: string): void {
  void run('page-margins', applyMarginPreset(superdoc.value, id));
}

function onOrientation(id: string): void {
  void run('page-orientation', applyOrientation(superdoc.value, id as PageOrientation));
}

function onPaperSize(id: string): void {
  void run('page-size', applyPaperSize(superdoc.value, id));
}

function onColumns(id: string): void {
  void run('page-columns', applyColumns(superdoc.value, Number(id)));
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
