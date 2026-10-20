<template>
  <aside
    class="nav-pane"
    aria-label="ניווט"
  >
    <header class="nav-head">
      <span class="nav-title">ניווט</span>
      <button
        type="button"
        class="nav-close"
        aria-label="סגור את חלונית הניווט"
        data-tip-title="סגור"
        @pointerdown.prevent
        @click="$emit('close')"
      >
        ×
      </button>
    </header>

    <ul
      v-if="rows.length > 0"
      class="nav-tree"
      role="tree"
      aria-label="כותרות"
    >
      <template
        v-for="row in rows"
        :key="row.heading.blockId"
      >
        <li
          v-if="!row.hidden"
          class="nav-item"
          :class="{ 'nav-item--current': row.current }"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-expanded="row.expandable ? !row.collapsed : undefined"
          :aria-current="row.current ? 'location' : undefined"
          :style="{ '--nav-depth': row.depth }"
          :data-tip-title="row.heading.text"
          @pointerdown.prevent
          @click="go(row.heading.blockId)"
        >
          <span
            class="nav-twisty"
            :class="{ 'nav-twisty--open': row.expandable && !row.collapsed }"
            aria-hidden="true"
            @click.stop="row.expandable && toggle(row.heading.blockId)"
          >
            <SvgIcon
              v-if="row.expandable"
              name="chevronLeft"
              :size="12"
            />
          </span>
          <span class="nav-label">{{ row.heading.text }}</span>
        </li>
      </template>
    </ul>

    <p
      v-else
      class="nav-empty"
    >
      {{ emptyText }}
    </p>
  </aside>
</template>

<script setup lang="ts">
/**
 * „חלונית ניווט” — הכותרות של המסמך הפתוח כעץ, ולחיצה על כותרת מעבירה אליה.
 * הקריאה, העץ והקפיצה ב-engine/navigation-pane.ts; כאן רק התזמון והציור.
 *
 * ## מתי נקרא מחדש
 *
 * - **מסמך אחר** (`host`/`generation`) — מיד, והקיפולים מתאפסים: הם נרשמו
 *   על מזהי בלוקים של המסמך הקודם.
 * - **עריכה** (`docRevision`) — אחרי השקטה. קריאת כל הבלוקים בכל תו הייתה
 *   עבודה מיותרת, וקריאות המנוע ממילא אינן חוזרות באמצע הקלדה רציפה.
 * - **תזוזת סמן** (`caretRevision`) — רק הבחירה נקראת, לא המסמך: הפרק
 *   הנוכחי נגזר ממיקום הבלוק במפה שכבר נקראה.
 *
 * הרכיב קיים רק כשהחלונית פתוחה (`v-if` ב-App.vue), ולכן חלונית סגורה אינה
 * קוראת כלום.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { SuperDoc } from 'superdoc';
import SvgIcon from '../icons/SvgIcon.vue';
import {
  goToNavHeading,
  navHasChildren,
  navHidden,
  navParents,
  navSectionIndex,
  readCaretBlockId,
  readNavOutline,
  type NavOutline,
} from '../../engine/navigation-pane';

const props = defineProps<{
  host: SuperDoc | null;
  generation: number;
  docRevision: number;
  caretRevision: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  /** הסמן הועבר לכותרת — האב מחזיר את המיקוד למסמך. */
  (e: 'navigated'): void;
}>();

/** השקטה אחרי עריכה — אותו סדר גודל כמו „סימני עיצוב” (300ms). */
const DOC_DEBOUNCE_MS = 400;
/** תזוזת סמן זולה יותר לקרוא, אבל חצים מוחזקים יורים בכל שורה. */
const CARET_DEBOUNCE_MS = 150;

const outline = shallowRef<NavOutline | null>(null);
const loaded = ref(false);
const collapsed = ref<ReadonlySet<string>>(new Set());
const caretOrdinal = ref<number | null>(null);

let docTimer: ReturnType<typeof setTimeout> | undefined;
let caretTimer: ReturnType<typeof setTimeout> | undefined;
let generationToken = 0;

async function readOutline(): Promise<void> {
  const mine = ++generationToken;
  const host = props.host;
  const next = await readNavOutline(host);
  if (mine !== generationToken || host !== props.host) return;
  // `null` היא קריאה שנכשלה: משאירים את מה שהיה, ולא „אין כותרות”.
  if (next !== null || !loaded.value) outline.value = next;
  loaded.value = true;
  await readCaret();
}

