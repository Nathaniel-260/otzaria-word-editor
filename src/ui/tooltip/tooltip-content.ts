/**
 * מה כתוב בטולטיפ — התוכן, במנותק מהתצוגה ומה-DOM.
 *
 * ## מה שהיה כאן קודם
 *
 * הטולטיפ של התוכנה היה תכונת `title` מולדת: מלבן אפור של מערכת ההפעלה, בגופן
 * שאינו הגופן של הממשק, ללא היררכיה בתוכו. הצירוף נדחף לאותה מחרוזת בסוגריים
 * (`RibbonButton.computedTitle`), ולכן „מברשת עיצוב” ו„העתק עיצוב ממקום אחד
 * והחל במקום אחר” הוצגו כשורה אחת ארוכה — למשתמש לא הייתה דרך לראות מה השם
 * ומה ההסבר.
 *
 * הטולטיפ החדש מציג שלושה שדות: **כותרת**, **צירוף מקשים** באותה שורה,
 * ו**הסבר** מתחתיהם. המודול הזה קובע מאין כל אחד מהם מגיע.
 *
 * ## למה מודול טהור
 *
 * הכלל שממפה את ה-props הקיימים לשלושת השדות הוא ההחלטה היחידה כאן שאפשר
 * לשבור בשקט: 126 אתרי קריאה כבר מעבירים `label` ו-`tooltip`, ובחלקם
 * ה-`tooltip` הוא *שם* („מודגש”) ובחלקם *הסבר* („העתק עיצוב ממקום אחד…”).
 * כפונקציה טהורה אפשר למדוד את ההבחנה (tests/unit/tooltip-content.test.ts),
 * והקומפוננטה נשארת חיווט.
 */

/** שלושת השדות שהטולטיפ מצייר. מחרוזת ריקה = השדה אינו מוצג. */
export interface TipContent {
  title: string;
  shortcut: string;
  description: string;
}

/**
 * התכונות שאלמנט מצהיר בהן על טולטיפ עשיר.
 *
 * למה תכונות DOM ולא props של קומפוננטה: השכבה שמציגה את הטולטיפ אחת לכל
 * התוכנה (`TooltipLayer.vue`), והיא מאזינה במסירה (delegation) על המסמך. לולא
 * זאת כל פקד היה צריך לחווט לעצמו מאזינים, טיימר ומיקום — וגם אז כפתור
 * *מנוטרל* היה נשאר בלי טולטיפ, כי דפדפן אינו שולח אירועי עכבר לפקד מנוטרל.
 */
export const TIP_TITLE_ATTR = 'data-tip-title';
export const TIP_SHORTCUT_ATTR = 'data-tip-shortcut';
export const TIP_DESCRIPTION_ATTR = 'data-tip-desc';

/** אלמנט שיש לו אחד מהשניים הוא עוגן לטולטיפ. `title` הוא הנפילה לאחור. */
export const TIP_ANCHOR_SELECTOR = `[${TIP_TITLE_ATTR}],[title]:not([title=""])`;

/**
 * מה שלא מקבל טולטיפ של המעטפת.
 *
 * אזור המסמך הוא DOM שהמנוע מצייר, ולא הממשק שלנו. `title` שהוא מוסיף (סימוני
 * תגובות, למשל) הוא שלו, וטולטיפ מעוצב של הרצועה שצץ בתוך המסמך היה הפתעה.
 * הבדיקה הזאת גם מה שמונע חישוב מיקום בכל תנועת עכבר בזמן הקלדה או בחירה.
 */
export const TIP_EXCLUDED_SELECTOR = '.editor-stack';

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export interface TipSource {
  /** תווית הפקד — השם הקצר שמופיע גם על הכפתור עצמו. */
  label?: string;
  /** ה-prop הקיים. לפי אתר הקריאה הוא שם או הסבר — ראו למטה. */
  tooltip?: string;
  /** הסבר מפורש. גובר על כל גזירה. */
  description?: string;
  /** תווית הצירוף מהרג'יסטרי, למשל `Ctrl+B`. */
  shortcut?: string;
}

/**
 * שלושת השדות, בהינתן מה שאתר הקריאה מסר.
 *
 * הכלל, ולמה הוא כזה:
 *
 * 1. **`description` מפורש גובר.** זה המסלול לפקדים שנכתב להם הסבר משלהם.
 * 2. **יש `label` וה-`tooltip` שונה ממנו → ה-`tooltip` הוא ההסבר.** זה בדיוק
 *    המקרה של „מברשת עיצוב” / „העתק עיצוב ממקום אחד והחל במקום אחר”, וגם של
 *    כפתור מנוטרל שה-`tooltip` שלו הוא *הסיבה* („אין בחירה”) — הכותרת נשארת
 *    שם הפקד, והסיבה יורדת לשורת ההסבר במקום להחליף את השם.
 * 3. **אחרת ה-`tooltip` הוא הכותרת.** אלה הכפתורים חסרי התווית שברצועה
 *    (`variant: 'icon-only'`), שבהם ה-`tooltip` תמיד היה השם: „מודגש”, „נטוי”.
 *
 * המקרה שהכלל *לא* מטפל בו הוא `tooltip` ארוך על כפתור בלי `label` — שם אין
 * ממה לגזור כותרת, וההסבר יוצג ככותרת. זה המצב הקיים בדיוק, ולכן אינו רגרסיה;
 * הדרך לתקן אתר קריאה כזה היא להוסיף לו `description`.
 */
export function tipParts(source: TipSource): TipContent {
  const label = clean(source.label);
  const tooltip = clean(source.tooltip);
  const explicit = clean(source.description);

  const title = label || tooltip;
  const derived = label && tooltip && tooltip !== label ? tooltip : '';

  return {
    title,
    shortcut: clean(source.shortcut),
    description: explicit || derived,
  };
}

/**
 * התוכן שאלמנט מצהיר עליו, או null אם אינו עוגן.
 *
 * הנפילה ל-`title` היא מה שמעביר את כל התוכנה לעיצוב החדש בבת אחת: פקד שלא
 * חווט (הכפתורים בפס העליון, בשורת המצב, לוח הצבעים) ממשיך למסור מחרוזת אחת,
 * ומקבל אותה כמלבן המעוצב במקום כמלבן של מערכת ההפעלה.
 */
export function readTip(element: Element): TipContent | null {
  const declared = element.getAttribute(TIP_TITLE_ATTR);
  const native = element.getAttribute('title');

  const content = tipParts({
    tooltip: declared ?? native ?? '',
    shortcut: element.getAttribute(TIP_SHORTCUT_ATTR) ?? '',
    description: element.getAttribute(TIP_DESCRIPTION_ATTR) ?? '',
  });

  return content.title || content.description ? content : null;
}
