/**
 * קבוצת „לוח” — העתק, גזור והדבק — ו„בחר הכל”.
 *
 * ## למה מודול, ולא שלוש שורות בקומפוננטה
 *
 * מה שהיה ב-HomeTab: `doCut` ו-`doCopy` בגוף **ריק** עם הערה שהפעולה „נתמכת
 * דרך קיצור מקלדת”, ו-`doPaste` שקורא `navigator.clipboard.readText()` ו-
 * **זורק את התוצאה** (וב-`file://` גם מייצר unhandled rejection, כי הוא
 * `void`-ed). לפני זה היו שם `document.execCommand('cut'/'copy'/'paste')`,
 * שאסורים (tests/unit/engine-boundaries: „אין עריכת מסמך דרך ה-DOM”), והתגובה
 * לאיסור הייתה למחוק את הגוף. שני הכיוונים נובעים מאותה טעות: הלוח נראה כמו
 * יכולת של הדפדפן.
 *
 * הוא אינו. תוכן מעוצב שעובר ל-Word הוא עניין של מודל המסמך, ולמנוע יש לזה
 * משטח ציבורי — `doc.clipboard` — שממיר בין `ClipboardPayload` (סדרת פריטים
 * לפי MIME) לבין fragment של המסמך. `navigator.clipboard` הוא רק הצינור אל
 * מערכת ההפעלה, ומה שנשלח בו הוא מה שהמנוע סידר.
 *
 * `doSelectAll` היה אותה טעות בצורתה החריפה: `selectAllChildren(document.body)`
 * סימן את **הרצועה, שורת המצב וכל הממשק** — ולא את המסמך. בחירה במסמך היא
 * `SelectionTarget` במודל של המנוע, ולא טווח DOM.
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

/**
 * התכנית ש-`parse` מחזיר ו-`insert` מקבל. שני השדות אינם עוברים כאן עיבוד —
 * הם מוצהרים מפני שהוולידטור של המנוע דורש `fragment.blocks` כמערך ו-
 * `diagnostics` כמערך, וכפיל שאינו מכריז עליהם היה מאשר תכנית פסולה.
 */
export interface ClipboardPlan {
  fragment: { blocks: readonly unknown[] };
  diagnostics: readonly unknown[];
  summary?: { sourceKind?: string; plainFallback?: boolean };
}

/** צורת הכשל של משפחת `clipboard.*`. `details.unsupportedReason` הוא ההסבר האמיתי. */
export interface ClipboardFailure {
  code?: string;
  message?: string;
  details?: { unsupportedReason?: string };
}

export type ClipboardParseResult =
  | { success: true; plan: ClipboardPlan }
  | { success: false; failure?: ClipboardFailure };

/** הקבלה של `insert`, בתוספת מה שהיא מספרת על מה שהודבק בפועל. */
export interface ClipboardInsertReceipt extends DocReceipt {
  failure?: ClipboardFailure;
  plan?: { sourceKind?: string; plainFallback?: boolean };
  diagnostics?: readonly unknown[];
}

/** מה שנצרך מ-`activeEditor.doc`. כל שדה אופציונלי: גרסה אחרת עשויה לא לחשוף אותו. */
export interface ClipboardDocumentApi {
  clipboard?: {
    serializeSelection?: (input?: {
      target?: SelectionTarget;
      includeHtml?: boolean;
    }) => MaybePromise<ClipboardSerializeResult | undefined>;
    parse?: (payload: ClipboardPayload) => MaybePromise<ClipboardParseResult | undefined>;
    insert?: (input: {
      payload?: ClipboardPayload;
      plan?: ClipboardPlan;
    }) => MaybePromise<ClipboardInsertReceipt | undefined>;
  };
  delete?: (input: { target: SelectionTarget }) => MaybePromise<DocReceipt | undefined>;
  ranges?: {
    resolve?: (input: {
      start: DocumentEdgeAnchor;
      end: DocumentEdgeAnchor;
    }) => MaybePromise<{ target?: SelectionTarget | null } | undefined>;
  };
}

