/**
 * „תוכן עניינים” — הקבוצה הראשונה בלשונית „הפניות” של Word העברי, דרך
 * `doc.toc`.
 *
 * מה שכבר היה כאן הוא פקד יחיד מעל פקודת ה-registry `table-of-contents-insert`
 * (שרצה על `create.tableOfContents`). המודול הזה מוסיף את מה שהופך אותו
 * לקבוצה: עדכון, הסרה, התאמה אישית וסימון ערך ידני. הפקד הקיים לא נגע.
 *
 * ## הכול כאן נמדד בדפדפן. אלה התוצאות
 *
 * Chrome headless, `file://`, ה-dist האמיתי, מסמך שנוקה ב-`clearContent`
 * וזרוע בכותרות `Heading1`/`Heading2`, ביום 25.8.2026:
 *
 * 1. **`create.tableOfContents` כותב קוד Word תקני** — `TOC \h` — והטבלה
 *    נבנית **מלאה כבר ביצירה**: `toc.get().text` החזיר
 *    `"פרק ראשון1סעיף א1פרק שני1"`, ו-`entryCount` היה 3.
 * 2. **`toc.update` באמת ממלא.** זו הייתה השאלה שהגל נשען עליה. כותרת
 *    (`פרק שלישי`) נוספה למסמך **אחרי** יצירת הטבלה; לפני העדכון
 *    `toc.get().text` היה `"פרק ראשון1סעיף א1פרק שני1"`, ואחרי
 *    `update({mode:'all'})` הוא `"פרק ראשון1סעיף א1פרק שני1פרק שלישי1"`,
 *    ו-`getText()` של המסמך כולו קיבל שורה נוספת `"פרק שלישי\t1"`.
 *    **`entryCount` אינו העדות לכך.** נמדד שוב: הוא עלה מ-3 ל-4 כבר עם
 *    הוספת הכותרת, **לפני** ה-`update` ובלי קשר אליו — הוא נספר מהמקורות
 *    (הכותרות ושדות ה-`TC`) ולא מהשורות שרונדרו. מה שהעדכון שינה הוא
 *    ה-`text`, כלומר הטבלה שעל המסך.
 * 3. **`toc.markEntry` מייצר שדה `TC` תקני של Word** — `TC "ערך ידני" \l 1` —
 *    והערך נאסף אל הטבלה בעדכון הבא (הטקסט קיבל `"ערך ידני1"` בסופו).
 *
 * ## מה שנמדד ולכן **אינו** כאן
 *
 * `TocConfigurePatch` מציע עשר מתגים. שלושה מהם מתקבלים עם `success: true`
 * ואינם עושים כלום, ולכן אין להם פקד:
 *
 * - `tabLeader` (מנהיג הנקודות) — נשלח `'dot'` ואחריו `'none'`; אף אחד מהם
 *   לא הופיע ב-`displayConfig` שחזר, וה-`instruction` לא השתנה כלל. גם ערך
 *   שאינו בחוזה בכלל (`'zigzag'`) חזר `success: true`.
 * - `rightAlignPageNumbers` — אותה תוצאה בדיוק.
 * - `includePageNumbers` — זו „הקרנה” של המתג `\n` לקריאה בלבד, ולא מתג
 *   בפני עצמו: שליחתה נבלעת בשני הכיוונים.
 *
 * וחמור מזה: **הצגת מספרי העמודים היא מתג חד-כיווני.** אחרי
 * `omitPageNumberLevels: {from:1,to:9}` (שנכתב כ-`\n "1-9"` ובאמת מוחק את
 * המספרים מהטבלה) אין בחוזה שום ערך שמחזיר אותם — נוסו `includePageNumbers:
 * true`, `{from:0,to:0}`, `{from:10,to:10}`, `null` ו-`undefined`; כולם
 * חזרו `success: true`, ואף אחד מהם לא הסיר את `\n` מה-`instruction`.
 * תיבת סימון „הצג מספרי עמודים” הייתה לכן מלכודת: מכבים אותה פעם אחת ואי
 * אפשר להדליק בחזרה. לכן היא אינה כאן, ו-`configureTableOfContents` חושפת
 * בדיוק שני דברים שנמדדו כהפיכים לחלוטין — טווח רמות הכותרות (`\o`) והאם
 * הערכים הם קישורים (`\h`).
 *
 * ## ההסרה, והשיירים שהיא משאירה
 *
 * זו התגלית הלא-נעימה של הגל. במודל של המנוע תוכן עניינים אינו בלוק אחד:
 * השורה הראשונה היא בלוק `tableOfContents`, וכל שאר השורות הן פסקאות
 * אחיות בסגנונות `TOC1`…`TOC9`. `toc.remove` מוחק את **הבלוק הראשון בלבד**
 * ומחזיר `success: true`; `toc.list` מדווח מעכשיו 0, אבל כל שאר שורות
 * הטבלה נשארות במסמך כפסקאות רגילות. נמדד: טבלה בת שש שורות הפכה אחרי
 * `remove` לחמש פסקאות `TOC1` יתומות.
 *
 * פקד „הסר תוכן עניינים” שמשאיר את גוף הטבלה על המסך הוא בדיוק הכפתור
 * שמדווח „בוצע” ואינו עושה את מה שנאמר. לכן ההסרה כאן היא שני צעדים:
 * `toc.remove`, ואחריו `blocks.deleteRange` על רצף הפסקאות שנשאר במקומו.
 *
 * `deleteRange` ולא `blocks.delete` בלולאה — והנימוק הראשון עומד בפני עצמו:
 * זו קריאה **אחת** במקום N על מסמך שהאורדינלים שלו זזים אחרי כל מחיקה, כלומר
 * אין מרוץ בין הרשימה שנקראה לבין המצב שנמחק לתוכו. בנוסף נמדד (וגם בבדיקה
 * חוזרת היום) ש-`blocks.delete` על פסקת `TOC*` יתומה **זורק**
 * `paragraph-tracked-wrapper-unsupported` ואינו מוחק דבר; סוכן QA לא שחזר
 * את הזריקה הזאת אצלו, ולכן היא נימוק תומך בלבד ולא זה שההחלטה נשענת עליו.
 *
 * ## למה „טבלה אחת” — כולל בעדכון
 *
 * להסרה ולהתאמה אישית אין דרך ציבורית לדעת על איזו טבלה המשתמש התכוון:
 * `doc.selection` מחזיר `blockId` של פסקה, ושורות הטבלה מלבד הראשונה הן
 * פסקאות שאינן נושאות שום זיהוי של הטבלה שהן שייכות לה. לכן שתי הפעולות
 * האלה פועלות על הטבלה היחידה שבמסמך, ובמסמך שיש בו יותר מאחת הן מסרבות
 * ואומרות למה.
 *
 * כאן נכתב קודם ש„עדכן טבלה” אינו דו-משמעי ולכן הוא רץ על כולן. **המדידה
 * סותרת.** שתי טבלאות שנוצרו באותו מסמך מקבלות את **אותו `nodeId` בדיוק**:
 * שתי הקריאות ל-`create.tableOfContents` החזירו `5D013B61`, `toc.list` דיווח
 * `total: 2` ושני items עם אותה כתובת, וגם `blocks.list` מציג את שני הבלוקים
 * (אורדינל 0 ואורדינל 2) תחת אותו מזהה. המזהה הוא hash של ה-`instruction`,
 * ושתי טבלאות שנוצרו כברירת מחדל נושאות `TOC \h` זהה. לולאה על ה-items
 * הייתה לכן בונה את הראשונה פעמיים, משאירה את השנייה מיושנת, ומדווחת „בוצע”.
 *
 * דרך ציבורית לפנות לטבלה השנייה **אין**, ונבדקה גם האפשרות המתבקשת: המזהה
 * שב-`blocks.list` הוא אותו מזהה עצמו. לכן העדכון רץ פעם אחת לכל כתובת
 * **שונה**, ואם היו כפילויות הוא אומר במפורש שהעדכון לא הושלם. בניגוד להסרה
 * הוא אינו מסרב מראש: בנייה מחדש אינה הרסנית, וטבלה אחת מעודכנת עדיף על
 * כלום — ובלבד שלא ייאמר למשתמש שהכול עודכן.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';
import { readDocSelection, type SelectionDocumentApi, type SelectionTarget } from './doc-selection';

/** `TocAddress` — מה ש-`get`/`configure`/`update`/`remove` מקבלים כ-`target`. */
interface TocAddress {
  kind: 'block';
  nodeType: 'tableOfContents';
  nodeId: string;
}

