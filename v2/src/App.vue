<template>
  <div
    class="word-app-shell"
    :class="{ 'focus-mode': isFocusMode }"
  >
    <!-- פס עליון -->
    <TitleBar
      :title="title"
      :is-dirty="saveSnapshot.isDirty"
      :is-saving="saveSnapshot.isSaving"
      :is-save-error="saveSnapshot.state === 'error'"
      :save-state-text="saveStateMessage"
      :autosave-enabled="autosaveEnabled"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :is-opening="isOpening"
      @save="onSave(false)"
      @undo="onUndo"
      @redo="onRedo"
      @open="onPickAndOpen"
      @open-find="openFindDialog('find')"
      @toggle-autosave="toggleAutosave"
      @update-title="onTitleUpdate"
    />

    <!-- רצועת הכלים (Ribbon) -->
    <Ribbon
      @new-doc="onNewDocument"
      @open-doc="onPickAndOpen"
      @save-doc="onSave(false)"
      @save-as-doc="onSave(true)"
      @export-doc="onExportDocx"
      @print-doc="onPrint"
      @about="isAboutOpen = true"
      @open-find="openFindDialog('find')"
      @open-replace="openFindDialog('replace')"
      @toggle-focus-mode="toggleFocusMode"
      @insert-citation="onInsertCitation"
      @search-otzaria="onSearchOtzaria"
      @open-library="onOpenLibrary"
    />

    <!-- אזור המסמך (SuperDoc Editor Stack) -->
    <main
      ref="editorStackRef"
      class="editor-stack"
    />

    <!-- שורת מצב תחתונה -->
    <StatusBar
      :current-page="currentPage"
      :total-pages="totalPages"
      :word-count="wordCount"
      :status-text="statusText"
      :is-error="isStatusError"
      :zoom-level="zoomLevel"
      @update:zoom-level="onZoomChange"
      @toggle-focus="toggleFocusMode"
    />

    <!-- דיאלוגים ופאנלים -->
    <FindReplaceDialog
      :is-open="isFindOpen"
      :initial-mode="findMode"
      @close="isFindOpen = false"
      @find="onFindText"
      @replace="onReplaceText"
      @replace-all="onReplaceAllText"
    />

    <AboutDialog
      :is-open="isAboutOpen"
      @close="isAboutOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, computed, shallowRef } from 'vue';
import TitleBar from './ui/shell/TitleBar.vue';
import Ribbon from './ui/ribbon/Ribbon.vue';
import StatusBar from './ui/shell/StatusBar.vue';
import FindReplaceDialog from './ui/panels/FindReplaceDialog.vue';
import AboutDialog from './ui/panels/AboutDialog.vue';

import { createCommandAdapter, type CommandAdapter } from './engine/command-adapter';
import { createEditorSwap, type EditorSwap } from './sessions/editor-swap';
import { createSaveCoordinator, type SaveCoordinator, type SaveSnapshot } from './sessions/save-coordinator';
import { createEditor } from './engine/create-editor';
import { exportDocx, docxFileName } from './engine/export';
import { downloadBlob } from './host/download';
import {
  beginBinaryWrite,
  uploadBytes,
  abortBinaryWrite,
  commitUserFileWrite,
  pickDocxFile,
  resolveFileUrl,
  type UserFile,
} from './host/files';
import { decideDocumentSwitch, saveShortcut } from './sessions/open-flow';
import { confirm, notifyError } from './host/otzaria-client';
import { loadLastDocument, saveLastDocument, forgetLastDocument } from './host/settings';

const editorStackRef = ref<HTMLElement | null>(null);

const commandAdapter = shallowRef<CommandAdapter | null>(null);
provide('commandAdapter', commandAdapter);

const title = ref('מסמך חדש');
const isOpening = ref(false);
const autosaveEnabled = ref(true);
const statusText = ref('');
const isStatusError = ref(false);
const isFocusMode = ref(false);

const isFindOpen = ref(false);
const findMode = ref<'find' | 'replace'>('find');
const isAboutOpen = ref(false);

const currentPage = ref(1);
const totalPages = ref(1);
const wordCount = ref(0);
const zoomLevel = ref(100);

const canUndo = ref(false);
const canRedo = ref(false);

const saveSnapshot = ref<SaveSnapshot>({
  state: 'idle',
  isDirty: false,
  isSaving: false,
  targetToken: null,
  exportedRevision: 0,
});

let swap: EditorSwap | null = null;
let save: SaveCoordinator | null = null;

