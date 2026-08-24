<template>
  <div class="word-ribbon-group">
    <div
      class="word-group-content"
      :class="{ 'column-flow': columnFlow }"
    >
      <slot />
    </div>
    <div class="word-group-footer">
      <span class="word-group-title">{{ title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    /* מנוטרל בכוונה: כפתור ה-launcher הוסר, וה-prop נשאר רק כדי שאתרי הקריאה
       בלשוניות שעוד מעבירים :launcher ימשיכו לעבור typecheck. */
    launcher?: boolean;
    columnFlow?: boolean;
  }>(),
  {
    launcher: true,
    columnFlow: false,
  }
);
</script>
