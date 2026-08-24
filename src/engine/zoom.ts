/**
 * גודל התצוגה, כפי שהמנוע מדווח אותו.
 *
 * למה מודול ולא קריאה ישירה מהקומפוננטה: הסרגל ב-StatusBar.vue קידד 50–200
 * כמספרים בתבנית, ואיש לא בדק מול המנוע. הגבולות האמיתיים יושבים
 * ב-`ui.zoom.getSnapshot()` (`min`/`max`), ומסמך שהמנוע מגביל אחרת היה מקבל
 * סרגל שנע לערכים שהמנוע דוחה — כלומר הסרגל זז והמסמך לא.
 *
 * **הכתיבה אינה כאן.** שינוי זום נעשה דרך הפקודה `zoom` של ה-controller
 * (`engine/payloads.ts` → `zoomPayload`), ולא דרך `ui.zoom.set`: כל פעולה
 * שהמשתמש מפעיל עוברת ב-command-adapter, ושם היא מקבלת הודעת כשל בעברית ומצב
 * `enabled` לפקד. שני מסלולי כתיבה לאותו דבר היו שני חוזים לתחזק.
 *
 * הצורה מוגדרת כאן מבנית ואינה מיובאת מ-`superdoc/ui`: הפאסדה אינה מייצאת
 * `ZoomHandle`/`ZoomSlice`, ו-import מנתיב פנימי של החבילה אסור
 * (tests/unit/engine-boundaries.test.ts). הכול אופציונלי — גרסת מנוע בלי
 * `zoom` נופלת בחן לגבולות ברירת המחדל ולא בחריגה.
 */

/** גודל התצוגה והגבולות שהמנוע מתיר, באחוזים. */
export interface ZoomState {
  value: number;
  min: number;
  max: number;
}

/**
 * מה שמוצג כשאין מסמך פתוח, וכשהמנוע אינו מדווח גבולות. אלה המספרים שהיו
 * מקודדים בסרגל — מכאן והלאה הם **ברירת מחדל אחרונה** ולא החוזה.
 */
export const FALLBACK_ZOOM: ZoomState = { value: 100, min: 50, max: 200 };

/** מה שנצרך מ-`superdoc.ui`. ראו הערת הפתיחה. */
export interface ZoomSource {
  zoom?: {
    getSnapshot?: () => { value?: unknown; min?: unknown; max?: unknown } | null | undefined;
    observe?: (listener: (slice: { value?: unknown; min?: unknown; max?: unknown }) => void) => () => void;
  };
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** מגביל ערך לטווח. הסרגל, הצעדים ולחצני ± כולם עוברים דרכה. */
export function clampZoom(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return FALLBACK_ZOOM.value;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * מנרמלת slice של המנוע ל-`ZoomState` שאפשר לסמוך עליו.
 *
 * שני מצבים פגומים מטופלים במפורש, כי שניהם משתיקים את הסרגל לגמרי: גבולות
 * שאינם מספרים חיוביים, וטווח הפוך (`min > max`) שהיה מקפיא כל ערך על אותו
 * מספר.
 */
export function normalizeZoomState(slice: {
  value?: unknown;
  min?: unknown;
  max?: unknown;
} | null | undefined): ZoomState {
  const reportedMin = positive(slice?.min);
  const reportedMax = positive(slice?.max);
  const range =
    reportedMin !== null && reportedMax !== null && reportedMin < reportedMax
      ? { min: reportedMin, max: reportedMax }
      : { min: FALLBACK_ZOOM.min, max: FALLBACK_ZOOM.max };

  const value = positive(slice?.value) ?? FALLBACK_ZOOM.value;
  return { ...range, value: clampZoom(value, range.min, range.max) };
}

/** הערכים ברגע זה. כשל קריאה מוחזר כברירת המחדל ולא כחריגה. */
export function readZoom(ui: ZoomSource | null | undefined): ZoomState {
  const zoom = ui?.zoom;
  if (typeof zoom?.getSnapshot !== 'function') return { ...FALLBACK_ZOOM };
  try {
    return normalizeZoomState(zoom.getSnapshot());
  } catch (error) {
    console.warn('[otzaria-word] קריאת גודל התצוגה מהמנוע נכשלה', error);
    return { ...FALLBACK_ZOOM };
  }
}

/**
 * מאזינה לגודל התצוגה. `observe` של המנוע יורה מיד עם ה-snapshot ואז על כל
 * שינוי — כולל שינויים שלא באו מאיתנו (`zoom-fit-width`, התאמה לרוחב חלון) —
 * ולכן ההאזנה היא מה שמונע מהתווית בשורת המצב להראות ערך שהמסמך כבר לא בו.
 *
 * מחזירה disposer גם כשאין `observe`, כדי שאתר הקריאה לא יצטרך להבחין.
 */
export function observeZoom(
  ui: ZoomSource | null | undefined,
  listener: (state: ZoomState) => void,
): () => void {
  const zoom = ui?.zoom;
  const observe = zoom?.observe;

  if (typeof observe !== 'function') {
    listener(readZoom(ui));
    return () => {};
  }

  try {
    return observe.call(zoom, (slice) => listener(normalizeZoomState(slice)));
  } catch (error) {
    console.warn('[otzaria-word] האזנה לגודל התצוגה נכשלה', error);
    listener(readZoom(ui));
    return () => {};
  }
}
