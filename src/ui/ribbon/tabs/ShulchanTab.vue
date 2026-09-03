<template>
  <div class="ribbon-tab-pane shulchan-tab">
    <!-- הגהה -->
    <RibbonGroup title="הגהה">
      <RibbonButton
        icon="proofing"
        label="שגיאות מצויות"
        variant="large"
        :tooltip="toolTooltip('תיקון שגיאות הקלדה נפוצות בכל המסמך — רווחים כפולים, פיסוק, סוגריים')"
        :disabled="!ready"
        @click="typosOpen = true"
      />
      <RibbonButton
        icon="search"
        label="סוגריים לא סגורים"
        variant="large"
        :tooltip="toolTooltip('סריקת המסמך אחר סוגריים עגולים ומרובעים שאינם מאוזנים')"
        :disabled="!ready"
        @click="onScanUnclosed"
      />
      <RibbonButton
        icon="bold"
        label="טקסט מתחלף"
        variant="large"
        :tooltip="toolTooltip('הדגשת דיבור-המתחיל בפסקאות המסומנות — מתחילת הפסקה עד תו הסיום, ובין תו ההתחלה לתו הסיום')"
        :disabled="!ready"
        @click="alternatingOpen = true"
      />
      <RibbonButton
        icon="paste"
        label="תיקון העתקה"
        variant="large"
        :tooltip="toolTooltip('רווחים קשיחים שהגיעו מהדבקה מתוכנות אחרות הופכים לרווחים רגילים, בפסקאות המסומנות')"
        :disabled="!ready"
        @click="onCopyFix"
      />
    </RibbonGroup>

    <!-- הערות שוליים -->
    <RibbonGroup title="הערות שוליים">
      <RibbonStack>
        <RibbonButton
          label="סוגריים ⟵ הערות"
          variant="small"
          :tooltip="toolTooltip('כל קטע בסוגריים בפסקאות המסומנות הופך להערת שוליים במקומו')"
          :disabled="!ready"
          @click="onBracketsToNotes"
        />
        <RibbonButton
          label="הערות ⟵ סוגריים"
          variant="small"
          :tooltip="toolTooltip('תוכן הערות השוליים שבבחירה חוזר לגוף הטקסט בסוגריים, במקום ההפניה')"
          :disabled="!ready"
          @click="onNotesToBrackets"
        />
        <RibbonSelect
          :model-value="bracketsType"
          :options="bracketOptions"
          :disabled="!ready"
          title="סוג הסוגריים להמרה"
          width="150px"
          @update:model-value="onBracketsTypeChange"
        />
      </RibbonStack>
    </RibbonGroup>

    <!-- עיצוב פסקה -->
    <RibbonGroup title="עיצוב פסקה">
      <RibbonButton
        icon="growFont"
        label="מילה ראשונה"
        variant="large"
        :tooltip="toolTooltip('הגדלה והדגשה של המילה הראשונה בכל פסקה מסומנת, פרופורציונלית לגוף הפסקה')"
        :disabled="!ready"
        @click="firstWordOpen = true"
      />
      <RibbonStack>
        <RibbonButton
          label="מרווח שורות אחיד"
          variant="small"
          :tooltip="toolTooltip('קיבוע מרווח „בדיוק” בגובה שורה של גופן הגוף — שהמילה המוגדלת לא תמתח את השורה הראשונה. מומלץ להריץ לפני עיצוב המילה הראשונה')"
          :disabled="!ready"
          @click="onLineSpacingApply"
        />
        <RibbonButton
          label="בטל מרווח אחיד"
          variant="small"
          :tooltip="toolTooltip('החזרת מרווח „בדיוק” למרווח „מרובה” שקול בפסקאות המסומנות')"
          :disabled="!ready"
          @click="onLineSpacingRemove"
        />
      </RibbonStack>
    </RibbonGroup>

    <!-- אחידות מסמך -->
    <RibbonGroup title="אחידות מסמך">
      <RibbonStack>
        <RibbonButton
          label="גודל עמוד ושוליים"
          variant="small"
          :tooltip="toolTooltip('איתור מקטעים שסטו מגודל העמוד או מהשוליים של שאר המסמך, והשוואתם לפרופיל אחד')"
          :disabled="!ready"
          @click="onOpenPageUniform"
        />
        <RibbonButton
          label="רוחב טורים"
          variant="small"
          :tooltip="toolTooltip('איתור מקטעים מרובי-טורים שרוחב הטורים או המרווח ביניהם שונה, והשוואתם')"
          :disabled="!ready"
          @click="onOpenColumnsUniform"
        />
      </RibbonStack>
    </RibbonGroup>

    <ShulchanTyposDialog
      :is-open="typosOpen"
      :busy="inFlight"
      @close="typosOpen = false"
      @submit="onTyposSubmit"
    />
    <ShulchanUnclosedDialog
      :is-open="unclosedOpen"
      :busy="inFlight"
      :findings="unclosedFindings"
      :mode="unclosedMode"
      @close="unclosedOpen = false"
      @rescan="onScanUnclosed"
      @reveal="onRevealFinding"
      @update:mode="onUnclosedModeChange"
    />
    <ShulchanAlternatingDialog
      :is-open="alternatingOpen"
      :busy="inFlight"
      @close="alternatingOpen = false"
      @submit="onAlternatingSubmit"
    />
    <ShulchanFirstWordDialog
      :is-open="firstWordOpen"
      :busy="inFlight"
      :styles="styleOptions"
      @close="firstWordOpen = false"
      @apply="onFirstWordApply"
      @remove="onFirstWordRemove"
    />
    <ShulchanUniformDialog
      :is-open="uniformOpen"
      :busy="inFlight"
      :title="uniformTitle"
      :note="uniformNote"
      :items="uniformItems"
      @close="uniformOpen = false"
      @submit="onUniformSubmit"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * „שולחן העורך” — כלי העריכה התורניים שנוידו מתבניות ה-Word של שולחן
 * העורך. מה נויד, מה לא ולמה — docs/shulchan-haorech.md.
 *
 * המבנה כמו LayoutTab: הלשונית מחזיקה את מצב הדיאלוגים ואת נעילת ה-inFlight,
 * המנוע ב-engine/shulchan/*, כשל מדווח ל-COMMAND_REPORTER וסיכום הצלחה
 * ל-STATUS_NOTIFIER.
 */
