/**
 * מסך מלא ברמת החלון — „שיעלים גם את אוצריא”.
 *
 * מצב מיקוד מסתיר את הפסים **שלנו**. סביבנו יושבת אוצריא: פס הכותרת שלה,
 * שורת הטאבים וסרגל הניווט. הדרך היחידה שדף שרץ בתוך WebView יכול לבקש את
 * החלון כולו היא ה-Fullscreen API של הדפדפן — ל-SDK של אוצריא אין קריאה
 * למסך מלא. נמדד ב-2026-09-01 מול `docs/plugin-sdk/API_REFERENCE.md`,
 * מול טבלת ה-RPC ב-`lib/plugins/bridge/plugin_bridge_handler.dart`
 * ומול `origin/dev`: הערוץ היחיד שקשור למסך מלא הוא `otzaria_escape_pressed`,
 * והוא לכיוון אחד — יציאה.
 *
 * לכן הפונקציות כאן **אינן** מבטיחות דבר: בקשה שנדחתה מחזירה `false`, ומי
 * שקרא ממשיך כרגיל. מצב מיקוד שעובד רק אם המסך המלא הצליח היה מצב מיקוד
 * שנשבר בכל מאחז שאינו תומך.
 *
 * הקידומת של WebKit אינה קישוט: אוצריא רצה גם ב-macOS, ושם ה-WebView הוא
 * WKWebView — שחושף רק את `webkitRequestFullscreen`, וזו גרסה שאינה מחזירה
 * Promise.
 */

/** מה שאפשר להרחיב. ה-union מאפשר גם אלמנט אמיתי וגם כפיל בבדיקה. */
export interface FullscreenTarget {
  requestFullscreen?: (options?: unknown) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** מי שמנהל את המצב — `document` בפועל. */
export interface FullscreenOwner {
  documentElement?: FullscreenTarget;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/**
 * שני שמות לאותו אירוע. הלא-מקודם קיים ב-WebView2, המקודם ב-WKWebView, ומאחז
 * שיורה את שניהם רק יקרא לקריאה החוזרת פעמיים עם אותו ערך — ולכן ההאזנה
 * לשניהם בטוחה.
 */
const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

/** `null` = אין `document` (בדיקה ללא DOM), ואז כל פעולה כאן היא no-op. */
function ownerOf(owner?: FullscreenOwner | null): FullscreenOwner | null {
  if (owner) return owner;
  return typeof document === 'undefined' ? null : (document as unknown as FullscreenOwner);
}

/** האם החלון במסך מלא כרגע. */
export function isFullscreen(owner?: FullscreenOwner | null): boolean {
  const host = ownerOf(owner);
  if (!host) return false;
  return Boolean(host.fullscreenElement ?? host.webkitFullscreenElement);
}

/**
 * האם בכלל יש למי לפנות.
 *
 * `fullscreenEnabled === false` הוא תשובה מפורשת של המאחז („מדיניות אוסרת”),
 * ואילו `undefined` הוא מאחז ישן שאינו מדווח — ושם עדיין שווה לנסות.
 */
export function canFullscreen(owner?: FullscreenOwner | null): boolean {
  const host = ownerOf(owner);
  if (!host) return false;
  if (host.fullscreenEnabled === false && host.webkitFullscreenEnabled !== true) return false;
  const target = host.documentElement;
  return typeof target?.requestFullscreen === 'function'
    || typeof target?.webkitRequestFullscreen === 'function';
}

/**
 * בקשת מסך מלא. `false` = המאחז סירב או שאינו תומך.
 *
 * **חייבת להיקרא מתוך מחווה של המשתמש** (לחיצה או הקשה) — זו דרישת הדפדפן,
 * ולכן שחזור מצב מיקוד מהפעלה קודמת אינו קורא לכאן: הוא היה נכשל תמיד.
 *
 * לעולם אינה זורקת. היא נקראת מתוך טיפול במקש, וחריגה שם מפילה את המאזין
 * הגלובלי — כלומר את כל הקיצורים, ולא רק את זה.
 */
export async function enterFullscreen(owner?: FullscreenOwner | null): Promise<boolean> {
  const host = ownerOf(owner);
  const target = host?.documentElement;
  if (!target) return false;

  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen();
      return true;
    }
    if (typeof target.webkitRequestFullscreen === 'function') {
      await target.webkitRequestFullscreen();
      return true;
    }
  } catch {
    /* מאחז שאינו מרשה. מצב המיקוד עצמו אינו תלוי בזה. */
  }
  return false;
}

/** יציאה ממסך מלא. `false` = לא היינו בו, או שאין למי לפנות. */
export async function exitFullscreen(owner?: FullscreenOwner | null): Promise<boolean> {
  const host = ownerOf(owner);
  if (!host || !isFullscreen(host)) return false;

  try {
    if (typeof host.exitFullscreen === 'function') {
      await host.exitFullscreen();
      return true;
    }
    if (typeof host.webkitExitFullscreen === 'function') {
      await host.webkitExitFullscreen();
      return true;
    }
  } catch {
    /* אותו טעם כמו בכניסה. */
  }
  return false;
}

/**
 * האזנה ליציאה שלא באה מאיתנו — `Escape` של הדפדפן, או `F11` שלו.
 *
 * בלעדיה נשארת מעטפת בלי פסים בתוך חלון רגיל: המשתמש יצא ממסך מלא, וממצב
 * המיקוד לא. מחזירה פונקציית פירוק.
 */
export function watchFullscreen(
  onChange: (fullscreen: boolean) => void,
  owner?: FullscreenOwner | null,
): () => void {
  const host = ownerOf(owner);
  if (!host?.addEventListener) return () => {};

  const listener = (): void => onChange(isFullscreen(host));
  for (const event of CHANGE_EVENTS) host.addEventListener(event, listener);

  return () => {
    for (const event of CHANGE_EVENTS) host.removeEventListener?.(event, listener);
  };
}
