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
import { pickDocxFile, type UserFile } from './host/files';
import { downloadBlob } from './host/download';
import { createEditor, type EditorSession } from './engine/create-editor';
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
    <button id="open" type="button">פתיחת קובץ Word</button>
    <button id="export" type="button" disabled>ייצוא ל-Word</button>
    <button id="bold" type="button" disabled aria-pressed="false">מודגש</button>
    <button id="rtl" type="button" disabled>כיוון מימין לשמאל</button>
  </div>
  <main id="editor" class="editor-host"></main>
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
  const editorHost = app.querySelector<HTMLElement>('#editor')!;
  const openBtn = app.querySelector<HTMLButtonElement>('#open')!;
  const exportBtn = app.querySelector<HTMLButtonElement>('#export')!;
  const boldBtn = app.querySelector<HTMLButtonElement>('#bold')!;
  const rtlBtn = app.querySelector<HTMLButtonElement>('#rtl')!;

  function status(text: string, isError = false): void {
    statusEl.textContent = text;
    statusEl.classList.toggle('status--error', isError);
    if (isError) notifyError(text);
  }

  let session: EditorSession | null = null;
  let commands: CommandAdapter | null = null;
  let title = 'מסמך חדש';

  async function openDocument(file?: UserFile): Promise<void> {
    session?.destroy();
    session = null;
    commands = null;
    editorHost.replaceChildren();
    for (const button of [exportBtn, boldBtn, rtlBtn]) button.disabled = true;

    const startedAt = performance.now();
    status(file ? `פותח את ${file.name}…` : 'פותח מסמך ריק…');

    try {
      const editor = await createEditor({
        container: editorHost,
        source: file?.url,
        onError: (error) => console.error('[otzaria-word] המנוע דיווח על שגיאה', error),
      });
      session = editor;
      commands = createCommandAdapter(editor.ui);

      title = file ? file.name.replace(/\.docx$/i, '') : 'מסמך חדש';
      status(`${title} — נטען ב-${Math.round(performance.now() - startedAt)} מילישניות`);

      for (const button of [exportBtn, boldBtn, rtlBtn]) button.disabled = false;

      // המצב מגיע מהמנוע ולא מחישוב DOM, וה-subscription מתבטל עם הפירוק.
      editor.onDispose(
        commands.observe('bold', (state) => {
          boldBtn.setAttribute('aria-pressed', String(state.active));
          boldBtn.disabled = !state.enabled;
        }),
      );
    } catch (error) {
      status(error instanceof Error ? error.message : 'טעינת המסמך נכשלה', true);
    }
  }

  /** מריצה פקודה ומדווחת כשל בעברית. */
  async function run(id: string): Promise<void> {
    const outcome = await commands?.run(id);
    if (outcome && !outcome.ok) status(outcome.message, true);
  }

  // הפקד לא לוקח את הפוקוס: בלי זה הבחירה במסמך נעלמת לפני שהפקודה רצה.
  for (const button of [exportBtn, boldBtn, rtlBtn]) {
    button.addEventListener('mousedown', (event) => event.preventDefault());
  }

  openBtn.addEventListener('click', () => {
    void (async () => {
      try {
        const file = await pickDocxFile();
        if (file) await openDocument(file);
      } catch (error) {
        status(error instanceof Error ? error.message : 'בחירת הקובץ נכשלה', true);
      }
    })();
  });

  exportBtn.addEventListener('click', () => {
    void (async () => {
      if (!session) return;
      try {
        downloadBlob(await exportDocx(session.superdoc), docxFileName(title));
        status(`${title} יוצא ל-Word`);
      } catch (error) {
        status(error instanceof Error ? error.message : 'הייצוא נכשל', true);
      }
    })();
  });

  boldBtn.addEventListener('click', () => void run('bold'));
  rtlBtn.addEventListener('click', () => void run('direction-rtl'));

  try {
    const info = await boot;
    applyTheme(info.theme);
    onThemeChanged(applyTheme);
    status(`אוצריא ${info.app.version} · ${info.app.platform} — בחר קובץ Word כדי להתחיל`);
  } catch (error) {
    status(error instanceof Error ? error.message : 'אוצריא לא אתחלה את התוסף', true);
    return;
  }

  await openDocument();
}

void main();
