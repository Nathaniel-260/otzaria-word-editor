/**
 * „הדפסה”: מה שהמעטפת עושה **לפני** `window.print()`.
 *
 * ## מה היה כאן
 *
 * `onPrint()` היה `window.print()` בשורה אחת, ובכל `src/` וב-`index.html`
 * לא היה אף `@media print` ואף `@page`. כלומר הכפתור הדפיס את **הממשק**: נמדד
 * ב-CDP (`Emulation.setEmulatedMedia: print` + `Page.printToPDF`) על ה-dist
 * הארוז שהפלט מכיל את פס הכותרת עם הלוגו, את שמונה לשוניות הרצועה, את גלריית
 * הסגנונות ואת שורת המצב — והמסמך עצמו קטע קטן באמצע, כי המעטפת היא
 * `height: 100vh; overflow: hidden` ולכן מה שנדפס הוא בדיוק גובה חלון אחד.
 *
 * ## שלוש הבעיות, ולמי כל אחת שייכת
 *
 * 1. **המעטפת נדפסת.** נפתר ב-`styles/print.css`: שם יושב הגלון שמסתיר את פס
 *    הכותרת, הרצועה, שורת המצב והדיאלוגים, ומשחרר את מיכל הגלילה כדי שכל
 *    עמודי המסמך יהיו בזרימה ולא רק זה שנראה.
 * 2. **גודל הנייר.** `@page` **חייב** לקבל את מידות הדף של המסמך: המנוע מצייר
 *    את העמוד כתיבה בגודל קבוע (A4 = 793.733×1122.53 פיקסלים), ונייר קטן ממנו
 *    שובר כל עמוד לשני גיליונות. המידות אינן ידועות בזמן כתיבת ה-CSS — הן של
 *    המסמך — ולכן הן נקראות מהמנוע כאן ומוזרקות כ-`@page` לפני ההדפסה.
 * 3. **הזום.** נמדד: `ui.zoom` מיושם כ-`transform: matrix(0.5, …)` על מיכל
 *    העמודים של המנוע. כלומר הדפסה ב-50% הייתה מדפיסה מסמך מוקטן בפינת
 *    הגיליון. הגלון מבטל את ה-transform במדיית print, וזה נמדד: באותו מסמך
 *    ב-50% זום, במדיית print העמודים חזרו ל-794×1123 והפלט היה שלושה גיליונות
 *    A4 מלאים.
 *
 * ## היחידות (נמדד, לא הונח)
 *
 * `sections.list()` מחזיר `pageSetup.width/height` ב**אינצ'ים**: הפרויקציה
 * הציבורית במנוע היא `twips / 1440` (הפונקציה `_I` ב-`@superdoc/docx-engine`),
 * סימטרית לסטרים שמכפילים ב-1440 (ראו engine/page-setup.ts). A4 = 11906 twips
 * = 8.268 אינץ'.
 *
 * העיגול הוא **כלפי מעלה** ובכוונה: גיליון שקטן מתיבת העמוד אפילו בשבריר
 * פיקסל מוליד עמוד נוסף ריק על כל עמוד במסמך. עיגול למעלה מוסיף פחות מעשירית
 * פיקסל של לבן ואינו יכול לשבור עמוד.
 *
 * ## מה אינו מטופל, במפורש
 *
 * מסמך עם כמה מקטעים בגדלים שונים מקבל את הגודל של המקטע הראשון: ל-CSS יש
 * `@page` אחד למסמך, ו-named pages (`page: name`) דורשות שהמנוע יסמן כל עמוד
 * — הוא אינו עושה זאת. זה מתועד ולא מוסתר, וזה גם המקרה הנדיר.
 */
import type { SuperDoc } from 'superdoc';
import type { MaybePromise } from './document-api';

