<template>
  <div class="ribbon-tab-pane home-tab">
    <!-- קבוצה 1: לוח -->
    <RibbonGroup title="לוח">
      <RibbonButton
        icon="paste"
        label="הדבק"
        variant="large"
        :tooltip="pasteTooltip"
        shortcut-id="paste"
        :disabled="!canPaste"
        @click="doPaste"
      />
      <div class="column-items">
        <RibbonButton
          icon="cut"
          label="גזור"
          variant="small"
          :tooltip="cutTooltip"
          shortcut-id="cut"
          :disabled="!canCut"
          @click="doCut"
        />
        <RibbonButton
          icon="copy"
          label="העתק"
          variant="small"
          :tooltip="copyTooltip"
          shortcut-id="copy"
          :disabled="!canCopy"
          @click="doCopy"
        />
        <RibbonButton
          icon="formatPainter"
          label="מברשת עיצוב"
          variant="small"
          tooltip="העתק עיצוב ממקום אחד והחל במקום אחר"
          :active="formatPainterCmd.active.value"
          :disabled="!formatPainterCmd.enabled.value"
          @click="formatPainterCmd.run()"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 2: גופן -->
    <RibbonGroup
      title="גופן"
      :column-flow="true"
    >
      <!-- שורה עליונה: גופן, גודל, הגדל/הקטן, נקה -->
      <div class="word-group-row">
        <!--
          `:model-value` ולא `v-model`: הערך המוצג הוא computed שמקורו במנוע,
          ואין לפקד רשות לכתוב אליו. מה שהמשתמש בוחר עובר בפקודה, וחוזר משם.
        -->
        <RibbonSelect
          :model-value="selectedFontFamily"
          :options="familySelectOptions"
          :disabled="!fontFamilyCmd.enabled.value"
          width="130px"
          title="גופן"
          @update:model-value="onFontFamilyChange"
        />
        <RibbonSelect
          :model-value="selectedFontSize"
          :options="sizeSelectOptions"
          :disabled="!fontSizeCmd.enabled.value"
          width="50px"
          title="גודל גופן"
          @update:model-value="onFontSizeChange"
        />
        <RibbonButton
          icon="growFont"
          variant="icon-only"
          tooltip="הגדל גופן"
          :disabled="!fontSizeCmd.enabled.value"
          @click="growFontSize"
        />
        <RibbonButton
          icon="shrinkFont"
          variant="icon-only"
          tooltip="הקטן גופן"
          :disabled="!fontSizeCmd.enabled.value"
          @click="shrinkFontSize"
        />
        <RibbonButton
          icon="clearFormatting"
          variant="icon-only"
          tooltip="נקה את כל העיצוב"
          :disabled="!clearFormatCmd.enabled.value"
          @click="clearFormatCmd.run()"
        />

        <!--
          „גופן מתקדם" — פתח הדיאלוג, כמו פתח ה„גופן" של Word בקצה הקבוצה.
          הדיאלוג עצמו נכשל סגור כשאין Document API, ולכן הכפתור נשאר לחיץ
          והפתיחה מסבירה. `@pointerdown.prevent` מונע גזילת המיקוד מהעורך —
          הבחירה חייבת לשרוד עד החלת העיצוב.
        -->
        <RibbonButton
          label="מתקדם"
          variant="small"
          tooltip="גופן מתקדם: ריווח תווים, מיקום, אפקטים וגופן מורכב"
          :disabled="fontAdvInFlight"
          @click="onOpenFontAdvanced"
        />
      </div>

      <!-- שורה תחתונה: B, I, U, S, sub, super, highlight, color -->
      <div class="word-group-row">
        <RibbonButton
          icon="bold"
          variant="icon-only"
          tooltip="מודגש"
          shortcut-id="bold"
          :active="boldCmd.active.value"
          :disabled="!boldCmd.enabled.value"
          @click="boldCmd.run()"
        />
        <RibbonButton
          icon="italic"
          variant="icon-only"
          tooltip="נטוי"
          shortcut-id="italic"
          :active="italicCmd.active.value"
          :disabled="!italicCmd.enabled.value"
          @click="italicCmd.run()"
        />
        <RibbonButton
          icon="underline"
          variant="icon-only"
          tooltip="קו תחתון"
          shortcut-id="underline"
          :active="underlineCmd.active.value"
          :disabled="!underlineCmd.enabled.value"
          @click="underlineCmd.run()"
        />
        <RibbonButton
          icon="strikethrough"
          variant="icon-only"
          tooltip="קו חוצה"
          :active="strikeCmd.active.value"
          :disabled="!strikeCmd.enabled.value"
          @click="strikeCmd.run()"
        />
        <RibbonButton
          icon="subscript"
          variant="icon-only"
          :tooltip="vertAlignTooltip('subscript')"
          :disabled="!canSetVertAlign"
          @click="onVertAlign('subscript')"
        />
        <RibbonButton
          icon="superscript"
          variant="icon-only"
          :tooltip="vertAlignTooltip('superscript')"
          :disabled="!canSetVertAlign"
          @click="onVertAlign('superscript')"
        />

        <div class="word-separator" />

        <ColorPickerPopover
          :model-value="highlightColor"
          icon="highlight"
          title="צבע סימון טקסט"
          default-color="#FFFF00"
          :disabled="!highlightCmd.enabled.value"
          @change="onHighlightChange"
        />
        <ColorPickerPopover
          :model-value="textColor"
          icon="fontColor"
          title="צבע גופן"
          default-color="#000000"
          :disabled="!fontColorCmd.enabled.value"
          @change="onTextColorChange"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 3: פיסקה -->
    <RibbonGroup
      title="פיסקה"
      :column-flow="true"
    >
      <!-- שורה עליונה: תבליטים, מספור, הזחה, כיווניות, סימני עיצוב -->
      <div class="word-group-row">
        <RibbonButton
          icon="bulletList"
          variant="icon-only"
          tooltip="תבליטים"
          :active="bulletCmd.active.value"
          :disabled="!bulletCmd.enabled.value"
          @click="bulletCmd.run()"
        />
        <RibbonButton
          icon="numberList"
          variant="icon-only"
          tooltip="מספור"
          :active="numberedCmd.active.value"
          :disabled="!numberedCmd.enabled.value"
          @click="numberedCmd.run()"
        />
        <RibbonButton
          icon="indentDecrease"
          variant="icon-only"
          tooltip="הקטן הזחה"
          :disabled="!indentDecCmd.enabled.value"
          @click="indentDecCmd.run()"
        />
        <RibbonButton
          icon="indentIncrease"
          variant="icon-only"
          tooltip="הגדל הזחה"
          :disabled="!indentIncCmd.enabled.value"
          @click="indentIncCmd.run()"
        />

        <!--
          „רשימה" (גל 14א) — פעולות שאין להן פקודה ברצועה: מספור עברי
          (hebrew1 — נמדד שנכתב ל-numbering.xml), התחלה מחדש, המשך מספור
          קודם והמרה לטקסט. „המר לטקסט" בלתי-הפיך ולכן דורש לחיצה שנייה.
        -->
        <RibbonMenuButton
          icon="numberList"
          label="רשימה"
          :tooltip="listsTooltip"
          :disabled="!listsAvailable"
          :items="listMenuItems"
          @select="onListMenuSelect"
        />

        <div class="word-separator" />

        <RibbonButton
          icon="dirRtl"
          variant="icon-only"
          tooltip="כיוון פסקה מימין לשמאל"
          :active="dirRtlCmd.active.value"
          :disabled="!dirRtlCmd.enabled.value"
          @click="dirRtlCmd.run()"
        />
        <RibbonButton
          icon="dirLtr"
          variant="icon-only"
          tooltip="כיוון פסקה משמאל לימין"
          :active="dirLtrCmd.active.value"
          :disabled="!dirLtrCmd.enabled.value"
          @click="dirLtrCmd.run()"
        />
        <RibbonButton
          icon="pilcrow"
          variant="icon-only"
          tooltip="הצג/הסתר סימני עיצוב"
          :active="marksCmd.active.value"
          :disabled="!marksCmd.enabled.value"
          @click="marksCmd.run()"
        />
      </div>

      <!-- שורה תחתונה: יישור ימין, מרכז, שמאל, מלא, מרווח שורות -->
      <div class="word-group-row">
        <RibbonButton
          icon="alignRight"
          variant="icon-only"
          tooltip="יישור לימין"
          :active="alignCmd.value.value === 'right'"
          :disabled="!alignCmd.enabled.value"
          @click="onAlign('right')"
        />
        <RibbonButton
          icon="alignCenter"
          variant="icon-only"
          tooltip="מרכז"
          :active="alignCmd.value.value === 'center'"
          :disabled="!alignCmd.enabled.value"
          @click="onAlign('center')"
        />
        <RibbonButton
          icon="alignLeft"
          variant="icon-only"
          tooltip="יישור לשמאל"
          :active="alignCmd.value.value === 'left'"
          :disabled="!alignCmd.enabled.value"
          @click="onAlign('left')"
        />
        <RibbonButton
          icon="alignJustify"
          variant="icon-only"
          tooltip="יישור לשני הצדדים"
          :active="alignCmd.value.value === 'justify'"
          :disabled="!alignCmd.enabled.value"
          @click="onAlign('justify')"
        />

        <div class="word-separator" />

        <RibbonSelect
          :model-value="selectedLineSpacing"
          :options="spacingSelectOptions"
          :disabled="!lineSpacingCmd.enabled.value"
          width="48px"
          title="מרווח בין שורות"
          @update:model-value="onLineSpacingChange"
        />

        <div class="word-separator" />

        <!--
          „תפריט פסקה” — פתח הדיאלוג, כמו פתח ה„פסקה” של Word בקצה הקבוצה.
          זמינותו אינה של פקודה: הדיאלוג עצמו נכשל סגור כשאין Document API,
          ולכן הכפתור נשאר לחיץ והפתיחה מסבירה. `@pointerdown.prevent` מונע
          גזילת המיקוד מהעורך — הבחירה חייבת לשרוד עד פתיחת הדיאלוג.
        -->
        <RibbonButton
          icon="pilcrow"
          variant="icon-only"
          tooltip="תפריט פסקה: כניסות, ריווח ועצירות טאב"
          :disabled="paraInFlight"
          @click="onOpenParagraph"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 4: סגנונות -->
    <RibbonGroup
      title="סגנונות"
      class="styles-group"
    >
      <!-- `disabled` ולא רק `current-style`: בלי בחירה במסמך הפקודה
           `linked-style` נכשלת, וגלריה שנראית פעילה מזמינה לחיצה שלא תעשה
           כלום. הדיווח על הכשל עצמו הוא של `useCommand().run()`. -->
      <StyleGallery
        :current-style="String(styleCmd.value.value || 'Normal')"
        :disabled="!styleCmd.enabled.value"
        @select-style="onApplyStyle"
      />
    </RibbonGroup>

    <!-- קבוצה 5: עריכה -->
    <RibbonGroup title="עריכה">
      <div class="column-items">
        <RibbonButton
          icon="search"
          label="חפש"
          variant="small"
          tooltip="חיפוש טקסט במסמך"
          shortcut-id="find"
          @click="$emit('open-find')"
        />
        <RibbonButton
          icon="replace"
          label="החלפה"
          variant="small"
          tooltip="החלפת טקסט במסמך"
          shortcut-id="replace"
          @click="$emit('open-replace')"
        />
        <!--
          בלי `shortcut`: Ctrl+A במסמך הוא התנהגות מקורית של משטח העריכה של
          הדפדפן, ואין במנוע פקודת select-all שתרחיב אותה לכל המסמך בפריסה
          מרובת עמודים. קיצור שמוצג ואינו עושה את מה שהכפתור עושה הוא שקר קטן.
        -->
        <RibbonButton
          icon="select"
          label="בחר הכל"
          shortcut-id="select-all"
          variant="small"
          :tooltip="selectAllTooltip"
          :disabled="!canSelectAll"
          @click="doSelectAll"
        />
      </div>
    </RibbonGroup>

    <ParagraphDialog
      :is-open="paragraphOpen"
      :busy="paraInFlight"
      :tabs-enabled="tabsEnabled"
      :snapshot="paraSnapshot"
      @close="paragraphOpen = false"
      @submit="onParagraphSubmit"
      @tab-add="onParagraphTabAdd"
      @tab-remove="onParagraphTabRemove"
      @tabs-clear="onParagraphTabsClear"
    />

    <FontAdvancedDialog
      :is-open="fontAdvOpen"
      :busy="fontAdvInFlight"
      @close="fontAdvOpen = false"
      @submit="onFontAdvancedSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, shallowRef, watch, type Ref } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import RibbonSelect, { type SelectOption } from '../common/RibbonSelect.vue';
