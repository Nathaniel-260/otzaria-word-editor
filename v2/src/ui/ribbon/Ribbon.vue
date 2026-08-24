<template>
  <div class="word-ribbon-container">
    <!-- סרגל הלשוניות -->
    <div class="word-tab-bar">
      <!-- ה-tablist עוטף את הלשוניות בלבד: הצאצאים של role="tablist" חייבים
           להיות role="tab", וכפתור הכיווץ אינו לשונית -->
      <div
        class="word-tab-strip"
        role="tablist"
        aria-label="לשוניות הרצועה"
        aria-orientation="horizontal"
        @keydown="onTabKeydown"
      >
        <button
          v-for="(tab, index) in TABS"
          :id="ribbonTabId(tab.id)"
          :key="tab.id"
          :ref="(el) => registerTabRef(el, index)"
          type="button"
          role="tab"
          class="word-tab-btn"
          :class="[
            { active: activeTabId === tab.id },
            tab.className || ''
          ]"
          :aria-selected="activeTabId === tab.id ? 'true' : 'false'"
          :aria-controls="RIBBON_PANEL_ID"
          :tabindex="activeTabId === tab.id ? 0 : -1"
          @click="selectTab(tab.id)"
          @dblclick="toggleCollapsed"
        >
          {{ tab.label }}
        </button>
      </div>

      <button
        type="button"
        class="word-ribbon-toggle"
        :title="isCollapsed ? 'הצג את הרצועה' : 'כווץ את הרצועה'"
        :aria-label="isCollapsed ? 'הצג את הרצועה' : 'כווץ את הרצועה'"
        :aria-expanded="!isCollapsed"
        :aria-controls="RIBBON_PANEL_ID"
        @click="toggleCollapsed"
      >
        <SvgIcon
          :name="isCollapsed ? 'chevronDown' : 'chevronUp'"
          :size="14"
        />
      </button>
    </div>

    <!-- תוכן הלשונית הפעילה בלבד (Mount on active). פאנל אחד שמתחלף ולא שמונה
         פאנלים, ולכן aria-labelledby מצביע על הלשונית הפעילה כרגע -->
    <div
      v-show="!isCollapsed"
      :id="RIBBON_PANEL_ID"
      class="word-ribbon-body"
      role="tabpanel"
      :aria-labelledby="ribbonTabId(activeTabId)"
    >
      <FileTab
        v-if="activeTabId === 'file'"
        :has-document="hasDocument"
        :is-saving="isSaving"
        :is-opening="isOpening"
        @new-doc="$emit('new-doc')"
        @open-doc="$emit('open-doc')"
        @save-doc="$emit('save-doc')"
        @save-as-doc="$emit('save-as-doc')"
        @export-doc="$emit('export-doc')"
        @print-doc="$emit('print-doc')"
        @about="$emit('about')"
        @exit-app="$emit('exit-app')"
      />
      <HomeTab
        v-else-if="activeTabId === 'home'"
        @open-find="$emit('open-find')"
        @open-replace="$emit('open-replace')"
      />
      <InsertTab v-else-if="activeTabId === 'insert'" />
      <LayoutTab v-else-if="activeTabId === 'layout'" />
      <ReferencesTab v-else-if="activeTabId === 'references'" />
      <ReviewTab v-else-if="activeTabId === 'review'" />
      <ViewTab
        v-else-if="activeTabId === 'view'"
        @toggle-focus-mode="$emit('toggle-focus-mode')"
      />
      <OtzariaTab
        v-else-if="activeTabId === 'otzaria'"
        @insert-citation="$emit('insert-citation')"
        @search-otzaria="$emit('search-otzaria')"
        @open-library="$emit('open-library')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type ComponentPublicInstance } from 'vue';
