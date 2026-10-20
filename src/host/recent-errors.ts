/**
 * השגיאות האחרונות שהדף ראה, בשביל „דיווח על באג”.
 *
 * ## למה בכלל
 *
 * מי שמדווח „זה נתקע” אינו יודע מה קרה, ואין לו קונסול: התוסף רץ ב-WebView
 * בתוך אוצריא, בלי DevTools. מה שהדף הדפיס ל-`console.error` ומה שזרק בלי
 * שנתפס הוא בדרך כלל כל מה שיש למפתח ביד — ולכן הוא נאסף כאן, בזיכרון בלבד,
 * ומוצג למשתמש בתוך הדיווח **לפני** שהוא נשלח.
 *
 * ## מה נשמר, ומה לא
 *
 * הודעה בלבד, מקוצרת, ובלי ערכים שאינם טקסט: אובייקט שנמסר ל-`console.error`
 * נרשם כשם הסוג שלו ולא כתוכנו, כי תוכן כזה עשוי להיות צומת של המסמך. הודעות
 * עוברות `scrubDiagnostic` (נתיבי משתמש, כתובות מייל) כבר ברישום, כך שגם
 * מה שמוצג בתצוגה המקדימה כבר נקי.
 *
 * אין כאן שמירה לדיסק ואין שליחה: הרשימה מתה עם הדף.
 */

/** כמה שגיאות נשמרות. דיווח עם מאה שורות אינו נקרא, ומתארך מעבר לגבול ה-URL. */
export const RECENT_ERRORS_LIMIT = 8;

/** אורך מרבי להודעה אחת. */
const MESSAGE_LIMIT = 300;

export interface RecentError {
  /** `HH:MM:SS` בשעון המקומי — מספיק כדי לראות מה קדם למה. */
  time: string;
  message: string;
  /** כמה פעמים ברצף נרשמה בדיוק אותה הודעה. */
  count: number;
}

const entries: RecentError[] = [];
let installed = false;

/**
 * מנקה הודעת אבחון ממה שמזהה את המשתמש.
 *
 * - `C:\Users\<שם>\…` ו-`/home/<שם>/…` — שם המשתמש במערכת.
 * - תיקיית ההתקנה ב-`file:///` — מוחלפת ב-`…/`, ושם הקובץ (`assets/app.js`)
 *   נשאר, כי הוא מה שמאתר את השורה.
 * - כתובות מייל.
 * - שמות מסמכים (`חידושים.docx` → `<מסמך>.docx`): שם קובץ הוא לא פעם תוכן.
 */
export function scrubDiagnostic(text: string): string {
  return text
    .replace(/file:\/\/\/[^\s'"()]+/gi, (url) => {
      const segments = url.slice('file:///'.length).split('/');
      const name = segments.pop() ?? '';
      const parent = segments.pop();
      return `file:///…/${parent === 'assets' ? 'assets/' : ''}${name}`;
    })
    // שם משתמש עם רווח („yossi cohen”) — עד המפריד הבא, ולא עד הרווח.
    .replace(/([A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+)[^\\/\n'"<>|?*]+/gi, '$1…')
    .replace(/(\/(?:home|Users)\/)[^/\s'"]+/g, '$1…')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<מייל>')
    // שם במירכאות עשוי להכיל רווחים; בלעדיהן — עד הרווח או המפריד הקרוב.
    .replace(/(["'„“«])[^"'„“”«»\n]*?\.(docx|dotx|docm|doc|pdf|txt)(["'”»])/gi, '$1<מסמך>.$2$3')
    // נתיב מלא (כונן או UNC) עד סיומת של מסמך, גם בלי מירכאות: שמות תיקיות
    // וקבצים עם רווחים („D:\הספרים שלי\חידושים על התורה.docx”). הגבול הוא
    // התווים שאסורים בנתיב של Windows, ולא הרווח.
    .replace(/(?:[A-Za-z]:[\\/]|\\\\)[^\n"'<>|?*:„“”«»]*?\.(docx|dotx|docm|doc|pdf|txt)\b/gi, (_path, ext: string) => `<מסמך>.${ext}`)
    // התיקיות של נתיב שאינו מסמך (סקריפט, תיקיית התקנה) — שמות שבחר המשתמש.
    // שם הקובץ האחרון נשאר: הוא מה שמאתר את השורה.
    .replace(/((?:[A-Za-z]:[\\/]|\\\\))(?:[^\\/\n"'<>|?*:]+[\\/])+/g, '$1…\\')
    .replace(/[^\\/\s'"«»„“”:<>]+\.(docx|dotx|docm|doc|pdf|txt)\b/gi, (_name, ext: string) => `<מסמך>.${ext}`);
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MESSAGE_LIMIT ? `${flat.slice(0, MESSAGE_LIMIT)}…` : flat;
}

/** ערך אחד מתוך הארגומנטים של `console.error` — טקסט, או שם הסוג בלבד. */
function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value);
  const name = (value as { constructor?: { name?: string } }).constructor?.name;
  return `[${name || typeof value}]`;
}

function timestamp(): string {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

/** רושמת שגיאה. מיוצאת לבדיקות ולמי שתופס שגיאה ורוצה שתופיע בדיווח. */
export function recordError(...parts: unknown[]): void {
  const message = clip(scrubDiagnostic(parts.map(describe).join(' ')));
  if (!message) return;

  const last = entries[entries.length - 1];
  if (last && last.message === message) {
    last.count += 1;
    last.time = timestamp();
    return;
  }
  entries.push({ time: timestamp(), message, count: 1 });
  if (entries.length > RECENT_ERRORS_LIMIT) entries.splice(0, entries.length - RECENT_ERRORS_LIMIT);
}

/** עותק של הרשימה, מהישנה לחדשה. */
export function recentErrors(): RecentError[] {
  return entries.map((entry) => ({ ...entry }));
}

/** לבדיקות. */
export function clearRecentErrors(): void {
  entries.length = 0;
}

/**
 * מתחילה להאזין: `console.error`, `error` ו-`unhandledrejection`.
 *
 * `console.error` נעטף ולא מוחלף — המקור נקרא תמיד, ראשון, וכשל ברישום אינו
 * מגיע אליו. נקראת פעם אחת מ-main.ts; קריאה חוזרת אינה עוטפת שוב.
 */
export function installRecentErrors(): void {
  if (installed) return;
  installed = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      recordError(...args);
    } catch {
      // הרישום הוא תוספת; הוא אינו רשאי להפיל את מי שדיווח.
    }
  };

  window.addEventListener('error', (event: ErrorEvent) => {
    // שגיאת טעינה של משאב (תמונה, סקריפט) מגיעה בלי message — אין מה לרשום.
    if (!event.message) return;
    const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
    recordError(`${event.message}${where}`);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    recordError('Unhandled rejection:', event.reason);
  });
}