import ColorPickerPopover from '../common/ColorPickerPopover.vue';
import StyleGallery from '../common/StyleGallery.vue';
import { useCommand } from '../../../composables/useCommand';
import { useFontOptions } from '../../../composables/useFontOptions';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import type { CommandOutcome } from '../../../engine/command-adapter';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { readDocCapabilities, type DocCapabilityReport } from '../../../engine/doc-capabilities';
import {
  copySelection,
  cutSelection,
  pasteFromClipboard,
  selectWholeDocument,
} from '../../../engine/clipboard';
import {
  readVertAlignSupport,
  toggleVertAlign,
  type VertAlignKind,
  type VertAlignSupport,
} from '../../../engine/vert-align';
import ParagraphDialog from '../../panels/ParagraphDialog.vue';
import FontAdvancedDialog from '../../panels/FontAdvancedDialog.vue';
import {
  TWIPS_PER_CM,
  TWIPS_PER_PT,
  addParagraphTabStop,
  applyParagraphIndentation,
  applyParagraphKeepOptions,
  applyParagraphSpacing,
  clearAllParagraphTabStops,
  emptyParagraphFormat,
  readParagraphFormat,
  removeParagraphTabStop,
  type TabStop,
} from '../../../engine/paragraph-format';
import {
  applyFontAdvanced,
  type FontAdvancedPatch,
} from '../../../engine/font-advanced';
import {
  NUMBER_STYLE_LABELS,
  continuePreviousList,
  convertListToText,
  restartListAt,
  setListNumberStyle,
} from '../../../engine/lists';
import {
  DEFAULT_FONT_SIZE_PT,
  DEFAULT_LINE_HEIGHT,
  alignmentPayload,
  colorPayload,
  fontFamilyPayload,
  fontSizePayload,
  grownFontSize,
  lineHeightPayload,
  parseColor,
  parseFontFamily,
  parseFontSizePt,
  parseLineHeight,
  shrunkFontSize,
  stylePayload,
  type ParagraphAlignment,
} from '../../../engine/payloads';

