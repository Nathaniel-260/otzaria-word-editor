/**
 * נקודת הכניסה — מעטפת שלב 0.
 *
 * המטרה כאן אינה ממשק אלא הוכחה: ששרשרת SuperDoc v2 + מנוע ה-DOCX + ה-workers
 * חיה בתוסף **ארוז** ב-WebView של אוצריא, שאפשר לפתוח DOCX דרך בורר הקבצים של
 * אוצריא, להריץ פקודה, ולייצא קובץ שנפתח ב-Word. זה שער A ושער B בתכנית
 * (docs/word-plugin-implementation-plan.md §6). ה-Ribbon האמיתי נבנה בשלב 3,
 * ב-Vue, ומחליף את המעטפת הזאת.
 */
import './styles/tokens.css';
import './styles/shell.css';
import { notifyError, onThemeChanged, waitForBoot } from './host/otzaria-client';
import { applyTheme } from './host/theme';
import {
  beginBinaryWrite,
  commitUserFileWrite,
  pickDocxFile,
  uploadBytes,
  type UserFile,
} from './host/files';
import { downloadBlob } from './host/download';
import { createEditor } from './engine/create-editor';
import { createEditorSwap } from './sessions/editor-swap';
import { createSaveCoordinator, type SaveSnapshot } from './sessions/save-coordinator';
import { createCommandAdapter, type CommandAdapter } from './engine/command-adapter';
import { docxFileName, exportDocx } from './engine/export';

/** ב-build הסקריפט קלאסי, כלומר הוא עשוי לרוץ לפני שה-body נפרס. */
function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

const SHELL = `
  <header class="topbar"><span class="topbar__title">וורד לאוצריא</span></header>
  <div class="toolbar">
    <button id="open" type="button" disabled>פתיחת קובץ Word</button>
    <button id="save" type="button" disabled>שמור</button>
    <button id="save-as" type="button" disabled>שמור בשם</button>
    <button id="export" type="button" disabled>ייצוא ל-Word</button>
    <button id="bold" type="button" disabled aria-pressed="false">מודגש</button>
    <button id="rtl" type="button" disabled>כיוון מימין לשמאל</button>
  </div>
  <main id="editor" class="editor-stack"></main>
  <footer id="status" class="status" role="status">ממתין לטעינת אוצריא…</footer>
`;

