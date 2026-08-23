/**
 * עטיפה טיפוסית סביב `window.Otzaria` — האובייקט שאוצריא מזריקה ל-WebView.
 * כל הקוד בתוסף עובר דרך כאן ולא נוגע ב-window ישירות, כדי שיהיה מקום אחד
 * לטיפול בשגיאות, ל-stub של פיתוח בדפדפן, ולהמתנה ל-plugin.boot.
 *
 * הטיפוסים מגיעים מ-src/types/otzaria_plugin.d.ts — העתק verbatim של ה-d.ts
 * הרשמי מ-docs/plugin-sdk של אוצריא. לעדכן משם, לא לערוך ידנית.
 */
import type {
  BootPayload,
  OtzariaEventMap,
  OtzariaGlobal,
  ThemePayload,
} from '../types/otzaria_plugin';

/** ב-WebView של אוצריא ה-SDK תמיד קיים; בדפדפן רגיל הוא עשוי לא להיות. */
function bridge(): OtzariaGlobal {
  const sdk = (window as Partial<Window>).Otzaria;
  if (!sdk) throw new Error('ה-SDK של אוצריא אינו זמין — התוסף נטען מחוץ לאוצריא?');
  return sdk;
}

export function isAvailable(): boolean {
  return Boolean((window as Partial<Window>).Otzaria);
}

/** קריאה ל-Host API. זורקת שגיאה עם ההודעה שהגיעה מאוצריא. */
export async function call<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await bridge().call<T>(method, payload);
  if (!res.success) {
    throw new Error(res.error?.message ?? `הקריאה ל-${method} נכשלה`);
  }
  return res.data as T;
}

/** כמו call, אבל מחזירה null במקום לזרוק — לשימושים לא-קריטיים. */
export async function tryCall<T>(
  method: string,
  payload?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await call<T>(method, payload);
  } catch {
    return null;
  }
}

/** נרשמת לאירוע ומחזירה פונקציית ביטול. `off` דורש בדיוק את אותה הפניה. */
export function on<K extends keyof OtzariaEventMap>(
  event: K,
  callback: (detail: OtzariaEventMap[K]) => void,
): () => void {
  const sdk = bridge();
  sdk.on(event, callback);
  return () => sdk.off(event, callback);
}

/**
 * ה-latch של plugin.boot.
 *
 * האירוע נורה פעם אחת. אוצריא אינה שומרת את ה-payload ואין `getBootInfo`, ו-
 * `on` של ה-SDK האמיתי הוא `window.addEventListener` בלי replay — כלומר מי
 * שנרשם אחרי הירייה, למשל אחרי `await`, לא יקבל אותו לעולם. זה הכשל שההרשמה
 * כאן, בזמן טעינת המודול, מונעת.
 *
 * (אוצריא כן מזריקה stub לפני ה-SDK, שה-`on` שלו מתור רישומים ומשחזר אותם
 * לפני שיגור ה-boot — ולכן `Otzaria.on` בזמן טעינת המודול היה עובד גם כן.
 * ההרשמה ישירות על window אינה תלויה בהתנהגות הזאת, וזה כל היתרון שלה.)
 */
const bootPayload = new Promise<BootPayload>((resolve) => {
  window.addEventListener(
    'plugin.boot',
    (event) => resolve((event as CustomEvent<BootPayload>).detail),
    { once: true },
  );
});

/** ברירת מחדל לשעון-שומר של ה-boot. ה-Host מקומי; המתנה ארוכה היא כשל. */
export const BOOT_TIMEOUT_MS = 15_000;

/**
 * ממתינה ל-plugin.boot. כל קריאה ל-Host API חייבת לרוץ אחריה — קריאה
 * לפני ה-boot אינה מובטחת. נכשלת בזמן קצוב במקום להשאיר מסך תלוי.
 */
export function waitForBoot(timeoutMs = BOOT_TIMEOUT_MS): Promise<BootPayload> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    bootPayload.then((payload) => {
      clearTimeout(timer);
      return payload;
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('אוצריא לא סיימה לאתחל את התוסף')),
        timeoutMs,
      );
    }),
  ]);
}

export function onThemeChanged(callback: (theme: ThemePayload) => void): () => void {
  return on('theme.changed', callback);
}

/** הודעות למשתמש. נכשלות בשקט — הודעה שלא נראתה אינה סיבה להפיל פעולה. */
export function notify(message: string): void {
  void tryCall('ui.showMessage', { message });
}

export function notifyError(message: string): void {
  void tryCall('ui.showError', { message });
}
