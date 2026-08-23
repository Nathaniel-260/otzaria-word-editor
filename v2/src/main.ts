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
import { installBundledFonts } from './styles/fonts';
import { confirm, notifyError, onThemeChanged, resolveBoot } from './host/otzaria-client';
import { applyTheme } from './host/theme';
import {
  abortBinaryWrite,
  beginBinaryWrite,
  commitUserFileWrite,
  pickDocxFile,
  resolveFileUrl,
  uploadBytes,
  type UserFile,
} from './host/files';
import { forgetLastDocument, loadLastDocument, saveLastDocument } from './host/settings';
import { downloadBlob } from './host/download';
import { createEditor } from './engine/create-editor';
import { createEditorSwap } from './sessions/editor-swap';
import { createSaveCoordinator, type SaveSnapshot } from './sessions/save-coordinator';
import { decideDocumentSwitch, saveShortcut } from './sessions/open-flow';
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
  // לפני כל השאר: ה-@font-face של הגופן הארוז. מסמך שנפתח לפני שהגופן הוצהר
  // נמדד בגופן אחר ואז מתעמד מחדש.
  installBundledFonts();

  if (import.meta.env.DEV) {
    const { installDevStub } = await import('./host/dev-stub');
    installDevStub();
  }

  // ה-latch של plugin.boot יושב ב-<head> של index.html ורץ לפני הבאנדל הזה,
  // מפני שהאירוע נורה פעם אחת ואינו משוחזר. resolveBoot נופלת משם לשחזור
  // ב-RPC אם האירוע בכל זאת אבד — ראו host/otzaria-client.ts.
  const boot = resolveBoot();

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
    abort: abortBinaryWrite,
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

  /** `true` אם המסמך נפתח. `false` על כשל או על החלפה. */
  async function openDocument(file?: UserFile): Promise<boolean> {
    openBtn.disabled = true;
    const startedAt = performance.now();
    status(file ? `פותח את ${file.name}…` : 'פותח מסמך ריק…');

    const outcome = await swap.open(file?.url);
    openBtn.disabled = swap.isOpening;

    if (outcome.status === 'superseded') return false;

    if (outcome.status === 'failed') {
      // הודעות המנוע באנגלית ולא חסומות מלמעלה, ולכן הן נכנסות אחרי משפט
      // בעברית שאומר מה קרה — ולא במקומו.
      // המסמך שהיה פעיל נשאר פעיל, ולכן גם הפקדים שלו נשארים כפי שהיו.
      const kept = swap.current ? ` ${title} נשאר פתוח.` : '';
      status(`פתיחת המסמך נכשלה: ${outcome.error.message}.${kept}`, true);
      return false;
    }

    const editor = outcome.session;
    commands = createCommandAdapter(editor.ui);
    title = file ? file.name.replace(/\.docx$/i, '') : 'מסמך חדש';
    status(`${title} — נטען ב-${Math.round(performance.now() - startedAt)} מילישניות`);
    if (file && file.access !== 'readwrite') {
      status(`${title} — פתוח לקריאה; „שמור” יבקש מקום חדש`);
    }

    // מסמך חדש מתחיל נקי. token לקריאה בלבד אינו יעד כתיבה, ולכן „שמור”
    // הראשון שלו יפתח „שמור בשם” — וזה בדיוק מה שה-SDK אוכף.
    save.reset(
      file && file.access === 'readwrite' ? { token: file.token, name: file.name } : null,
    );

    // מה שנשמר הוא ה-token, לא ה-URL: ה-URL תקף לריצה אחת בלבד.
    if (file) {
      void saveLastDocument({
        token: file.token,
        name: file.name,
        writable: file.access === 'readwrite',
      });
    } else {
      void forgetLastDocument();
    }

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
    return true;
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

  /** ההחלטות עצמן ב-sessions/open-flow.ts, כדי שיהיו נבדקות. */
  function decideSwitch(): ReturnType<typeof decideDocumentSwitch> {
    return decideDocumentSwitch({
      isDirty: () => save.snapshot.isDirty,
      isSaving: () => save.snapshot.isSaving,
      confirm,
      documentName: () => title,
    });
  }

  openBtn.addEventListener('click', () => {
    void (async () => {
      openBtn.disabled = true;
      try {
        const file = await pickDocxFile();
        // ביטול הבורר אינו כשל ואינו נוגע במסמך הפתוח.
        if (!file) return;

        // ההחלטה נלקחת אחרי הבורר: אין לשאול על שמירה מי שרק פתח דיאלוג
        // וביטל אותו.
        const decision = await decideSwitch();
        if (decision.action === 'cancel') {
          status(
            decision.reason === 'saving'
              ? 'השמירה עוד רצה — רגע אחד'
              : 'הפתיחה בוטלה, והמסמך נשאר פתוח',
          );
          return;
        }

        if (decision.action === 'save-first') {
          const outcome = await save.saveNow({ suggestedName: title });
          // שמירה שלא הצליחה — כולל ביטול „שמור בשם” — עוצרת את הפתיחה. אחרת
          // המשתמש ביקש לשמור, לא הצליח, והמסמך נמחק בכל זאת.
          if (outcome.status !== 'saved') {
            if (outcome.status === 'failed') status(outcome.message, true);
            else status('הפתיחה נעצרה — המסמך לא נשמר');
            return;
          }
        }

        await openDocument(file);
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

  /** מציג את תוצאת השמירה. „בוטל” ו„הוחלף” אינם שגיאה ואינם מודיעים למשתמש. */
  async function runSave(forceSaveAs: boolean): Promise<void> {
    if (!swap.current) return;
    const outcome = await save.saveNow({ forceSaveAs, suggestedName: title });

    if (outcome.status === 'failed') {
      status(outcome.message, true);
      return;
    }
    if (outcome.status === 'saved') {
      title = outcome.name.replace(/\.docx$/i, '') || title;
      // „שמור בשם” מחזיר token חדש; זה מה שצריך להיפתח בהפעלה הבאה.
      void saveLastDocument({ token: outcome.token, name: outcome.name, writable: true });
      status(`${title} נשמר`);
    }
  }

  saveBtn.addEventListener('click', () => void runSave(false));
  saveAsBtn.addEventListener('click', () => void runSave(true));

  // Ctrl/Cmd+S. preventDefault תמיד, גם בלי מסמך: אחרת ה-WebView פותח את
  // דיאלוג השמירה של הדף.
  window.addEventListener('keydown', (event) => {
    const shortcut = saveShortcut(event, save.snapshot.isSaving);
    if (!shortcut.isSaveKey) return;
    event.preventDefault();
    if (!shortcut.handled) return;
    void runSave(shortcut.saveAs);
  });

  try {
    const info = await boot;
    applyTheme(info.theme);
    onThemeChanged(applyTheme);
    // הכפתור נפתח רק כאן: לחיצה לפני ה-boot הייתה יכולה להתחיל פתיחה שהמסמך
    // הריק של האתחול יחליף — כלומר בחירת המשתמש נעלמת בשקט.
    openBtn.disabled = false;
    if (info.source === 'recovered') {
      // לא שגיאה — התוסף עלה. נרשם כדי שמסלול שאמור להיות נדיר לא יהפוך
      // לשקוף, ושתהיה עדות אם הוא קורה תמיד.
      console.warn('[otzaria-word] plugin.boot אבד; מצב האתחול שוחזר ב-RPC');
    }
    status(`אוצריא ${info.app.version} · ${info.app.platform} — בחר קובץ Word כדי להתחיל`);
  } catch (error) {
    status(error instanceof Error ? error.message : 'אוצריא לא אתחלה את התוסף', true);
    return;
  }

  // מסמך ריק בעליית הלשונית מרים את כל המנוע ושני workers גם אם המשתמש לא
  // יפתח קובץ. מתאים ל-spike; בשלב ה-Ribbon יש להחליף במסך פתיחה שמקים את
  // המנוע רק כשבאמת צריך.
  // המסמך האחרון, ואם הוא לא נפתח — מסמך ריק. תוסף שנפתח בלי שום מסמך, רק
  // כי קובץ מהפעם הקודמת נפגם, אינו שמיש.
  const last = await resolveLastDocument();
  if (!last) {
    await openDocument();
    return;
  }
  if (!(await openDocument(last))) {
    void forgetLastDocument();
    await openDocument();
    // בלי isError: הכשל עצמו כבר הודיע למשתמש, ושתי הודעות שגיאה על אותו
    // אירוע הן רעש. זו ההשלמה — מה קרה בסוף.
    status('המסמך האחרון לא נפתח — נפתח מסמך חדש');
  }
}

/**
 * המסמך שהיה פתוח בהפעלה הקודמת.
 *
 * ה-token נשמר ב-storage וה-URL נבנה מחדש כאן, כי הפורט של שרת ה-loopback
 * מתחלף בכל הפעלה. קובץ שהוזז או נמחק מחזיר null — זה לא כשל, וזה גם לא
 * לולאת שגיאה: ה-grant נשכח ונפתח מסמך ריק.
 */
async function resolveLastDocument(): Promise<UserFile | undefined> {
  const last = await loadLastDocument();
  if (!last) return undefined;

  const file = await resolveFileUrl(last.token);
  if (!file) {
    void forgetLastDocument();
    return undefined;
  }
  // ה-access אינו חוזר מ-resolveFileUrl; מה שנשמר הוא מה שהיה בפתיחה.
  return { ...file, name: file.name || last.name, access: last.writable ? 'readwrite' : 'read' };
}

void main();