/** `TocEntryAddress` — הכתובת של שדה `TC` בודד. */
interface TocEntryAddress {
  kind: 'inline';
  nodeType: 'tableOfContentsEntry';
  nodeId: string;
}

/** `TocConfigurePatch` בחלק שנמדד כמשפיע והפיך. ראו הערת הפתיחה. */
interface TocConfigurePatch {
  outlineLevels?: { from: number; to: number };
  hyperlinks?: boolean;
}

/**
 * `TocDomain` בחלק שנצרך כאן.
 *
 * `preserved` הוא חלק מהחוזה הציבורי (`TocPreservedSwitches`) ולא שדה runtime,
 * ונמדד שהוא באמת מגיע: טבלה שנוצרה עם `TOC \o "1-3" \h \t "MyToc1,1"` חזרה
 * מ-`toc.list` עם `preserved.customStyles: [{styleName:"MyToc1", level:1}]`,
 * גם אחרי `update`. זה המתג `\t` של Word — הוא ממפה סגנון פסקה משלו לרמה
 * בטבלה, ובמסמך שהגיע מ-Word שורות הטבלה נושאות אותו ולא `TOC1`…`TOC9`.
 * בלעדיו ניקוי השיירים היה עיוור בדיוק במסמכים שהמתג הזה קיים בהם.
 */
interface TocEntry {
  address?: TocAddress;
  sourceConfig?: { outlineLevels?: { from?: number; to?: number } };
  displayConfig?: { hyperlinks?: boolean };
  preserved?: { customStyles?: readonly { styleName?: string; level?: number }[] };
  entryCount?: number;
}

/** `TocEntryDomain` — ערך `TC` כפי ש-`listEntries` מחזיר אותו. */
interface MarkedEntry {
  address?: TocEntryAddress;
  text?: string;
  level?: number;
}

/** `BlockListEntry` בחלק שנצרך לניקוי השיירים. */
interface BlockEntry {
  ordinal?: number;
  nodeId?: string;
  nodeType?: string;
  styleId?: string | null;
}

