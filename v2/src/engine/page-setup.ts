/**
 * לשונית „פריסה”: שוליים, כיוון, גודל נייר ועמודות — דרך `doc.sections`.
 *
 * ## היחידות (נמדד, לא הונח)
 *
 * המסמך הריק של המנוע ארוז ב-base64 בתוך
 * `node_modules/superdoc/dist/chunks/blank-docx-*.es.js`. חילוץ ה-ZIP וקריאת
 * `word/document.xml` נותנים את ה-`sectPr` הזה:
 *
 *     <w:pgSz w:w="12240" w:h="15840"/>
 *     <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
 *              w:header="720" w:footer="720" w:gutter="0"/>
 *
 * כלומר ה-XML הוא twips, 1440 לאינץ' — `1440` = אינץ' אחד = 2.54 ס"מ, וגודל
 * המסמך הריק הוא Letter (12240×15840) ולא A4.
 *
 * **אבל ה-API אינו מקבל twips אלא אינצ'ים.** זה נמדד במימוש עצמו
 * (`@superdoc/docx-engine`, הפונקציות שכותבות את ה-`sectPr`): כל אחת מהן
 * כותבת `String(Math.round(value * 1440))`. כלומר `setPageMargins({top: 1})`
 * מייצר `w:top="1440"`, ו-`setPageMargins({top: 1440})` היה מייצר
 * `w:top="2073600"` — שולי דף בגובה 36 מטר. אותה המרה חלה על
 * `setPageSetup.width/height` ועל `setColumns.gap`.
 *
 * לכן הקבועים כאן נשמרים ב-twips — אלה המספרים שנמדדו ושמופיעים ב-OOXML —
 * והחלוקה ב-`TWIPS_PER_INCH` נעשית ברגע הקריאה למנוע. שתי היחידות גלויות
 * במקום שבו הן נפגשות, ולא מוסתרות בקבוע אחד ששמו לא אומר מה הוא.
 *
 * ## כיוון הדף
 *
 * אין צורך להחליף `width`/`height` בעצמנו: המימוש בודק את היחס הקיים ומחליף
 * לבדו כשהוא אינו מתאים לכיוון המבוקש (`landscape && w<=h` או
 * `portrait && w>h`). לכן `applyOrientation` שולח `orientation` בלבד. לעומת
 * זאת **החלפת גודל נייר כן חייבת להתחשב בכיוון**: המימוש מחליף רק כשנשלח
 * `orientation`, ושליחת מידות A4 לאורך למסמך שהוא לרוחב הייתה משאירה
 * `w:orient="landscape"` על דף שמידותיו לאורך. לכן `applyPaperSize` קורא את
 * הכיוון הנוכחי של המקטע ומחליף את המידות בעצמו.
 *
 * ## על מה זה מוחל
 *
 * על **כל** המקטעים במסמך, ולא על המקטע שבו הסמן. זה מה ש-Word עושה: בדיאלוג
 * „הגדרת עמוד” ברירת המחדל של „החל על” היא „כל המסמך”, וכך גם הגלריות בסרגל.
 * זה גם חוסך תלות ב-`selection` — מיפוי הסמן למקטע דורש את אינדקס הפסקה שלו,
 * וה-selection API אינו חושף אותו ישירות. במסמך רגיל יש מקטע אחד.
 *
 * ## NO_OP אינה שגיאה
 *
 * המנוע מחזיר `success: false, failure.code: 'NO_OP'` כשהערכים המבוקשים כבר
 * מוגדרים. מבחינת המשתמש זו הצלחה — הוא בחר „רגיל” והשוליים רגילים. הודעת
 * שגיאה במצב הזה הייתה גורמת לו לחשוב שהפקד שבור.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';

/** 1440 twips לאינץ'. נמדד ב-`w:pgMar w:top="1440"` של המסמך הריק. ראו הערת הפתיחה. */
export const TWIPS_PER_INCH = 1440;

