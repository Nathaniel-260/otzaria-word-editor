/**
 * קבוצת „לוח”: העתק וגזור.
 *
 * ## למה מודול, ולא שלוש שורות בקומפוננטה
 *
 * מה שהיה ב-HomeTab: `doCut` ו-`doCopy` בגוף **ריק** עם הערה שהפעולה „נתמכת
 * דרך קיצור מקלדת”, ו-`doPaste` שקורא `navigator.clipboard.readText()` וזורק
 * את התוצאה. לפני זה היו שם `document.execCommand('cut'/'copy')`, שאסורים
 * (tests/unit/engine-boundaries: „אין עריכת מסמך דרך ה-DOM”), והתגובה לאיסור
 * הייתה למחוק את הגוף. שני הכיוונים נובעים מאותה טעות: הלוח נראה כמו יכולת
 * של הדפדפן.
 *
 * הוא אינו. תוכן מעוצב שעובר ל-Word הוא עניין של מודל המסמך, ולמנוע יש לזה
 * משטח ציבורי — `doc.clipboard` — שממיר בין `ClipboardPayload` (סדרת פריטים
 * לפי MIME) לבין fragment של המסמך. `navigator.clipboard` הוא רק הצינור אל
 * מערכת ההפעלה, ומה שנשלח בו הוא מה שהמנוע סידר.
 *
 * ## מה אינו ודאי בזמן ריצה
 *
 * 1. **`clipboard` הוא adapter אופציונלי** (`clipboard?:` ב-
 *    `DocumentApiAdapters`). כשהוא חסר, המנוע מסמן את כל פעולות ה-namespace
 *    כ-`NAMESPACE_UNAVAILABLE`, ולכן בדיקת היכולת (engine/doc-capabilities)
 *    מספיקה כדי להחליט אם הפקד פעיל — בדיוק כמו בהערות שוליים.
 * 2. **`navigator.clipboard` עשוי להיחסם.** התוסף רץ מ-`file://` בתוך
 *    WebView2, ושם הרשאת הלוח נדחית גם בתוך user-gesture. לכן יש כאן **לוח
 *    פנימי**: העתקה שהמערכת חסמה עדיין נשמרת, וההדבקה בתוך התוסף תמצא אותה.
 *    ההודעה למשתמש אומרת בדיוק מה קרה — „הצלחה” במצב הזה היא טקסט שנעלם.
 * 3. **הפאסדה בדפדפן א-סינכרונית**: `BrowserDocumentApi` עוטף כל מתודה
 *    ב-`MaybePromise`, ולכן כל קריאה כאן ב-`await` ובתוך `try`.
 *
 * ## למה הבחירה נקראת לפני הסדרוּר
 *
 * „גזור” = העתק + מחיקה, ולמחיקה (`doc.delete`) נדרש `target` מפורש — החוזה
 * מקבל `target` או `ref`, ולא כלום. לכן הבחירה נקראת **פעם אחת** מ-
 * `ui.selection`, ואותו target נשלח גם ל-`serializeSelection` וגם ל-`delete`:
 * שתי קריאות נפרדות ל„הבחירה הנוכחית” היו יכולות לתאר שני טווחים שונים,
 * כלומר להעתיק דבר אחד ולמחוק אחר.
 *
 * הטיפוסים של הלוח מוגדרים כאן ואינם מיובאים: הם יושבים תחת
 * `superdoc/dist/document-api/...`, ו-import מנתיב פנימי אסור. `SelectionTarget`
 * כן מיובא — מ-`superdoc/ui`, שהוא export ציבורי.
 */
