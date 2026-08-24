<template>
  <span
    class="svg-icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
    v-html="svgContent"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ICONS } from './icons';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number;
  }>(),
  {
    size: 16,
  }
);

const svgContent = computed(() => ICONS[props.name] || '');
</script>

<style scoped>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  fill: currentColor;
}
</style>
