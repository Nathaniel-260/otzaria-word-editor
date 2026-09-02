/**
 * מיקום הגלילה של מסמך, ומה ששומר עליו כשהמסמך יורד מהמסך.
 *
 * ## הבאג שהמודול הזה קיים בשבילו
 *
 * טאב שאינו פעיל מוסתר ב-`display: none` (App.vue, `activateTab`) — וזה
 * **הורס את קופסת הפריסה** של מיכל הגלילה שבתוכו. הדפדפן אינו „זוכר” גלילה
 * של אלמנט בלי קופסה: `scrollTop` חוזר לאפס, ואין דרך לבקש ממנו אחרת.
 *
 * מה שהמשתמש רואה עושה את זה מבלבל עוד יותר: מיד אחרי החזרה התמונה נראית
 * נכונה — עיגון הגלילה של הדפדפן (scroll anchoring) מחזיק אותה — אבל
 * `scrollTop` האמיתי הוא אפס, ולכן **בגלגול הראשון** הכול קופץ לראש המסמך.
 * זה בדיוק הדיווח „הוא זוכר איפה אני, וברגע שאני מתחיל לגלול הוא חוזר לראש”.
 *
 * ## שתי פעולות, ולא אחת
 *
 * ההבדל ביניהן הוא מי מותר לו לדרוס את מי:
 *
 * - **`applyPaneScroll`** — „החזר את המיקום שנשמר”. נקראת כשטאב חוזר להיות
 *   פעיל, ואז מה שנשמר הוא האמת היחידה: המיכל בדיוק נולד מחדש.
 * - **`repairPaneScroll`** — „תקן רק אם באמת אבד”. נקראת כשהתוסף חוזר מהרקע,
 *   ושם המיכל **לא בהכרח** איבד דבר. כתיבה גורפת שם הייתה מסוכנת: אילו
 *   המיקום שרד, והמסמך בינתיים התעמד מחדש והתקצר, היינו קופצים למקום שכבר
 *   אינו קיים. לכן היא כותבת אך ורק כשהמיכל יושב על אפס ואנחנו זוכרים אחרת —
 *   כלומר בדיוק החתימה של „המיקום נמחק”.
 *
 * ## למה זה מודול ולא שתי שורות במעטפת
 *
 * שתי השורות האלה הן ההבדל בין „הגלילה נשמרת” ל„הגלילה קופצת”, וזה בדיוק סוג
 * הקוד שנמחק בשקט ברפקטור הבא. כאן הוא נבדק.
 */

/** מיקום גלילה, בפיקסלי CSS. */
export interface PaneScroll {
  top: number;
  left: number;
}

/** ראש המסמך — גם ברירת המחדל של טאב שעוד לא נגללו בו. */
export const PANE_SCROLL_ORIGIN: PaneScroll = { top: 0, left: 0 };

/**
 * מה שנדרש ממיכל הגלילה. אלמנט אמיתי מקיים את זה מאליו, ובדיקה יכולה למסור
 * אובייקט פשוט — הדבר היחיד שנמדד כאן הוא שני מספרים.
 */
export type ScrollPane = Pick<HTMLElement, 'scrollTop' | 'scrollLeft'>;

/** ערך גלילה חוקי: מספר סופי ואי-שלילי. כל דבר אחר נקרא כאפס. */
function readAxis(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** המיקום הנוכחי של המיכל, או ראש המסמך כשאין מיכל. */
export function readPaneScroll(pane: ScrollPane | null | undefined): PaneScroll {
  if (!pane) return { ...PANE_SCROLL_ORIGIN };
  return { top: readAxis(pane.scrollTop), left: readAxis(pane.scrollLeft) };
}

/** האם שני המיקומים זהים. */
export function samePaneScroll(a: PaneScroll, b: PaneScroll): boolean {
  return a.top === b.top && a.left === b.left;
}

/**
 * מחזירה את המיקום השמור למיכל. מחזירה `true` אם משהו נכתב בפועל.
 *
 * כתיבה רק כשיש הבדל: השמה ל-`scrollTop` היא בקשת גלילה לכל דבר, והיא מבטלת
 * גלילה חלקה שרצה באותו רגע. „אותו ערך” הוא המצב הנפוץ (טאב שנשאר בראש),
 * ואין סיבה שהוא יעלה משהו.
 */
export function applyPaneScroll(pane: ScrollPane | null | undefined, scroll: PaneScroll): boolean {
  if (!pane) return false;
  let wrote = false;
  if (pane.scrollTop !== scroll.top) {
    pane.scrollTop = scroll.top;
    wrote = true;
  }
  if (pane.scrollLeft !== scroll.left) {
    pane.scrollLeft = scroll.left;
    wrote = true;
  }
  return wrote;
}

/**
 * מתקנת מיקום שאבד — ורק אותו. מחזירה `true` אם תיקנה.
 *
 * „אבד” מוגדר בצמצום: המיכל יושב על ראש המסמך, והמיקום השמור אינו שם. כל מצב
 * אחר — כולל „המיכל במקום אחר לגמרי” — אינו אובדן אלא מצב שיש לו בעלים, ואין
 * לגעת בו. ראו „שתי פעולות” בראש הקובץ.
 */
export function repairPaneScroll(pane: ScrollPane | null | undefined, scroll: PaneScroll): boolean {
  if (!pane) return false;
  if (samePaneScroll(scroll, PANE_SCROLL_ORIGIN)) return false;
  if (!samePaneScroll(readPaneScroll(pane), PANE_SCROLL_ORIGIN)) return false;
  return applyPaneScroll(pane, scroll);
}