async function readCaret(): Promise<void> {
  const host = props.host;
  const blockId = await readCaretBlockId(host);
  if (host !== props.host) return;
  const ordinal = blockId === null ? undefined : outline.value?.ordinals.get(blockId);
  // בלוק שאינו במפה — פסקה שנוספה אחרי הקריאה האחרונה. משאירים את הסימון
  // הקודם עד הקריאה הבאה, שכבר בדרך (`docRevision`).
  if (ordinal !== undefined) caretOrdinal.value = ordinal;
}

watch(
  () => [props.host, props.generation] as const,
  () => {
    clearTimeout(docTimer);
    clearTimeout(caretTimer);
    outline.value = null;
    loaded.value = false;
    collapsed.value = new Set();
    caretOrdinal.value = null;
    void readOutline();
  },
  { immediate: true },
);

watch(
  () => props.docRevision,
  () => {
    clearTimeout(docTimer);
    docTimer = setTimeout(() => void readOutline(), DOC_DEBOUNCE_MS);
  },
);

watch(
  () => props.caretRevision,
  () => {
    clearTimeout(caretTimer);
    caretTimer = setTimeout(() => void readCaret(), CARET_DEBOUNCE_MS);
  },
);

onBeforeUnmount(() => {
  generationToken += 1;
  clearTimeout(docTimer);
  clearTimeout(caretTimer);
});

const rows = computed(() => {
  const headings = outline.value?.headings ?? [];
  const parents = navParents(headings);
  const ids = headings.map((heading) => heading.blockId);
  const hasChildren = navHasChildren(parents);
  const hidden = navHidden(parents, collapsed.value, ids);
  const current =
    caretOrdinal.value === null ? -1 : navSectionIndex(headings, caretOrdinal.value);

  const depths: number[] = [];
  return headings.map((heading, index) => {
    const parent = parents[index];
    depths.push(parent >= 0 ? depths[parent] + 1 : 0);
    return {
      heading,
      depth: depths[index],
      expandable: hasChildren[index],
      collapsed: collapsed.value.has(heading.blockId),
      hidden: hidden[index],
      current: index === current,
    };
  });
});

const emptyText = computed(() => {
  if (!props.host) return 'אין מסמך פתוח';
  if (!loaded.value) return 'קורא את הכותרות…';
  if (outline.value === null) return 'לא ניתן לקרוא את הכותרות';
  return 'אין כותרות במסמך. החילו סגנון „כותרת 1”, „כותרת 2” וכו׳ כדי שיופיעו כאן.';
});

function toggle(blockId: string): void {
  const next = new Set(collapsed.value);
  if (!next.delete(blockId)) next.add(blockId);
  collapsed.value = next;
}

async function go(blockId: string): Promise<void> {
  const ordinal = outline.value?.ordinals.get(blockId);
  if (ordinal !== undefined) caretOrdinal.value = ordinal;
  if (await goToNavHeading(props.host, blockId)) emit('navigated');
}
</script>

<style scoped>
.nav-pane {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 240px;
  min-height: 0;
  background: var(--color-surface-container-high);
  border-inline-end: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 13px;
}

.nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  padding: 6px 10px 6px 6px;
  border-block-end: 1px solid var(--color-outline-variant);
}

.nav-title {
  font-weight: 600;
}

.nav-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-variant);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.nav-close:hover {
  background: var(--word-btn-hover);
}

/* פס הגלילה מימין, כמו ב-`.src-tree` (OpenSourcesNav.vue). */
.nav-tree {
  list-style: none;
  margin: 0;
  padding: 4px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  direction: ltr;
}

/* הזחה לפי עומק, כמו ב-`.src-item`: הצמתים שטוחים ב-DOM. */
.nav-item {
  direction: rtl;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding-inline: calc(2px + var(--nav-depth, 0) * 14px) 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.08s ease;
}

.nav-item:hover {
  background: var(--word-btn-hover);
}

/* הפרק שהסמן בו: אותה שפה כמו הפריט הנבחר ב-`.src-item--selected`. */
.nav-item--current {
  background: var(--color-primary-subtle);
  box-shadow: inset -3px 0 0 var(--word-blue);
  font-weight: 600;
}

.nav-item--current:hover {
  background: var(--color-primary-selected-hover);
}

.nav-twisty {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-on-surface-variant);
  transition: transform 0.12s ease;
}

/* ‹ פונה שמאלה ב-RTL (מקופל); פתוח הוא ‹ מסובב כלפי מטה. */
.nav-twisty--open {
  transform: rotate(-90deg);
}

.nav-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-empty {
  margin: 0;
  padding: 12px;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .nav-item,
  .nav-twisty {
    transition: none;
  }
}
</style>
