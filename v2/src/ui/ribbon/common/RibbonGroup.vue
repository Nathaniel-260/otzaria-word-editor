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
      <button
        v-if="launcher"
        type="button"
        class="word-group-launcher"
        :title="`${title} - אפשרויות מתקדמות`"
        @pointerdown.prevent
        @click="$emit('launch')"
      >
        <SvgIcon
          name="launcher"
          :size="10"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '../../icons/SvgIcon.vue';

withDefaults(
  defineProps<{
    title: string;
    launcher?: boolean;
    columnFlow?: boolean;
  }>(),
  {
    launcher: true,
    columnFlow: false,
  }
);

defineEmits<{
  (e: 'launch'): void;
}>();
</script>
