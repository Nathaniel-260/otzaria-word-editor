<template>
  <div class="ribbon-tab-pane view-tab">
    <!-- תצוגות -->
    <RibbonGroup title="תצוגות">
      <RibbonButton
        icon="focusMode"
        label="מצב מיקוד"
        variant="large"
        tooltip="מצב קריאה ומיקוד ללא הסחות דעת"
        @click="$emit('toggle-focus-mode')"
      />
    </RibbonGroup>

    <!-- הצג -->
    <RibbonGroup title="הצג">
      <div class="column-items">
        <RibbonButton
          icon="ruler"
          label="סרגל"
          variant="small"
          tooltip="הצג או הסתר את סרגל המידות"
          :active="rulerCmd.active.value"
          :disabled="!rulerCmd.enabled.value"
          @click="rulerCmd.run()"
        />
        <RibbonButton
          icon="pilcrow"
          label="סימני עיצוב"
          shortcut-id="formatting-marks"
          variant="small"
          tooltip="הצג סימני פסקאות ותווים נסתרים"
          :active="marksCmd.active.value"
          :disabled="!marksCmd.enabled.value"
          @click="marksCmd.run()"
        />
      </div>
    </RibbonGroup>

    <!-- זום -->
    <RibbonGroup title="שינוי גודל תצוגה">
      <!--
        `zoomPayload(100)` ולא `{ zoom: 1 }`: הזום הוא **אחוזים**, ואובייקט
        נדחה עוד לפני `SuperDoc.setZoom`. ראו engine/payloads.ts.
      -->
      <RibbonButton
        icon="zoom"
        label="100%"
        variant="large"
        tooltip="הצג את המסמך בגודל 100%"
        :disabled="!zoomCmd.enabled.value"
        @click="zoomCmd.run(zoomPayload(100))"
      />
      <RibbonButton
        icon="fitWidth"
        label="רוחב עמוד"
        variant="large"
        tooltip="התאם את תצוגת העמוד לרוחב החלון"
        :disabled="!fitWidthCmd.enabled.value"
        @click="fitWidthCmd.run()"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';
import { zoomPayload } from '../../../engine/payloads';

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