import { computed, inject, shallowRef } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonStack from '../common/RibbonStack.vue';
import RibbonButton from '../common/RibbonButton.vue';
import RibbonSelect from '../common/RibbonSelect.vue';
import ShulchanTyposDialog from '../../panels/ShulchanTyposDialog.vue';
import ShulchanUnclosedDialog from '../../panels/ShulchanUnclosedDialog.vue';
import ShulchanAlternatingDialog from '../../panels/ShulchanAlternatingDialog.vue';
import ShulchanFirstWordDialog from '../../panels/ShulchanFirstWordDialog.vue';
import ShulchanUniformDialog from '../../panels/ShulchanUniformDialog.vue';
import { COMMAND_REPORTER, STATUS_NOTIFIER, STYLE_GALLERY, type CommandReporter } from '../../../composables/keys';
import { useRememberedOptions } from '../../../composables/useRememberedOptions';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { fallbackStyleGallery, type StyleGalleryState } from '../../../engine/style-gallery';
import {
  copyFixSummaryText,
  runCopyFix,
  runTypos,
  typosSummaryText,
  type TyposOptions,
} from '../../../engine/shulchan/typos';
import { readShulchanBlocks, revealRange } from '../../../engine/shulchan/shulchan-doc';
import {
  scanForUnclosed,
  type ParenFinding,
  type UnclosedScanMode,
} from '../../../engine/shulchan/unclosed-parens';
import {
  alternatingSummaryText,
  runTextAlternating,
  type AlternatingOptions,
} from '../../../engine/shulchan/text-alternating';
import {
  BRACKET_TYPE_LABELS,
  conversionSummaryText,
  convertBracketsToFootnotes,
  convertFootnotesToBrackets,
  type BracketsType,
} from '../../../engine/shulchan/brackets-notes';
import {
  applyFirstWordDesign,
  firstWordSummaryText,
  removeFirstWordDesign,
  type FirstWordOptions,
} from '../../../engine/shulchan/first-word';
import {
  applyExactLineSpacing,
  lineSpacingSummaryText,
  removeExactLineSpacing,
} from '../../../engine/shulchan/line-spacing';
import {
  UNIFORM_NO_ERRORS_TEXT,
  applyColumnsProfile,
  applyPageProfile,
  columnsProfileLabel,
  pageProfileLabel,
  readColumnsProfiles,
  readPageProfiles,
  sectionCountText,
  type ColumnsProfile,
  type PageProfile,
} from '../../../engine/shulchan/sections-uniform';

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);
const notify = inject(STATUS_NOTIFIER, () => undefined);
const styleGallery = inject(STYLE_GALLERY, shallowRef<StyleGalleryState>(fallbackStyleGallery()));

/** סגנונות הפסקה של המסמך, לסינון „רק בסגנון” בעיצוב המילה הראשונה. */
const styleOptions = computed(() => styleGallery.value.items.map((item) => ({ id: item.id, label: item.label })));

