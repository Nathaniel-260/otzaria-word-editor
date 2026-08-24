<template>
  <div class="ribbon-tab-pane references-tab">
    <RibbonGroup
      title="תוכן עניינים"
      :launcher="false"
    >
      <RibbonButton
        icon="toc"
        label="תוכן עניינים"
        variant="large"
        tooltip="הוספת תוכן עניינים למסמך"
        :disabled="!tocCmd.enabled.value"
        @click="tocCmd.run()"
      />
    </RibbonGroup>

    <RibbonGroup
      title="הערות שוליים"
      :launcher="true"
    >
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
 * זמינות ההערות נקבעת מ-`doc.capabilities` ולא מהנחה: `footnotes` הוא adapter
 * אופציונלי בחוזה של המנוע, וכשהוא חסר הפקד מנוטרל עם ההסבר „אינו זמין בגרסה
 * זו” — בדיוק כפי ש-§12 דורש. „תוכן עניינים” ממשיך לרוץ דרך פקודת ה-registry;
 * מה שנוסף לו הוא `:disabled` מהמצב שהמנוע מדווח.
 */
import { computed, inject, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';
import { COMMAND_REPORTER, type CommandReporter } from '../../../composables/keys';
import { ACTIVE_SUPERDOC } from '../../../engine/document-api';
import { readDocCapabilities, type DocCapabilityReport } from '../../../engine/doc-capabilities';
import { insertNote, type NoteType } from '../../../engine/footnotes';

const tocCmd = useCommand('table-of-contents-insert');

/** ברירת המחדל כשאין מדווח — הרכבה חלקית בבדיקות. זהה להתנהגות של `useCommand`. */
const fallbackReporter: CommandReporter = (outcome, id) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${id}: ${outcome.message}`);
};

const superdoc = inject(ACTIVE_SUPERDOC, shallowRef<SuperDoc | null>(null));
const report = inject(COMMAND_REPORTER, fallbackReporter);

const capabilities = shallowRef<DocCapabilityReport | null>(null);

/** ראו LayoutTab: קריאת היכולות א-סינכרונית, ותשובה של מסמך קודם לא תדרוס. */
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

const canInsertNote = computed(() => capabilities.value?.can('canInsertFootnote') ?? false);

function noteTooltip(enabledText: string): string {
  if (canInsertNote.value) return enabledText;
  return capabilities.value?.explain('canInsertFootnote') || 'המסמך עדיין נטען';
}

async function onInsert(type: NoteType): Promise<void> {
  report(await insertNote(superdoc.value, type), `footnotes-insert-${type}`);
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