defineEmits<{
  (e: 'open-find'): void;
  (e: 'open-replace'): void;
}>();

const SPACING_OPTIONS: SelectOption[] = [
  { value: '1.0', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2.0', label: '2.0' },
  { value: '2.5', label: '2.5' },
  { value: '3.0', label: '3.0' },
];

/**
 * מה שהבורר מציג לפני שהמנוע דיווח על גופן. Assistant הוא הגופן הארוז, כלומר
 * היחיד שבטוח קיים בכל פלטפורמה.
 */
const DEFAULT_FONT_FAMILY = 'Assistant';

// פקודות SuperDoc
const boldCmd = useCommand('bold');
const italicCmd = useCommand('italic');
const underlineCmd = useCommand('underline');
const strikeCmd = useCommand('strikethrough');
const clearFormatCmd = useCommand('clear-formatting');
const formatPainterCmd = useCommand('copy-format');

const fontFamilyCmd = useCommand('font-family');
const fontSizeCmd = useCommand('font-size');
const fontColorCmd = useCommand('text-color');
const highlightCmd = useCommand('highlight-color');

const bulletCmd = useCommand('bullet-list');
const numberedCmd = useCommand('numbered-list');
const indentIncCmd = useCommand('indent-increase');
const indentDecCmd = useCommand('indent-decrease');
const dirRtlCmd = useCommand('direction-rtl');
const dirLtrCmd = useCommand('direction-ltr');
const marksCmd = useCommand('formatting-marks');
const alignCmd = useCommand('text-align');
const lineSpacingCmd = useCommand('line-height');
const styleCmd = useCommand('linked-style');

/**
 * אפשרויות הגופן מהמנוע (`ui.fonts`), ממוזגות עם שלנו. ראו
 * engine/font-options.ts — הרשימה הקשיחה שהייתה כאן לא ידעה מה יש במסמך.
 */
const { families: fontFamilyOptions, sizes: fontSizeOptions } = useFontOptions();

/* ------------------------------------------------------------------ */
/* מה שהמנוע מדווח על הבחירה                                            */
/* ------------------------------------------------------------------ */

/**
 * `CommandState.value` הוא המקור לערך שהבורר מציג — לא ref מקומי. עד עכשיו
 * שלושת הבוררים היו refs שאותחלו לערך קשיח ולעולם לא התעדכנו: לחיצה על טקסט
 * ב-20pt השאירה „12” בתיבה, ו-`growFontSize` חישב מהמספר השגוי הזה.
 */
const engineFamily = computed(() => parseFontFamily(fontFamilyCmd.value.value));
const engineSize = computed(() => parseFontSizePt(fontSizeCmd.value.value));
const engineLineHeight = computed(() => parseLineHeight(lineSpacingCmd.value.value));
const engineTextColor = computed(() => parseColor(fontColorCmd.value.value));
const engineHighlight = computed(() => parseColor(highlightCmd.value.value));

/**
 * מה שהמנוע דיווח לאחרונה.
 *
 * למה בכלל נדרש זיכרון כזה: המנוע מדווח `undefined` בשני מצבים שונים — בחירה
 * עם יותר מערך אחד, ורגע שבו הוא עוד לא פתר את הבחירה. הבורר הוא **פקד**, ולא
 * דוח; לרוקן אותו בכל תנועת סמן היה גרוע יותר מלהציג את הערך האחרון שכן ידענו.
 */
const lastFamily = ref(DEFAULT_FONT_FAMILY);
const lastSize = ref(DEFAULT_FONT_SIZE_PT);
const lastLineHeight = ref(DEFAULT_LINE_HEIGHT);

/**
 * מה שהמשתמש בחר וטרם קיבל תשובה מהמנוע. `null` = אין בקשה באוויר.
 *
 * למה שכבה נפרדת ולא כתיבה לזיכרון שלמעלה, וזה **הבאג שהיה כאן**: הזיכרון
 * נכתב לפני `run()` ולא הוחזר בכשל, ולכן הבורר הציג גופן שלא הוחל על שום דבר —
 * אותה תקלה בדיוק שתוקנה בזום, שבה הסרגל הזיז את התווית ורוחב העמוד לא זז.
 * מסוכן ממנה היה „הגדל גופן”, שמחשב מהערך הזה: שלוש לחיצות על מסמך שדוחה שלחו
 * 14, 16, 18 — הפקד התרחק מהמסמך בכל לחיצה.
 *
 * ההפרדה גם מה שמתקן את המקרה הקשה יותר, שבו למנוע **יש** ערך: כתיבה לזיכרון
 * לא שינתה שם את הערך המוצג בכלל (המנוע גובר עליו), ולכן לא היה רינדור חוזר —
 * ו-Vue מסנכרן `<select :value>` רק כשהערך הקשור משתנה. כלומר הבחירה שנדחתה
 * נשארה על המסך עד לרינדור חוזר מסיבה אחרת לגמרי. עם שכבת ה-`pending` הערך
 * המוצג משתנה בשני הכיוונים, והסנכרון נקשר לתשובה עצמה.
 */
const pendingFamily = ref<string | null>(null);
const pendingSize = ref<number | null>(null);
const pendingLineHeight = ref<number | null>(null);

watch(engineFamily, (value) => {
  if (value) lastFamily.value = value;
});
watch(engineSize, (value) => {
  if (value) lastSize.value = value;
});
watch(engineLineHeight, (value) => {
  if (value) lastLineHeight.value = value;
});

/**
 * סדר העדיפויות: מה שנבחר וטרם נענה, אחר כך מה שהמנוע מדווח, ולבסוף האחרון
 * שידענו. בקשה שנדחתה נעלמת מהשכבה הראשונה, ואז המסמך חוזר להיות מה שמוצג.
 */
const selectedFontFamily = computed(
  () => pendingFamily.value ?? engineFamily.value ?? lastFamily.value,
);
const currentSize = computed(() => pendingSize.value ?? engineSize.value ?? lastSize.value);
const currentLineHeight = computed(
  () => pendingLineHeight.value ?? engineLineHeight.value ?? lastLineHeight.value,
);

/** „12” ולא „12.0”, אבל „20.5” נשמר — המנוע מדווח חצאי נקודות. */
const selectedFontSize = computed(() => String(currentSize.value));

/** „1.5” ולא „1.50”, כדי שהערך יתאים לאפשרות בבורר. */
const selectedLineSpacing = computed(() => currentLineHeight.value.toFixed(2).replace(/0$/, ''));

/** צבע הפקד תמיד משקף את המסמך; ברירת המחדל היא מה שהכפתור יחיל בלחיצה. */
const textColor = computed(() => engineTextColor.value ?? '');
const highlightColor = computed(() => engineHighlight.value ?? '');

/**
 * הערך הנוכחי חייב להיות אחת האפשרויות, אחרת `<select>` מציג את הראשונה
 * ומשקר. גופן או גודל שאינם ברשימה (מסמך שנכתב בגופן שהמנוע לא הציע, טקסט
 * ב-20.5pt) מתווספים בראשה — בדיוק מה ש-Word עושה.
 */
function withCurrent(
  options: readonly SelectOption[],
  current: string,
): readonly SelectOption[] {
  if (current === '' || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current, preview: current }, ...options];
}