export interface MarginPreset {
  id: string;
  label: string;
  /** מה שמוצג בתפריט מתחת לשם, בסנטימטרים — היחידה שהמשתמש חושב בה. */
  hint: string;
  /** twips. ההמרה לאינצ'ים נעשית בקריאה למנוע. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * ה-presets של Word, בערכים שלו בדיוק. „רחב” אינו 5.08 מכל צד: ב-Word הוא
 * 2.54 למעלה ולמטה ו-5.08 בצדדים, וזו הפריסה שנראית כמו מסמך רחב-שוליים ולא
 * כמו טקסט שנדחס לריבוע.
 */
export const MARGIN_PRESETS: readonly MarginPreset[] = [
  { id: 'normal', label: 'רגיל', hint: '2.54 ס"מ מכל צד', top: 1440, right: 1440, bottom: 1440, left: 1440 },
  { id: 'narrow', label: 'צר', hint: '1.27 ס"מ מכל צד', top: 720, right: 720, bottom: 720, left: 720 },
  { id: 'wide', label: 'רחב', hint: '2.54 ס"מ למעלה ולמטה, 5.08 בצדדים', top: 1440, right: 2880, bottom: 1440, left: 2880 },
];

export interface PaperSize {
  id: string;
  label: string;
  hint: string;
  /** twips, לאורך. ראו הערת הפתיחה. */
  widthTwips: number;
  heightTwips: number;
  /**
   * `w:pgSz/@w:code` — קוד גודל הנייר של Windows (DMPAPER). Word כותב אותו
   * לצד המידות, וקוד שאינו מתאים למידות מבלבל את דיאלוג ההדפסה.
   */
  code: string;
}

/** A4 ראשון: זו ברירת המחדל בעברית, והמסמך הריק של המנוע דווקא נפתח ב-Letter. */
export const PAPER_SIZES: readonly PaperSize[] = [
  { id: 'a4', label: 'A4', hint: '21 × 29.7 ס"מ', widthTwips: 11906, heightTwips: 16838, code: '9' },
  { id: 'letter', label: 'Letter', hint: '21.6 × 27.9 ס"מ', widthTwips: 12240, heightTwips: 15840, code: '1' },
];

export type PageOrientation = 'portrait' | 'landscape';

export const ORIENTATIONS: readonly { id: PageOrientation; label: string; hint: string }[] = [
  { id: 'portrait', label: 'לאורך', hint: 'הדף גבוה מרוחבו' },
  { id: 'landscape', label: 'לרוחב', hint: 'הדף רחב מגובהו' },
];

export const COLUMN_CHOICES: readonly { count: number; label: string; hint: string }[] = [
  { count: 1, label: 'אחת', hint: 'עמודה אחת' },
  { count: 2, label: 'שתיים', hint: 'שתי עמודות שוות' },
  { count: 3, label: 'שלוש', hint: 'שלוש עמודות שוות' },
];

/** 720 twips = חצי אינץ'. זה הרווח שהמסמך הריק נושא (`w:cols w:space="720"`) וזה שWord קובע ב-presets. */
export const COLUMN_GAP_TWIPS = 720;

/** מה שנקרא מ-`sections.list()`. `pageSetup` נדרש רק כדי לזהות מקטע שהוא לרוחב. */
interface SectionItem {
  address?: unknown;
  pageSetup?: { width?: number; height?: number; orientation?: string };
}

export interface PageSetupDocumentApi {
  sections?: {
    list?: () => MaybePromise<{ items?: readonly SectionItem[] } | undefined>;
    setPageMargins?: (input: {
      target: unknown;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }) => MaybePromise<DocReceipt>;
    setPageSetup?: (input: {
      target: unknown;
      width?: number;
      height?: number;
      orientation?: PageOrientation;
      paperSize?: string;
    }) => MaybePromise<DocReceipt>;
    setColumns?: (input: {
      target: unknown;
      count?: number;
      gap?: number;
      equalWidth?: boolean;
    }) => MaybePromise<DocReceipt>;
  };
}

/** מה שנדרש מ-SuperDoc: רק הפאסדה של המסמך. ראו document-defaults.ts. */
export interface PageSetupHost {
  activeEditor?: { doc?: PageSetupDocumentApi | null } | null;
}

/**
 * ה-union הוא מה שמאפשר להעביר גם את המופע האמיתי וגם כפיל בבדיקות.
 *
 * בלעדיו TypeScript משווה מבנית את `BrowserDocumentApi` המלא מול הצורה
 * המוצהרת כאן, ונכשל על `target: unknown` מול `SectionAddress` — כלומר החוזה
 * המצומצם היה מחייב לשכפל את כל טיפוסי הכתובות של המנוע. אותה תבנית בדיוק
 * כמו `applyHebrewDocumentDefaults`.
 */
export type PageSetupTarget = SuperDoc | PageSetupHost | null | undefined;

type Sections = NonNullable<PageSetupDocumentApi['sections']>;

/** אינצ'ים מ-twips, מעוגל לשש ספרות: `round(x * 1440)` במנוע מחזיר את ה-twips המדויקים. */
export function twipsToInches(twips: number): number {
  return twips / TWIPS_PER_INCH;
}

function unavailable(failedAction: string, detail: string, reason: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: ${detail}`, reason };
}

/**
 * מריצה מוטציה על כל מקטעי המסמך ומחזירה תוצאה אחת.
 *
 * לעולם אינה זורקת: פעולות ה-Document API זורקות `INVALID_INPUT` על קלט פסול
 * במקום להחזיר קבלה, וחריגה מפקד ב-Ribbon מפילה את הרינדור של הרצועה כולה.
 */
async function applyToSections(
  host: PageSetupTarget,
  failedAction: string,
  pick: (sections: Sections) => ((section: SectionItem, target: unknown) => MaybePromise<DocReceipt>) | null,
): Promise<CommandOutcome> {
  const doc = (host as PageSetupHost | null | undefined)?.activeEditor?.doc;
  if (!doc) return unavailable(failedAction, 'המסמך עדיין נטען', 'document-api-unavailable');

  const sections = doc.sections;
  const mutate = sections ? pick(sections) : null;
  if (!sections?.list || !mutate) {
    return unavailable(failedAction, 'הפעולה אינה נתמכת בגרסה הזאת של המנוע', 'command-unsupported');
  }

  let items: readonly SectionItem[];
  try {
    items = (await sections.list())?.items ?? [];
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  const targets = items.filter((item) => item.address !== undefined && item.address !== null);
  if (targets.length === 0) {
    return unavailable(failedAction, 'לא נמצא מקטע במסמך', 'target-unresolved');
  }

  for (const section of targets) {
    let receipt: DocReceipt;
    try {
      receipt = await mutate(section, section.address);
    } catch (error) {
      return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
    }

    const code = receipt?.failure?.code;
    // NO_OP = הערכים כבר מוגדרים. ראו הערת הפתיחה.
    if (receipt?.success === false && code !== 'NO_OP') {
      return { ok: false, message: receiptFailureText(failedAction, receipt), reason: code };
    }
  }

  return { ok: true };
}

export function findMarginPreset(id: string): MarginPreset | undefined {
  return MARGIN_PRESETS.find((preset) => preset.id === id);
}

export function findPaperSize(id: string): PaperSize | undefined {
  return PAPER_SIZES.find((size) => size.id === id);
}

export function applyMarginPreset(
  host: PageSetupTarget,
  presetId: string,
): Promise<CommandOutcome> {
  const preset = findMarginPreset(presetId);
  if (!preset) {
    // באג בקוד שלנו, לא מצב של המסמך: הפקד לא היה צריך להציע את הערך הזה.
    return Promise.resolve({
      ok: false,
      message: `שינוי השוליים נכשל: אין preset בשם ${presetId}`,
      reason: 'unknown-preset',
    });
  }

  return applyToSections(host, `שינוי השוליים ל„${preset.label}” נכשל`, (sections) => {
    const setPageMargins = sections.setPageMargins;
    if (!setPageMargins) return null;
    return (_section, target) =>
      setPageMargins({
        target,
        top: twipsToInches(preset.top),
        right: twipsToInches(preset.right),
        bottom: twipsToInches(preset.bottom),
        left: twipsToInches(preset.left),
      });
  });
}

export function applyOrientation(
  host: PageSetupTarget,
  orientation: PageOrientation,
): Promise<CommandOutcome> {
  const label = orientation === 'landscape' ? 'לרוחב' : 'לאורך';
  return applyToSections(host, `שינוי כיוון הדף ל„${label}” נכשל`, (sections) => {
    const setPageSetup = sections.setPageSetup;
    if (!setPageSetup) return null;
    // בלי width/height: המנוע מחליף אותם בעצמו כשהם אינם מתאימים לכיוון.
    return (_section, target) => setPageSetup({ target, orientation });
  });
}

/** האם המקטע כרגע לרוחב. היחס `width > height` אינו תלוי ביחידה שבה נקרא. */
function isLandscape(section: SectionItem): boolean {
  const setup = section.pageSetup;
  if (setup?.orientation === 'landscape') return true;
  if (setup?.orientation === 'portrait') return false;
  const { width, height } = setup ?? {};
  return typeof width === 'number' && typeof height === 'number' && width > height;
}

export function applyPaperSize(
  host: PageSetupTarget,
  sizeId: string,
): Promise<CommandOutcome> {
  const size = findPaperSize(sizeId);
  if (!size) {
    return Promise.resolve({
      ok: false,
      message: `שינוי גודל הדף נכשל: אין גודל בשם ${sizeId}`,
      reason: 'unknown-paper-size',
    });
  }

  return applyToSections(host, `שינוי גודל הדף ל-${size.label} נכשל`, (sections) => {
    const setPageSetup = sections.setPageSetup;
    if (!setPageSetup) return null;
    return (section, target) => {
      const landscape = isLandscape(section);
      // המידות בטבלה הן לאורך; במקטע שהוא לרוחב מחליפים אותן, אחרת נשארת
      // סתירה בין `w:orient` ובין המידות בפועל.
      const width = landscape ? size.heightTwips : size.widthTwips;
      const height = landscape ? size.widthTwips : size.heightTwips;
      return setPageSetup({
        target,
        width: twipsToInches(width),
        height: twipsToInches(height),
        paperSize: size.code,
      });
    };
  });
}

export function applyColumns(
  host: PageSetupTarget,
  count: number,
): Promise<CommandOutcome> {
  if (!Number.isInteger(count) || count < 1) {
    return Promise.resolve({
      ok: false,
      message: `שינוי מספר העמודות נכשל: ${count} אינו מספר עמודות חוקי`,
      reason: 'invalid-column-count',
    });
  }

  return applyToSections(host, `שינוי מספר העמודות ל-${count} נכשל`, (sections) => {
    const setColumns = sections.setColumns;
    if (!setColumns) return null;
    return (_section, target) =>
      setColumns({
        target,
        count,
        gap: twipsToInches(COLUMN_GAP_TWIPS),
        equalWidth: true,
      });
  });
}
