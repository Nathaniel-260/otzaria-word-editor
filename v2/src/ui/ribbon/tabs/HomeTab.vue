<template>
  <div class="ribbon-tab-pane home-tab">
    <!-- קבוצה 1: לוח -->
    <RibbonGroup
      title="לוח"
      :launcher="true"
    >
      <RibbonButton
        icon="paste"
        label="הדבק"
        variant="large"
        tooltip="הדבק תוכן מלוח הגזירים"
        shortcut="Ctrl+V"
        @click="doPaste"
      />
      <div class="column-items">
        <RibbonButton
          icon="cut"
          label="גזור"
          variant="small"
          tooltip="גזור"
          shortcut="Ctrl+X"
          @click="doCut"
        />
        <RibbonButton
          icon="copy"
          label="העתק"
          variant="small"
          tooltip="העתק"
          shortcut="Ctrl+C"
          @click="doCopy"
        />
        <RibbonButton
          icon="formatPainter"
          label="מברשת עיצוב"
          variant="small"
          tooltip="העתק עיצוב ממקום אחד והחל במקום אחר"
          :active="formatPainterCmd.active.value"
          @click="formatPainterCmd.run()"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 2: גופן -->
    <RibbonGroup
      title="גופן"
      :column-flow="true"
      :launcher="true"
    >
      <!-- שורה עליונה: גופן, גודל, הגדל/הקטן, נקה -->
      <div class="word-group-row">
        <RibbonSelect
          v-model="selectedFontFamily"
          :options="FONT_FAMILIES"
          width="130px"
          title="גופן"
          @update:model-value="onFontFamilyChange"
        />
        <RibbonSelect
          v-model="selectedFontSize"
          :options="FONT_SIZES"
          width="50px"
          title="גודל גופן"
          @update:model-value="onFontSizeChange"
        />
        <RibbonButton
          icon="growFont"
          variant="icon-only"
          tooltip="הגדל גופן"
          shortcut="Ctrl+]"
          @click="growFontSize"
        />
        <RibbonButton
          icon="shrinkFont"
          variant="icon-only"
          tooltip="הקטן גופן"
          shortcut="Ctrl+["
          @click="shrinkFontSize"
        />
        <RibbonButton
          icon="clearFormatting"
          variant="icon-only"
          tooltip="נקה את כל העיצוב"
          @click="clearFormatCmd.run()"
        />
      </div>

      <!-- שורה תחתונה: B, I, U, S, sub, super, highlight, color -->
      <div class="word-group-row">
        <RibbonButton
          icon="bold"
          variant="icon-only"
          tooltip="מודגש"
          shortcut="Ctrl+B"
          :active="boldCmd.active.value"
          :disabled="!boldCmd.enabled.value"
          @click="boldCmd.run()"
        />
        <RibbonButton
          icon="italic"
          variant="icon-only"
          tooltip="נטוי"
          shortcut="Ctrl+I"
          :active="italicCmd.active.value"
          :disabled="!italicCmd.enabled.value"
          @click="italicCmd.run()"
        />
        <RibbonButton
          icon="underline"
          variant="icon-only"
          tooltip="קו תחתון"
          shortcut="Ctrl+U"
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
          tooltip="כתב תחתי (אינו נתמך במנוע הנוכחי)"
          :disabled="true"
        />
        <RibbonButton
          icon="superscript"
          variant="icon-only"
          tooltip="כתב עליון (אינו נתמך במנוע הנוכחי)"
          :disabled="true"
        />

        <div class="word-separator" />

        <ColorPickerPopover
          v-model="highlightColor"
          icon="highlight"
          title="צבע סימון טקסט"
          default-color="#FFFF00"
          @change="onHighlightChange"
        />
        <ColorPickerPopover
          v-model="textColor"
          icon="fontColor"
          title="צבע גופן"
          default-color="#000000"
          @change="onTextColorChange"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 3: פיסקה -->
    <RibbonGroup
      title="פיסקה"
      :column-flow="true"
      :launcher="true"
    >
      <!-- שורה עליונה: תבליטים, מספור, הזחה, כיווניות, סימני עיצוב -->
      <div class="word-group-row">
        <RibbonButton
          icon="bulletList"
          variant="icon-only"
          tooltip="תבליטים"
          :active="bulletCmd.active.value"
          @click="bulletCmd.run()"
        />
        <RibbonButton
          icon="numberList"
          variant="icon-only"
          tooltip="מספור"
          :active="numberedCmd.active.value"
          @click="numberedCmd.run()"
        />
        <RibbonButton
          icon="indentDecrease"
          variant="icon-only"
          tooltip="הקטן הזחה"
          @click="indentDecCmd.run()"
        />
        <RibbonButton
          icon="indentIncrease"
          variant="icon-only"
          tooltip="הגדל הזחה"
          @click="indentIncCmd.run()"
        />

        <div class="word-separator" />

        <RibbonButton
          icon="dirRtl"
          variant="icon-only"
          tooltip="כיוון פסקה מימין לשמאל"
          :active="dirRtlCmd.active.value"
          @click="dirRtlCmd.run()"
        />
        <RibbonButton
          icon="dirLtr"
          variant="icon-only"
          tooltip="כיוון פסקה משמאל לימין"
          :active="dirLtrCmd.active.value"
          @click="dirLtrCmd.run()"
        />
        <RibbonButton
          icon="pilcrow"
          variant="icon-only"
          tooltip="הצג/הסתר סימני עיצוב"
          :active="marksCmd.active.value"
          @click="marksCmd.run()"
        />
      </div>

      <!-- שורה תחתונה: יישור ימין, מרכז, שמאל, מלא, מרווח שורות -->
      <div class="word-group-row">
        <RibbonButton
          icon="alignRight"
          variant="icon-only"
          tooltip="יישור לימין"
          shortcut="Ctrl+R"
          :active="alignCmd.value.value === 'right'"
          @click="alignCmd.run({ alignment: 'right' })"
        />
        <RibbonButton
          icon="alignCenter"
          variant="icon-only"
          tooltip="מרכז"
          shortcut="Ctrl+E"
          :active="alignCmd.value.value === 'center'"
          @click="alignCmd.run({ alignment: 'center' })"
        />
        <RibbonButton
          icon="alignLeft"
          variant="icon-only"
          tooltip="יישור לשמאל"
          shortcut="Ctrl+L"
          :active="alignCmd.value.value === 'left'"
          @click="alignCmd.run({ alignment: 'left' })"
        />
        <RibbonButton
          icon="alignJustify"
          variant="icon-only"
          tooltip="יישור לשני הצדדים"
          shortcut="Ctrl+J"
          :active="alignCmd.value.value === 'justify'"
          @click="alignCmd.run({ alignment: 'justify' })"
        />

        <div class="word-separator" />

        <RibbonSelect
          v-model="selectedLineSpacing"
          :options="SPACING_OPTIONS"
          width="48px"
          title="מרווח בין שורות"
          @update:model-value="onLineSpacingChange"
        />
      </div>
    </RibbonGroup>

    <!-- קבוצה 4: סגנונות -->
    <RibbonGroup
      title="סגנונות"
      class="styles-group"
      :launcher="true"
    >
      <StyleGallery
        :current-style="String(styleCmd.value.value || 'Normal')"
        @select-style="onApplyStyle"
      />
    </RibbonGroup>

    <!-- קבוצה 5: עריכה -->
    <RibbonGroup
      title="עריכה"
      :launcher="true"
    >
      <div class="column-items">
        <RibbonButton
          icon="search"
          label="חפש"
          variant="small"
          tooltip="חיפוש טקסט במסמך"
          shortcut="Ctrl+F"
          @click="$emit('open-find')"
        />
        <RibbonButton
          icon="replace"
          label="החלפה"
          variant="small"
          tooltip="החלפת טקסט במסמך"
          shortcut="Ctrl+H"
          @click="$emit('open-replace')"
        />
        <RibbonButton
          icon="select"
          label="בחר הכל"
          variant="small"
          tooltip="בחירת כל הטקסט במסמך"
          shortcut="Ctrl+A"
          @click="doSelectAll"
        />
      </div>
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import RibbonSelect, { type SelectOption } from '../common/RibbonSelect.vue';
import ColorPickerPopover from '../common/ColorPickerPopover.vue';
import StyleGallery from '../common/StyleGallery.vue';
import { useCommand } from '../../../composables/useCommand';