export interface TocDocumentApi extends SelectionDocumentApi {
  toc?: {
    list?: (query?: {
      limit?: number;
      offset?: number;
    }) => MaybePromise<{ items?: readonly TocEntry[]; total?: number } | undefined>;
    update?: (input: {
      target: TocAddress;
      mode?: 'all' | 'pageNumbers';
    }) => MaybePromise<DocReceipt>;
    remove?: (input: { target: TocAddress }) => MaybePromise<DocReceipt>;
    configure?: (input: {
      target: TocAddress;
      patch: TocConfigurePatch;
    }) => MaybePromise<DocReceipt>;
    markEntry?: (input: {
      target: {
        kind: 'inline-insert';
        anchor: { nodeType: 'paragraph'; nodeId: string };
        position?: 'start' | 'end';
      };
      text: string;
      level?: number;
    }) => MaybePromise<DocReceipt>;
    unmarkEntry?: (input: { target: TocEntryAddress }) => MaybePromise<DocReceipt>;
    listEntries?: (query?: {
      limit?: number;
      offset?: number;
    }) => MaybePromise<{ items?: readonly MarkedEntry[]; total?: number } | undefined>;
  };
  blocks?: {
    list?: (input?: {
      limit?: number;
      offset?: number;
    }) => MaybePromise<{ blocks?: readonly BlockEntry[]; total?: number } | undefined>;
    deleteRange?: (input: {
      start: { kind: 'block'; nodeType: 'paragraph'; nodeId: string };
      end: { kind: 'block'; nodeType: 'paragraph'; nodeId: string };
    }) => MaybePromise<DocReceipt>;
  };
}

