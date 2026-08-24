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
        shortcut="Ctrl+Enter"
        @click="insertPageBreak"
      />
    </RibbonGroup>

    <!-- קבוצה 2: טבלאות -->
    <RibbonGroup
      title="טבלאות"
      :launcher="false"
    >
      <TablePicker @select="onInsertTable" />
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
        tooltip="הוספת תמונה מקובץ"
        @click="imageCmd.run()"
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
        tooltip="הוספת היפר-קישור"
        shortcut="Ctrl+K"
        @click="linkCmd.run()"
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
        @click="tocCmd.run()"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import TablePicker from '../common/TablePicker.vue';
import { useCommand } from '../../../composables/useCommand';

const tableCmd = useCommand('table-insert');
const imageCmd = useCommand('image');
const linkCmd = useCommand('link');
const tocCmd = useCommand('table-of-contents-insert');

function onInsertTable(dimensions: { rows: number; cols: number }): void {
  void tableCmd.run({ rows: dimensions.rows, cols: dimensions.cols });
}

function insertPageBreak(): void {
  document.execCommand('insertParagraph');
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