/**
 * ההעדפות שהלשונית עצמה מחזיקה (לא דיאלוג): סוג הסוגריים ומצב סריקת
 * הסוגריים. נטענות פעם אחת בהרכבה — שני הפקדים נראים עוד לפני שנלחץ משהו.
 */
const tabPrefs = useRememberedOptions('tab', () => ({ bracketsType: 'round', unclosedMode: 'paragraph' }));
void tabPrefs.load().then((prefs) => {
  if (BRACKET_TYPE_LABELS.some((entry) => entry.value === prefs.bracketsType)) {
    bracketsType.value = prefs.bracketsType as BracketsType;
  }
  unclosedMode.value = prefs.unclosedMode === 'document' ? 'document' : 'paragraph';
});

function saveTabPrefs(): void {
  void tabPrefs.save({ bracketsType: bracketsType.value, unclosedMode: unclosedMode.value });
}

/** פעולה על המסמך באוויר — אותה נעילה כמו ב-LayoutTab, ומאותו טעם. */
const inFlight = shallowRef(false);
const ready = computed(() => superdoc.value !== null && !inFlight.value);

function toolTooltip(available: string): string {
  return superdoc.value ? available : 'יש לפתוח מסמך תחילה';
}

/**
 * מסלול אחיד לכל כלי: נעילה, ריצה, דיווח כשל או סיכום הצלחה. `commandId`
 * מופיע בלוג הכשל בלבד.
 */
async function runTool<T extends { ok: boolean; message?: string }>(
  commandId: string,
  action: () => Promise<T>,
  summary: (result: T) => string,
): Promise<void> {
  if (inFlight.value || !superdoc.value) return;
  inFlight.value = true;
  try {
    const result = await action();
    if (!result.ok) {
      report({ ok: false, message: result.message ?? 'הפעולה נכשלה', reason: 'shulchan-failed' }, commandId);
      return;
    }
    report({ ok: true }, commandId);
    notify(summary(result));
  } finally {
    inFlight.value = false;
  }
}

/* ---------- הגהה ---------- */

const typosOpen = shallowRef(false);

function onTyposSubmit(options: TyposOptions): void {
  typosOpen.value = false;
  void runTool('shulchan-typos', () => runTypos(superdoc.value, options), (result) =>
    typosSummaryText(result),
  );
}

function onCopyFix(): void {
  void runTool('shulchan-copy-fix', () => runCopyFix(superdoc.value), (result) => copyFixSummaryText(result));
}

const unclosedOpen = shallowRef(false);
const unclosedFindings = shallowRef<readonly ParenFinding[]>([]);
const unclosedMode = shallowRef<UnclosedScanMode>('paragraph');

async function onScanUnclosed(): Promise<void> {
  if (inFlight.value || !superdoc.value) return;
  inFlight.value = true;
  try {
    const blocks = await readShulchanBlocks(superdoc.value);
    if (blocks === null) {
      report({ ok: false, message: 'הסריקה נכשלה: אין מסמך פתוח, או שהמסמך אינו תומך בפעולה', reason: 'command-unsupported' }, 'shulchan-unclosed');
      return;
    }
    unclosedFindings.value = scanForUnclosed(blocks, unclosedMode.value);
    unclosedOpen.value = true;
    report({ ok: true }, 'shulchan-unclosed');
  } finally {
    inFlight.value = false;
  }
}

/** הדיאלוג מבקש סריקה מחדש מיד אחרי השינוי — ולכן המצב נכתב לפני שהיא רצה. */
function onUnclosedModeChange(mode: UnclosedScanMode): void {
  unclosedMode.value = mode;
  saveTabPrefs();
}

function onRevealFinding(index: number): void {
  const finding = unclosedFindings.value[index];
  if (!finding) return;
  void revealRange(superdoc.value, finding.blockId, finding.start, finding.end);
}

const alternatingOpen = shallowRef(false);

function onAlternatingSubmit(options: AlternatingOptions): void {
  alternatingOpen.value = false;
  void runTool('shulchan-alternating', () => runTextAlternating(superdoc.value, options), (result) =>
    alternatingSummaryText(result),
  );
}

/* ---------- הערות שוליים ---------- */

const bracketsType = shallowRef<BracketsType>('round');
const bracketOptions = BRACKET_TYPE_LABELS.map((entry) => ({ value: entry.value, label: entry.label }));

function onBracketsTypeChange(value: string): void {
  const entry = BRACKET_TYPE_LABELS.find((candidate) => candidate.value === value);
  if (!entry) return;
  bracketsType.value = entry.value;
  saveTabPrefs();
}

function onBracketsToNotes(): void {
  void runTool(
    'shulchan-brackets-to-notes',
    () => convertBracketsToFootnotes(superdoc.value, bracketsType.value),
    (result) => conversionSummaryText(result, 'to-notes'),
  );
}

