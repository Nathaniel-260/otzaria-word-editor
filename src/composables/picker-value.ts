/**
 * שני הכללים שכל בורר ברצועה חי לפיהם — במקום אחד, ולא בכל לשונית מחדש.
 *
 * שניהם נכתבו במקור בתוך `HomeTab.vue`, ושניהם תוקנו שם אחרי באג אמיתי. הם
 * יצאו לכאן ברגע שאותם בוררים הופיעו במקום שני (תפריט הלחצן הימני): כלל
 * שמועתק הוא כלל שיתוקן פעם אחת בלבד.
 */
import type { Ref } from 'vue';
import type { CommandOutcome } from '../engine/command-adapter';

/**
 * אפשרות אחת בבורר, בצורה שמשותפת ל-`RibbonSelect` ול-`RibbonCombo`.
 *
 * `preview` ו-`group` אופציונליים מפני שהבורר הנייטיב אינו מכיר קיבוץ, ובורר
 * הגודל אינו מציג תצוגה מקדימה — אבל שני הפקדים מקבלים את אותה צורה, ולכן
 * `withCurrent` אחד מספיק לשלושת הבוררים.
 */
export interface PickerOption {
  value: string;
  label: string;
  /** `font-family` של CSS — כך כל שם מוצג בגופן עצמו. */
  preview?: string;
  /** כותרת הקבוצה בבורר החיפוש. חסר = בראש, בלי כותרת. */
  group?: string;
  /**
   * הגופן מכסה עברית — ואז בבורר החיפוש מופיעה לפני שמו דגימה של אותיות
   * עבריות. נקבע ב-engine/font-options.ts; ראו שם למה זו שאלה של כיסוי ולא של
   * ייעוד. חסר = בלי דגימה, וזו גם ברירת המחדל של בורר הגודל ושל האפשרות
   * שנוספת ב-`withCurrent`.
   */
  hebrew?: boolean;
}

/**
 * הערך הנוכחי חייב להיות אחת האפשרויות, אחרת `<select>` מציג את הראשונה
 * ומשקר. גופן או גודל שאינם ברשימה (מסמך שנכתב בגופן שהמנוע לא הציע, טקסט
 * ב-20.5pt) מתווספים בראשה — בדיוק מה ש-Word עושה.
 */
export function withCurrent<T extends PickerOption>(
  options: readonly T[],
  current: string,
): readonly (T | PickerOption)[] {
  if (current === '' || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current, preview: current }, ...options];
}

/**
 * שולחת את הבחירה ומחזיקה אותה על המסך עד לתשובה: בהצלחה היא נשמרת כ„אחרון
 * שידענו”, ובכשל היא נעלמת — כלומר מה שלא קרה במסמך אינו מוצג.
 *
 * למה אופטימי ולא „להמתין לתשובה”: הבורר חייב להגיב מיד, והמנוע אינו מדווח
 * ערך בכלל על בחירה מעורבת — תיבה שממתינה לו הייתה נראית קפואה גם בהצלחה
 * מלאה.
 *
 * הבדיקה `pending.value !== next` לפני העדכון: אם המשתמש בחר שוב בזמן
 * ההמתנה, הבקשה שבאוויר אינה שלנו יותר, ותשובה מאוחרת אינה אמורה למחוק בחירה
 * טרייה.
 */
export async function applyOptimistically<T>(
  pending: Ref<T | null>,
  memo: Ref<T>,
  next: T,
  run: () => Promise<CommandOutcome>,
): Promise<void> {
  pending.value = next;
  const outcome = await run();
  if (pending.value !== next) return;
  if (outcome.ok) memo.value = next;
  pending.value = null;
}