async function main(): Promise<void> {
  if (import.meta.env.DEV) {
    const { installDevStub } = await import('./host/dev-stub');
    installDevStub();
  }

  // ה-latch של plugin.boot נרשם בייבוא של host/otzaria-client, לפני ה-await
  // הזה — האירוע נורה פעם אחת ואינו משוחזר.
  const boot = waitForBoot();

  await domReady();

  const app = document.getElementById('app');
  if (!app) throw new Error('חסר #app ב-index.html');
  app.innerHTML = SHELL;

  const statusEl = app.querySelector<HTMLElement>('#status')!;
  const editorStack = app.querySelector<HTMLElement>('#editor')!;
  const openBtn = app.querySelector<HTMLButtonElement>('#open')!;
  const exportBtn = app.querySelector<HTMLButtonElement>('#export')!;
  const saveBtn = app.querySelector<HTMLButtonElement>('#save')!;
  const saveAsBtn = app.querySelector<HTMLButtonElement>('#save-as')!;
  const boldBtn = app.querySelector<HTMLButtonElement>('#bold')!;
  const rtlBtn = app.querySelector<HTMLButtonElement>('#rtl')!;

  function status(text: string, isError = false): void {
    baseStatus = isError ? '' : text;
    statusEl.textContent = text;
    statusEl.classList.toggle('status--error', isError);
    if (isError) notifyError(text);
  }

  let commands: CommandAdapter | null = null;
  let title = 'מסמך חדש';
  /** ההודעה שאינה נוגעת לשמירה, כדי שהמצב יוכל להתרפרש בלעדיה. */
  let baseStatus = '';

  /**
   * השמירה עצמה יושבת ב-sessions/save-coordinator.ts, כדי שהכלל „מסמך שלא
   * נשמר בוודאות נשאר מלוכלך” יהיה נבדק ולא תלוי במעטפת הזאת.
   */
  const save = createSaveCoordinator({
    exportDocument: () => {
      const active = swap.current;
      if (!active) throw new Error('אין מסמך פתוח');
      return exportDocx(active.superdoc);
    },
    beginWrite: (size) => beginBinaryWrite(size),
    upload: uploadBytes,
    commit: (input) =>
      commitUserFileWrite({
        writeToken: input.writeToken,
        targetToken: input.targetToken,
        suggestedName: input.suggestedName ?? title,
        title: 'שמירת המסמך',
      }),
    onStateChange: renderSaveState,
  });

  function renderSaveState(snapshot: SaveSnapshot): void {
    // מסמך שלא נשמר מעולם אינו „נשמר” ואינו „לא נשמר” — אין לו מה להשוות
    // אליו. הצגת „נשמר” עליו היא בדיוק ההטעיה שכל המודול הזה בא למנוע.
    const idleLabel = snapshot.isDirty
      ? 'לא נשמר'
      : snapshot.targetToken
        ? 'נשמר'
        : 'טרם נשמר';
    const label: Record<SaveSnapshot['state'], string> = {
      idle: idleLabel,
      exporting: 'מייצא…',
      uploading: 'שומר…',
      committing: 'שומר…',
      error: 'השמירה נכשלה',
    };
    saveBtn.textContent = snapshot.isDirty ? 'שמור •' : 'שמור';
    saveBtn.disabled = snapshot.state !== 'idle' && snapshot.state !== 'error';
    saveAsBtn.disabled = saveBtn.disabled;
    statusEl.textContent = baseStatus
      ? `${baseStatus} · ${label[snapshot.state]}`
      : label[snapshot.state];
    statusEl.classList.toggle('status--error', snapshot.state === 'error');
  }

  // ההחלפה עצמה — טעינה ל-host נפרד והחלפה רק אחרי onReady — יושבת ב-
  // sessions/editor-swap.ts, כדי שהיא תהיה נבדקת ולא תלויה במעטפת הזאת.
  const swap = createEditorSwap(editorStack, (host, source) =>
    createEditor({
      container: host,
      source,
      onError: (error) => console.error('[otzaria-word] המנוע דיווח על שגיאה', error),
      onUpdate: () => save.markDirty(),
    }),
  );

  async function openDocument(file?: UserFile): Promise<void> {
    openBtn.disabled = true;
    const startedAt = performance.now();
    status(file ? `פותח את ${file.name}…` : 'פותח מסמך ריק…');

    const outcome = await swap.open(file?.url);
    openBtn.disabled = swap.isOpening;

    if (outcome.status === 'superseded') return;

    if (outcome.status === 'failed') {
      // הודעות המנוע באנגלית ולא חסומות מלמעלה, ולכן הן נכנסות אחרי משפט
      // בעברית שאומר מה קרה — ולא במקומו.
      // המסמך שהיה פעיל נשאר פעיל, ולכן גם הפקדים שלו נשארים כפי שהיו.
      const kept = swap.current ? ` ${title} נשאר פתוח.` : '';
      status(`פתיחת המסמך נכשלה: ${outcome.error.message}.${kept}`, true);
      return;
    }

    const editor = outcome.session;
    commands = createCommandAdapter(editor.ui);
    title = file ? file.name.replace(/\.docx$/i, '') : 'מסמך חדש';
    status(`${title} — נטען ב-${Math.round(performance.now() - startedAt)} מילישניות`);

    // מסמך חדש מתחיל נקי. token לקריאה בלבד אינו יעד כתיבה, ולכן „שמור”
    // הראשון שלו יפתח „שמור בשם” — וזה בדיוק מה שה-SDK אוכף.
    save.reset(
      file && file.access === 'readwrite' ? { token: file.token, name: file.name } : null,
    );

    for (const button of [exportBtn, saveBtn, saveAsBtn, boldBtn, rtlBtn]) {
      button.disabled = false;
    }

    // המצב מגיע מהמנוע ולא מחישוב DOM, וה-subscription מתבטל עם הפירוק.
    editor.onDispose(
      commands.observe('bold', (state) => {
        boldBtn.setAttribute('aria-pressed', String(state.active));
        boldBtn.disabled = !state.enabled;
      }),
    );
  }

  /** מריצה פקודה ומדווחת כשל בעברית. */
  async function run(id: string): Promise<void> {
    const outcome = await commands?.run(id);
    if (outcome && !outcome.ok) status(outcome.message, true);
  }

  // הפקד לא לוקח את הפוקוס: בלי זה הבחירה במסמך נעלמת לפני שהפקודה רצה.
  for (const button of [exportBtn, saveBtn, saveAsBtn, boldBtn, rtlBtn]) {
    button.addEventListener('mousedown', (event) => event.preventDefault());
  }

  openBtn.addEventListener('click', () => {
    void (async () => {
      openBtn.disabled = true;
      try {
        const file = await pickDocxFile();
        // ביטול הבורר אינו כשל ואינו נוגע במסמך הפתוח.
        if (file) await openDocument(file);
      } catch (error) {
        status(error instanceof Error ? error.message : 'בחירת הקובץ נכשלה', true);
      } finally {
        if (!swap.isOpening) openBtn.disabled = false;
      }
    })();
  });

  exportBtn.addEventListener('click', () => {
    void (async () => {
      const active = swap.current;
      if (!active) return;
      try {
        downloadBlob(await exportDocx(active.superdoc), docxFileName(title));
        status(`${title} יוצא ל-Word`);
      } catch (error) {
        status(error instanceof Error ? error.message : 'הייצוא נכשל', true);
      }
    })();
  });

  boldBtn.addEventListener('click', () => void run('bold'));
  rtlBtn.addEventListener('click', () => void run('direction-rtl'));

  /** מציג את תוצאת השמירה. „בוטל” אינו שגיאה ואינו מודיע למשתמש. */
  async function runSave(forceSaveAs: boolean): Promise<void> {
    if (!swap.current) return;
    const outcome = await save.saveNow({ forceSaveAs, suggestedName: title });

    if (outcome.status === 'failed') {
      status(outcome.message, true);
      return;
    }
    if (outcome.status === 'saved') {
      title = outcome.name.replace(/\.docx$/i, '') || title;
      status(`${title} נשמר`);
    }
  }

  saveBtn.addEventListener('click', () => void runSave(false));
  saveAsBtn.addEventListener('click', () => void runSave(true));

  // Ctrl/Cmd+S. preventDefault תמיד, גם בלי מסמך: אחרת ה-WebView פותח את
  // דיאלוג השמירה של הדף.
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 's' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    void runSave(event.shiftKey);
  });

  try {
    const info = await boot;
    applyTheme(info.theme);
    onThemeChanged(applyTheme);
    // הכפתור נפתח רק כאן: לחיצה לפני ה-boot הייתה יכולה להתחיל פתיחה שהמסמך
    // הריק של האתחול יחליף — כלומר בחירת המשתמש נעלמת בשקט.
    openBtn.disabled = false;
    status(`אוצריא ${info.app.version} · ${info.app.platform} — בחר קובץ Word כדי להתחיל`);
  } catch (error) {
    status(error instanceof Error ? error.message : 'אוצריא לא אתחלה את התוסף', true);
    return;
  }

  // מסמך ריק בעליית הלשונית מרים את כל המנוע ושני workers גם אם המשתמש לא
  // יפתח קובץ. מתאים ל-spike; בשלב ה-Ribbon יש להחליף במסך פתיחה שמקים את
  // המנוע רק כשבאמת צריך.
  await openDocument();
}

void main();