function onNotesToBrackets(): void {
  void runTool(
    'shulchan-notes-to-brackets',
    () => convertFootnotesToBrackets(superdoc.value, bracketsType.value),
    (result) => conversionSummaryText(result, 'to-brackets'),
  );
}

/* ---------- עיצוב פסקה ---------- */

const firstWordOpen = shallowRef(false);

function onFirstWordApply(options: FirstWordOptions): void {
  firstWordOpen.value = false;
  void runTool('shulchan-first-word', () => applyFirstWordDesign(superdoc.value, options), (result) =>
    firstWordSummaryText(result, false),
  );
}

function onFirstWordRemove(): void {
  firstWordOpen.value = false;
  void runTool('shulchan-first-word-remove', () => removeFirstWordDesign(superdoc.value), (result) =>
    firstWordSummaryText(result, true),
  );
}

function onLineSpacingApply(): void {
  void runTool('shulchan-line-spacing', () => applyExactLineSpacing(superdoc.value), (result) =>
    lineSpacingSummaryText(result, false),
  );
}

function onLineSpacingRemove(): void {
  void runTool('shulchan-line-spacing-remove', () => removeExactLineSpacing(superdoc.value), (result) =>
    lineSpacingSummaryText(result, true),
  );
}

/* ---------- אחידות מסמך ---------- */

const uniformOpen = shallowRef(false);
const uniformTitle = shallowRef('');
const uniformNote = shallowRef('');
const uniformItems = shallowRef<string[]>([]);
let uniformMode: 'page' | 'columns' = 'page';
let uniformPageProfiles: PageProfile[] = [];
let uniformColumnsProfiles: ColumnsProfile[] = [];

async function onOpenPageUniform(): Promise<void> {
  if (inFlight.value || !superdoc.value) return;
  inFlight.value = true;
  try {
    const result = await readPageProfiles(superdoc.value);
    if (!result.ok) {
      report(result.outcome, 'shulchan-page-uniform');
      return;
    }
    if (result.groups.length <= 1) {
      report({ ok: true }, 'shulchan-page-uniform');
      notify(UNIFORM_NO_ERRORS_TEXT);
      return;
    }
    uniformMode = 'page';
    uniformPageProfiles = result.groups.map((group) => group.profile);
    uniformTitle.value = 'אחידות גודל עמוד ושוליים';
    uniformNote.value = 'נמצאו במסמך כמה פרופילים של גודל עמוד ושוליים. יש לבחור את הנכון — והוא יוחל על כל המקטעים:';
    uniformItems.value = result.groups.map(
      (group) => `${pageProfileLabel(group.profile)} (${sectionCountText(group.sections)})`,
    );
    uniformOpen.value = true;
  } finally {
    inFlight.value = false;
  }
}

async function onOpenColumnsUniform(): Promise<void> {
  if (inFlight.value || !superdoc.value) return;
  inFlight.value = true;
  try {
    const result = await readColumnsProfiles(superdoc.value);
    if (!result.ok) {
      report(result.outcome, 'shulchan-columns-uniform');
      return;
    }
    if (result.groups.length <= 1) {
      report({ ok: true }, 'shulchan-columns-uniform');
      notify(UNIFORM_NO_ERRORS_TEXT);
      return;
    }
    uniformMode = 'columns';
    uniformColumnsProfiles = result.groups.map((group) => group.profile);
    uniformTitle.value = 'אחידות רוחב טורים';
    uniformNote.value = 'נמצאו במסמך כמה פרופילים של טורים. יש לבחור את הנכון — והוא יוחל על כל המקטעים מרובי-הטורים:';
    uniformItems.value = result.groups.map(
      (group) => `${columnsProfileLabel(group.profile)} (${sectionCountText(group.sections)})`,
    );
    uniformOpen.value = true;
  } finally {
    inFlight.value = false;
  }
}

function onUniformSubmit(index: number): void {
  uniformOpen.value = false;
  if (uniformMode === 'page') {
    const profile = uniformPageProfiles[index];
    if (!profile) return;
    void runTool('shulchan-page-uniform', () => applyPageProfile(superdoc.value, profile).then((outcome) => ({
      ok: outcome.ok,
      ...(outcome.ok ? {} : { message: outcome.message }),
    })), () => 'גודל העמוד והשוליים הוחלו על כל המקטעים');
    return;
  }
  const profile = uniformColumnsProfiles[index];
  if (!profile) return;
  void runTool('shulchan-columns-uniform', () => applyColumnsProfile(superdoc.value, profile).then((outcome) => ({
    ok: outcome.ok,
    ...(outcome.ok ? {} : { message: outcome.message }),
  })), () => 'רוחב הטורים הוחל על כל המקטעים מרובי-הטורים');
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
