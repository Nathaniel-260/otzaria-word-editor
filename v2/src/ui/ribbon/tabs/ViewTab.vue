<template>
  <div class="ribbon-tab-pane view-tab">
    <!-- תצוגות -->
    <RibbonGroup
      title="תצוגות"
      :launcher="false"
    >
      <RibbonButton
        icon="focusMode"
        label="מצב מיקוד"
        variant="large"
        tooltip="מצב קריאה ומיקוד ללא הסחות דעת"
        @click="$emit('toggle-focus-mode')"
      />
    </RibbonGroup>

    <!-- הצג -->
    <RibbonGroup
      title="הצג"
      :launcher="false"
    >
      <div class="column-items">
        <RibbonButton
          icon="ruler"
          label="סרגל"
          variant="small"
          tooltip="הצג או הסתר את סרגל המידות"
          :active="rulerCmd.active.value"
          @click="rulerCmd.run()"
        />
        <RibbonButton
          icon="pilcrow"
          label="סימני עיצוב"
          variant="small"
          tooltip="הצג סימני פסקאות ותווים נסתרים"
          :active="marksCmd.active.value"
          @click="marksCmd.run()"
        />
      </div>
    </RibbonGroup>

    <!-- זום -->
    <RibbonGroup
      title="שינוי גודל תצוגה"
      :launcher="false"
    >
      <RibbonButton
        icon="zoom"
        label="100%"
        variant="large"
        tooltip="הצג את המסמך בגודל 100%"
        @click="zoomCmd.run({ zoom: 1 })"
      />
      <RibbonButton
        icon="fitWidth"
        label="רוחב עמוד"
        variant="large"
        tooltip="התאם את תצוגת העמוד לרוחב החלון"
        @click="fitWidthCmd.run()"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';

defineEmits<{
  (e: 'toggle-focus-mode'): void;
}>();

const rulerCmd = useCommand('ruler');
const marksCmd = useCommand('formatting-marks');
const zoomCmd = useCommand('zoom');
const fitWidthCmd = useCommand('zoom-fit-width');
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