import type { SuperDoc } from 'superdoc';
import type { SelectionTarget } from 'superdoc/ui';
import { reasonText, type CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';

/* ------------------------------------------------------------------ */
/* צורת המנוע כפי שהמודול צורך אותה                                    */
/* ------------------------------------------------------------------ */

/** פריט בודד בלוח, לפי MIME. `bytes` קיים בחוזה ואינו נוצר כאן — ראו `writeSystemClipboard`. */
export interface ClipboardPayloadItem {
  type: string;
  kind: 'string' | 'bytes';
  data: string | Uint8Array;
  name?: string;
}

/** מה שהמנוע מסדר, ומה שהוא מקבל בחזרה. `items` הוא החלק היחיד שיש לו משמעות כאן. */
export interface ClipboardPayload {
  source?: string;
  items: readonly ClipboardPayloadItem[];
}

export interface ClipboardSerializeResult {
  payload?: ClipboardPayload;
}

/** מה שנצרך מ-`activeEditor.doc`. כל שדה אופציונלי: גרסה אחרת עשויה לא לחשוף אותו. */
export interface ClipboardDocumentApi {
  clipboard?: {
    serializeSelection?: (input?: {
      target?: SelectionTarget;
      includeHtml?: boolean;
    }) => MaybePromise<ClipboardSerializeResult | undefined>;
  };
  delete?: (input: { target: SelectionTarget }) => MaybePromise<DocReceipt | undefined>;
}

/**
 * מצב הבחירה כפי ש-`ui.selection.getSnapshot()` מדווח. `status` הוא מה שמפריד
 * בין „אין בחירה” לבין „הקריאה טרם הסתיימה”, ולכן הוא נקרא ולא רק ה-target.
 */
export interface SelectionSnapshot {
  status?: string;
  empty?: boolean;
  selectionTarget?: SelectionTarget | null;
}

export interface SelectionSurface {
  getSnapshot?: () => SelectionSnapshot | undefined;
}

export interface ClipboardHost {
  activeEditor?: { doc?: ClipboardDocumentApi | null } | null;
  ui?: { selection?: SelectionSurface | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type ClipboardHostTarget = SuperDoc | ClipboardHost | null | undefined;

/* ------------------------------------------------------------------ */
/* הלוח הפנימי                                                        */
/* ------------------------------------------------------------------ */

let buffered: ClipboardPayload | null = null;

/**
 * רשת הביטחון כשלוח המערכת אינו זמין.
 *
 * לא מטמון ולא אופטימיזציה: ב-`file://` הרשאת הלוח נדחית, ובלי הלוח הזה
 * „גזור” היה מוחק טקסט שאי אפשר להחזיר בהדבקה. הוא חי כל עוד הדף חי, ואינו
 * מסונכרן עם לוח המערכת — בכוונה: לוח המערכת הוא המקור כשהוא זמין.
 *
 * מיוצא כאובייקט (ולא כמשתנה) כדי שבדיקה תוכל לנקות אותו בין מקרים בלי שם
 * שמכריז „for tests”.
 */
export const internalClipboard = {
  read(): ClipboardPayload | null {
    return buffered;
  },
  write(payload: ClipboardPayload): void {
    buffered = payload;
  },
  clear(): void {
    buffered = null;
  },
};

/* ------------------------------------------------------------------ */
/* עזרים                                                              */
/* ------------------------------------------------------------------ */

const COPY_FAILED = 'ההעתקה נכשלה';
const CUT_FAILED = 'הגזירה נכשלה';

/**
 * הנוסח כשהמנוע אינו חושף את הלוח. זהה למה שהיכולת מחזירה על
 * `NAMESPACE_UNAVAILABLE`, כדי שהמשתמש יראה את אותו הסבר בין אם הפקד מנוטרל
 * ובין אם הוא נלחץ לפני שהיכולות נקראו.
 */
const UNAVAILABLE = 'אינו זמין בגרסה זו';

/**
 * מה שנאמר למשתמש כשהתוכן נשמר בתוך התוסף אבל לא הגיע ללוח המערכת.
 *
 * מגיע אליו כ-`ok: false` ולא כהצלחה שקטה: הוא ביקש להעתיק, וההעתקה **לא**
 * הגיעה למקום שממנו מדביקים ל-Word. הקיצור שמוזכר כאן עובד — הוא מטופל בתוך
 * המסמך על ידי המנוע עצמו, לא על ידינו.
 */
const SYSTEM_BLOCKED_REASON = 'system-clipboard-blocked';

function docOf(host: ClipboardHostTarget): ClipboardDocumentApi | undefined {
  return (host as ClipboardHost | null | undefined)?.activeEditor?.doc ?? undefined;
}

/**
 * `superdoc.ui` הוא getter שיוצר את ה-controller בקריאה הראשונה. קריאתו
 * מתועדת כבטוחה גם לפני שהמסמך מוכן, אבל היא בכל זאת קריאה אל קוד זר —
 * וכשל שלה אינו סיבה להפיל לחיצה על כפתור.
 */
function selectionOf(host: ClipboardHostTarget): SelectionSurface | undefined {
  try {
    return (host as ClipboardHost | null | undefined)?.ui?.selection ?? undefined;
  } catch (error) {
    console.warn('[otzaria-word] קריאת משטח הבחירה מהמנוע נכשלה', error);
    return undefined;
  }
}

/** כשל עם הודעה בעברית מ-reason של ה-controller. */
function failed(failedAction: string, reason: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: ${reasonText(reason)}`, reason };
}

type SelectionRead = { ok: true; target: SelectionTarget } | { ok: false; reason: string };

/**
 * הטווח שהמשתמש סימן, כ-`SelectionTarget` — הצורה שפעולות הכתיבה של המנוע
 * מקבלות ישירות.
 *
 * `selectionTarget` ולא `target`: הראשון שומר את קצות הבחירה בדיוק, והשני הוא
 * מודל הכתובות של הערות ומיועד לצרכן אחר.
 */
function readSelection(surface: SelectionSurface | undefined): SelectionRead {
  const getSnapshot = surface?.getSnapshot;
  if (typeof getSnapshot !== 'function') return { ok: false, reason: 'host-capability-unavailable' };

  let slice: SelectionSnapshot | undefined;
  try {
    slice = getSnapshot();
  } catch {
    return { ok: false, reason: 'not-ready' };
  }

  const target = slice?.selectionTarget ?? null;
  if (!target || typeof target !== 'object') {
    // `status` שאינו `ready` אומר שקריאת הבחירה עוד לא הסתיימה — וזה מצב אחר
    // מ„המשתמש לא סימן כלום”, גם אם שניהם מגיעים בתור `selectionTarget: null`.
    return { ok: false, reason: slice?.status === 'ready' ? 'range-selection-required' : 'not-ready' };
  }
  if (slice?.empty === true) return { ok: false, reason: 'range-selection-required' };

  return { ok: true, target };
}

/** הפריט מה-payload לפי MIME, כשהוא מחרוזת. `null` = אין כזה. */
function textItem(payload: ClipboardPayload | undefined, type: string): string | null {
  const items = payload?.items;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (item?.type === type && item.kind === 'string' && typeof item.data === 'string') return item.data;
  }
  return null;
}

/**
 * ה-API של הדפדפן, או `undefined`.
 *
 * הצהרת ה-DOM ב-TypeScript מבטיחה ש-`navigator.clipboard` קיים; ב-jsdom
 * ובהקשרים לא-מאובטחים הוא פשוט אינו שם. ה-cast הוא ההודאה בפער הזה.
 */
function systemClipboard(): Clipboard | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
}

/**
 * כותבת ללוח המערכת. מחזירה האם זה הצליח — ולא זורקת.
 *
 * `write()` עם `text/html` **ו**-`text/plain` הוא מה שמאפשר להדביק ל-Word
 * אמיתי ולשמור עיצוב; `writeText` לבדו היה משטח את הכול לטקסט. `write`
 * ו-`ClipboardItem` אינם קיימים בכל סביבה, ולכן הם נבדקים ולא מונחים, ויש
 * נפילה מדורגת אל `writeText`.
 *
 * ה-MIME הפרטי של המנוע (`application/x-superdoc-v2-fragment`) אינו נשלח:
 * לוח המערכת מסנן טיפוסים שאינם ברשימה המותרת, וניסיון לכתוב אותו מפיל את
 * כל הקריאה. העתקה בתוך המסמך שומרת נאמנות דרך הלוח הפנימי.
 */
async function writeSystemClipboard(payload: ClipboardPayload): Promise<boolean> {
  const plain = textItem(payload, 'text/plain');
  const html = textItem(payload, 'text/html');
  if (plain === null && html === null) return false;

  const api = systemClipboard();
  if (!api) return false;

  if (html !== null && typeof api.write === 'function' && typeof ClipboardItem === 'function') {
    const parts: Record<string, Blob> = { 'text/html': new Blob([html], { type: 'text/html' }) };
    if (plain !== null) parts['text/plain'] = new Blob([plain], { type: 'text/plain' });
    try {
      await api.write([new ClipboardItem(parts)]);
      return true;
    } catch {
      // הרשאה שנדחתה, או טיפוס שהדפדפן סינן. `writeText` הוא המסלול המצומצם
      // שלעתים כן עובר, ולכן ממשיכים אליו במקום לדווח כשל מיד.
    }
  }

  if (plain === null || typeof api.writeText !== 'function') return false;
  try {
    await api.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* העתק וגזור                                                         */
/* ------------------------------------------------------------------ */

type Serialized = { ok: true; payload: ClipboardPayload } | { ok: false; outcome: CommandOutcome };

/**
 * מסדרת את הבחירה דרך המנוע ושומרת בלוח הפנימי.
 *
 * `target` אופציונלי: החוזה קובע ש-`serializeSelection` מסדר „the current or
 * supplied model selection”, ולכן כשאין מסלול לקרוא את הבחירה — „העתק” עדיין
 * עובד על החי. „גזור” אינו יכול, כי הוא צריך את אותו target למחיקה.
 */
async function serializeSelection(
  host: ClipboardHostTarget,
  failedAction: string,
  target: SelectionTarget | undefined,
): Promise<Serialized> {
  const serialize = docOf(host)?.clipboard?.serializeSelection;
  if (typeof serialize !== 'function') {
    return {
      ok: false,
      outcome: {
        ok: false,
        message: `${failedAction}: ${UNAVAILABLE}`,
        reason: 'command-unsupported',
      },
    };
  }

  let result: ClipboardSerializeResult | undefined;
  try {
    result = await serialize(target ? { target, includeHtml: true } : { includeHtml: true });
  } catch (error) {
    return { ok: false, outcome: { ok: false, message: thrownText(failedAction, error), reason: 'threw' } };
  }

  const payload = result?.payload;
  // אין items = אין מה להעתיק. זה המצב של סמן בלי טווח, והוא בקשה שאין לה
  // תוצאה — לא תקלה במנוע.
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, outcome: failed(failedAction, 'range-selection-required') };
  }

  internalClipboard.write(payload);
  return { ok: true, payload };
}

/** ההודעה כשהתוכן בלוח הפנימי בלבד. `gesture` הוא הקיצור שכן מגיע לתוכנה אחרת. */
function systemBlocked(what: string, gesture: string): CommandOutcome {
  return {
    ok: false,
    message: `${what} בתוך התוסף בלבד — לוח המערכת חסם את הפעולה. הדבקה כאן תעבוד; להעברה ל-Word יש להשתמש ב-${gesture}.`,
    reason: SYSTEM_BLOCKED_REASON,
  };
}

/**
 * „העתק”. מסדרת את הבחירה, שומרת בלוח הפנימי, וכותבת ללוח המערכת.
 *
 * לעולם אינה זורקת: כל הקריאות למנוע ולדפדפן עטופות, וחריגה מפקד ב-Ribbon
 * מפילה את רינדור הרצועה כולה.
 */
export async function copySelection(host: ClipboardHostTarget): Promise<CommandOutcome> {
  const selection = readSelection(selectionOf(host));
  // בחירה ריקה נעצרת כאן ולא במנוע, כדי שההודעה תהיה „יש לסמן טקסט תחילה”
  // ולא כשל סדרוּר. חוסר **מסלול** לקרוא את הבחירה אינו עוצר: המנוע יסדר את
  // הבחירה החיה בעצמו.
  if (!selection.ok && selection.reason === 'range-selection-required') {
    return failed(COPY_FAILED, selection.reason);
  }

  const serialized = await serializeSelection(
    host,
    COPY_FAILED,
    selection.ok ? selection.target : undefined,
  );
  if (!serialized.ok) return serialized.outcome;

  if (!(await writeSystemClipboard(serialized.payload))) {
    return systemBlocked('הטקסט הועתק', 'Ctrl+C');
  }
  return { ok: true };
}

/**
 * „גזור” = העתק ואחר כך מחק.
 *
 * הסדר אינו שרירותי: המחיקה רצה **רק** אחרי שהתוכן נשמר בלוח הפנימי, כדי
 * שכשל בסדרוּר לא ימחוק טקסט שאין לו עותק. לוח מערכת שנחסם כן מאפשר להמשיך
 * למחיקה — התוכן קיים בתוך התוסף, וההודעה אומרת את זה במפורש.
 */
export async function cutSelection(host: ClipboardHostTarget): Promise<CommandOutcome> {
  const doc = docOf(host);
  const remove = doc?.delete;
  if (typeof remove !== 'function') {
    return { ok: false, message: `${CUT_FAILED}: ${UNAVAILABLE}`, reason: 'command-unsupported' };
  }

  // ל„גזור” הבחירה היא חובה, ולא נוחות: `doc.delete` מקבל `target` או `ref`,
  // ובלי אחד מהם אין מה למחוק.
  const selection = readSelection(selectionOf(host));
  if (!selection.ok) return failed(CUT_FAILED, selection.reason);

  const serialized = await serializeSelection(host, CUT_FAILED, selection.target);
  if (!serialized.ok) return serialized.outcome;

  const onSystemClipboard = await writeSystemClipboard(serialized.payload);

  let receipt: DocReceipt | undefined;
  try {
    receipt = await remove({ target: selection.target });
  } catch (error) {
    return { ok: false, message: thrownText(CUT_FAILED, error), reason: 'threw' };
  }

  if (receipt?.success === false) {
    return {
      ok: false,
      message: receiptFailureText(CUT_FAILED, receipt),
      reason: receipt.failure?.code,
    };
  }

  if (!onSystemClipboard) return systemBlocked('הטקסט נגזר', 'Ctrl+X');
  return { ok: true };
}
