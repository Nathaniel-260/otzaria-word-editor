<template>
  <div class="ribbon-tab-pane review-tab">
    <!-- הגהה -->
    <RibbonGroup
      title="הגהה"
      :launcher="false"
    >
      <RibbonButton
        icon="proofing"
        label="בדיקת איות"
        variant="large"
        tooltip="בדיקת איות ודקדוק בעברית"
        shortcut="F7"
      />
    </RibbonGroup>

    <!-- תגובות -->
    <RibbonGroup
      title="תגובות"
      :launcher="false"
    >
      <RibbonButton
        icon="comment"
        label="תגובה חדשה"
        variant="large"
        tooltip="הוספת תגובה לפסקה או לטקסט הנבחר"
      />
    </RibbonGroup>

    <!-- מעקב -->
    <RibbonGroup
      title="מעקב אחר שינויים"
      :launcher="false"
    >
      <RibbonButton
        icon="trackChanges"
        label="עקוב אחר שינויים"
        variant="large"
        tooltip="הפעלת מצב מעקב אחר שינויים במסמך"
      />
    </RibbonGroup>

    <!-- שינויים -->
    <RibbonGroup
      title="שינויים"
      :launcher="false"
    >
      <div class="column-items">
        <RibbonButton
          icon="accept"
          label="קבל שינוי"
          variant="small"
          tooltip="קבלת השינוי הנוכחי"
          @click="acceptCmd.run()"
        />
        <RibbonButton
          icon="reject"
          label="דחה שינוי"
          variant="small"
          tooltip="דחיית השינוי הנוכחי"
          @click="rejectCmd.run()"
        />
        <RibbonButton
          icon="accept"
          label="קבל את כל השינויים"
          variant="small"
          tooltip="קבלת כל השינויים במסמך"
          @click="acceptAllCmd.run()"
        />
      </div>
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
import { useCommand } from '../../../composables/useCommand';

const acceptCmd = useCommand('acceptChange');
const rejectCmd = useCommand('rejectChange');
const acceptAllCmd = useCommand('acceptAllChanges');
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
