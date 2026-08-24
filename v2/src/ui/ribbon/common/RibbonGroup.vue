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
/* אין כאן `launcher`: כפתור ההרחבה בפינת הקבוצה הוסר מהעיצוב (b2f0635),
   ה-HTML שלו הוסר (e66dc8f), וה-prop עצמו נשאר אחריו בלי צרכן. הוא הוסר ביחד
   עם כל אתרי הקריאה שהעבירו אותו — prop שאינו מוצהר נוזל ל-`$attrs` ומרונדר
   כתכונת DOM על ה-div של הקבוצה. */
withDefaults(
  defineProps<{
    title: string;
    columnFlow?: boolean;
  }>(),
  {
    columnFlow: false,
  }
);
</script>