const saveStateMessage = computed(() => {
  const state = saveSnapshot.value.state;
  if (state === 'exporting') return 'מייצא…';
  if (state === 'uploading' || state === 'committing') return 'שומר…';
  if (state === 'error') return 'שגיאה בשמירה';
  if (saveSnapshot.value.isDirty) return 'שינויים לא שמורים';
  if (saveSnapshot.value.targetToken) return 'נשמר';
  return 'טרם נשמר';
});

function setStatus(text: string, isError = false): void {
  statusText.value = text;
  isStatusError.value = isError;
  if (isError) notifyError(text);
}

function initSaveCoordinator(): SaveCoordinator {
  return createSaveCoordinator({
    exportDocument: () => {
      const active = swap?.current;
      if (!active) throw new Error('אין מסמך פתוח');
      return exportDocx(active.superdoc);
    },
    beginWrite: (size) => beginBinaryWrite(size),
    upload: uploadBytes,
    abort: abortBinaryWrite,
    commit: (input) =>
      commitUserFileWrite({
        writeToken: input.writeToken,
        targetToken: input.targetToken,
        suggestedName: input.suggestedName ?? title.value,
        title: 'שמירת המסמך',
      }),
    onStateChange: (snapshot) => {
      saveSnapshot.value = snapshot;
    },
  });
}

async function openDocument(file?: UserFile): Promise<boolean> {
  if (!swap) return false;
  isOpening.value = true;
  const startedAt = performance.now();
  setStatus(file ? `פותח את ${file.name}…` : 'פותח מסמך ריק…');

  const outcome = await swap.open(file?.url);
  isOpening.value = swap.isOpening;

  if (outcome.status === 'superseded') return false;

  if (outcome.status === 'failed') {
    const kept = swap.current ? ` ${title.value} נשאר פתוח.` : '';
    setStatus(`פתיחת המסמך נכשלה: ${outcome.error.message}.${kept}`, true);
    return false;
  }

  const editor = outcome.session;
  const adapter = createCommandAdapter(editor.ui);
  commandAdapter.value = adapter;

  title.value = file ? file.name.replace(/\.docx$/i, '') : 'מסמך חדש';
  setStatus(`${title.value} — נטען ב-${Math.round(performance.now() - startedAt)} מילישניות`);

  if (file && file.access !== 'readwrite') {
    setStatus(`${title.value} — פתוח לקריאה; „שמור” יבקש מקום חדש`);
  }

  save?.reset(file && file.access === 'readwrite' ? { token: file.token, name: file.name } : null);

  if (file) {
    void saveLastDocument({
      token: file.token,
      name: file.name,
      writable: file.access === 'readwrite',
    });
  } else {
    void forgetLastDocument();
  }

  // האזנה למצב Undo/Redo
  editor.onDispose(
    adapter.observe('undo', (state) => {
      canUndo.value = state.enabled;
    })
  );
  editor.onDispose(
    adapter.observe('redo', (state) => {
      canRedo.value = state.enabled;
    })
  );

  return true;
}

async function onSave(forceSaveAs = false): Promise<void> {
  if (!swap?.current || !save) return;
  const outcome = await save.saveNow({ forceSaveAs, suggestedName: title.value });

  if (outcome.status === 'failed') {
    setStatus(outcome.message, true);
    return;
  }
  if (outcome.status === 'saved') {
    title.value = outcome.name.replace(/\.docx$/i, '') || title.value;
    void saveLastDocument({ token: outcome.token, name: outcome.name, writable: true });
    setStatus(`${title.value} נשמר`);
  }
}

async function onPickAndOpen(): Promise<void> {
  if (isOpening.value) return;
  try {
    const file = await pickDocxFile();
    if (!file) return;

    if (save && swap) {
      const decision = await decideDocumentSwitch({
        isDirty: () => save!.snapshot.isDirty,
        isSaving: () => save!.snapshot.isSaving,
        confirm,
        documentName: () => title.value,
      });

      if (decision.action === 'cancel') {
        setStatus(
          decision.reason === 'saving'
            ? 'השמירה עוד רצה — רגע אחד'
            : 'הפתיחה בוטלה, והמסמך נשאר פתוח'
        );
        return;
      }

      if (decision.action === 'save-first') {
        const outcome = await save.saveNow({ suggestedName: title.value });
        if (outcome.status !== 'saved') {
          if (outcome.status === 'failed') setStatus(outcome.message, true);
          else setStatus('הפתיחה נעצרה — המסמך לא נשמר');
          return;
        }
      }
    }

    await openDocument(file);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'בחירת הקובץ נכשלה', true);
  }
}