const familySelectOptions = computed(() =>
  withCurrent(
    fontFamilyOptions.value.map((option) => ({
      value: option.value,
      label: option.label,
      preview: option.previewFamily,
    })),
    selectedFontFamily.value,
  ),
);

const sizeSelectOptions = computed(() =>
  withCurrent(
    fontSizeOptions.value.map((option) => ({ value: option.value, label: option.label })),
    selectedFontSize.value,
  ),
);

const spacingSelectOptions = computed(() =>
  withCurrent(SPACING_OPTIONS, selectedLineSpacing.value),
);

/* ------------------------------------------------------------------ */
/* הפעלה                                                              */
/* ------------------------------------------------------------------ */

// כל ה-payloads נבנים ב-engine/payloads.ts, ולא כליטרל כאן: מה שנשלח לפקודה
// הוא חוזה מול ולידטור בתוך המנוע, והוולידטור נכשל **סגור**. ראו את הטבלה
// שם, ואת בדיקת החוזה ב-tests/contract/command-payloads.test.ts.
/**
 * שולחת את הבחירה ומחזיקה אותה על המסך עד לתשובה: בהצלחה היא נשמרת כ„אחרון
 * שידענו”, ובכשל היא נעלמת — כלומר מה שלא קרה במסמך אינו מוצג.
 *
 * למה אופטימי ולא „להמתין לתשובה”: הבורר חייב להגיב מיד, והמנוע אינו מדווח
 * ערך בכלל על בחירה מעורבת — תיבה שממתינה לו הייתה נראית קפואה גם בהצלחה
 * מלאה.
 *
 * הבדיקה `pending.value !== next` לפני העדכון: אם המשתמש בחר שוב בזמן
 * ההמתנה, הבקשה שבאוויר אינה שלנו יותר, ותשובה מאוחרת אינה אמורה למחוק בחירה
 * טרייה.
 */
