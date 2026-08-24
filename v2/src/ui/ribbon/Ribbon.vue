<template>
  <div class="word-ribbon-container">
    <!-- סרגל הלשוניות -->
    <div class="word-tab-bar">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        class="word-tab-btn"
        :class="[
          { active: activeTabId === tab.id },
          tab.className || ''
        ]"
        @click="selectTab(tab.id)"
        @dblclick="toggleCollapsed"
      >
        {{ tab.label }}
      </button>

      <button
        type="button"
        class="word-ribbon-toggle"
        :title="isCollapsed ? 'הצג את הרצועה' : 'כווץ את הרצועה'"
        @click="toggleCollapsed"
      >
        <SvgIcon
          :name="isCollapsed ? 'chevronDown' : 'chevronUp'"
          :size="14"
        />
      </button>
    </div>

    <!-- תוכן הלשונית הפעילה בלבד (Mount on active) -->
    <div
      v-show="!isCollapsed"
      class="word-ribbon-body"
    >
      <FileTab
        v-if="activeTabId === 'file'"
        @new-doc="$emit('new-doc')"
        @open-doc="$emit('open-doc')"
        @save-doc="$emit('save-doc')"
        @save-as-doc="$emit('save-as-doc')"
        @export-doc="$emit('export-doc')"
        @print-doc="$emit('print-doc')"
        @about="$emit('about')"
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
import { ref } from 'vue';
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
  { id: 'file', label: 'קובץ', className: 'file-tab' },
  { id: 'home', label: 'בית' },
  { id: 'insert', label: 'הוספה' },
  { id: 'layout', label: 'פריסה' },
  { id: 'references', label: 'הפניות' },
  { id: 'review', label: 'סקירה' },
  { id: 'view', label: 'תצוגה' },
  { id: 'otzaria', label: '✦ אוצריא', className: 'otzaria-tab' },
];

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
  (e: 'open-find'): void;
  (e: 'open-replace'): void;
  (e: 'toggle-focus-mode'): void;
  (e: 'insert-citation'): void;
  (e: 'search-otzaria'): void;
  (e: 'open-library'): void;
}>();

function selectTab(id: string): void {
  activeTabId.value = id;
  if (isCollapsed.value) {
    isCollapsed.value = false;
  }
}

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value;
}
</script>
