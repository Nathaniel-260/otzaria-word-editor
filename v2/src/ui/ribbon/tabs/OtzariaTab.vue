<template>
  <div class="ribbon-tab-pane otzaria-tab">
    <!-- שילוב עם אוצריא -->
    <RibbonGroup
      title="אוצריא"
      :launcher="false"
    >
      <RibbonButton
        icon="book"
        label="ציטוט מהקורא"
        variant="large"
        tooltip="הכנסת הקטע המסומן מהספר הפתוח באוצריא"
        @click="$emit('insert-citation')"
      />
      <RibbonButton
        icon="search"
        label="חיפוש באוצריא"
        variant="large"
        tooltip="חיפוש מקורות בכל ספריות אוצריא"
        @click="$emit('search-otzaria')"
      />
      <RibbonButton
        icon="otzaria"
        label="פתח ספרייה"
        variant="large"
        tooltip="פתיחת ספריית הספרים של אוצריא"
        @click="$emit('open-library')"
      />
    </RibbonGroup>

    <!-- תבניות תורניות -->
    <RibbonGroup
      title="סגנון תורני"
      :launcher="false"
    >
      <div class="column-items">
        <RibbonButton
          label="חידוש"
          variant="small"
          tooltip="החלת סגנון פסקת חידוש"
        />
        <RibbonButton
          label="קושיא"
          variant="small"
          tooltip="החלת סגנון פסקת קושיא"
        />
        <RibbonButton
          label="תירוץ"
          variant="small"
          tooltip="החלת סגנון פסקת תירוץ"
        />
      </div>
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';

defineEmits<{
  (e: 'insert-citation'): void;
  (e: 'search-otzaria'): void;
  (e: 'open-library'): void;
}>();
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