async function applyOptimistically<T>(
  pending: Ref<T | null>,
  memo: Ref<T>,
  next: T,
  run: () => Promise<CommandOutcome>,
): Promise<void> {
  pending.value = next;
  const outcome = await run();
  if (pending.value !== next) return;
  if (outcome.ok) memo.value = next;
  pending.value = null;
}

function onFontFamilyChange(font: string): void {
  const payload = fontFamilyPayload(font);
  if (payload === null) return;
  void applyOptimistically(pendingFamily, lastFamily, payload, () => fontFamilyCmd.run(payload));
}

function applyFontSize(pt: number): void {
  const payload = fontSizePayload(pt);
  if (payload === null) return;
  void applyOptimistically(pendingSize, lastSize, payload, () => fontSizeCmd.run(payload));
}

function onFontSizeChange(size: string): void {
  const pt = parseFontSizePt(size);
  if (pt !== null) applyFontSize(pt);
}

/** הגדל/הקטן עובדים על **הערך מהמנוע**, על סולם הגדלים של Word. */
function growFontSize(): void {
  applyFontSize(grownFontSize(currentSize.value));
}

function shrinkFontSize(): void {
  applyFontSize(shrunkFontSize(currentSize.value));
}

function onTextColorChange(color: string | null): void {
  void fontColorCmd.run(colorPayload(color));
}

function onHighlightChange(color: string | null): void {
  void highlightCmd.run(colorPayload(color));
}

function onLineSpacingChange(val: string): void {
  const multiplier = parseLineHeight(val);
  if (multiplier === null) return;
  const payload = lineHeightPayload(multiplier);
  if (payload === null) return;
  void applyOptimistically(pendingLineHeight, lastLineHeight, multiplier, () =>
    lineSpacingCmd.run(payload),
  );
}

