/**
 * רשימות — המספור העברי, התחלה מחדש, המשך מספור קודם והמרה לטקסט
 * (גל 14א), דרך `doc.lists.*`.
 *
 * ## ממצא הדגל שנמדד: `hebrew1` עובד
 *
 * `ListsSetLevelNumberStyleInput.numberStyle` הוא **string חופשי** ולא union
 * (שונה מ-`sections.setPageNumbering.format`, שם ה-union נאכף בזמן ריצה).
 * נמדד: `numberStyle:'hebrew1'` על רשימה קיימת כתב
 * `<w:numFmt w:val="hebrew1"/>` ב-numbering.xml — מספור א׳ ב׳ ג׳ אמיתי.
 * ולכן המודול מציע אותו, וחוסם ערכים שאינם ברשימת `numFmt` של ECMA-376.
 *
 * ## שאר מה שנמדד
 *
 * - `restartAt({startAt})` עובד; `continuePrevious` מחזיר קבלת כשל
 *   (`INVALID_CONTEXT / NO_PREVIOUS_LIST`) ולא זורק; `canContinuePrevious`
 *   הוא בוליאן ולכן TOCTOU — קוראים לפעולה ומדווחים את הקבלה, בלי להסתמך
 *   על הבוליאן.
 * - `convertToText({includeMarker:true})` **מעתיק את הסמן לתוך הטקסט**
 *   ('a. ') והפריט הופך לפסקה — בלתי-הפיך למעשה, ולכן הפקד דורש אישור
 *   דו-לחיצה בממשק.
 * - כתובת פריט היא `{kind:'block', nodeType:'listItem', nodeId}`; פסקה
 *   שאינה פריט מחזירה `TARGET_NOT_FOUND`. היעד נפתר מהבחירה + `lists.getState`
 *   (ראו `resolveListItem`: `blocks.list` לבדו מפספס רשימות בטבלה וכותרות
 *   ממוספרות).
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt } from './document-api';

const UNAVAILABLE_TEXT = 'אינו זמין בגרסה זו';

/**
 * ערכי `numFmt` של ECMA-376 בהם נעשה שימוש הגיוני במסמך עברי/כללי.
 *
 * `hebrew1` היה כאן מלכתחילה — החוזה מקבל `numberStyle` כמחרוזת חופשית,
 * ונמדד ש-`w:numFmt="hebrew1"` אכן נכתב ל-numbering.xml. מה שלא נמדד אז הוא
 * שה**סמן צויר ריק**: על superdoc@2.8.0 המשתמש קיבל „. ” בלי אות, כלומר
 * מסמך נכון ומסך ריק. במעבר ל-2.10.0 הסמנים מצוירים, ולכן `hebrew2` מצטרף.
 */
export const NUMBER_STYLES: readonly string[] = [
  'decimal',
  'upperLetter',
  'lowerLetter',
  'upperRoman',
  'lowerRoman',
  'hebrew1',
  'hebrew2',
  'bullet',
];

/**
 * תוויות לתצוגה.
 *
 * התווית של `hebrew1` הייתה „א׳, ב׳, ג׳ — עברי” והיא תוקנה: המנוע אינו מצייר
 * גרש. עשרים פריטים ברצף נמדדו על ה-dist הבנוי, וזה מה שיצא:
 *
 *     hebrew1 → א ב ג … י יא יב יג יד טו טז יז יח יט כ   (גימטריה)
 *     hebrew2 → א ב ג … י כ  ל  מ  נ  ס  ע  פ  צ  ק  ר   (סדר האלף-בית)
 *
 * שניהם זהים בעשרת הראשונים, ולכן התוויות מראות היכן הם נפרדים.
 */
export const NUMBER_STYLE_LABELS: Record<string, string> = {
  decimal: '1, 2, 3',
  upperLetter: 'A, B, C',
  lowerLetter: 'a, b, c',
  upperRoman: 'I, II, III',
  lowerRoman: 'i, ii, iii',
  hebrew1: 'א, ב, ג … יא, יב (גימטריה)',
  hebrew2: 'א, ב, ג … כ, ל (אלף־בית)',
  bullet: 'תבליט',
};

interface ListsApiShape {
  selection?: {
    current?: () => MaybePromise<SelectionInfoLike | undefined>;
  };
  blocks?: {
    list?: () => MaybePromise<{
      blocks?: Array<{ nodeId?: string; nodeType?: string; paragraphNumbering?: unknown }>;
    }>;
  };
  lists?: {
    getState?: (input: {
      target: { kind: 'block'; nodeType: 'paragraph' | 'listItem'; nodeId: string };
    }) => MaybePromise<{ success?: boolean; isListItem?: boolean } | undefined>;
    setLevelNumberStyle?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
    restartAt?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
    continuePrevious?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
    convertToText?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
  };
}

