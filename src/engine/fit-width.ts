/**
 * „רוחב עמוד”: חישוב אחוז ההתאמה כאן, והחלתו דרך פקודת `zoom` הרגילה.
 *
 * ## למה איננו שולחים את `zoom-fit-width` של המנוע
 *
 * נמדד חי (CDP על ה-dist הארוז, superdoc@2.8.0): מסלול `setZoomMode('fit-width')`
 * מפעיל מדידה חוזרת של רוחב המסמך **אחרי** שהזום הוחל, ורוחב העמוד באותה מדידה
 * מדורג לפי הזום הנוכחי — ב-bundle של המנוע: "page metrics viewport coords
 * scale with the same zoom value". התוצאה היא לולאת משוב: כל הערכה מכפילה את
 * הזום ביחס ההתאמה שוב. נמדד: לחיצה אחת על „רוחב עמוד” בחלון שבו ההתאמה
 * האמיתית היא ~93% הורידה את המסמך לרצפה (10%) תוך פחות משנייה, והעמוד
 * המרונדר לא נע בגבולות שהמשתמש מזהה.
 *
 * לכן הכפתור מחשב את האחוז בעצמו — רוחב המאגס שלנו חלקי רוחב עמוד המסמך
 * ב-100%, מהמידות הקנוניות של `sections.list` (אינצ'ים; ראו engine/print.ts) —
 * ומחיל אותו דרך פקודת `zoom`. `setZoom` של המנוע מעביר ל-zoomMode `manual`
 * מטעמי עיצוב שלו, ובכך מנטרל את הלולאה. מסלול הכתיבה נשאר יחיד: האדפטר.
 */
import type { ZoomState } from './zoom';
import { clampZoom } from './zoom';
import { readPrintPageSize, type PrintTarget } from './print';

/**
 * המאגס שלנו שבתוכו המנוע מרנדר.
 *
 * זהו **קלס שלנו** ולא של המנוע — הכלל שאוסר `querySelector` אל DOM פנימי
 * של SuperDoc (`.sd-*`) אינו נפגע: אנחנו מודדים את המקום שאנחנו עצמנו נתנו
 * למנוע, שהוא בדיוק מה ש„רוחב עמוד” אמור להתאים אליו.
 */
export const EDITOR_STACK_SELECTOR = '.editor-stack';

/** פיקסלי CSS לאינץ' — ההמרה ממידות ה-`sections.list` לגיאומטריית המסך. */
export const CSS_PX_PER_INCH = 96;

/**
 * רוחב המאגס בפיקסלי CSS, או `0` כשאין מה למדוד.
 *
 * `clientWidth` ולא `getBoundingClientRect`: הראשון מוציא את פס הגלילה,
 * והתאמה שמתעלמת ממנו הייתה משאירה גלילה אופקית של בדיוק רוחב פס הגלילה.
 */
export function editorStackWidth(root: Document = document): number {
  const el = root.querySelector(EDITOR_STACK_SELECTOR);
  return el && el.clientWidth > 0 ? Math.round(el.clientWidth) : 0;
}

/**
 * אחוז ההתאמה, מוגבל לגבולות שהמנוע מתיר, או `null` כשאין מדידה תקינה.
 *
 * החישוב הוא יחס גלם ולא ניחוש: חלון 1480px על A4 (8.268 אינץ' ≈ 794px)
 * נותן 186% — כלומר בחלון רחב החישוב **מציע הגדלה**, בדיוק כמו ב-Word.
 * שימו לב: בתצורת ברירת המחדל של המנוע `max` הוא 100 (אותו מקור של הסליידר
 * בשורת המצב), ואז ההתאמה נעצרת אצל 100% — ההגדלה יוחל רק אם המנוע דיווח
 * תקרה גבוהה יותר. הגבולות כאן ושם הם מקור אחד בכוונה.
 */
export function computeFitPercent(
  containerPx: number,
  pageInches: number,
  bounds: Pick<ZoomState, 'min' | 'max'>,
): number | null {
  if (!(containerPx > 0)) return null;
  if (!(pageInches > 0) || !Number.isFinite(pageInches)) return null;
  return clampZoom((containerPx / (pageInches * CSS_PX_PER_INCH)) * 100, bounds.min, bounds.max);
}

/**
 * אחוז ההתאמה לפי המסמך הפתוח, או `null` כשרוחב העמוד לא נקרא.
 *
 * קורא את מידות הדף מ-`sections.list` דרך אותו מסלול מנוטר ומסונן של
 * ההדפסה (`readPrintPageSize`): אינץ' עם סינון תשובות שאינן תשובה, ולעולם
 * בלי זריקה — כשל קריאה הוא `null`, והכפתור ידווח על כך ולא ינחש.
 */
export async function fitWidthPercent(
  host: PrintTarget,
  containerPx: number,
  bounds: Pick<ZoomState, 'min' | 'max'>,
): Promise<number | null> {
  if (!(containerPx > 0)) return null;
  const size = await readPrintPageSize(host);
  if (!size) return null;
  return computeFitPercent(containerPx, size.widthIn, bounds);
}