/** מה שנדרש מ-SuperDoc: רק הפאסדה של המסמך. ראו page-setup.ts. */
export interface TocHost {
  activeEditor?: { doc?: TocDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type TocTarget = SuperDoc | TocHost | null | undefined;

/**
 * הטיית הכשל בעברית תקנית. „תוכן העניינים” זכר, „הטבלה” נקבה — הביטוי נשמר
 * שלם ואינו נגזר ממזהה. ראו document-api.ts.
 */
const UPDATE_FAILED = 'עדכון תוכן העניינים נכשל';
const REMOVE_FAILED = 'הסרת תוכן העניינים נכשלה';
const CONFIGURE_FAILED = 'שינוי הגדרות תוכן העניינים נכשל';
const MARK_FAILED = 'סימון הערך נכשל';
const UNMARK_FAILED = 'ביטול סימון הערך נכשל';
const READ_FAILED = 'קריאת תוכן העניינים נכשלה';

/**
 * שלוש ההודעות שחוזרות על עצמן בשלוש פעולות. „אין במסמך תוכן עניינים” מוחזר
 * ככשל ולא כהצלחה שקטה — בשונה מ„עדכן שדות” ו„עדכן הפניות”, שהם רענון
 * גורף על אוכלוסייה בלתי נראית, תוכן עניינים הוא **עצם אחד גלוי**. לחיצה על
 * „עדכן טבלה” במסמך שאין בו טבלה היא טעות, והשתיקה עליה משאירה את המשתמש
 * בטוח שמשהו קרה.
 */
const NO_TOC_DETAIL = 'אין במסמך תוכן עניינים';
const AMBIGUOUS_DETAIL =
  'יש במסמך יותר מתוכן עניינים אחד, ואין דרך לדעת על איזה מהם הפעולה חלה';
const NO_ANCHOR_DETAIL = 'יש ללחוץ בגוף המסמך, על הפסקה שאליה יסומן הערך';

/**
 * מה שמוחזר כשהעדכון רץ אך לא על כל הטבלאות. „לא הושלם” ולא „נכשל”: משהו
 * כן עודכן, והודעה שאומרת „נכשל” הייתה שולחת את המשתמש לבדוק טבלה שדווקא
 * נבנתה מחדש. אותה הבחנה בדיוק כמו ב-`rowsRemain`.
 */
function partialUpdate(unreachable: number): CommandOutcome {
  const left = unreachable === 1 ? 'אחת מהן לא עודכנה' : `${unreachable} מהן לא עודכנו`;
  return {
    ok: false,
    message: `עדכון תוכן העניינים לא הושלם: יש במסמך כמה טבלאות תוכן עניינים שאינן ניתנות להבחנה זו מזו, ולכן ${left}`,
    reason: 'ambiguous-toc',
  };
}

/**
 * מה שמוחזר כשההסרה עצמה הצליחה אך שורות הטבלה לא זוהו. שני המסלולים
 * שמגיעים לכאן — מקום שלא נמצא, וזיהוי שלא תפס שורות שהיו צפויות — מחזירים
 * את **אותה** הודעה: למשתמש שרואה שורות על המסך אין שום הבדל ביניהם.
 */
function rowsRemain(): CommandOutcome {
  return {
    ok: false,
    message: 'הסרת תוכן העניינים לא הושלמה: הטבלה הוסרה, אך שורות ממנה עשויות להישאר במסמך',
    reason: 'rows-remain',
  };
}

/** התקרה של Word למתג `\l` בשדה `TC` ולמתג `\o` בשדה `TOC`. */
export const TOC_LEVEL_MIN = 1;
export const TOC_LEVEL_MAX = 9;

/**
 * מה שמוצג למשתמש כשהרמה נדחית. הבדיקה יושבת כאן ולא נשענת על המנוע מפני
 * שנמדד שהמנוע **מקבל** `level: 12` ומחזיר `success: true` — וכותב למסמך
 * `TC "…" \l 12`, מתג שאינו חוקי ב-Word.
 */
export const TOC_LEVEL_HINT = 'רמת הערך היא מספר שלם בין 1 ל-9';

/** מה שמוצג כשטווח הרמות נדחה. גם כאן המנוע מקבל הכול — ראו `normalizeTocLevels`. */
export const TOC_LEVELS_HINT = 'טווח הרמות מתחיל ברמה 1 לכל הפחות, מסתיים ברמה 9 לכל היותר, והרמה הראשונה אינה גדולה מהאחרונה';

/** טקסט הערך כפי שיישלח, או `null` כשהוא ריק. המנוע **זורק** על מחרוזת ריקה. */
export function normalizeTocEntryText(raw: string): string | null {
  const text = raw.trim();
  return text === '' ? null : text;
}

/** האם הרמה חוקית ל-Word. `Number.isInteger` ולא `>=`: `1.5` נשלח כמו שהוא. */
export function isValidTocLevel(level: number): boolean {
  return Number.isInteger(level) && level >= TOC_LEVEL_MIN && level <= TOC_LEVEL_MAX;
}

/**
 * טווח הרמות כפי שיישלח, או `null` כשהוא פסול.
 *
 * הבדיקה כאן ולא במנוע: נמדד ש-`configure` מקבל `{from:9,to:1}` בשמחה,
 * כותב `TOC \o "9-1"`, ומחזיר `success: true` — והטבלה נעשית **ריקה**.
 * כלומר המשתמש היה לוחץ „אישור” ורואה את תוכן העניינים שלו נמחק.
 */
export function normalizeTocLevels(from: number, to: number): { from: number; to: number } | null {
  if (!isValidTocLevel(from) || !isValidTocLevel(to) || from > to) return null;
  return { from, to };
}

function unavailable(failedAction: string, detail: string, reason: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: ${detail}`, reason };
}

/** הנוסח שהתכנית קובעת ב-§12, וזהה לזה שהיכולת מחזירה. ראו footnotes.ts. */
function unsupported(failedAction: string): CommandOutcome {
  return {
    ok: false,
    message: `${failedAction}: אינו זמין בגרסה זו`,
    reason: 'command-unsupported',
  };
}

/** קריאה למנוע שאינה זורקת החוצה. ראו הערת ה„לעולם לא זורקת” ב-footnotes.ts. */
async function attempt<T>(
  failedAction: string,
  call: () => MaybePromise<T>,
): Promise<{ ok: true; value: T } | { ok: false; outcome: CommandOutcome }> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return {
      ok: false,
      outcome: { ok: false, message: thrownText(failedAction, error), reason: 'threw' },
    };
  }
}

/** כשל הקבלה, או `null` כשהיא הצליחה. `NO_OP` נחשב הצלחה — ראו header-footer.ts. */
function failureOf(failedAction: string, receipt: DocReceipt | undefined): CommandOutcome | null {
  const code = receipt?.failure?.code;
  if (receipt?.success !== false || code === 'NO_OP') return null;
  return { ok: false, message: receiptFailureText(failedAction, receipt), reason: code };
}

function docOf(host: TocTarget): TocDocumentApi | null {
  return (host as TocHost | null | undefined)?.activeEditor?.doc ?? null;
}

/** גודל העמוד בכל שאיבה, ובלם מפני מנוע שיחזיר `total` שאינו יורד. ראו fields.ts. */
const PAGE_SIZE = 200;
const PAGE_GUARD = 1000;

/**
 * כל הפריטים של פעולת discovery, בשאיבת עמודים עד `total`.
 *
 * `total` ולא `items.length`: `TocListResult` ו-`TocListEntriesResult` הם
 * `DiscoveryOutput`, כלומר `items` הוא עמוד תחת `limit`/`offset`. רשימה
 * שמציגה עמוד אחד הייתה משאירה במסמך גדול טבלאות שהעדכון לא נגע בהן.
 *
 * כשל באמצע השאיבה מוחזר כמו שהוא ואינו נבלע: הקורא הוא שמחליט אם חצי
 * רשימה מספיקה לו (`readTocState`) או שהיא כשל (`updateTableOfContents`).
 */
async function collectAll<T>(
  failedAction: string,
  list: (query: { limit: number; offset: number }) => MaybePromise<
    { items?: readonly T[]; total?: number } | undefined
  >,
): Promise<{ ok: true; items: T[] } | { ok: false; items: T[]; outcome: CommandOutcome }> {
  const items: T[] = [];
  let offset = 0;
  let guard = 0;

  for (;;) {
    const listed = await attempt(failedAction, () => list({ limit: PAGE_SIZE, offset }));
    if (!listed.ok) return { ok: false, items, outcome: listed.outcome };

    const page = listed.value?.items ?? [];
    items.push(...page);
    if (page.length === 0) return { ok: true, items };

    offset += page.length;

    const total = listed.value?.total;
    if (!Number.isFinite(total) || offset >= (total as number)) return { ok: true, items };
    if (++guard > PAGE_GUARD) return { ok: true, items };
  }
}

/* ------------------------------------------------------------------ */
/* קריאה                                                               */
/* ------------------------------------------------------------------ */

/** ערך `TC` כפי שהדיאלוג מציג אותו. */
export interface TocEntrySummary {
  nodeId: string;
  text: string;
  level: number;
}

/** מה שהממשק צריך לדעת. תצלום ולא מנוי, כמו header-footer.ts. */
export interface TocState {
  /** מספר טבלאות התוכן במסמך. 0 = אין מה לעדכן, >1 = אי-אפשר להסיר. */
  count: number;
  /** טווח הרמות של הטבלה היחידה, או `null` כשהמנוע לא הצהיר עליו (`TOC` בלי `\o`). */
  levels: { from: number; to: number } | null;
  /** האם הערכים בטבלה הם קישורים (`\h`). */
  hyperlinks: boolean;
  /** הערכים הידניים (`TC`) שבמסמך. */
  entries: readonly TocEntrySummary[];
}

export function emptyTocState(): TocState {
  return { count: 0, levels: null, hyperlinks: false, entries: [] };
}

/**
 * קוראת את מצב תוכן העניינים במסמך. לעולם אינה זורקת: כשל של קריאה מחזיר
 * „אין תוכן עניינים”, כלומר ה-tooltip יאמר שאין מה לעדכן — ולא ימציא מספר.
 *
 * ההגדרות נקראות מהטבלה **הראשונה** בלבד, מפני שהדיאלוג ממילא פועל רק על
 * מסמך שיש בו טבלה אחת (ראו הערת הפתיחה); במסמך עם שתיים הוא מסרב לפני
 * שהוא מציג משהו, ולכן אין מצב שבו הערכים המוצגים שייכים לטבלה אחרת מזו
 * שתשונה.
 */
export async function readTocState(host: TocTarget): Promise<TocState> {
  const doc = docOf(host);
  const list = doc?.toc?.list;
  if (typeof list !== 'function') return emptyTocState();

  const listed = await collectAll<TocEntry>(READ_FAILED, (query) => list(query));
  const first = listed.items[0];

  const levels = first?.sourceConfig?.outlineLevels;
  const from = levels?.from;
  const to = levels?.to;

  const entries: TocEntrySummary[] = [];
  const listEntries = doc?.toc?.listEntries;
  if (typeof listEntries === 'function') {
    const marked = await collectAll<MarkedEntry>(READ_FAILED, (query) => listEntries(query));
    for (const entry of marked.items) {
      const nodeId = entry.address?.nodeId;
      if (typeof nodeId !== 'string' || nodeId === '') continue;
      entries.push({
        nodeId,
        text: typeof entry.text === 'string' ? entry.text : '',
        level: typeof entry.level === 'number' ? entry.level : TOC_LEVEL_MIN,
      });
    }
  }

  return {
    count: listed.items.length,
    levels: typeof from === 'number' && typeof to === 'number' ? { from, to } : null,
    hyperlinks: first?.displayConfig?.hyperlinks === true,
    entries,
  };
}

/**
 * הטבלה היחידה שבמסמך, או כשל מנומק.
 *
 * שלושת המצבים נפרדים בכוונה: „אין”, „יש כמה” ו„הקריאה נכשלה” הם שלוש
 * הודעות שונות למשתמש, ואיחוד שלהם לאחת היה שולח אותו לחפש את הבעיה
 * הלא נכונה.
 */
async function soleToc(
  host: TocTarget,
  failedAction: string,
): Promise<{ ok: true; address: TocAddress; rows: TocRowSignature } | { ok: false; outcome: CommandOutcome }> {
  const list = docOf(host)?.toc?.list;
  if (typeof list !== 'function') return { ok: false, outcome: unsupported(failedAction) };

  const listed = await collectAll<TocEntry>(failedAction, (query) => list(query));
  if (!listed.ok) return { ok: false, outcome: listed.outcome };

  if (listed.items.length === 0) {
    return { ok: false, outcome: unavailable(failedAction, NO_TOC_DETAIL, 'no-toc') };
  }
  if (listed.items.length > 1) {
    return { ok: false, outcome: unavailable(failedAction, AMBIGUOUS_DETAIL, 'ambiguous-toc') };
  }

  const address = listed.items[0].address;
  if (!address?.nodeId) {
    // טבלה בלי כתובת אינה יעד חוקי, ושליחתה הייתה חריגת `INVALID_TARGET`.
    return { ok: false, outcome: unavailable(failedAction, NO_TOC_DETAIL, 'no-toc') };
  }
  return { ok: true, address, rows: rowSignatureOf(listed.items[0]) };
}

/* ------------------------------------------------------------------ */
/* עדכון                                                               */
/* ------------------------------------------------------------------ */

/**
 * „עדכן טבלה” — בונה מחדש כל תוכן עניינים שאפשר לפנות אליו במסמך.
 *
 * `mode: 'all'` ולא `'pageNumbers'`: זה ההבדל בין שתי האפשרויות שהדיאלוג של
 * Word מציע, ו„עדכן את הטבלה כולה” הוא היחיד שבטוח נכון אחרי עריכה. עדכון
 * מספרי העמודים בלבד אינו נמדד כאן כמשמעותי — ב-headless אין עימוד וכל
 * המספרים הם 1 — ופקד שלא נמדד אינו נשלח.
 *
 * עצירה בכשל הראשון: מסמך שחציו עודכן וחציו לא הוא מצב שאי אפשר לתאר
 * למשתמש, ועדיף לעצור ולומר מה נכשל. אותה החלטה כמו `rebuildAllFields`.
 *
 * כתובת חוזרת נשלחת **פעם אחת**, ובסוף מדווחת: שתי טבלאות עם אותו
 * `instruction` חולקות `nodeId` (נמדד — ראו הערת הפתיחה), ולולאה תמימה הייתה
 * בונה את הראשונה פעמיים ומדווחת „בוצע” על שנייה שנשארה מיושנת.
 */
export async function updateTableOfContents(host: TocTarget): Promise<CommandOutcome> {
  const doc = docOf(host);
  if (!doc) return unavailable(UPDATE_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const list = doc.toc?.list;
  const update = doc.toc?.update;
  if (typeof list !== 'function' || typeof update !== 'function') {
    return unsupported(UPDATE_FAILED);
  }

  const listed = await collectAll<TocEntry>(UPDATE_FAILED, (query) => list(query));
  if (!listed.ok) return listed.outcome;
  if (listed.items.length === 0) {
    return unavailable(UPDATE_FAILED, NO_TOC_DETAIL, 'no-toc');
  }

  const sent = new Set<string>();
  let unreachable = 0;

  for (const item of listed.items) {
    const address = item.address;
    if (!address?.nodeId) continue;
    if (sent.has(address.nodeId)) {
      unreachable++;
      continue;
    }
    sent.add(address.nodeId);

    const updated = await attempt(UPDATE_FAILED, () => update({ target: address, mode: 'all' }));
    if (!updated.ok) return updated.outcome;
    const failure = failureOf(UPDATE_FAILED, updated.value);
    if (failure) return failure;
  }

  if (unreachable > 0) return partialUpdate(unreachable);

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* הסרה                                                                */
/* ------------------------------------------------------------------ */

/** סגנונות שורות הטבלה של Word. זה מה שהמנוע עצמו מרנדר — נמדד. */
const TOC_STYLE = /^TOC[1-9]$/;

/**
 * סוגי הבלוקים ששורת טבלה יכולה להופיע בהם.
 *
 * `listItem` ולא רק `paragraph`: הסיווג הוא של המנוע ולא שלנו, ותוכן עניינים
 * ממוספר היה מקבל שורה אחת מסווגת אחרת — הרצף היה נקטע באמצע, החצי השני היה
 * נשאר על המסך, וההסרה הייתה מדווחת „בוצע”. `heading` **אינו** כאן בכוונה:
 * הכותרת שאחרי הטבלה היא בדיוק מה שאסור לבלוע.
 */
const ROW_NODE_TYPES = new Set(['paragraph', 'listItem']);

/**
 * מה שדרוש כדי לזהות את שורות הטבלה אחרי שהבלוק הראשון שלה כבר נמחק.
 *
 * `expectedRows` אינו תקרה למחיקה אלא **ציפייה**: `entryCount` נספר מהמקורות,
 * והשורה הראשונה היא הבלוק שהוסר זה עתה, ולכן מה שאמור להישאר הוא
 * `entryCount - 1` (נמדד: `entryCount: 3` → בלוק ועוד שתי פסקאות; `4` → בלוק
 * ועוד שלוש). מספר קטן מזה אינו מכשיל את המחיקה — הוא רק אוסר לומר „בוצע”.
 */
interface TocRowSignature {
  styleNames: readonly string[];
  expectedRows: number;
}

function rowSignatureOf(entry: TocEntry | undefined): TocRowSignature {
  const styleNames = (entry?.preserved?.customStyles ?? [])
    .map((style) => style?.styleName)
    .filter((name): name is string => typeof name === 'string' && name !== '');
  const count = entry?.entryCount;
  const expectedRows = typeof count === 'number' && count > 1 ? count - 1 : 0;
  return { styleNames, expectedRows };
}

/**
 * האם הבלוק הוא שורה של תוכן עניינים. `TOC1`…`TOC9` הם סגנונות Word, וסגנונות
 * ה-`\t` של הטבלה שהוסרה מצטרפים אליהם — ראו `TocEntry.preserved`.
 */
function isTocRow(block: BlockEntry | undefined, styleNames: readonly string[]): boolean {
  if (!ROW_NODE_TYPES.has(block?.nodeType ?? '')) return false;
  const styleId = block?.styleId ?? '';
  return TOC_STYLE.test(styleId) || styleNames.includes(styleId);
}

/**
 * מוצאת את מקומו של הבלוק ברשימת הבלוקים. `null` כשלא נמצא — מסמך שגדל
 * מעבר לבלם, או מנוע שאינו מדווח `nodeId`.
 */
async function ordinalOf(
  host: TocTarget,
  nodeId: string,
): Promise<number | null> {
  const list = docOf(host)?.blocks?.list;
  if (typeof list !== 'function') return null;

  let offset = 0;
  let guard = 0;
  for (;;) {
    const listed = await attempt(REMOVE_FAILED, () => list({ limit: PAGE_SIZE, offset }));
    if (!listed.ok) return null;

    const blocks = listed.value?.blocks ?? [];
    for (const block of blocks) {
      if (block.nodeId === nodeId) {
        return typeof block.ordinal === 'number' ? block.ordinal : offset + blocks.indexOf(block);
      }
    }
    if (blocks.length === 0) return null;

    offset += blocks.length;
    const total = listed.value?.total;
    if (!Number.isFinite(total) || offset >= (total as number)) return null;
    if (++guard > PAGE_GUARD) return null;
  }
}

/**
 * מוחקת את שורות הטבלה שנשארו יתומות אחרי `toc.remove`.
 *
 * הרצף נקרא **אחרי** ההסרה ומתחיל בדיוק במקום שהבלוק שהוסר תפס, ונעצר
 * בבלוק הראשון שאינו שורת תוכן עניינים. פסקה בסגנון `TOC*` שיושבת שם היא
 * חלק מהטבלה בהגדרה — היא נוצרה על ידה — ולכן אין כאן ניחוש על תוכן שהמשתמש
 * כתב.
 *
 * הרצף נשאב בעמודים ואינו נקרא בקריאה אחת: `PAGE_SIZE` הוא 200, ותוכן עניינים
 * של ספר — התרחיש הרגיל של אוצריא — ארוך ממנו בקלות. קריאה יחידה הייתה מוחקת
 * את 200 השורות הראשונות, משאירה את השאר על המסך, ומחזירה „בוצע”.
 *
 * על `deleteRange` מול `blocks.delete` — ראו הערת הפתיחה.
 */
async function sweepTocRows(
  host: TocTarget,
  from: number,
  signature: TocRowSignature,
): Promise<CommandOutcome> {
  const doc = docOf(host);
  const list = doc?.blocks?.list;
  const deleteRange = doc?.blocks?.deleteRange;
  if (typeof list !== 'function' || typeof deleteRange !== 'function') {
    return unsupported(REMOVE_FAILED);
  }

  const rows: string[] = [];
  let offset = from;
  let guard = 0;
  let truncated = false;

  // ממשיכים לעמוד הבא רק כשכל העמוד היה שורות טבלה: העמוד שנקטע באמצע הוא
  // סוף הרצף בהגדרה, ומה שאחריו כבר שייך למשתמש.
  for (;;) {
    const listed = await attempt(REMOVE_FAILED, () => list({ limit: PAGE_SIZE, offset }));
    if (!listed.ok) return listed.outcome;

    const page = listed.value?.blocks ?? [];
    let stopped = page.length === 0;
    for (const block of page) {
      if (!isTocRow(block, signature.styleNames) || typeof block.nodeId !== 'string') {
        stopped = true;
        break;
      }
      rows.push(block.nodeId);
    }
    if (stopped) break;

    offset += page.length;
    const total = listed.value?.total;
    if (!Number.isFinite(total) || offset >= (total as number)) break;
    if (++guard > PAGE_GUARD) {
      truncated = true;
      break;
    }
  }

  // זיהוי שלא תפס שורות שהיו צפויות אינו הצלחה שקטה: הטבלה הוסרה, השורות
  // על המסך, והמשתמש היה בטוח שמה שנשאר הוא טקסט שלו. אותה הודעה בדיוק כמו
  // במסלול שבו מקום הבלוק לא נמצא מלכתחילה.
  if (rows.length === 0) {
    return signature.expectedRows > 0 ? rowsRemain() : { ok: true };
  }

  const swept = await attempt(REMOVE_FAILED, () =>
    deleteRange({
      start: { kind: 'block', nodeType: 'paragraph', nodeId: rows[0] },
      end: { kind: 'block', nodeType: 'paragraph', nodeId: rows[rows.length - 1] },
    }),
  );
  if (!swept.ok) return swept.outcome;

  const failure = failureOf(REMOVE_FAILED, swept.value);
  if (failure) return failure;

  return truncated || rows.length < signature.expectedRows ? rowsRemain() : { ok: true };
}

/**
 * „הסר תוכן עניינים” — מוחקת את הטבלה כולה, כולל השורות שהמנוע משאיר.
 *
 * מקומו של הבלוק נקרא **לפני** ההסרה: אחריה הוא כבר אינו ברשימה, ואין דרך
 * לדעת היכן הרצף מתחיל.
 */
export async function removeTableOfContents(host: TocTarget): Promise<CommandOutcome> {
  const doc = docOf(host);
  if (!doc) return unavailable(REMOVE_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const remove = doc.toc?.remove;
  if (typeof remove !== 'function') return unsupported(REMOVE_FAILED);

  const sole = await soleToc(host, REMOVE_FAILED);
  if (!sole.ok) return sole.outcome;

  const at = await ordinalOf(host, sole.address.nodeId);

  const removed = await attempt(REMOVE_FAILED, () => remove({ target: sole.address }));
  if (!removed.ok) return removed.outcome;
  const failure = failureOf(REMOVE_FAILED, removed.value);
  if (failure) return failure;

  // מקום שלא נמצא אינו מכשיל את ההסרה עצמה — היא כבר קרתה. הכשל אומר מה
  // נשאר, כדי שהמשתמש לא יחשוב שהשורות שעל המסך הן טבלה חיה.
  if (at === null) return rowsRemain();

  return sweepTocRows(host, at, sole.rows);
}

/* ------------------------------------------------------------------ */
/* התאמה אישית                                                         */
/* ------------------------------------------------------------------ */

/** מה שהדיאלוג שולח. שני השדות נמדדו כמשפיעים והפיכים — ראו הערת הפתיחה. */
export interface TocSettings {
  levels: { from: number; to: number };
  hyperlinks: boolean;
}

/**
 * „תוכן עניינים מותאם אישית” — טווח רמות הכותרות והאם הערכים קישורים.
 *
 * שינוי ההגדרות **אינו** בונה את הטבלה מחדש מהמסמך; הוא כותב את המתגים
 * ומרנדר את הטבלה מהמצב הקיים (נמדד: הטקסט השתנה מיד). לכן הפקד ברצועה
 * מריץ אחריו „עדכן טבלה”, וזו החלטה של הממשק ולא של המודול.
 */
export async function configureTableOfContents(
  host: TocTarget,
  settings: TocSettings,
): Promise<CommandOutcome> {
  const levels = normalizeTocLevels(settings.levels.from, settings.levels.to);
  // נדחה לפני שנוגעים במנוע: נמדד שהוא מקבל `{from:9,to:1}` ומרוקן את הטבלה.
  if (levels === null) {
    return { ok: false, message: `${CONFIGURE_FAILED}: ${TOC_LEVELS_HINT}`, reason: 'invalid-levels' };
  }

  const doc = docOf(host);
  if (!doc) return unavailable(CONFIGURE_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const configure = doc.toc?.configure;
  if (typeof configure !== 'function') return unsupported(CONFIGURE_FAILED);

  const sole = await soleToc(host, CONFIGURE_FAILED);
  if (!sole.ok) return sole.outcome;

  const applied = await attempt(CONFIGURE_FAILED, () =>
    configure({
      target: sole.address,
      patch: { outlineLevels: levels, hyperlinks: settings.hyperlinks },
    }),
  );
  if (!applied.ok) return applied.outcome;

  return failureOf(CONFIGURE_FAILED, applied.value) ?? { ok: true };
}

/* ------------------------------------------------------------------ */
/* ערך ידני (שדה TC)                                                   */
/* ------------------------------------------------------------------ */

/**
 * „סמן ערך” — מכניסה שדה `TC` בסוף הפסקה שהסמן בה.
 *
 * `position: 'end'` ולא `'start'`: השדה בלתי נראה במסמך, ובסוף הפסקה הוא
 * אינו דוחף את תחילת הטקסט. זו גם ההתנהגות שברירת המחדל בחוזה מצהירה עליה.
 *
 * העוגן הוא `blockId` של הבחירה ותו לא: החוזה דורש `nodeType: 'paragraph'`,
 * ונמדד שגם `nodeId` של כותרת (`heading`) מתקבל תחתיו — כלומר אין צורך
 * לחסום סימון ערך על כותרת, וחסימה כזאת הייתה מונעת בדיוק את השימוש הנפוץ.
 */
export async function markTocEntry(
  host: TocTarget,
  rawText: string,
  level: number,
): Promise<CommandOutcome> {
  const text = normalizeTocEntryText(rawText);
  // המנוע **זורק** על מחרוזת ריקה („requires a non-empty text string”), ולכן
  // הבדיקה כאן אינה כפילות אלא מה שהופך את הכשל להודעה בעברית.
  if (text === null) {
    return { ok: false, message: `${MARK_FAILED}: יש להקליד את טקסט הערך`, reason: 'invalid-text' };
  }
  if (!isValidTocLevel(level)) {
    return { ok: false, message: `${MARK_FAILED}: ${TOC_LEVEL_HINT}`, reason: 'invalid-level' };
  }

  const doc = docOf(host);
  if (!doc) return unavailable(MARK_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const markEntry = doc.toc?.markEntry;
  if (typeof markEntry !== 'function') return unsupported(MARK_FAILED);

  const selection = await readDocSelection(host as SelectionTarget);
  if (!selection.blockId) return unavailable(MARK_FAILED, NO_ANCHOR_DETAIL, 'no-selection');

  const marked = await attempt(MARK_FAILED, () =>
    markEntry({
      target: {
        kind: 'inline-insert',
        anchor: { nodeType: 'paragraph', nodeId: selection.blockId as string },
        position: 'end',
      },
      text,
      level,
    }),
  );
  if (!marked.ok) return marked.outcome;

  return failureOf(MARK_FAILED, marked.value) ?? { ok: true };
}

/**
 * „בטל סימון ערך” — מוחקת שדה `TC` שסומן קודם.
 *
 * המזהה מגיע מ-`readTocState` ואינו נבנה כאן. החוזה מתאר אותו כ-hash, אבל
 * המדידה מראה מזהה **מיקומי**: `toc-entry:33A6A9C2:0`, כלומר
 * `<blockId>:<index>`, ושני `markEntry` עוקבים על אותה פסקה החזירו את אותו
 * מזהה בדיוק. המסקנה המעשית היא שהמזהה תקף רק לתצלום שממנו נקרא: ביטול של
 * הערך הראשון בפסקה הופך את השני לאינדקס 0, ורשימה ישנה הייתה מצביעה על
 * הערך הלא נכון. לכן ReferencesTab קורא `readTocState` מחדש אחרי כל פעולה,
 * ודיאלוג הערכים מנקה את הבחירה ומאמת אותה מול הרשימה שהתקבלה.
 */
export async function unmarkTocEntry(host: TocTarget, nodeId: string): Promise<CommandOutcome> {
  const doc = docOf(host);
  if (!doc) return unavailable(UNMARK_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const unmarkEntry = doc.toc?.unmarkEntry;
  if (typeof unmarkEntry !== 'function') return unsupported(UNMARK_FAILED);

  const unmarked = await attempt(UNMARK_FAILED, () =>
    unmarkEntry({ target: { kind: 'inline', nodeType: 'tableOfContentsEntry', nodeId } }),
  );
  if (!unmarked.ok) return unmarked.outcome;

  return failureOf(UNMARK_FAILED, unmarked.value) ?? { ok: true };
}