function onAlign(alignment: ParagraphAlignment): void {
  void alignCmd.run(alignmentPayload(alignment));
}

function onApplyStyle(styleId: string): void {
  const payload = stylePayload(styleId);
  if (payload === null) return;
  void styleCmd.run(payload);
}

/* ------------------------------------------------------------------ */
/* לוח                                                                */
/* ------------------------------------------------------------------ */

/**
 * פעולות הלוח אינן פקודות ב-registry של ה-controller — אין להן מזהה בקטלוג —
 * ולכן הן עוברות ב-Document API דרך engine/clipboard.ts, ומדווחות ידנית. ראו
 * ReferencesTab: אותו דפוס בדיוק, כולל קריאת היכולות בכל החלפת מסמך.
 */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

const capabilities = shallowRef<DocCapabilityReport | null>(null);

/** קריאת היכולות א-סינכרונית, ותשובה של מסמך קודם לא תדרוס את הנוכחי. */
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

const canCopy = computed(() => capabilities.value?.can('canCopySelection') ?? false);

/** „גזור” הוא סדרוּר **ומחיקה**. מנוע שיודע רק להעתיק משאיר „העתק” פעיל. */
const canCut = computed(
  () => canCopy.value && (capabilities.value?.can('canDeleteSelection') ?? false),
);

const canPaste = computed(() => capabilities.value?.can('canPasteContent') ?? false);

/**
 * „בחר הכל” עובר ב-`ranges.resolve` (גבולות גוף המסמך) ואז ב-
 * `ui.selection.apply`. רק הראשון נשאל ביכולות — לשני אין מזהה פעולה בקטלוג,
 * והוא נכשל סגור עם `reason` משלו.
 */
const canSelectAll = computed(() => capabilities.value?.can('canResolveRange') ?? false);

type ClipboardQuestion =
  | 'canCopySelection'
  | 'canDeleteSelection'
  | 'canPasteContent'
  | 'canResolveRange';

function tooltipFor(enabled: boolean, question: ClipboardQuestion, text: string): string {
  if (enabled) return text;
  return capabilities.value?.explain(question) || 'המסמך עדיין נטען';
}

const copyTooltip = computed(() =>
  tooltipFor(canCopy.value, 'canCopySelection', 'העתקת הבחירה ללוח'),
);
const cutTooltip = computed(() =>
  tooltipFor(
    canCut.value,
    canCopy.value ? 'canDeleteSelection' : 'canCopySelection',
    'גזירת הבחירה ללוח',
  ),
);
const pasteTooltip = computed(() =>
  tooltipFor(canPaste.value, 'canPasteContent', 'הדבקת תוכן מהלוח'),
);
const selectAllTooltip = computed(() =>
  tooltipFor(canSelectAll.value, 'canResolveRange', 'בחירת כל הטקסט במסמך'),
);

async function doCopy(): Promise<void> {
  report(await copySelection(superdoc.value), 'clipboard-copy');
}

async function doCut(): Promise<void> {
  report(await cutSelection(superdoc.value), 'clipboard-cut');
}

async function doPaste(): Promise<void> {
  report(await pasteFromClipboard(superdoc.value), 'clipboard-paste');
}

async function doSelectAll(): Promise<void> {
  report(await selectWholeDocument(superdoc.value), 'select-all');
}

/* ------------------------------------------------------------------ */
/* כתב עליון וכתב תחתי                                                 */
/* ------------------------------------------------------------------ */

/**
 * שני הפקדים היו `:disabled="true"` קשיח עם tooltip שהאשים את המנוע („אינו
 * נתמך במנוע הנוכחי”). הטענה לא הייתה נכונה: `format.vertAlign` הוא פעולה
 * ציבורית בקטלוג, ומה שחסר היה פקודה ברצועה. הם עוברים מעכשיו ב-Document API,
 * בדיוק כמו פעולות הלוח שמעל — ההסבר המלא, כולל למה אין כאן חיווי „דלוק”,
 * ב-engine/vert-align.ts.
 *
 * זמינות נפרדת מזו של הלוח: היא נשענת גם על נוכחות `doc.format.vertAlign`
 * בפאסדה ולא רק על מפת היכולות, וזו בדיקה שהדוח הכללי אינו עושה.
 */
const vertAlign = shallowRef<VertAlignSupport>({ available: false, explanation: 'המסמך עדיין נטען' });

/** ראו למעלה: תשובה של מסמך קודם לא תדרוס את הנוכחי. */
let vertAlignGeneration = 0;

watch(
  superdoc,
  async (host) => {
    const mine = ++vertAlignGeneration;
    vertAlign.value = { available: false, explanation: 'המסמך עדיין נטען' };
    const support = await readVertAlignSupport(host);
    if (mine === vertAlignGeneration) vertAlign.value = support;
  },
  { immediate: true }
);

const canSetVertAlign = computed(() => vertAlign.value.available);