import { RIBBON_PANEL_ID, nextTabIndex, ribbonTabId } from './aria';
import SvgIcon from '../icons/SvgIcon.vue';
import HomeTab from './tabs/HomeTab.vue';
import FileTab from './tabs/FileTab.vue';
import InsertTab from './tabs/InsertTab.vue';
import LayoutTab from './tabs/LayoutTab.vue';
import ReferencesTab from './tabs/ReferencesTab.vue';
import ReviewTab from './tabs/ReviewTab.vue';
import ViewTab from './tabs/ViewTab.vue';
import OtzariaTab from './tabs/OtzariaTab.vue';

interface TabDefinition {
  id: string;
  label: string;
  className?: string;
}

const TABS: TabDefinition[] = [
  { id: 'file', label: 'קובץ' },
  { id: 'home', label: 'בית' },
  { id: 'insert', label: 'הוספה' },
  { id: 'layout', label: 'פריסה' },
  { id: 'references', label: 'הפניות' },
  { id: 'review', label: 'סקירה' },
  { id: 'view', label: 'תצוגה' },
  { id: 'otzaria', label: '✦ אוצריא', className: 'otzaria-tab' },
];

/**
 * מצב המעטפת, לפקדי לשונית „קובץ”.
 *
 * הרצועה קיבלה עד עכשיו אפס props, וזה היה נכון: כל שאר הלשוניות שואבות את
 * המצב שלהן מהמנוע (`useCommand`, `ACTIVE_SUPERDOC`) ואינן צריכות דבר מהאב.
 * „קובץ” היא היחידה שפקדיה הם פעולות מעטפת — מסמך פתוח, שמירה שרצה, פתיחה
 * שרצה — ואת המצב הזה רק App.vue מחזיק. ההסבר המלא, כולל למה props ולא מפתח
 * הזרקה חדש, ב-FileTab.vue.
 *
 * הרצועה עצמה אינה קוראת אותם: היא צינור, בדיוק כמו שהיא צינור ל-events
 * בכיוון ההפוך.
 */
withDefaults(
  defineProps<{
    hasDocument?: boolean;
    isSaving?: boolean;
    isOpening?: boolean;
  }>(),
  { hasDocument: false, isSaving: false, isOpening: false },
);

const activeTabId = ref('home');
const isCollapsed = ref(false);

defineEmits<{
  (e: 'new-doc'): void;
  (e: 'open-doc'): void;
  (e: 'save-doc'): void;
  (e: 'save-as-doc'): void;
  (e: 'export-doc'): void;
  (e: 'print-doc'): void;
  (e: 'about'): void;
  (e: 'exit-app'): void;
  (e: 'open-find'): void;
  (e: 'open-replace'): void;
  (e: 'toggle-focus-mode'): void;
  (e: 'insert-citation'): void;
  (e: 'search-otzaria'): void;
  (e: 'open-library'): void;
}>();

/** רק הלשונית הפעילה נמצאת ב-tab order, ולכן החצים צריכים להזיז מיקוד בעצמם. */
const tabButtons = ref<Array<HTMLButtonElement | null>>([]);

function registerTabRef(el: Element | ComponentPublicInstance | null, index: number): void {
  tabButtons.value[index] = el instanceof HTMLButtonElement ? el : null;
}

function selectTab(id: string): void {
  activeTabId.value = id;
  if (isCollapsed.value) {
    isCollapsed.value = false;
  }
}

/** הפעלה אוטומטית: החץ מעביר מיקוד **ומחליף** לשונית, כמו ברצועה של Word. */
function onTabKeydown(event: KeyboardEvent): void {
  const current = TABS.findIndex((tab) => tab.id === activeTabId.value);
  // 'rtl' קבוע: המעטפת של התוסף היא dir="rtl" (index.html), והפונקציה תומכת
  // בשני הכיוונים כדי שאפשר יהיה למדוד את שניהם.
  const next = nextTabIndex(event.key, current, TABS.length, 'rtl');
  if (next === null) return;

  // בלי זה החצים גם גוללים את סרגל הלשוניות שגלילתו auto.
  event.preventDefault();
  selectTab(TABS[next].id);
  tabButtons.value[next]?.focus();
}

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value;
}
</script>
