<template>
  <div class="ribbon-tab-pane view-tab">
    <!-- תצוגות -->
    <RibbonGroup title="תצוגות">
      <RibbonButton
        icon="focusMode"
        label="מצב מיקוד"
        shortcut-id="focus-mode"
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
        :disabled="!zoomCmd.enabled.value"
        @click="runFitPageWidth()"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import { inject, shallowRef } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { editorStackWidth, fitWidthPercent } from '../../../engine/fit-width';
import { FALLBACK_ZOOM } from '../../../engine/zoom';
import { zoomPayload } from '../../../engine/payloads';

defineEmits<{
  (e: 'toggle-focus-mode'): void;
}>();

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const zoomCmd = useCommand('zoom');
const rulerCmd = useCommand('ruler');
const marksCmd = useCommand('formatting-marks');
const activeSuperdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

/**
 * „רוחב עמוד”.
 *
 * מזהה ה-`zoom-fit-width` של המנוע אינו בשימוש בכוונה — ההתאמה הפנימית שלו
 * נמדדה בלולאת משוב שמתכווצת לרצפה; החישוב והנימוק המלאים ב-engine/fit-width.ts.
 * הפעולה עצמה נשארת במסלול היחיד של כתיבה: פקודת `zoom` דרך האדפטר, כולל
 * הדיווח שלה.
 */
async function runFitPageWidth(): Promise<void> {
  const host = activeSuperdoc.value;

  if (!host) {
    report({ ok: false, message: 'אין מסמך פתוח', reason: 'not-ready' }, 'zoom');
    return;
  }

  // הגבולות מהמנוע ולא מקודדים — אותו מקור של הסליידר בשורת המצב.
  const state =
    typeof (host as { getZoomState?: () => { min?: unknown; max?: unknown } }).getZoomState ===
    'function'
      ? (host as { getZoomState: () => { min?: unknown; max?: unknown } }).getZoomState()
      : null;
  const bounds = {
    min:
      typeof state?.min === 'number' && Number.isFinite(state.min)
        ? state.min
        : FALLBACK_ZOOM.min,
    max:
      typeof state?.max === 'number' && Number.isFinite(state.max)
        ? state.max
        : FALLBACK_ZOOM.max,
  };

  const percent = await fitWidthPercent(host, editorStackWidth(), bounds);
  if (percent === null) {
    report(
      { ok: false, message: 'לא ניתן למדוד את רוחב העמוד — נסו שוב לאחר שהמסמך נטען', reason: 'geometry-unavailable' },
      'zoom',
    );
    return;
  }

  await zoomCmd.run(zoomPayload(percent));
}
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