/**
 * המחלקות של המנוע שגלון ההדפסה מכוון אליהן.
 *
 * מוגדרות כאן, בקוד, ולא רק בסלקטור: `tests/contract/print.test.ts` מקבע אותן
 * מול ה-bundle של המנוע, ולכן שינוי שם במנוע מפיל בדיקה במקום להשאיר גלון
 * הדפסה שאינו תופס כלום ואיש אינו יודע. אותה סיבה שבגללה
 * `PAGE_BREAK_OPERATION` מיוצא ב-page-break.ts.
 *
 * `ENGINE_PAGE_CLASS` — תיבת העמוד המצוירת; `ENGINE_LAYOUT_CLASS` — המיכל
 * שנושא את ה-transform של הזום.
 */
export const ENGINE_PAGE_CLASS = 'superdoc-page';
export const ENGINE_LAYOUT_CLASS = 'superdoc-layout';

/** ה-`<style>` שנושא את `@page`. מזהה קבוע = אלמנט אחד שמתחדש, ולא ערימה. */
export const PRINT_PAGE_STYLE_ID = 'otzaria-print-page';

/**
 * `data-print-page-size` על שורש ה-HTML: גודל הדף שההדפסה האחרונה נשענה עליו.
 *
 * לא קוסמטי ולא רק אבחון — זהו הסימן היחיד מבחוץ למה שההדפסה חישבה, בדיוק
 * כמו `data-boot` ו-`data-document-direction`. שער ה-CDP נשען עליו, ובלעדיו
 * „הכפתור נלחץ” היה כל העדות שיש.
 */
export const PRINT_SIZE_DATASET_KEY = 'printPageSize';

/** מידות דף באינצ'ים, כפי שהמנוע מדווח עליהן. */
export interface PrintPageSize {
  widthIn: number;
  heightIn: number;
}

/**
 * גבולות שפיות למידות דף. אינם „גדלים מותרים” אלא סינון של תשובה שאינה תשובה:
 * `0`, שלילי, `NaN` או 400 אינץ' פירושם שהקריאה נכשלה, ו-`@page` כזה היה גרוע
 * מהיעדרו.
 */
const MIN_PAGE_INCHES = 0.5;
const MAX_PAGE_INCHES = 200;

/** מה שנקרא מ-`sections.list()`. רק המידות — כל השאר אינו נוגע להדפסה. */
interface SectionItem {
  pageSetup?: { width?: number; height?: number };
}

/** הצורה שנצרכת מ-`doc`. ראו ההסבר ב-document-defaults.ts למה מוגדרת ולא מיובאת. */
export interface PrintDocumentApi {
  sections?: {
    list?: () => MaybePromise<{ items?: readonly SectionItem[] } | undefined>;
  };
}

export interface PrintHost {
  activeEditor?: { doc?: PrintDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type PrintTarget = SuperDoc | PrintHost | null | undefined;

export type PrintOutcome =
  | {
      ok: true;
      /** הגודל שנכתב ל-`@page`, או `null` כשלא נקרא. */
      size: PrintPageSize | null;
      /** הודעה שאינה שגיאה: ההדפסה יצאה, אבל יש מה לומר עליה. */
      warning?: string;
    }
  | { ok: false; message: string; reason: string };

/** האם המספר הוא מידה שאפשר להישען עליה. */
function isSaneInches(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_PAGE_INCHES &&
    value <= MAX_PAGE_INCHES
  );
}

/** עיגול כלפי מעלה לשלוש ספרות. ראו הערת הפתיחה — הכיוון הוא ההגנה. */
function ceilTo3(value: number): number {
  return Math.ceil(value * 1000) / 1000;
}

/**
 * קוראת את מידות הדף של המסמך.
 *
 * המקטע הראשון שיש לו שתי מידות שפויות, ולא הראשון בהכרח: מקטע בלי `pgSz`
 * מקבל `undefined` בפרויקציה, ומסמך שכזה עדיין יודע להדפיס לפי המקטע הבא.
 *
 * לעולם אינה זורקת ולעולם אינה מחזירה גודל מומצא: `null` פירושו „לא נקרא”,
 * וההדפסה תיפול חזרה על גודל הנייר שבדיאלוג — עם הודעה שאומרת זאת.
 */
export async function readPrintPageSize(host: PrintTarget): Promise<PrintPageSize | null> {
  const list = (host as PrintHost | null | undefined)?.activeEditor?.doc?.sections?.list;
  if (typeof list !== 'function') return null;

  let items: readonly SectionItem[];
  try {
    items = (await list())?.items ?? [];
  } catch (error) {
    // קריאת המקטעים שנכשלה אינה סיבה לא להדפיס. ללוג, וממשיכים בלי `size`.
    console.warn('[otzaria-word] קריאת גודל הדף להדפסה נכשלה', error);
    return null;
  }

  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const width = item?.pageSetup?.width;
    const height = item?.pageSetup?.height;
    if (isSaneInches(width) && isSaneInches(height)) {
      return { widthIn: ceilTo3(width), heightIn: ceilTo3(height) };
    }
  }

