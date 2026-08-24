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
      :result-text="searchCounter"
      :can-replace="searchState.canReplace"
      :is-replacing="searchState.isReplacing"
      @close="closeFindDialog"
      @find="onFindText"
      @query-change="onFindQueryChange"
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

import { createCommandAdapter, type CommandAdapter, type CommandOutcome } from './engine/command-adapter';
import { COMMAND_ADAPTER, COMMAND_REPORTER } from './composables/keys';
import { zoomPayload } from './engine/payloads';
import {
  createSearchAdapter,
  idleSearchState,
  searchCounterText,
  type SearchAdapter,
  type SearchOutcome,
  type SearchState,
} from './engine/search';
import { createEditorSwap, type EditorSwap } from './sessions/editor-swap';
import { createSaveCoordinator, type SaveCoordinator, type SaveSnapshot } from './sessions/save-coordinator';
import { createEditor } from './engine/create-editor';
import { applyHebrewDocumentDefaults } from './engine/document-defaults';
import type { SuperDoc } from 'superdoc';
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
provide(COMMAND_ADAPTER, commandAdapter);

const title = ref('מסמך חדש');
const isOpening = ref(false);
const autosaveEnabled = ref(true);
const statusText = ref('');
const isStatusError = ref(false);
const isFocusMode = ref(false);

const isFindOpen = ref(false);
const findMode = ref<'find' | 'replace'>('find');
const isAboutOpen = ref(false);

/**
 * מצב החיפוש כפי שהמנוע מדווח עליו. הדיאלוג נשען עליו למונה התוצאות ולשאלה
 * אם להציג פקדי החלפה — ולא על state מקומי משלו, שהיה יכול להראות „3 מתוך 12”
 * על מסמך שהחיפוש בו כלל לא רץ.
 */
const searchState = ref<SearchState>(idleSearchState());
const searchCounter = computed(() => searchCounterText(searchState.value));

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
  name: null,
  lastError: null,
});

let swap: EditorSwap | null = null;
let save: SaveCoordinator | null = null;
let searchAdapter: SearchAdapter | null = null;

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

/**
 * כל פקד ב-Ribbon מדווח לכאן דרך useCommand. עד עכשיו הפקדים עשו
 * `void cmd.run()` וזרקו את התוצאה, ולכן „יש למקם את הסמן במסמך” או „הפעולה
 * אינה נתמכת בגרסה הזאת של המנוע” לא הגיעו למשתמש אף פעם — הכפתור פשוט נראה
 * שבור. כאן ההודעה נכנסת לשורת המצב, ובכשל גם ללוג של אוצריא.
 */
provide(COMMAND_REPORTER, (outcome: CommandOutcome, commandId: string) => {
  if (!outcome.ok) {
    setStatus(outcome.message, true);
    console.warn(`[otzaria-word] ${commandId} נכשלה: ${outcome.message} (${outcome.reason ?? '—'})`);
    return;
  }
  // הצלחה מנקה שגיאה קודמת שנשארה על המסך, ולא דורסת הודעה תקינה.
  if (isStatusError.value) setStatus('');
});

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

/**
 * כיווניות עברית למסמך חדש. ההחלה עצמה ב-engine/document-defaults.ts; כאן רק
 * הדיווח — כשל שקט הוא בדיוק מה שהחזיר מסמך חדש ל-LTR בלי שאף אחד ידע.
 *
 * `data-document-direction` על שורש ה-HTML הוא מה שאפשר לראות מבחוץ:
 * שער `check:rtl` נשען עליו, ובלוג של אוצריא הוא מפריד בין „לא הוחל” ל„הוחל
 * ולא נראה”.
 */