async function onNewDocument(): Promise<void> {
  if (save && swap && save.snapshot.isDirty) {
    const decision = await decideDocumentSwitch({
      isDirty: () => save!.snapshot.isDirty,
      isSaving: () => save!.snapshot.isSaving,
      confirm,
      documentName: () => title.value,
    });
    if (decision.action === 'cancel') return;
    if (decision.action === 'save-first') {
      const outcome = await save.saveNow({ suggestedName: title.value });
      if (outcome.status !== 'saved') return;
    }
  }
  await openDocument();
}

async function onExportDocx(): Promise<void> {
  const active = swap?.current;
  if (!active) return;
  try {
    const blob = await exportDocx(active.superdoc);
    downloadBlob(blob, docxFileName(title.value));
    setStatus(`${title.value} יוצא ל-Word`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'הייצוא נכשל', true);
  }
}

function onPrint(): void {
  window.print();
}

function onUndo(): void {
  void commandAdapter.value?.run('undo');
}

function onRedo(): void {
  void commandAdapter.value?.run('redo');
}

function onTitleUpdate(newTitle: string): void {
  if (newTitle.trim()) {
    title.value = newTitle.trim();
    save?.markDirty();
  }
}

function toggleAutosave(): void {
  autosaveEnabled.value = !autosaveEnabled.value;
}

function toggleFocusMode(): void {
  isFocusMode.value = !isFocusMode.value;
}

function openFindDialog(mode: 'find' | 'replace'): void {
  findMode.value = mode;
  isFindOpen.value = true;
}

function onFindText(query: string, _dir: 'next' | 'prev'): void {
  const ui = swap?.current?.ui;
  if (ui && 'search' in ui) {
    try {
      (ui as any).search?.find?.(query);
    } catch {
      // search fallback
    }
  }
}

function onReplaceText(search: string, replace: string): void {
  const ui = swap?.current?.ui;
  if (ui && 'search' in ui) {
    try {
      (ui as any).search?.replace?.(search, replace);
    } catch {
      // replace fallback
    }
  }
}

function onReplaceAllText(search: string, replace: string): void {
  const ui = swap?.current?.ui;
  if (ui && 'search' in ui) {
    try {
      (ui as any).search?.replaceAll?.(search, replace);
    } catch {
      // replace all fallback
    }
  }
}

function onZoomChange(level: number): void {
  zoomLevel.value = level;
  void commandAdapter.value?.run('zoom', { zoom: level / 100 });
}

function onInsertCitation(): void {
  setStatus('ציטוט מאוצריא יוטמע במיקום הסמן');
}

function onSearchOtzaria(): void {
  setStatus('פותח חיפוש באוצריא...');
}

function onOpenLibrary(): void {
  setStatus('פותח את ספריית אוצריא...');
}

// קיצורי מקלדת
function onKeyDown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 's' || event.key === 'S') {
      const shortcut = saveShortcut(event, saveSnapshot.value.isSaving);
      if (shortcut.isSaveKey) {
        event.preventDefault();
        if (shortcut.handled) {
          void onSave(shortcut.saveAs);
        }
      }
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      openFindDialog('find');
    } else if (event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      openFindDialog('replace');
    } else if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      onPrint();
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown);

  if (editorStackRef.value) {
    save = initSaveCoordinator();
    swap = createEditorSwap(editorStackRef.value, (host, source) =>
      createEditor({
        container: host,
        source,
        onError: (err) => console.error('[otzaria-word] שגיאת מנוע:', err),
        onUpdate: () => save?.markDirty(),
      })
    );

    // טעינת מסמך אחרון או פתיחת מסמך ריק
    const last = await resolveLastDocument();
    if (!last) {
      await openDocument();
    } else if (!(await openDocument(last))) {
      void forgetLastDocument();
      await openDocument();
      setStatus('המסמך האחרון לא נפתח — נפתח מסמך חדש');
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});

async function resolveLastDocument(): Promise<UserFile | undefined> {
  const last = await loadLastDocument();
  if (!last) return undefined;

  const file = await resolveFileUrl(last.token);
  if (!file) {
    void forgetLastDocument();
    return undefined;
  }
  return { ...file, name: file.name || last.name, access: last.writable ? 'readwrite' : 'read' };
}
</script>

<style scoped>
.word-app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  direction: rtl;
}

.editor-stack {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: var(--color-surface-container-highest);
  overflow: hidden;
}

/* מצב מיקוד */
.word-app-shell.focus-mode :deep(.word-titlebar),
.word-app-shell.focus-mode :deep(.word-ribbon-container),
.word-app-shell.focus-mode :deep(.word-statusbar) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.word-app-shell.focus-mode:hover :deep(.word-titlebar),
.word-app-shell.focus-mode:hover :deep(.word-ribbon-container),
.word-app-shell.focus-mode:hover :deep(.word-statusbar) {
  opacity: 1;
  pointer-events: auto;
}
</style>