defineEmits<{
  (e: 'open-find'): void;
  (e: 'open-replace'): void;
}>();

// רשימות גופנים וגדלים
const FONT_FAMILIES: SelectOption[] = [
  // Assistant נארז עם התוסף (styles/fonts.ts) ולכן זמין בכל פלטפורמה; השאר
  // תלויים במה שמותקן במערכת או במה שאוצריא מזריקה.
  { value: 'Assistant', label: 'Assistant' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Aptos', label: 'Aptos' },
  { value: 'FrankRuhlCLM', label: 'Frank Ruhl' },
  { value: 'TaameyDavidCLM', label: 'David' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Rubik', label: 'Rubik' },
  { value: 'Shofar', label: 'Shofar' },
  { value: 'NotoRashiHebrew', label: 'Rashi' },
];

const FONT_SIZES: SelectOption[] = [
  '8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72'
].map(s => ({ value: s, label: s }));

const SPACING_OPTIONS: SelectOption[] = [
  { value: '1.0', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2.0', label: '2.0' },
  { value: '2.5', label: '2.5' },
  { value: '3.0', label: '3.0' },
];

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

const selectedFontFamily = ref('FrankRuhlCLM');
const selectedFontSize = ref('12');
const selectedLineSpacing = ref('1.5');
const textColor = ref('#000000');
const highlightColor = ref('');

function onFontFamilyChange(font: string): void {
  selectedFontFamily.value = font;
  void fontFamilyCmd.run({ fontFamily: font });
}

function onFontSizeChange(size: string): void {
  selectedFontSize.value = size;
  void fontSizeCmd.run({ fontSize: `${size}pt` });
}

function growFontSize(): void {
  const current = parseInt(selectedFontSize.value, 10) || 12;
  const next = current < 12 ? current + 1 : current < 28 ? current + 2 : current + 4;
  onFontSizeChange(String(next));
}

function shrinkFontSize(): void {
  const current = parseInt(selectedFontSize.value, 10) || 12;
  const next = current <= 12 ? Math.max(8, current - 1) : current <= 28 ? current - 2 : current - 4;
  onFontSizeChange(String(next));
}

function onTextColorChange(color: string): void {
  void fontColorCmd.run({ color });
}

function onHighlightChange(color: string): void {
  void highlightCmd.run({ color });
}

function onLineSpacingChange(val: string): void {
  selectedLineSpacing.value = val;
  void lineSpacingCmd.run({ lineHeight: parseFloat(val) });
}

function onApplyStyle(styleId: string): void {
  void styleCmd.run({ style: styleId });
}

function doPaste(): void {
  void navigator.clipboard?.readText?.();
}

function doCut(): void {
  // הפעולה נתמכת דרך קיצור מקלדת Ctrl+X
}

function doCopy(): void {
  // הפעולה נתמכת דרך קיצור מקלדת Ctrl+C
}

function doSelectAll(): void {
  window.getSelection()?.selectAllChildren(document.body);
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
