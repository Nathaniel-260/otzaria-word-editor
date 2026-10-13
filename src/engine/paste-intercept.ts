/**
 * Ctrl+V לפי ברירת המחדל שהמשתמש בחר („הגדר הדבקת ברירת מחדל” של Word).
 *
 * ## למה לחטוף את האירוע, ולא קיצור מקלדת
 *
 * Ctrl+V מסומן ברג'יסטרי כ-`native` — המנוע מטפל בו בתוך המסמך, עם ה-
 * `clipboardData` של האירוע. זה מה שמאפשר לו לעבוד ב-`file://` בלי הרשאת
 * `clipboard-read` (engine/clipboard.ts, „מה אינו ודאי”). קיצור שהיה קורא
 * ל-`pasteFromClipboard` היה מאבד בדיוק את זה, ונופל ל„אין הרשאה לקרוא את
 * הלוח”. לכן נחטף **אירוע ה-`paste`** עצמו, והתוכן שלו נקרא ממנו — אותו ערוץ
 * שהמנוע היה קורא בו.
 *
 * ## מתי לא
 *
 * „שמירה על עיצוב המקור” אינה נחטפת: זו ההדבקה של המנוע, והיא נשארת שלו
 * במלואה — כולל RTF וקבצים, שמסלול ה-`parse` אינו מקבל. כך ברירת המחדל של
 * התוכנה אינה משנה דבר למי שלא בחר אחרת.
 *
 * ## למה גם `keydown`
 *
 * נמדד (Chrome על ה-dist הארוז, superdoc 2.20): Ctrl+V אינו מגיע לדף
 * כאירוע `paste` בכלל — גם מאזין `capture` על `window` שנרשם **לפני** שהמנוע
 * נטען ראה `keydown` בלבד, והטקסט הודבק. המנוע מטפל בצירוף ב-`keydown` שלו,
 * מבטל את ברירת המחדל של הדפדפן וקורא את הלוח בעצמו. אירוע `paste` סינתטי
 * שנשלח ל-TEXTAREA שלו, מנגד, נבלע בלי להדביק.
 *
 * לכן, כשברירת המחדל אינה של המנוע, ה-`keydown` של Ctrl+V נעצר על ה-container
 * לפני שהוא יורד אליו — **בלי** `preventDefault`. הדפדפן ממשיך לפעולת ברירת
 * המחדל שלו, שהיא הדבקה: אירוע `paste` trusted, עם `clipboardData` מלא ובלי
 * צורך בהרשאת `clipboard-read` — והוא נתפס כאן למטה.
 *
 * ## למה `capture` על ה-container, ו-`stopPropagation` ולא `Immediate`
 *
 * המאזין הזה חייב לרוץ לפני המנוע, שמאזין על האלמנט שבתוך ה-container.
 * `stopPropagation` עוצר את האירוע לפני שהוא יורד אליו, אבל משאיר את שאר
 * מאזיני ה-capture על אותו container — זיהוי הרשימות (list-autoformat-install)
 * ו-@ (at-mention-overlay) מאזינים שם ל-`paste` כדי לדעת שהייתה עריכה, והם
 * צריכים לדעת גם על הדבקה שעברה כאן.
 */
import type { CommandOutcome } from './command-adapter';
import {
  pasteFromClipboard,
  type ClipboardHostTarget,
  type ClipboardPayload,
  type ClipboardPayloadItem,
} from './clipboard';
import type { PasteMode } from './paste-formatting';

/**
 * הטיפוסים שנקראים מהאירוע. ה-fragment הפרטי של המנוע ראשון: העתקה בתוך
 * התוסף נושאת אותו, וה-`parse` מעדיף אותו על HTML — הוא הייצוג הנאמן ביותר
 * של מה שהועתק, וממנו „מזג עיצוב” מנקה את מה שצריך.
 */
const EVENT_TEXT_TYPES = [
  'application/x-superdoc-v2-fragment-v2.2',
  'application/x-superdoc-v2-fragment',
  'text/html',
  'text/plain',
] as const;

/**
 * התוכן של אירוע ההדבקה, כ-`ClipboardPayload`.
 *
 * טקסט בלבד, בכוונה: `getData` סינכרוני ותקף רק בתוך האירוע, ותמונה דורשת
 * `arrayBuffer()` — קריאה א-סינכרונית. „שמירת טקסט בלבד” ממילא זורקת אותה,
 * ו„מזג עיצוב” של תמונה בלבד אינו שונה מ„שמירה על עיצוב המקור” — ולכן אירוע
 * שאין בו טקסט כלל נשאר למנוע (`null`).
 */
export function payloadFromEvent(data: DataTransfer | null): ClipboardPayload | null {
  if (!data) return null;
  const types = Array.from(data.types ?? []);
  const items: ClipboardPayloadItem[] = [];
  for (const type of EVENT_TEXT_TYPES) {
    if (!types.includes(type)) continue;
    const value = data.getData(type);
    if (value) items.push({ type, kind: 'string', data: value });
  }
  return items.length > 0 ? { source: 'browser', items } : null;
}

/**
 * Ctrl+V — ולא Ctrl+Shift+V, שהוא „הדבק כטקסט” של המנוע ונשאר שלו. לפי `code`
 * ולא לפי `key`: בפריסה עברית אותו מקש הוא „ה”.
 */
function isPasteChord(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.code === 'KeyV';
}

export interface PasteInterceptOptions {
  container: HTMLElement;
  host: ClipboardHostTarget;
  /** ברירת המחדל הנוכחית. נקראת בכל אירוע, ולכן החלפה אינה דורשת התקנה מחדש. */
  mode: () => PasteMode;
  report: (outcome: CommandOutcome) => void;
}

export function installPasteIntercept({ container, host, mode, report }: PasteInterceptOptions): { dispose(): void } {
  const onPaste = (event: ClipboardEvent): void => {
    const current = mode();
    if (current === 'keep-source' || event.defaultPrevented) return;
    // שדה קלט אמיתי בתוך ה-container (שדה חיפוש של שכבה, למשל) מדביק לעצמו.
    if (event.target instanceof HTMLInputElement) return;

    const payload = payloadFromEvent(event.clipboardData);
    if (!payload) return;

    event.preventDefault();
    event.stopPropagation();
    void pasteFromClipboard(host, { mode: current, payload }).then(report);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (mode() === 'keep-source' || event.defaultPrevented) return;
    if (!isPasteChord(event)) return;
    if (event.target instanceof HTMLInputElement) return;
    // בלי `preventDefault`: ההדבקה של הדפדפן היא מה שמביא את אירוע ה-`paste`.
    event.stopPropagation();
  };

  container.addEventListener('keydown', onKeyDown, true);
  container.addEventListener('paste', onPaste, true);
  return {
    dispose() {
      container.removeEventListener('keydown', onKeyDown, true);
      container.removeEventListener('paste', onPaste, true);
    },
  };
}
