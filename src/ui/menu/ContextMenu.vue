<template>
  <div
    v-if="open && sections.length > 0"
    ref="cardRef"
    class="ctx-menu"
    role="menu"
    aria-label="תפריט הקשר"
    data-context-menu
    tabindex="-1"
    :style="cardStyle"
    @keydown="onKeydown"
  >
    <template
      v-for="(section, index) in sections"
      :key="section.id"
    >
      <div
        v-if="index > 0"
        class="ctx-menu__sep"
        role="separator"
      />
      <div
        class="ctx-menu__section"
        :class="`ctx-menu__section--${section.layout}`"
        role="group"
        :aria-label="section.label"
      >
        <ContextMenuButton
          v-for="entry in section.entries"
          :key="entry.id"
          :ref="(element) => registerButton(entry.id, element)"
          :entry="entry"
          :layout="section.layout"
          :focused="entry.id === focusedId"
          @run="onRun"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * הכרטיס של תפריט ההקשר.
 *
 * ## מה הוא עושה, ומה הוא במפורש אינו עושה
 *
 * הוא מצייר מקטעים שהמודל בנה, מודד את עצמו וממקם את עצמו בנקודה שנלחצה,
 * ומנהל מיקוד וניווט מקלדת. הוא **אינו** מחליט מה מופיע (זה
 * `context-menu-model.ts`), אינו קורא למנוע (הפקד עושה זאת, או ההורה), ואינו
 * מטפל ב-`Escape`.
 *
 * ## למה Escape אינו כאן
 *
 * במעטפת יש בעלים אחד ל-Escape — `closeTopmost` ב-App.vue, שמנוהל דרך
 * הרג'יסטרי של הקיצורים. מאזין מקומי כאן היה יוצר בעלים שני, ומאזין כזה כבר
 * נכתב פעם ב-`RibbonMenuButton` ואינו יורה מעולם (הפופאובר שם אינו מקבל מיקוד
 * כלל). התפריט נסגר מ-Escape מפני שההורה מוסיף אותו כענף הראשון בשרשרת.
 *
 * ## שתי מדידות שקובעות התנהגות
 *
 * - **המיקום נמדד בשני מעברים.** הכרטיס נפרס מוסתר (`visibility: hidden`),
 *   נמדד, ורק אז מקבל קואורדינטות — אחרת פריים אחד מצויר בפינה השגויה.
 * - **גלילה סוגרת ואינה ממקמת מחדש.** עוגן-נקודה מתיישן ברגע שהתוכן זז: מלבן
 *   הכפתור זז יחד עם הכפתור, אבל הנקודה שנלחצה נשארת במקום שכבר אין בו כלום.
 */
import { computed, nextTick, onUnmounted, ref, watch, type ComponentPublicInstance, type CSSProperties } from 'vue';
import ContextMenuButton from './ContextMenuButton.vue';
import { contextMenuEntries, type ContextMenuEntry, type ContextMenuSection } from './context-menu-model';
import { contextMenuPlacement, type MenuPoint } from './menu-placement';
import { isRightToLeft } from '../../composables/popover-position';

const props = defineProps<{
  open: boolean;
  point: MenuPoint | null;
  sections: readonly ContextMenuSection[];
}>();

const emit = defineEmits<{
  (e: 'run', entry: ContextMenuEntry): void;
  (e: 'close'): void;
}>();

const cardRef = ref<HTMLElement | null>(null);
const focusedId = ref<string | null>(null);

/** הצורה שנמדדת לפני שיש מה למדוד — אותה תבנית של composables/popover-position. */
const UNMEASURED: CSSProperties = {
  position: 'fixed',
  top: '0px',
  left: '0px',
  visibility: 'hidden',
};

const cardStyle = ref<CSSProperties>({ ...UNMEASURED });

const buttons = new Map<string, HTMLElement>();

function registerButton(id: string, element: Element | ComponentPublicInstance | null): void {
  const node = (element as ComponentPublicInstance | null)?.$el ?? (element as Element | null);
  if (node instanceof HTMLElement) buttons.set(id, node);
  else buttons.delete(id);
}

const entries = computed(() => contextMenuEntries(props.sections));

