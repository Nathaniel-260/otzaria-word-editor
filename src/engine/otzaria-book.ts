/**
 * ייצוא לפורמט ספר של אוצריא: טקסט פשוט, פסקה אחת = שורה אחת, כותרות כתגי
 * `<h1>`–`<h6>` בתחילת שורה.
 *
 * ## החוזה של הצד השני
 *
 * הפורמט אינו המצאה של התוסף — הוא חוזה מתועד באוצריא עצמה:
 * `lib/utils/text/otzaria_markup.dart` (שמכריז על עצמו כמקור היחיד) ו-
 * `docs/document_conversion_matrix.md`. שלוש הנקודות שהמודול הזה חייב להן:
 *
 * 1. **שורה = יחידת כתובת.** אוצריא ממספרת שורות (`content.split('\n')`),
 *    וקישורים, סימניות והערות אישיות מצביעים על אינדקס שורה. לכן אסור `\n`
 *    בתוך פסקה — שבירת שורה רכה בתוך פסקה מתורגמת ל-`<br>`, שהוא חלק
 *    מתת-קבוצת ה-HTML המותרת שם.
 * 2. **כותרת = שורה שמתחילה ב-`<h#>`.** שני הפרסרים של אוצריא
 *    (`toc_parser.dart` ו-`generator.dart::detectHeaderLevel`) בודקים
 *    `startsWith('<h1'..'<h6')` — כותרת עטופה במשהו אחר אינה כותרת.
 * 3. **טקסט חופשי חייב escaping.** `<` גולמי בטקסט המסמך היה נקרא שם כתג.
 *
 * ## מיפוי הרמות — בהיסט, כמו אוצריא עצמה
 *
 * `Title` → `<h1>`, ‏`Heading1` → `<h2>` וכן הלאה עד תקרה ב-`<h6>`. זו אותה
 * הזזה שהממירים של אוצריא עצמה עושים (HTML/EPUB: ‏h1→h2, מטריצת ההמרה הערה ⁵):
 * `<h1>` שמור לשם הספר, שהוא שורש יחיד בעץ הניווט. מסמך בלי פסקת `Title`
 * מקבל את שם המסמך כשורת `<h1>` ראשונה — אחרת הכותרות היו מתחילות מ-`<h2>`
 * ואוצריא הייתה מקדמת את כולן ליתומים-בשורש.
 *
 * ## מה מושמט, במפורש
 *
 * פסקאות ריקות אינן מיוצאות: באוצריא כל שורה היא כתובת, ושורת-כתובת ריקה
 * אינה שווה את המרווח החזותי. עיצוב בתוך פסקה (מודגש, הערות שוליים) אינו
 * מיוצא בשלב הזה — `blocks.list` מחזיר את הטקסט הקנוני בלבד, וזה הייצוא
 * ה„פשוט” במכוון. נאמנות מלאה דורשת את `doc.getHtml` ושכבת התאמה ל-whitelist
 * של אוצריא — הרחבה נפרדת אם תידרש.
 */
import type { SuperDoc } from 'superdoc';
import type { MaybePromise } from './document-api';
import { thrownText } from './document-api';
import { NO_DOCUMENT_TEXT } from './shulchan/shulchan-doc';

/** מה שנצרך מ-`blocks.list` — כמו ב-shulchan-doc.ts, בתוספת שדות הכותרת. */
interface BookBlockEntry {
  nodeId?: unknown;
  text?: unknown;
  styleId?: unknown;
  headingLevel?: unknown;
}

export interface OtzariaBookDocumentApi {
  blocks?: {
    list?: (input: {
      includeText: boolean;
      offset: number;
      limit: number;
    }) => MaybePromise<{ blocks?: readonly BookBlockEntry[] } | undefined>;
  };
}