export interface ListsHost {
  activeEditor?: { doc?: ListsApiShape | null } | null;
}

export type ListsTarget = SuperDoc | ListsHost | null | undefined;

interface SelectionInfoLike {
  empty?: boolean;
  target?: {
    segments?: ReadonlyArray<{ blockId?: string }>;
  } | null;
}

type MaybePromise<T> = T | Promise<T>;

function docOf(host: ListsTarget): ListsApiShape | null {
  return (host as ListsHost | null | undefined)?.activeEditor?.doc ?? null;
}

/**
 * פותרת את פריט הרשימה שבו הסמן. `blockId` מהבחירה (הבחירה אינה מדווחת
 * listItem), וההכרעה „פריט רשימה או לא” היא של `lists.getState` — סמכות
 * הרשימות של המנוע — ולא של `blocks.list`.
 *
 * למה לא `blocks.list` (issue #14 ג׳, נמדד על superdoc 2.11.0): הוא מונה
 * בלוקים **עליונים** בלבד, ולכן פריט רשימה בתוך תא טבלה אינו מופיע בו כלל;
 * וכותרת ממוספרת של Word (Heading1 + numPr) מדווחת בו כ-`heading` ולא
 * `listItem`. בשני המקרים `getState` אומר `isListItem:true`, ו-
 * `setLevelNumberStyle` עם כתובת `listItem` מצליח — כלומר הבלוק כן פריט
 * רשימה, ורק הזיהוי כשל ב„יש למקם את הסמן בתוך רשימה”.
 *
 * `blocks.list` נשאר כנפילה לגרסת מנוע בלי `getState`, בקריאה אחת: בלי
 * ארגומנטים הוא מחזיר את כל הסיפור (אין עמוד של 50, נמדד), ו-
 * `paragraphNumbering` על הבלוק מכסה שם את הכותרת הממוספרת.
 *
 * פסקה שאינה ברשימה היא `null` — ולא כשל, כדי שהפקד יוכל להסביר.
 */
async function resolveListItem(host: ListsTarget): Promise<ListItemAddress | null> {
  const doc = docOf(host);
  if (!doc) return null;

  let blockId: string | null = null;
  try {
    const info = await doc.selection?.current?.();
    blockId =
      info?.target?.segments?.find((s) => typeof s?.blockId === 'string')?.blockId ?? null;
  } catch {
    return null;
  }
  if (!blockId) return null;
  const address: ListItemAddress = { kind: 'block', nodeType: 'listItem', nodeId: blockId };

  const getState = doc.lists?.getState;
  if (typeof getState === 'function') {
    try {
      // `nodeType:'paragraph'` תקף לכל בלוק פסקתי, כולל כותרת; `'heading'` נזרק.
      const state = await getState({ target: { kind: 'block', nodeType: 'paragraph', nodeId: blockId } });
      if (state?.success === true) return state.isListItem ? address : null;
    } catch {
      // נופלים ל-blocks.list.
    }
  }

  const list = doc.blocks?.list;
  if (typeof list !== 'function') return null;
  try {
    const listed = await list();
    const block = (listed?.blocks ?? []).find((b) => b.nodeId === blockId);
    if (!block) return null;
    return block.nodeType === 'listItem' || block.paragraphNumbering ? address : null;
  } catch {
    return null;
  }
}

interface ListItemAddress {
  kind: 'block';
  nodeType: 'listItem';
  nodeId: string;
}

function unsupported(failedAction: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: ${UNAVAILABLE_TEXT}`, reason: 'command-unsupported' };
}

/** עוטף קריאה אחת: לעולם לא זורק, NO_OP הצלחה. */
async function call(failedAction: string, run: () => MaybePromise<DocReceipt>): Promise<CommandOutcome> {
  let receipt: DocReceipt;
  try {
    receipt = await run();
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }
  if (receipt?.success === false && receipt.failure?.code !== 'NO_OP') {
    return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
  }
  return { ok: true };
}

/** „יש למקם את הסמן ברשימה" — תשובה משותפת לכל הפעולות. */
function notInList(failedAction: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: יש למקם את הסמן בתוך רשימה`, reason: 'selection-required' };
}

