<template>
  <div class="style-gallery-container">
    <div
      ref="scrollContainerRef"
      class="style-cards-scroll"
    >
      <button
        v-for="style in STYLES"
        :key="style.id"
        type="button"
        class="style-card"
        :class="{ active: currentStyle === style.id }"
        :title="style.label"
        @pointerdown.prevent
        @click="$emit('select-style', style.id)"
      >
        <span
          class="style-card-preview"
          :style="style.previewStyle"
        >
          {{ style.previewText }}
        </span>
        <span class="style-card-name">{{ style.label }}</span>
      </button>
    </div>
    <div class="gallery-nav-btns">
      <button
        type="button"
        class="nav-btn"
        title="גלול ימינה"
        @pointerdown.prevent
        @click="scrollGallery('right')"
      >
        <SvgIcon
          name="chevronDown"
          :size="10"
          style="transform: rotate(90deg);"
        />
      </button>
      <button
        type="button"
        class="nav-btn"
        title="גלול שמאלה"
        @pointerdown.prevent
        @click="scrollGallery('left')"
      >
        <SvgIcon
          name="chevronDown"
          :size="10"
          style="transform: rotate(-90deg);"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from '../../icons/SvgIcon.vue';

interface StyleItem {
  id: string;
  label: string;
  previewText: string;
  previewStyle: Record<string, string>;
}

const STYLES: StyleItem[] = [
  {
    id: 'Normal',
    label: 'רגיל',
    previewText: 'AaBbCc',
    previewStyle: { fontSize: '13px', color: 'inherit', fontWeight: '400' },
  },
  {
    id: 'NoSpacing',
    label: 'ללא מרווח',
    previewText: 'AaBbCc',
    previewStyle: { fontSize: '13px', color: 'inherit', fontWeight: '400', letterSpacing: '-0.5px' },
  },
  {
    id: 'Heading1',
    label: 'כותרת 1',
    previewText: 'כותרת 1',
    previewStyle: { fontSize: '14px', color: '#2e74b5', fontWeight: '700' },
  },
  {
    id: 'Heading2',
    label: 'כותרת 2',
    previewText: 'כותרת 2',
    previewStyle: { fontSize: '13px', color: '#1f4e78', fontWeight: '600' },
  },
  {
    id: 'Subtitle',
    label: 'כותרת משנה',
    previewText: 'ת טקסט',
    previewStyle: { fontSize: '12px', color: '#595959', fontStyle: 'italic' },
  },
  {
    id: 'Quote',
    label: 'ציטוט',
    previewText: 'ציטוט',
    previewStyle: { fontSize: '12px', color: '#2e74b5', fontStyle: 'italic' },
  },
];

withDefaults(
  defineProps<{
    currentStyle?: string;
  }>(),
  {
    currentStyle: 'Normal',
  }
);

defineEmits<{
  (e: 'select-style', styleId: string): void;
}>();

const scrollContainerRef = ref<HTMLElement | null>(null);

function scrollGallery(direction: 'left' | 'right'): void {
  if (!scrollContainerRef.value) return;
  const delta = direction === 'left' ? -120 : 120;
  scrollContainerRef.value.scrollBy({ left: delta, behavior: 'smooth' });
}
</script>

<style scoped>
.style-gallery-container {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  padding: 2px;
  height: 68px;
  width: 100%;
  max-width: 100%;
  flex: 1 1 auto;
}

.style-cards-scroll {
  display: flex;
  align-items: stretch;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
  height: 100%;
  padding-inline: 2px;
}

.style-cards-scroll::-webkit-scrollbar {
  display: none;
}

.style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  padding: 3px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 0.08s ease;
  white-space: nowrap;
}

.style-card:hover {
  background: var(--word-btn-hover);
  border-color: var(--word-blue);
}

.style-card.active {
  background: var(--word-btn-active);
  border-color: var(--word-blue);
  box-shadow: 0 0 0 1px var(--word-blue);
}

.style-card-preview {
  display: block;
  font-family: var(--font-main);
  line-height: 1.2;
  margin-bottom: 2px;
}

.style-card-name {
  font-size: 9px;
  color: var(--color-on-surface-variant);
}

.gallery-nav-btns {
  display: flex;
  flex-direction: column;
  gap: 1px;
  height: 100%;
  justify-content: space-around;
  border-inline-start: 1px solid var(--color-outline-variant);
  padding-inline-start: 1px;
}

.nav-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  background: var(--word-btn-hover);
  color: var(--word-blue);
}
</style>
