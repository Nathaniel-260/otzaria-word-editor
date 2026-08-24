<template>
  <div class="style-gallery-container">
    <div
      ref="scrollContainerRef"
      class="style-cards-scroll"
      role="group"
      aria-label="סגנונות"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="style-card"
        :class="{ active: activeId === item.id }"
        :title="item.label"
        :aria-pressed="activeId === item.id"
        @pointerdown.prevent
        @click="$emit('select-style', item.id)"
      >
        <span
          class="style-card-preview"
          :style="item.previewStyle"
        >
          {{ item.previewText }}
        </span>
        <span class="style-card-name">{{ item.label }}</span>
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
import { computed, inject, ref, shallowRef } from 'vue';
import SvgIcon from '../../icons/SvgIcon.vue';
import { STYLE_GALLERY } from '../../../composables/keys';
import { fallbackStyleGallery } from '../../../engine/style-gallery';

const props = withDefaults(
  defineProps<{
    /**
     * הסגנון שפקודת `linked-style` מדווחת. משמש רק כשאין גלריה מהמסמך —
     * כשיש, `activeParagraphStyleId` של המנוע מדויק ממנו (הוא יודע להבחין
     * בבחירה מעורבת).
     */
    currentStyle?: string;
  }>(),
  {
    currentStyle: 'Normal',
  },
);

defineEmits<{
  (e: 'select-style', styleId: string): void;
}>();

/**
 * ברירת המחדל של ה-inject היא רשת הביטחון ולא רשימה ריקה: קומפוננטה שמורכבת
 * בלי המעטפת (בדיקה, או רצועה שעולה לפני שנפתח מסמך) צריכה גלריה עובדת.
 * הצורה עם factory (`true`) ולא ערך ישיר — כדי שהרשימה לא תיבנה בכל הרכבה
 * גם כשהמעטפת כן מספקת את המפתח.
 */
const gallery = inject(STYLE_GALLERY, () => shallowRef(fallbackStyleGallery()), true);

const items = computed(() => gallery.value.items);

/**
 * בחירה מעורבת מחזירה `null` מהמנוע, ואז אין כרטיס מסומן — Word מציג גלריה
 * בלי בחירה, ולא את הסגנון של הפסקה הראשונה כאילו הוא של כולן. לכן כשהרשימה
 * מהמסמך, התשובה של המנוע קובעת גם כשהיא `null`.
 */
const activeId = computed(() =>
  gallery.value.fromDocument ? gallery.value.activeId : props.currentStyle,
);

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
  /* מהודקת לתוכן. `width: 100%` עם `flex: 1 1 auto` שהיו כאן מתחו אותה על כל
     מה שהקבוצה נתנה, והשאירו לצד הכרטיסים שטח לבן שנראה כמו משבצת סגנון
     ריקה — זו התלונה. `0 1 auto` = אינה גדלה, ומצטמצמת כשהרצועה צרה. */
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.style-cards-scroll {
  display: flex;
  align-items: stretch;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
  height: 100%;
  padding-inline: 2px;
  /* התקרה היא מה שמונע מגלריה של מסמך עשיר בסגנונות לדחוף את שאר הקבוצות
     מהרצועה: הקטלוג של Word מחזיר לעיתים חמישה-עשר סגנונות מהירים, ולא חמישה.
     רוחב של כחמישה כרטיסים — ומשם גוללים. */
  max-width: 340px;
  min-width: 0;
}

.style-cards-scroll::-webkit-scrollbar {
  display: none;
}

.style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 62px;
  max-width: 84px;
  padding: 3px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 0.08s ease;
  white-space: nowrap;
  overflow: hidden;
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
  max-width: 100%;
  font-family: var(--font-main);
  line-height: 1.2;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style-card-name {
  max-width: 100%;
  font-size: 9px;
  color: var(--color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
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