/** קצה המסמך, כעוגן ל-`ranges.resolve`. אחת משלוש צורות העוגן שהחוזה מגדיר. */
export interface DocumentEdgeAnchor {
  kind: 'document';
  edge: 'start' | 'end';
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
  /** מחילה בחירה על העורך החי. נכשלת סגור עם `reason`, ואינה זורקת. */
  apply?: (target: SelectionTarget) => MaybePromise<{ ok?: boolean; reason?: string } | undefined>;
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
const PASTE_FAILED = 'ההדבקה נכשלה';

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

/* ------------------------------------------------------------------ */
/* הדבק                                                               */
/* ------------------------------------------------------------------ */

/**
 * ה-MIME-ים שמסלול הכפתור מעביר למנוע.
 *
 * `text/html` לפני `text/plain` — הראשון הוא זה שנושא עיצוב, וה-`parse` של
 * המנוע בוחר את הייצוג הנאמן ביותר מבין הפריטים. התמונות נקראות כ-`bytes`,
 * כי זה מה שהוולידטור דורש (`data instanceof Uint8Array`), והמנוע יודע להפוך
 * אותן ל-assets בתוך ה-fragment.
 *
 * מה שמחוץ לרשימה — RTF, קבצים, `image/gif` — אינו מוברח בכל זאת: `parse`
 * היה דוחה אותו, וההדבקה המקורית של המנוע (Ctrl+V) כן מטפלת בו.
 */
const READ_AS_TEXT = ['text/html', 'text/plain'] as const;
const READ_AS_BYTES = ['image/png', 'image/jpeg'] as const;

/**
 * קודי הכשל של משפחת `clipboard.*` שאינם בטבלה המשותפת שב-document-api.ts.
 *
 * שכבה דקה ולא טבלה שנייה: כל השאר נופל ל-`receiptFailureText`, כדי שלא
 * ייווצרו שני נוסחים עבריים לאותו קוד. (הטבלה שם פרטית ואינה מיוצאת.)
 */
const CLIPBOARD_FAILURE_TEXT: Record<string, string> = {
  INVALID_PAYLOAD: 'תוכן הלוח אינו במבנה שהמנוע מקבל',
  EMPTY_FRAGMENT: 'אין תוכן להדבקה',
  INVALID_FRAGMENT: 'תוכן הלוח פגום ואינו ניתן להדבקה',
};

/**
 * למה המנוע לא ידע להדביק. אלה קודי `SDPasteUnsupportedReason`, והם ההסבר
 * **המדויק** — `failure.code` במקרים האלה הוא רק `CAPABILITY_UNSUPPORTED`.
 */
const PASTE_UNSUPPORTED_TEXT: Record<string, string> = {
  'paste-empty': 'אין תוכן להדבקה',
  'paste-payload-too-large': 'התוכן שבלוח גדול מדי להדבקה',
  'paste-source-unsupported': 'המקור שהתוכן הועתק ממנו אינו נתמך',
  'paste-no-faithful-representation': 'אין דרך להדביק את התוכן הזה בלי לשנות אותו',
  'paste-structure-unsupported': 'מבנה התוכן שבלוח אינו נתמך בהדבקה',
  'paste-media-unsupported-type': 'סוג התמונה שבלוח אינו נתמך',
  'paste-media-too-large': 'התמונה שבלוח גדולה מדי',
  'paste-media-bad-magic': 'התמונה שבלוח פגומה',
  'paste-security-rejected': 'התוכן שבלוח נדחה מטעמי אבטחה',
  'paste-target-unsupported': 'לא ניתן להדביק במקום הזה במסמך',
  'paste-tracked-structural-unsupported': 'הדבקה כזאת אינה נתמכת במצב מעקב אחר שינויים',
  'paste-cross-story-unsupported': 'לא ניתן להדביק בין חלקים שונים של המסמך',
  'paste-fragment-version-unsupported': 'התוכן הועתק מגרסה אחרת של המנוע',
  'paste-legacy-slice-unsupported': 'התוכן הועתק מגרסה ישנה של המנוע',
  'paste-depth-exceeded': 'התוכן שבלוח מקונן עמוק מדי',
};

type SystemRead =
  | { kind: 'payload'; payload: ClipboardPayload }
  /** הלוח נקרא, ואין בו דבר שאפשר להעביר למנוע. */
  | { kind: 'empty' }
  /** אין API, או שההרשאה נדחתה. זה המצב הנפוץ ב-`file://`. */
  | { kind: 'blocked' };

/**
 * קוראת את לוח המערכת ובונה ממנו `ClipboardPayload`.
 *
 * ההבחנה בין `empty` ל-`blocked` היא מה שמכריע אם ליפול ללוח הפנימי: לוח
 * מערכת שנקרא **והיה ריק** הוא תשובה, והדבקה של משהו שהועתק לפני חצי שעה
 * בתוך התוסף הייתה שגויה. הרשאה שנדחתה היא היעדר מידע, ושם הלוח הפנימי הוא
 * הידע הטוב ביותר שיש.
 */
async function readSystemClipboard(): Promise<SystemRead> {
  const api = systemClipboard();
  if (!api) return { kind: 'blocked' };

  let readable = false;

  if (typeof api.read === 'function') {
    try {
      const items = (await api.read()) ?? [];
      readable = true;
      const collected: ClipboardPayloadItem[] = [];
      for (const item of items) {
        const types: readonly string[] = item?.types ?? [];
        for (const type of READ_AS_TEXT) {
          if (!types.includes(type)) continue;
          const data = await (await item.getType(type)).text();
          if (data) collected.push({ type, kind: 'string', data });
        }
        for (const type of READ_AS_BYTES) {
          if (!types.includes(type)) continue;
          const data = new Uint8Array(await (await item.getType(type)).arrayBuffer());
          if (data.length > 0) collected.push({ type, kind: 'bytes', data });
        }
      }
      if (collected.length > 0) {
        return { kind: 'payload', payload: { source: 'browser', items: collected } };
      }
    } catch {
      // `NotAllowedError` הוא המסלול הנפוץ ב-`file://`. `readText` מבקש הרשאה
      // מצומצמת יותר ולעתים כן עובר, ולכן ממשיכים אליו.
    }
  }

  if (typeof api.readText === 'function') {
    try {
      const text = await api.readText();
      readable = true;
      if (text) {
        return {
          kind: 'payload',
          payload: { source: 'browser', items: [{ type: 'text/plain', kind: 'string', data: text }] },
        };
      }
    } catch {
      // אותו דבר; כאן נגמרו המסלולים.
    }
  }

  return readable ? { kind: 'empty' } : { kind: 'blocked' };
}

/** ההודעה כשאין הרשאה לקרוא את הלוח. Ctrl+V כן עובד — המנוע מטפל בו במסמך. */
function readBlocked(): CommandOutcome {
  return {
    ok: false,
    message: 'ההדבקה נכשלה: אין הרשאה לקרוא את לוח המערכת. יש להדביק עם Ctrl+V — המנוע מטפל בו בתוך המסמך.',
    reason: SYSTEM_BLOCKED_REASON,
  };
}

/** ההסבר בעברית לכשל של `parse` או `insert`. */
function pasteFailureText(failure: ClipboardFailure | undefined): string {
  const unsupported = failure?.details?.unsupportedReason;
  const explained = unsupported ? PASTE_UNSUPPORTED_TEXT[unsupported] : undefined;
  if (explained) return `${PASTE_FAILED}: ${explained}`;

  const known = failure?.code ? CLIPBOARD_FAILURE_TEXT[failure.code] : undefined;
  if (known) return `${PASTE_FAILED}: ${known}`;

  return receiptFailureText(PASTE_FAILED, { success: false, failure });
}

/**
 * „הדבק”.
 *
 * המסלול הוא זה שהחוזה מתאר: `ClipboardPayload` → `parse` → `insert`. ה-`parse`
 * נפרד מה-`insert` בכוונה — הוא **אינו** משנה את המסמך, ולכן תוכן שאי אפשר
 * להדביק נעצר לפני שנגענו במסמך, והמשתמש מקבל את הסיבה המדויקת
 * (`unsupportedReason`) ולא רק „הפעולה נכשלה”.
 *
 * `target` אינו נשלח: הוולידטור דורש בדיוק אחד מ-payload/plan/fragment ואינו
 * דורש יעד, והמנוע פותר את מקום ההדבקה מהבחירה החיה בעצמו — בדיוק כמו
 * ב-Ctrl+V. חישוב יעד כאן היה משחזר בקוד שלנו את מה שהוא כבר עושה.
 *
 * ההדבקה המקורית של המנוע אינה נוגעת בזה: המודול הזה אינו רושם מאזינים
 * ואינו חוטף אירועי `paste`.
 */
export async function pasteFromClipboard(host: ClipboardHostTarget): Promise<CommandOutcome> {
  const clipboard = docOf(host)?.clipboard;
  const insert = clipboard?.insert;
  if (typeof insert !== 'function') {
    return { ok: false, message: `${PASTE_FAILED}: ${UNAVAILABLE}`, reason: 'command-unsupported' };
  }

  const read = await readSystemClipboard();
  const payload = read.kind === 'payload' ? read.payload : read.kind === 'blocked' ? internalClipboard.read() : null;

  if (!payload) {
    if (read.kind === 'blocked') return readBlocked();
    return {
      ok: false,
      message: 'ההדבקה נכשלה: לוח המערכת ריק, או שהתוכן שבו אינו נתמך כאן. Ctrl+V מדביק אותו דרך המנוע.',
      reason: 'paste-source-unsupported',
    };
  }

  let input: { payload?: ClipboardPayload; plan?: ClipboardPlan };
  const parse = clipboard?.parse;
  if (typeof parse === 'function') {
    let parsed: ClipboardParseResult | undefined;
    try {
      parsed = await parse(payload);
    } catch (error) {
      return { ok: false, message: thrownText(PASTE_FAILED, error), reason: 'threw' };
    }
    if (!parsed || parsed.success !== true) {
      const failure = parsed?.success === false ? parsed.failure : undefined;
      return { ok: false, message: pasteFailureText(failure), reason: failure?.code ?? 'parse-failed' };
    }
    input = { plan: parsed.plan };
  } else {
    // גרסה שאינה חושפת `parse`: `insert` מקבל payload גולמי ומפרק אותו בעצמו.
    input = { payload };
  }

  let receipt: ClipboardInsertReceipt | undefined;
  try {
    receipt = await insert(input);
  } catch (error) {
    return { ok: false, message: thrownText(PASTE_FAILED, error), reason: 'threw' };
  }

  if (receipt?.success === false) {
    return { ok: false, message: pasteFailureText(receipt.failure), reason: receipt.failure?.code };
  }

  // הדבקה שנפלה לטקסט בלבד היא **הצלחה** עם אובדן עיצוב. אין לה ערוץ נפרד
  // אל המשתמש (המדווח מציג כשלים), ולכן היא נרשמת ללוג ולא נצבעת כשגיאה.
  if (receipt?.plan?.plainFallback === true) {
    console.info('[otzaria-word] ההדבקה נפלה לטקסט בלבד', receipt.diagnostics);
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* בחר הכל                                                            */
/* ------------------------------------------------------------------ */

const SELECT_ALL_FAILED = 'בחירת כל המסמך נכשלה';

/**
 * „בחר הכל”.
 *
 * שני מסלולים ציבוריים משורשרים, ואף אחד מהם אינו DOM:
 *
 * 1. `doc.ranges.resolve` עם עוגני `{kind:'document', edge:'start'|'end'}`.
 *    אלה בדיוק העוגנים שהחוזה מגדיר לגבולות גוף המסמך, והפלט הוא
 *    `SelectionTarget` — „transparent selection target”, כלומר הצורה שפעולות
 *    הבחירה והכתיבה מקבלות. אין צורך לרוץ על `blocks.list()` ולהרכיב קצוות
 *    בעצמנו; המנוע כבר יודע איפה המסמך מתחיל ונגמר.
 * 2. `ui.selection.apply(target)` — „apply a public selection target through
 *    the host-owned selection helper”. זה גם מה שהמנוע עצמו עושה כשהוא מחיל
 *    בחירה מבחוץ, והוא נכשל סגור עם `reason` מהטקסונומיה הציבורית במקום
 *    לזרוק.
 *
 * שני השלבים אינם מובטחים: `ranges` אינו חשוף בכל גרסה, ו-`apply` תלוי
 * ב-helper שה-host מספק. כשאחד מהם חסר הפקד מנוטרל עם הסבר — §12 — ולא
 * מנסה מסלול עקיף.
 */
export async function selectWholeDocument(host: ClipboardHostTarget): Promise<CommandOutcome> {
  const resolve = docOf(host)?.ranges?.resolve;
  if (typeof resolve !== 'function') {
    return { ok: false, message: `${SELECT_ALL_FAILED}: ${UNAVAILABLE}`, reason: 'command-unsupported' };
  }

  const apply = selectionOf(host)?.apply;
  if (typeof apply !== 'function') {
    return failed(SELECT_ALL_FAILED, 'host-capability-unavailable');
  }

  let target: SelectionTarget | null | undefined;
  try {
    const resolved = await resolve({
      start: { kind: 'document', edge: 'start' },
      end: { kind: 'document', edge: 'end' },
    });
    target = resolved?.target;
  } catch (error) {
    return { ok: false, message: thrownText(SELECT_ALL_FAILED, error), reason: 'threw' };
  }

  if (!target || typeof target !== 'object') {
    return failed(SELECT_ALL_FAILED, 'target-unresolved');
  }

  let result: { ok?: boolean; reason?: string } | undefined;
  try {
    result = await apply(target);
  } catch (error) {
    return { ok: false, message: thrownText(SELECT_ALL_FAILED, error), reason: 'threw' };
  }

  if (result?.ok !== true) return failed(SELECT_ALL_FAILED, result?.reason ?? 'target-unresolved');
  return { ok: true };
}
