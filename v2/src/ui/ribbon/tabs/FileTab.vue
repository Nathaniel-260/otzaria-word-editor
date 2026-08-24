<template>
  <div class="ribbon-tab-pane file-tab">
    <RibbonGroup
      title="קובץ ומסמך"
      :launcher="false"
    >
      <RibbonButton
        icon="word"
        label="מסמך חדש"
        variant="large"
        tooltip="יצירת מסמך Word ריק חדש"
        @click="$emit('new-doc')"
      />
      <RibbonButton
        icon="search"
        label="פתח קובץ"
        variant="large"
        tooltip="פתיחת מסמך Word (.docx) מהמחשב"
        @click="$emit('open-doc')"
      />
    </RibbonGroup>

    <RibbonGroup
      title="שמירה"
      :launcher="false"
    >
      <RibbonButton
        icon="save"
        label="שמור"
        variant="large"
        tooltip="שמירת שינויים במסמך"
        shortcut="Ctrl+S"
        @click="$emit('save-doc')"
      />
      <RibbonButton
        icon="saveAs"
        label="שמור בשם..."
        variant="large"
        tooltip="שמירת המסמך כקובץ חדש"
        shortcut="Ctrl+Shift+S"
        @click="$emit('save-as-doc')"
      />
    </RibbonGroup>

    <RibbonGroup
      title="ייצוא והדפסה"
      :launcher="false"
    >
      <RibbonButton
        icon="saveAs"
        label="ייצוא ל-Word"
        variant="large"
        tooltip="הורדת קובץ .docx תואם Microsoft Word"
        @click="$emit('export-doc')"
      />
      <RibbonButton
        icon="print"
        label="הדפסה"
        variant="large"
        tooltip="הדפסת המסמך"
        shortcut="Ctrl+P"
        @click="$emit('print-doc')"
      />
    </RibbonGroup>

    <RibbonGroup
      title="מידע"
      :launcher="false"
    >
      <RibbonButton
        icon="info"
        label="אודות"
        variant="large"
        tooltip="אודות עורך Word לאוצריא"
        @click="$emit('about')"
      />
    </RibbonGroup>
  </div>
</template>

<script setup lang="ts">
import RibbonGroup from '../common/RibbonGroup.vue';
import RibbonButton from '../common/RibbonButton.vue';

defineEmits<{
  (e: 'new-doc'): void;
  (e: 'open-doc'): void;
  (e: 'save-doc'): void;
  (e: 'save-as-doc'): void;
  (e: 'export-doc'): void;
  (e: 'print-doc'): void;
  (e: 'about'): void;
}>();
</script>

<style scoped>
.ribbon-tab-pane {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
}
</style>