async function applyNewDocumentDirection(superdoc: SuperDoc): Promise<void> {
  const report = await applyHebrewDocumentDefaults(superdoc);

  if (report.failures.length === 0) {
    document.documentElement.dataset.documentDirection = 'rtl';
    return;
  }

  delete document.documentElement.dataset.documentDirection;
  console.warn('[otzaria-word] כיווניות המסמך החדש לא הוחלה במלואה:', report.failures.join('; '));
  setStatus(`המסמך נפתח, אך כיווניות עברית לא הוחלה: ${report.failures[0]}`, true);
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

  // החיפוש שייך ל-session: ה-handle הוא של ה-controller של המופע, ומסמך חדש
  // מקבל אדפטר חדש. ה-`session` המקומי ולא `searchAdapter` בפירוק — אחרת
  // סגירת המסמך הקודם הייתה מפרקת את האדפטר של המסמך שנפתח אחריו.
  const sessionSearch = createSearchAdapter(editor.ui);
  searchAdapter = sessionSearch;
  searchState.value = sessionSearch.getState();
  editor.onDispose(
    sessionSearch.subscribe((state) => {
      searchState.value = state;
    })
  );
  editor.onDispose(() => {
    sessionSearch.dispose();
    if (searchAdapter === sessionSearch) {
      searchAdapter = null;
      searchState.value = idleSearchState();
    }
  });

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
    await applyNewDocumentDirection(editor.superdoc);
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

/**
 * הדיאלוג הוא שלנו ולא ה-surface המובנה של המנוע
 * (`modules: { surfaces: { findReplace: true } }`) — החלטה, לא שכחה: המנוע רץ
 * כאן ב-`ui: false`, הממשק כולו עברי ומימין לשמאל, ואילו ה-surface המובנה הוא
 * חלון באנגלית בעיצוב של SuperDoc שאין דרך ציבורית לתרגם או לעצב. הפעולות
 * עצמן כן עוברות דרך `ui.search` — אותה שכבה שה-surface הזה נשען עליה — ולכן
 * אין כאן מימוש חיפוש מקביל.
 */
function openFindDialog(mode: 'find' | 'replace'): void {
  findMode.value = mode;
  isFindOpen.value = true;
  // פתיחת הדיאלוג פותחת session במנוע; בלעדיו `search` נכשל סגור.
  reportSearch(searchAdapter?.open());
}

function closeFindDialog(): void {
  isFindOpen.value = false;
  // סגירה מנקה את ההדגשות במסמך. בלעדיה הן נשארות אחרי שהדיאלוג נעלם.
  searchAdapter?.close();
}

/** התוצאה של כל פעולת חיפוש עוברת כאן: כשל לשורת המצב, הצלחה למונה. */
function reportSearch(outcome: SearchOutcome | undefined): void {
  if (!outcome) {
    setStatus('אין מסמך פתוח לחיפוש', true);
    return;
  }
  if (!outcome.ok) {
    setStatus(outcome.message, true);
    return;
  }
  searchState.value = outcome.snapshot;
}

function onFindText(query: string, direction: 'next' | 'prev'): void {
  reportSearch(searchAdapter?.find(query, direction));
}

/** הקלדה בשדה החיפוש. ההשקטה עצמה באדפטר, כדי שתהיה נבדקת. */
function onFindQueryChange(query: string): void {
  searchAdapter?.findDebounced(query, reportSearch);
}

/**
 * החלפה היא capability gate ולא תכולה מובטחת: ב-superdoc@2.8.0 `canReplace`
 * מדווח `true`, אבל נמדד ש-`replace`/`replaceAll` מחזירים
 * `operation-unavailable`. לכן הכשל מגיע לשורת המצב עם ההקשר שהוא כשל של
 * החלפה — לא נבלע, ולא מתחפש להודעת חיפוש.
 */
function reportReplace(outcome: SearchOutcome | undefined, success: string): void {
  if (!outcome) {
    setStatus('אין מסמך פתוח להחלפה', true);
    return;
  }
  if (!outcome.ok) {
    setStatus(`ההחלפה לא בוצעה: ${outcome.message}`, true);
    return;
  }
  searchState.value = outcome.snapshot;
  setStatus(success);
}

async function onReplaceText(replacement: string): Promise<void> {
  reportReplace(await searchAdapter?.replace(replacement), 'המופע הוחלף');
}

async function onReplaceAllText(replacement: string): Promise<void> {
  // נקרא לפני הפעולה: אחריה קבוצת ההתאמות כבר התרוקנה.
  const matches = searchAdapter?.getState().total ?? 0;
  reportReplace(await searchAdapter?.replaceAll(replacement), `הוחלפו ${matches} מופעים`);
}

/**
 * חוזה הזום: `run('zoom', <אחוזים>)` — 100 הוא 100%, ו-`zoomPayload` בונה את
 * הצורה שהמנוע מקבל. `{ zoom: level / 100 }` שהיה כאן נדחה ב-
 * `instanceCommandPayloadIsValid` (הוא דורש `typeof payload === 'number'`
 * אחרי הנרמול) — התווית בשורת המצב התחדשה, והמסמך לא זז.
 *
 * הגבולות של הסרגל אינם קשיחים אלא `min`/`max` מ-`ui.zoom.getSnapshot()`;
 * ה-StatusBar עדיין מגביל 50–200 בעצמו.
 */
function onZoomChange(level: number): void {
  const payload = zoomPayload(level);
  if (payload === null) return;
  zoomLevel.value = level;
  void commandAdapter.value?.run('zoom', payload);
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

/**
 * האם הפוקוס בשדה טקסט של הממשק שלנו (שם המסמך, שדות החיפוש). התכנית אוסרת
 * לדרוס שם קיצור שאינו עריכת מסמך: Ctrl+F בתוך שדה הוא קיצור של השדה.
 * הבדיקה על `tagName` בלבד — אזור המסמך של המנוע אינו `input`, ולכן קיצורי
 * המסמך ממשיכים לעבוד כשהסמן בתוכו.
 */
function isTextEntryTarget(event: KeyboardEvent): boolean {
  const tag = (event.target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

// קיצורי מקלדת
function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (isFindOpen.value) {
      closeFindDialog();
      event.preventDefault();
    }
    if (isAboutOpen.value) {
      isAboutOpen.value = false;
      event.preventDefault();
    }
    return;
  }

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
      if (isTextEntryTarget(event)) return;
      event.preventDefault();
      openFindDialog('find');
    } else if (event.key === 'h' || event.key === 'H') {
      if (isTextEntryTarget(event)) return;
      event.preventDefault();
      openFindDialog('replace');
    } else if (event.key === 'p' || event.key === 'P') {
      if (isTextEntryTarget(event)) return;
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
  // חיפוש-בזמן-הקלדה שממתין ירוץ אחרי הפירוק על handle של controller מפורק.
  searchAdapter?.dispose();
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
