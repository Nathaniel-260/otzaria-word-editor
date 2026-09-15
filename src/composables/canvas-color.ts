/**
 * צבע הבד — המשטח שסביב הדף.
 *
 * ## למה טוקן משלו ולא דריסה של `--color-surface-container-highest`
 *
 * הצבע שהבד נצבע בו עד עכשיו הוא טוקן של ערכת הנושא, ואותו טוקן בדיוק צובע
 * עוד ארבעה דברים: שני הסרגלים (DocumentRuler.vue, VerticalRuler.vue), הפינה
 * שביניהם וכפתור היציאה ממצב מיקוד. דריסה שלו הייתה מקבלת „צבע רקע” שמשנה
 * גם את הסרגלים — כלומר פקד שעושה יותר ממה ששמו אומר. `--word-canvas-bg`
 * (styles/tokens.css) יושב בין השניים: ברירת המחדל שלו היא **אותו** צבע ערכת
 * נושא, ולכן בלי העדפה שום פיקסל אינו משתנה, והצרכן היחיד שלו הוא
 * `.editor-stack` — הבד עצמו.
 *
 * ## למה סגנון inline על שורש המסמך
 *
 * זה בדיוק מה ש-`applyTheme` כבר עושה (host/theme.ts): צבעי אוצריא נכתבים
 * כ-`style.setProperty` על `documentElement`, וסגנון inline מנצח את הכלל
 * `:root` שב-tokens.css. משמע שתי התכונות שאנחנו צריכים מגיעות בחינם —
 * ההעדפה דורסת את ערכת הנושא, ו-`removeProperty` מחזירה את הבד **לעקוב**
 * אחריה, כולל מעבר בין מצב בהיר לכהה. אין כאן שני ערכים שמישהו צריך לסנכרן:
 * „אין העדפה” הוא היעדר ההצהרה, ולא צבע שני ששמור בצד.
 *
 * ## מה זה אינו
 *
 * העדפה של התוכנה, לא תכונה של המסמך — בדיוק כמו הסרגל (host/settings.ts):
 * היא אינה נכתבת ל-DOCX, היא אינה נוסעת עם הקובץ, והיא אינה מודפסת
 * (`styles/print.css` מאפס `.editor-stack` ל-`background: none`).
 */
import { ref } from 'vue';
import { saveCanvasColor } from '../host/settings';

/** הטוקן שהבד נצבע ממנו. ההגדרה וברירת המחדל ב-styles/tokens.css. */
export const CANVAS_COLOR_VAR = '--word-canvas-bg';

/**
 * הטוקן שהוא נופל אליו בלי העדפה — צבע המשטח של ערכת הנושא של אוצריא.
 *
 * מיוצא בשביל השער שמאמת שזהו אכן ה-fallback שכתוב ב-tokens.css: הקשר בין
 * השניים אינו נראה בקוד (שם אחד ב-TS, שם שני ב-CSS), ולכן הוא נמדד.
 */
export const THEME_CANVAS_VAR = '--color-surface-container-highest';

/**
 * `#rrggbb` באותיות קטנות, או `null` על כל דבר אחר.
 *
 * שני מקורות מזינים את זה, ושניהם כבר מייצרים בדיוק את הצורה הזאת: הפלטה
 * של `ColorPickerPopover` כתובה כך במקור, ו-`input[type=color]` מוגדר להחזיר
 * „simple color” — שבעה תווים, אותיות קטנות. הבדיקה כאן אינה בשבילם אלא
 * בשביל המסלול השלישי: מה שחוזר מה-`storage` של אוצריא הוא JSON שנכתב
 * בהפעלה קודמת, וגרסה קודמת, ערך שנקטע או קריאה שנכשלה מגיעים לאותה נקודה.
 * צבע פגום שמגיע עד `setProperty` פשוט אינו צובע — כלומר בד ללא רקע כלל —
 * ולכן הדחייה כאן ולא שם.
 */
export function normalizeCanvasColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}

/**
 * ההעדפה כפי שהיא כרגע. `null` = אין העדפה, והבד עוקב אחרי ערכת הנושא.
 *
 * מודול ולא `provide`: הבד נצבע בעלייה (App.vue), והפקד שמשנה אותו יושב
 * בלשונית „תצוגה” — שהיא `v-else-if` ב-Ribbon.vue, כלומר מורכבת רק כשהיא
 * הפעילה. מצב שחי בקומפוננטה היה נולד מחדש בכל מעבר לשונית.
 */
export const canvasColor = ref<string | null>(null);

/**
 * צבע הבד של ערכת הנושא — מה שהבד מצויר בו כשאין העדפה.
 *
 * נקרא מהערך המחושב ולא מקובע כקבוע: אוצריא מחליפה את הטוקן הזה בכל שינוי
 * ערכה ובכל מעבר בהיר/כהה (host/theme.ts), והמספר שב-tokens.css הוא ברירת
 * מחדל לפיתוח בלבד. הצרכן היחיד הוא הפס שמתחת לאייקון בבורר הצבע: בלעדיו
 * הפס היה מראה שחור („לחיצה תצבע את הבד בשחור”) כל עוד לא נבחר צבע.
 *
 * `undefined` כשאין תשובה — ואז הבורר נופל לברירת המחדל שלו.
 */
export function themeCanvasColor(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(THEME_CANVAS_VAR);
  return normalizeCanvasColor(value) ?? undefined;
}

/**
 * מחילה צבע על הבד בלי לשמור אותו.
 *
 * זהו המסלול של העלייה: App.vue קורא את ההעדפה במקביל לשאר ההגדרות ומוסר
 * אותה לכאן. הפרדה מ-`setCanvasColor` כדי שהעלייה לא תכתוב חזרה ל-`storage`
 * את מה שהרגע קראה ממנו.
 */
export function applyCanvasColor(color: string | null): void {
  canvasColor.value = color;
  const root = document.documentElement;
  if (color) root.style.setProperty(CANVAS_COLOR_VAR, color);
  else root.style.removeProperty(CANVAS_COLOR_VAR);
}

/**
 * הבחירה של המשתמש: מחילה מיד ושומרת. `null` = חזרה לצבע ערכת הנושא.
 *
 * צבע שאינו עובר את `normalizeCanvasColor` נקרא כ„אין העדפה”, ולא נשמר כפי
 * שהוא: הערך היחיד שאפשר לתת למחרוזת שאינה צבע הוא היעדר צבע, ושמירה שלה
 * הייתה מחזירה את אותה שאלה בהפעלה הבאה.
 *
 * הכתיבה ל-`storage` שקטה (`tryCall` ב-host/settings.ts) ולא ממתינה לפני
 * הצביעה: הבד כבר צבוע כשהסבב מול אוצריא מתחיל, וכשל שלו מאבד את הזיכרון
 * להפעלה הבאה בלבד.
 */
export async function setCanvasColor(color: string | null): Promise<void> {
  const normalized = normalizeCanvasColor(color);
  applyCanvasColor(normalized);
  await saveCanvasColor(normalized);
}