  return null;
}

/** „8.269in 11.694in”. מיוצאת כדי שהשער ב-CDP ישווה מול אותו נוסח בדיוק. */
export function pageSizeText(size: PrintPageSize): string {
  return `${size.widthIn}in ${size.heightIn}in`;
}

/**
 * חוק ה-`@page` שמוזרק.
 *
 * `margin: 0` בשני המצבים: לעמוד עצמו יש שוליים מה-DOCX, והשוליים שדפדפן
 * מוסיף כברירת מחדל נוספים עליהם — כלומר שוליים כפולים ותוכן שנדחק.
 */
export function pageRule(size: PrintPageSize | null): string {
  if (!size) return '@page { margin: 0; }';
  return `@page { size: ${pageSizeText(size)}; margin: 0; }`;
}

export interface PrintOptions {
  /** ברירת המחדל: המסמך של הדפדפן. מוחלף בבדיקות. */
  root?: Document;
  /** ברירת המחדל: `window.print`. מוחלף בבדיקות ובשער ה-CDP. */
  print?: () => void;
}

/**
 * כותבת את `@page` ואת התכונה על השורש. מוחזרת בנפרד מ-`printDocument` כדי
 * שהיא תהיה נבדקת בלי לזמן דיאלוג הדפסה.
 */
export function applyPrintPageSize(size: PrintPageSize | null, root: Document): void {
  const head = root.head ?? root.documentElement;
  let style = root.getElementById(PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = root.createElement('style');
    style.id = PRINT_PAGE_STYLE_ID;
    head.appendChild(style);
  }
  style.textContent = pageRule(size);

  const dataset = root.documentElement?.dataset;
  if (!dataset) return;
  if (size) dataset[PRINT_SIZE_DATASET_KEY] = pageSizeText(size);
  else delete dataset[PRINT_SIZE_DATASET_KEY];
}

const NO_PAPER_WARNING =
  'גודל הדף לא נקרא מהמסמך — בדקו את גודל הנייר בדיאלוג ההדפסה';

/**
 * מכינה את הדף להדפסה ופותחת את דיאלוג ההדפסה.
 *
 * לעולם אינה זורקת: `window.print()` חסום בהקשרים מסוימים (WebView בלי הרשאת
 * הדפסה), וחריגה כאן הייתה מפילה את מטפל הלחיצה בלי שהמשתמש יראה דבר.
 */
export async function printDocument(
  host: PrintTarget,
  options: PrintOptions = {},
): Promise<PrintOutcome> {
  const root = options.root ?? document;
  const print = options.print ?? (() => window.print());

  const size = await readPrintPageSize(host);
  applyPrintPageSize(size, root);

  try {
    print();
  } catch (error) {
    return {
      ok: false,
      message: `ההדפסה לא נפתחה: ${error instanceof Error ? error.message : String(error)}`,
      reason: 'threw',
    };
  }

  return size ? { ok: true, size } : { ok: true, size: null, warning: NO_PAPER_WARNING };
}
