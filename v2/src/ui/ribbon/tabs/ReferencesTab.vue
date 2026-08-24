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
        tooltip="הוספת הערת שוליים בתחתית העמוד"
        shortcut="Alt+Ctrl+F"
      />
      <RibbonButton
        icon="footnote"
        label="הערת סיום"
        variant="large"
        tooltip="הוספת הערת סיום בסוף המסמך"
        shortcut="Alt+Ctrl+D"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';

const tocCmd = useCommand('table-of-contents-insert');
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
}
</style>
