<template>
  <div class="ribbon-tab-pane layout-tab">
    <!-- קבוצה 1: הגדרת עמוד -->
    <RibbonGroup
      title="הגדרת עמוד"
      :launcher="true"
    >
      <RibbonButton
        icon="margins"
        label="שוליים"
        variant="large"
        tooltip="הגדרת שולי הדף (רגיל, צר, רחב)"
      />
      <RibbonButton
        icon="orientation"
        label="כיוון"
        variant="large"
        tooltip="כיוון הדף: לאורך או לרוחב"
      />
      <RibbonButton
        icon="paperSize"
        label="גודל"
        variant="large"
        tooltip="בחירת גודל נייר (A4, Letter)"
      />
      <RibbonButton
        icon="columns"
        label="עמודות"
        variant="large"
        tooltip="פיצול הטקסט לשתי עמודות או יותר"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
}
</style>