export interface SetNumberStyleOptions {
  /**
   * איך להפוך את הפסקה שבסמן לרשימה כשהיא עדיין אינה כזאת — הפקודה של
   * הכפתור („מספור”/„תבליטים”), שיושבת ב-registry של המנוע ולא ב-Document
   * API, ולכן מוזרקת מהרצועה ולא נקראת מכאן.
   *
   * בלעדיה הבחירה בסגנון מסרבת על פסקה רגילה. זה מה שהמשתמש קיבל (issue
   * #14 ג׳, שוחזר ב-scripts/qa/list-caret-qa.mjs): פתח את תפריט המספור על
   * פסקה, בחר „א, ב, ג”, וקרא „יש למקם את הסמן בתוך רשימה” — כשכל מה שביקש
   * הוא למספר את הפסקה, כמו שגלריית המספור של Word עושה.
   */
  createList?: () => Promise<CommandOutcome>;
}

/**
 * מגדירה את סגנון המספור של רמה 0 ברשימה שבה הסמן. `hebrew1` הוא
 * המספור העברי (א׳ ב׳ ג׳) — נמדד שנכתב ל-numbering.xml.
 *
 * על פסקה שאינה רשימה: אם נמסרה `createList`, קודם יוצרים את הרשימה ואז
 * מחילים את הסגנון — בחירת סגנון היא בקשה למספר, לא שאלה על רשימה קיימת.
 * בלי `createList` (או כשהיצירה נכשלה) — הסירוב המפורש, כמו קודם.
 */
export async function setListNumberStyle(
  host: ListsTarget,
  numberStyle: string,
  options: SetNumberStyleOptions = {},
): Promise<CommandOutcome> {
  const failedAction = 'שינוי סגנון המספור נכשל';

  if (!NUMBER_STYLES.includes(numberStyle)) {
    // string חופשי בחוזה — המנוע כנראה בולע כל ערך; רק numFmt תקני יוצא.
    return { ok: false, message: `${failedAction}: סגנון המספור אינו חוקי`, reason: 'invalid-number-style' };
  }

  let item = await resolveListItem(host);
  if (!item && options.createList) {
    const created = await options.createList();
    if (!created.ok) return created;
    // נפתר מחדש ולא מונח: הפקודה החליפה את הפסקה בפריט רשימה עם `nodeId`
    // חדש, וכתובת ישנה הייתה TARGET_NOT_FOUND.
    item = await resolveListItem(host);
  }
  if (!item) return notInList(failedAction);

  const setLevelNumberStyle = docOf(host)?.lists?.setLevelNumberStyle;
  if (typeof setLevelNumberStyle !== 'function') return unsupported(failedAction);

  return call(failedAction, () => setLevelNumberStyle({ target: item, level: 0, numberStyle }));
}

/** „התחל מחדש": מגדיר את ערך ההתחלה של הרשימה שבה הסמן. */
export async function restartListAt(host: ListsTarget, startAt: number): Promise<CommandOutcome> {
  const failedAction = 'התחלה מחדש של הרשימה נכשלה';

  if (typeof startAt !== 'number' || !Number.isInteger(startAt) || startAt < 0) {
    return { ok: false, message: `${failedAction}: הערך חייב להיות מספר שלם לא-שלילי`, reason: 'invalid-start' };
  }

  const item = await resolveListItem(host);
  if (!item) return notInList(failedAction);

  const restartAt = docOf(host)?.lists?.restartAt;
  if (typeof restartAt !== 'function') return unsupported(failedAction);

  return call(failedAction, () => restartAt({ target: item, startAt }));
}

/**
 * „המשך מספור קודם". כשאין רשימה קודמת המנוע מחזיר קבלת כשל
 * (`NO_PREVIOUS_LIST`) וההודעה מתורגמת — הבוליאן canContinue אינו בשימוש
 * (TOCTOU).
 */
export async function continuePreviousList(host: ListsTarget): Promise<CommandOutcome> {
  const failedAction = 'המשך המספור מהרשימה הקודמת נכשל';

  const item = await resolveListItem(host);
  if (!item) return notInList(failedAction);

  const continuePrevious = docOf(host)?.lists?.continuePrevious;
  if (typeof continuePrevious !== 'function') return unsupported(failedAction);

  return call(failedAction, () => continuePrevious({ target: item }));
}

/**
 * „המר לטקסט" — בלתי-הפיך למעשה: סמן הרשימה מועתק לתוך הטקסט ('a. ')
 * והפריט הופך לפסקה (נמדד). הפקד חייב אישור דו-לחיצה לפני הקריאה.
 */
export async function convertListToText(host: ListsTarget): Promise<CommandOutcome> {
  const failedAction = 'המרת הרשימה לטקסט נכשלה';

  const item = await resolveListItem(host);
  if (!item) return notInList(failedAction);

  const convertToText = docOf(host)?.lists?.convertToText;
  if (typeof convertToText !== 'function') return unsupported(failedAction);

  return call(failedAction, () => convertToText({ target: item, includeMarker: true }));
}


