/**
 * Workers של מנוע ה-DOCX, כ-blob: URLs.
 *
 * בתוסף ארוז הדף נטען מ-file:// , ושם worker מקובץ נפרד נחסם (המקור null).
 * ה-build מטמיע את קוד ה-worker כמחרוזת (ראו inlineEngineWorkers ב-vite.config.ts),
 * וכאן הוא הופך ל-blob: — פרוטוקול שה-SDK של אוצריא מתיר במפורש
 * (docs/plugin-sdk/README.md, "גישת קבצים").
 *
 * בפיתוח מ-localhost אין את הבעיה הזאת: אם המחרוזות אינן קיימות מחזירים
 * undefined, ו-SuperDoc משתמש ב-URL המובנה שלו ("Omitted entries keep
 * SuperDoc's bundled worker URLs").
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
    if (typeof code === 'string' && code.length > 0) {
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