export interface OtzariaBookHost {
  activeEditor?: { doc?: OtzariaBookDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type OtzariaBookTarget = SuperDoc | OtzariaBookHost | null | undefined;

/** אותם גבולות דפדוף כמו ב-search.ts וב-shulchan-doc.ts — כיסוי מלא או כשל גלוי. */
const BLOCKS_PAGE_SIZE = 500;
const BLOCKS_MAX_PAGES = 50;

/** תקרת הרמות של אוצריא: `detectHeaderLevel` מכיר `<h1>`–`<h6>` בלבד. */
const MAX_HEADING = 6;

export interface OtzariaBookResult {
  /** תוכן הקובץ: שורות מופרדות `\n`, בלי שורה ריקה בסוף. */
  text: string;
  lineCount: number;
  headingCount: number;
  /** האם שם המסמך הוזרק כ-`<h1>` כי אין פסקת Title. */
  titleAdded: boolean;
}

export type OtzariaBookOutcome =
  | ({ ok: true } & OtzariaBookResult)
  | { ok: false; message: string; reason: string };

const FAILED_ACTION = 'הייצוא לספר אוצריא נכשל';

/**
 * רמת הכותרת של בלוק, אחרי ההיסט, או `null` לפסקת גוף.
 *
 * `headingLevel` מהמנוע קודם ל-`styleId`: הוא מגיע מ-outline level אמיתי.
 * `styleId` הוא הגיבוי — מסמכים שהכותרות בהם הן סגנון בלי outline. הנרמול
 * (`heading 1` → `heading1`) מאותה סיבה שב-style-gallery.ts: תבניות Word
 * אינן עקביות ברישיות וברווחים.
 */
export function otzariaHeadingLevel(
  styleId: string | null | undefined,
  headingLevel: number | undefined,
): number | null {
  const key = typeof styleId === 'string' ? styleId.trim().toLowerCase().replace(/\s+/g, '') : '';
  if (key === 'title') return 1;
  if (typeof headingLevel === 'number' && Number.isInteger(headingLevel) && headingLevel >= 1) {
    return Math.min(headingLevel + 1, MAX_HEADING);
  }
  const match = /^heading([1-9])$/.exec(key);
  if (match) return Math.min(Number(match[1]) + 1, MAX_HEADING);
  return null;
}

/** escaping לטקסט חופשי — `<` גולמי היה נקרא באוצריא כתג. הסדר קובע: `&` ראשון. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * שורת אוצריא אחת מתוך בלוק: escaping, ואז `\n` פנימי (שבירה רכה) ל-`<br>` —
 * אחרי ה-escaping, כדי שה-`<br>` שנוצר לא יימלט בעצמו.
 */
function lineText(raw: string): string {
  return escapeText(raw).replace(/\n/g, '<br>').trim();
}

/** שם קובץ מוצע: אותו ניקוי כמו `documentFileName`, עם סיומת `txt`. */
export function otzariaBookFileName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'ספר';
  return `${clean}.txt`;
}

/**
 * בונה את תוכן הספר מהמסמך הפתוח.
 *
 * לעולם אינה מחזירה כיסוי חלקי: קריאת בלוקים שנכשלה באמצע היא `ok: false`,
 * לא ספר קטוע — ספר חסר-סוף שנקלט לספרייה גרוע מכשל גלוי (אותו שיקול כמו
 * ב-search.ts).
 */
export async function buildOtzariaBook(
  host: OtzariaBookTarget,
  documentTitle: string,
): Promise<OtzariaBookOutcome> {
  const list = (host as OtzariaBookHost | null | undefined)?.activeEditor?.doc?.blocks?.list;
  if (typeof list !== 'function') {
    return { ok: false, message: `${FAILED_ACTION}: ${NO_DOCUMENT_TEXT}`, reason: 'command-unsupported' };
  }

  const lines: string[] = [];
  let headingCount = 0;
  let hasBookTitle = false;

  let offset = 0;
  try {
    for (let page = 0; page < BLOCKS_MAX_PAGES; page += 1) {
      const result = await list({ includeText: true, offset, limit: BLOCKS_PAGE_SIZE });
      const entries = result?.blocks ?? [];
      for (const entry of entries) {
        const text = typeof entry?.text === 'string' ? lineText(entry.text) : '';
        if (!text) continue; // פסקה ריקה — מושמטת, ראו הערת הפתיחה.

        const level = otzariaHeadingLevel(
          typeof entry.styleId === 'string' ? entry.styleId : null,
          typeof entry.headingLevel === 'number' ? entry.headingLevel : undefined,
        );
        if (level === null) {
          lines.push(text);
        } else {
          lines.push(`<h${level}>${text}</h${level}>`);
          headingCount += 1;
          if (level === 1) hasBookTitle = true;
        }
      }
      if (entries.length < BLOCKS_PAGE_SIZE) break;
      offset += entries.length;
    }
  } catch (error) {
    return { ok: false, message: thrownText(FAILED_ACTION, error), reason: 'threw' };
  }

  if (lines.length === 0) {
    return { ok: false, message: 'המסמך ריק — אין מה לייצא לספר', reason: 'empty' };
  }

  let titleAdded = false;
  const bookTitle = escapeText(documentTitle.trim());
  if (!hasBookTitle && bookTitle) {
    lines.unshift(`<h1>${bookTitle}</h1>`);
    headingCount += 1;
    titleAdded = true;
  }

  return { ok: true, text: lines.join('\n'), lineCount: lines.length, headingCount, titleAdded };
}
