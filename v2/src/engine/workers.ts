/**
 * Workers של מנוע ה-DOCX, כ-blob: URLs.
 *
 * ה-build מטמיע את קוד ה-worker כמחרוזת (inlineEngineWorkers ב-vite.config.ts)
 * וכאן הוא הופך ל-blob: שנמסר ל-`config.workerUrls`. שלוש עובדות נמדדו
 * ב-Chromium וקובעות את הצורה הזאת (docs/spike.md §שער A):
 *
 * 1. ה-build הוא IIFE, ולכן ה-URL היחסי שהמנוע בונה לבד ל-worker אינו נפתר.
 *    בלי ההטמעה המנוע נכשל גם מ-origin תקין. כלומר workerUrls הוא חובה.
 * 2. המנוע יוצר module worker. מ-file:// (origin opaque) module worker מ-blob:
 *    נכשל, ומ-data: הוא עובד — אבל data: חסום סביב 2MB URL, וה-worker של
 *    המסמך גדול פי שלושה. כלומר מ-file:// אין צורה שעובדת.
 * 3. מ-origin http (loopback) blob: עובד, והמסמך נטען.
 *
 * המסקנה המעשית: התוסף הארוז חייב להיטען מ-origin ולא מ-file:// — שינוי בצד
 * אוצריא, שהוא תנאי מוקדם לשער A. עד אז הפיתוח נעשה בטעינה מ-localhost.
 *
 * בפיתוח מ-localhost המחרוזות אינן קיימות, ומחזירים undefined: ל-origin אמיתי
 * ושרת פיתוח שמגיש מודולים ה-worker המובנה של SuperDoc עובד ("Omitted entries
 * keep SuperDoc's bundled worker URLs").
 */
declare global {
  interface Window {
    __SUPERDOC_WORKER_SOURCES__?: Record<string, string>;
  }
}

/**
 * מפתחות של `Config.workerUrls`. שני התפקידים שהתוסף צריך: המסמך עצמו,
 * וה-index של הערות ו-track changes. `collaboration` אינו נארז — התוסף
 * עובד אופליין וללא הרשאת רשת.
 */
export interface EngineWorkerUrls {
  document?: string;
  reviewIndex?: string;
}

const ROLES = ['document', 'reviewIndex'] as const;

let cached: EngineWorkerUrls | undefined;

export function engineWorkerUrls(): EngineWorkerUrls | undefined {
  if (cached) return cached;

  const sources = window.__SUPERDOC_WORKER_SOURCES__;
  if (!sources) return undefined;

  const urls: EngineWorkerUrls = {};
  for (const role of ROLES) {
    const code = sources[role];
    // תפקיד חסר נשאר undefined בכוונה: SuperDoc ייפול חזרה ל-URL המובנה שלו
    // במקום לקבל blob: ריק שייכשל בטעינה.
    if (typeof code === 'string' && code !== '') {
      urls[role] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    }
  }

  cached = urls;
  return urls;
}

/** לבדיקות בלבד: מאפס את ה-cache של ה-URLs. */
export function resetEngineWorkerUrlsCache(): void {
  cached = undefined;
}