const VERT_ALIGN_TEXT: Record<VertAlignKind, string> = {
  // התווית אומרת בדיוק מה הלחיצה עושה: היא מחילה על **הטקסט המסומן**, והיא
  // מכבה בלחיצה שנייה. שני הדברים הם ההתנהגות שנמדדה, ולא הבטחה.
  superscript: 'הרמת הטקסט המסומן לכתב עליון; לחיצה נוספת מחזירה אותו לשורה',
  subscript: 'הנמכת הטקסט המסומן לכתב תחתי; לחיצה נוספת מחזירה אותו לשורה',
};

function vertAlignTooltip(kind: VertAlignKind): string {
  if (canSetVertAlign.value) return VERT_ALIGN_TEXT[kind];
  return vertAlign.value.explanation || 'המסמך עדיין נטען';
}

async function onVertAlign(kind: VertAlignKind): Promise<void> {
  report(await toggleVertAlign(superdoc.value, kind), `vert-align-${kind}`);
}

/* ------------------------------------------------------------------ */
/* תפריט פסקה                                                          */
/* ------------------------------------------------------------------ */

/**
 * דיאלוג „פסקה” — כניסות, ריווח, אפשרויות שמירה וטאבים, דרך
 * `doc.format.paragraph.*` (engine/paragraph-format.ts). אין לזה פקודה בקטלוג,
 * ולכן המסלול הוא Document API — אותו דפוס של פעולות הלוח מעל.
 *
 * `paraInFlight` הוא TOCTOU-lock ולא נוחות: הדיאלוג נפתח על **תצלום** מצב
 * הפסקה (`readParagraphFormat`), ושלושת סעיפי „אישור” כותבים מצב מלא. פעולה
 * שנייה שתיקלט בזמן שהראשונה באוויר הייתה כותבת על תצלום מיושן.
 */
const paragraphOpen = shallowRef(false);
const paraInFlight = shallowRef(false);
/** יעד הפסקה שהתצלום נלקח ממנו; כל פעולת „אישור” חוזרת אליו. */
let paraTarget: unknown = null;
const paraSnapshot = shallowRef(emptyParagraphFormat());

const tabsEnabled = computed(() => capabilities.value?.can('canManageParagraphTabs') ?? false);

async function runParagraph(action: () => Promise<void>): Promise<void> {
  if (paraInFlight.value) return;
  paraInFlight.value = true;
  try {
    await action();
  } finally {
    paraInFlight.value = false;
  }
}

/**
 * קוראת את מצב הפסקה ואז פותחת — בדיוק `openWithState` של LayoutTab:
 * דיאלוג שנפתח ריק וממלא את עצמו כעבור tick הוא דיאלוג שהמשתמש עשוי לאשר
 * לפני שהוא מלא. כשל קריאה מסביר ולא פותח דיאלוג על ערכים ריקים.
 */
async function onOpenParagraph(): Promise<void> {
  if (paraInFlight.value) return;
  paraInFlight.value = true;
  try {
    const result = await readParagraphFormat(superdoc.value);
    if (!result.ok) {
      report(result.outcome, 'paragraph-open');
      return;
    }
    paraTarget = result.target;
    paraSnapshot.value = result.snapshot;
    paragraphOpen.value = true;
  } finally {
    paraInFlight.value = false;
  }
}

function onParagraphSubmit(payload: {
  leftCm: number;
  rightCm: number;
  special: 'none' | 'firstLine' | 'hanging';
  amountCm: number;
  beforePt: number;
  afterPt: number;
  lineTwips: number;
  lineRule: 'auto' | 'exact' | 'atLeast';
  keepNext: boolean;
  keepLines: boolean;
  widowControl: boolean;
}): void {
  paragraphOpen.value = false;
  const target = paraTarget;
  // המרת היחידות כאן ולא בדיאלוג: engine/paragraph-format.ts הוא המקום היחיד
  // שמכיר את שתי המערכות (cm/pt אצל המשתמש, twips ב-API).
  const indentation = {
    leftTwips: Math.round(payload.leftCm * TWIPS_PER_CM),
    rightTwips: Math.round(payload.rightCm * TWIPS_PER_CM),
    special: payload.special,
    amountTwips: Math.round(payload.amountCm * TWIPS_PER_CM),
  };
  const spacing = {
    beforeTwips: Math.round(payload.beforePt * TWIPS_PER_PT),
    afterTwips: Math.round(payload.afterPt * TWIPS_PER_PT),
    lineTwips: payload.lineTwips,
    rule: payload.lineRule,
  };
  const keep = {
    keepNext: payload.keepNext,
    keepLines: payload.keepLines,
    widowControl: payload.widowControl,
  };
  void runParagraph(async () => {
    // שלוש פעולות על אותו pPr; כשל אחד אינו מבטל את האחרים, וכל אחת מדווחת
    // בפני עצמה — NO_OP כבר מטופל בתוך המודול.
    const outcomes = [
      await applyParagraphIndentation(superdoc.value, target, indentation),
      await applyParagraphSpacing(superdoc.value, target, spacing),
      await applyParagraphKeepOptions(superdoc.value, target, keep),
    ];
    for (const [index, outcome] of outcomes.entries()) {
      if (!outcome.ok) {
        report(outcome, ['paragraph-indent', 'paragraph-spacing', 'paragraph-keep'][index]);
        return;
      }
    }
    report({ ok: true }, 'paragraph-format');
  });
}