function place(): void {
  const card = cardRef.value;
  const point = props.point;
  if (!card || !point) return;

  // `offsetWidth`/`offsetHeight` ולא `getBoundingClientRect`: המלבן מוחזר
  // **אחרי** ה-transform, והכרטיס נמדד בפריים הראשון של אנימציית הכניסה —
  // כלומר ב-`scale(0.98)`. כרטיס בן 264px היה נמדד כ-258.7, וב-RTL הקצה הימני
  // שלו היה נוחת 5.3px מעבר לנקודה שנלחצה, כלומר מכסה אותה.
  const placement = contextMenuPlacement(
    point,
    { width: card.offsetWidth, height: card.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
    { rtl: isRightToLeft(card) },
  );

  cardStyle.value = {
    position: 'fixed',
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    maxHeight: `${placement.maxHeight}px`,
  };
}

function focusEntry(id: string | null): void {
  focusedId.value = id;
  if (id) void nextTick(() => buttons.get(id)?.focus());
}

/**
 * צעד ברשימה השטוחה. פריט מנוטרל **אינו** מדולג: הוא `aria-disabled` ולא
 * `disabled`, ולכן הוא בר-מיקוד — כך המשתמש יודע שהפעולה קיימת ואינה זמינה,
 * במקום שהיא תיעלם לו מתחת לחצים.
 */
function step(delta: number): void {
  const list = entries.value;
  if (list.length === 0) return;
  const current = list.findIndex((entry) => entry.id === focusedId.value);
  const next = current === -1 ? 0 : (current + delta + list.length) % list.length;
  focusEntry(list[next].id);
}

function onKeydown(event: KeyboardEvent): void {
  const card = cardRef.value;
  // בעברית החץ שמאלה מתקדם בשורת האייקונים, וימינה חוזר.
  const forwardKey = card && isRightToLeft(card) ? 'ArrowLeft' : 'ArrowRight';
  const backKey = forwardKey === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';

  switch (event.key) {
    case 'ArrowDown':
    case forwardKey:
      event.preventDefault();
      step(1);
      break;
    case 'ArrowUp':
    case backKey:
      event.preventDefault();
      step(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusEntry(entries.value[0]?.id ?? null);
      break;
    case 'End':
      event.preventDefault();
      focusEntry(entries.value[entries.value.length - 1]?.id ?? null);
      break;
    case 'Tab':
      // טאב מתפריט הקשר סוגר אותו: הוא אינו אזור בממשק, הוא שכבה מעל הרגע.
      // `preventDefault` כדי שהדפדפן לא ימשיך להזיז מיקוד לתוך כרטיס שנסגר.
      event.preventDefault();
      emit('close');
      break;
    default:
      break;
  }
}

function onPointerDown(event: PointerEvent): void {
  const card = cardRef.value;
  if (card && event.target instanceof Node && card.contains(event.target)) return;
  emit('close');
}

/** גלילה **בתוך** הכרטיס אינה סוגרת אותו; כל גלילה אחרת כן. */
function onScroll(event: Event): void {
  const card = cardRef.value;
  if (card && event.target instanceof Node && card.contains(event.target)) return;
  emit('close');
}

function onResize(): void {
  emit('close');
}

function bind(): void {
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
}

function unbind(): void {
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onResize);
}

/**
 * הנקודה והמקטעים נצפים יחד עם `open`, ולא רק הוא.
 *
 * תפריט שכבר פתוח יכול להיפתח **מחדש** במקום אחר: `Shift+F10` בזמן שהוא פתוח,
 * או לחיצה ימנית שנייה. אז `open` נשאר `true`, ובלי המעקב הזה הכרטיס היה
 * מצייר את הדגם החדש בקואורדינטות הישנות ועם מיקוד על פריט שכבר אינו קיים.
 */
watch(
  () => [props.open, props.point, props.sections] as const,
  async ([open]) => {
    if (!open) {
      unbind();
      buttons.clear();
      focusedId.value = null;
      cardStyle.value = { ...UNMEASURED };
      return;
    }

    // האיפוס **לפני** ההמתנה: אחריה יש פריים שבו הכרטיס כבר מציג את הדגם
    // החדש עם הסימון של הפתיחה הקודמת.
    // בלי פריט מסומן מראש — כמו ב-Word. המיקוד יושב על הכרטיס עצמו, והחץ
    // הראשון בוחר את הפריט הראשון (`step` מטפל ב„אין נבחר”).
    focusedId.value = null;

    bind();
    await nextTick();
    place();
    cardRef.value?.focus();
  },
  // `immediate` כדי שהרכבה שנולדת פתוחה תתנהג כמו פתיחה: בלעדיו כרטיס שהורכב
  // עם `open: true` היה מצויר בלי מיקום ובלי מיקוד, וזה גם המצב בבדיקות.
  { immediate: true },
);

onUnmounted(unbind);

function onRun(entry: ContextMenuEntry): void {
  emit('run', entry);
  emit('close');
}

defineExpose({ place });
</script>

<style scoped>
/* `top` / `left` / `max-height` מגיעים מ-`:style`. הצל, המסגרת והרדיוס הם
   אלה של פופאוברי הרצועה — כרטיס שנראה אחרת היה נראה כמו חלון של מישהו אחר.

   z-index 2500: מעל „חיפוש והחלפה” (2000), שאינו מודאלי ואפשר לערוך מתחתיו —
   תפריט שנפתח לידו ומוסתר על ידו הוא באג — ומתחת ל„אודות” ו„קיצורי מקלדת”
   (3000), שמעליהם ממילא אין תפריט: מודאל פתוח חוסם את הפתיחה מלכתחילה. */
.ctx-menu {
  position: fixed;
  z-index: 2500;
  min-width: 240px;
  max-width: 320px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  overflow-y: auto;
  animation: ctx-menu-in 90ms cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .ctx-menu {
    animation: none;
  }
}

@keyframes ctx-menu-in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* הכרטיס מקבל מיקוד בפתיחה (tabindex="-1") — בלי טבעת: הוא המכל, לא פקד. */
.ctx-menu:focus {
  outline: none;
}

.ctx-menu__section--icons {
  display: flex;
  gap: 2px;
  padding: 2px;
}

.ctx-menu__section--items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ctx-menu__sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--color-outline-variant);
}
</style>