function onParagraphTabAdd(tab: {
  positionTwips: number;
  alignment: 'left' | 'center' | 'right' | 'decimal' | 'bar';
  leader?: string;
}): void {
  void runParagraph(async () => {
    // ה-leader מגיע מה-select של הדיאלוג עם ערכי ה-union בלבד; ההיצמדות
    // ל-union נבדקת שוב בתוך המודול.
    const outcome = await addParagraphTabStop(superdoc.value, paraTarget, tab as TabStop);
    report(outcome, 'paragraph-tab-add');
  });
}

function onParagraphTabRemove(payload: { positionTwips: number }): void {
  void runParagraph(async () => {
    const outcome = await removeParagraphTabStop(superdoc.value, paraTarget, payload.positionTwips);
    report(outcome, 'paragraph-tab-remove');
  });
}

function onParagraphTabsClear(): void {
  void runParagraph(async () => {
    const outcome = await clearAllParagraphTabStops(superdoc.value, paraTarget);
    report(outcome, 'paragraph-tabs-clear');
  });
}

/* ------------------------------------------------------------------ */
/* גופן מתקדם                                                          */
/* ------------------------------------------------------------------ */

/**
 * דיאלוג „גופן מתקדם" — קריאה אחת ל-`format.apply` (engine/font-advanced.ts).
 * אין לו פקודה ב-registry, ולכן המסלול הוא Document API — כמו פעולות הלוח
 * ותפריט הפסקה מעל.
 */
const fontAdvOpen = shallowRef(false);
const fontAdvInFlight = shallowRef(false);

function onOpenFontAdvanced(): void {
  // אין קריאת מצב לפני הפתיחה: format.apply הוא patch לפי מפתח, ואין
  // קריאה ציבורית של עיצוב ריצות בבחירה (ראו vert-align.ts). הדיאלוג
  // נפתח על „ללא שינוי" ושולח רק מה שהמשתמש מילא.
  if (fontAdvInFlight.value) return;
  fontAdvOpen.value = true;
}

function onFontAdvancedSubmit(patch: FontAdvancedPatch): void {
  fontAdvOpen.value = false;
  if (fontAdvInFlight.value) return;
  fontAdvInFlight.value = true;
  void (async () => {
    try {
      report(await applyFontAdvanced(superdoc.value, patch), 'font-advanced');
    } finally {
      fontAdvInFlight.value = false;
    }
  })();
}

/* ------------------------------------------------------------------ */
/* רשימה (גל 14א)                                                      */
/* ------------------------------------------------------------------ */

/**
 * פעולות רשימה שאין להן פקודה בקטלוג: המספור העברי (hebrew1 — נמדד),
 * התחלה מחדש, המשך מספור קודם, והמרה לטקסט. `listsInFlight` הוא נעילת
 * TOCTOU: `canContinuePrevious` בוליאני ואין לסמוך עליו בין קריאות.
 */
const listsInFlight = shallowRef(false);

/** אישור דו-לחיצה ל„המר לטקסט" — בלתי-הפיך (נמדד: הסמן מועתק לטקסט). */
const convertArmed = shallowRef(false);

const listsAvailable = computed(() => capabilities.value?.can('canManageLists') ?? false);

const listMenuItems = computed(() => [
  ...Object.entries(NUMBER_STYLE_LABELS).map(([id, label]) => ({ id: `style:${id}`, label })),
  { id: 'restart', label: 'התחל מחדש מ-1' },
  { id: 'continue', label: 'המשך מספור קודם' },
  {
    id: 'convert',
    label: convertArmed.value ? 'לחץ שוב לאישור — הפעולה בלתי-הפיכה' : 'המר לטקסט…',
  },
]);

const listsTooltip = computed(() => {
  if (!listsAvailable.value) return capabilities.value?.explain('canManageLists') || 'המסמך עדיין נטען';
  return 'פעולות רשימה: סגנון מספור (כולל עברי), התחלה מחדש והמרה לטקסט';
});

async function runList(action: () => Promise<CommandOutcome>): Promise<void> {
  if (listsInFlight.value) return;
  listsInFlight.value = true;
  try {
    report(await action(), 'lists');
  } finally {
    listsInFlight.value = false;
  }
}

function onListMenuSelect(id: string): void {
  if (id.startsWith('style:')) {
    const style = id.slice('style:'.length);
    void runList(() => setListNumberStyle(superdoc.value, style));
    return;
  }

  if (id === 'restart') {
    void runList(() => restartListAt(superdoc.value, 1));
    return;
  }

  if (id === 'continue') {
    void runList(() => continuePreviousList(superdoc.value));
    return;
  }

  if (id === 'convert') {
    // אישור דו-לחיצה: הפעולה בלתי-הפיכה (נמדד). לחיצה ראשונה חומשת,
    // שנייה מבצעת; מעבר בין פתיחות התפריט מנטרל את החימוש.
    if (!convertArmed.value) {
      convertArmed.value = true;
      return;
    }
    convertArmed.value = false;
    void runList(() => convertListToText(superdoc.value));
  }
}
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
  width: 100%;
}

.column-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}
</style>
