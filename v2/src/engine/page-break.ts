/**
 * „מעבר עמוד” בלשונית „הוספה”, דרך `doc.format.paragraph.setFlowOptions`.
 *
 * ## המצב הקודם
 *
 * `insertPageBreak()` הייתה **פונקציה ריקה**, והכפתור הציג `Ctrl+Enter` כקיצור
 * שלו. שני הדברים לא היו נכונים: הפונקציה לא עשתה כלום, והתוסף אינו רושם את
 * הקיצור בשום מקום.
 *
 * ## למה `pageBreakBefore` ולא מעבר עמוד אמיתי
 *
 * מה ש-Word קורא לו Insert ▸ Page Break הוא `<w:br w:type="page"/>` בתוך ריצה —
 * מעבר **בסמן**, שמפצל את הפסקה הנוכחית. אין לזה API ציבורי ב-2.8.0:
 *
 * - אין פקודה כזאת ב-`COMMAND_CATALOG` של ה-controller (נבדקו כל ה-descriptors;
 *   `create`, `link`, `inline`, `blockParagraph`, `list`, `table` — ואין break).
 * - אין פעולה כזאת ב-`OperationId` של ה-Document API.
 * - במנוע עצמו **כן** קיים `insertPageBreakAtSelection`, קשור ל-`Mod-Enter`
 *   בצינור הקלט הפנימי שלו. הוא אינו נחשף לא על `doc` ולא על `ui.commands`,
 *   ולכן אין ממנו מסלול לפקד ברצועה. (מכאן גם ההערה שהייתה בקוד על
 *   `Ctrl+Enter` — כנראה הקיצור אכן עובד בתוך העורך, אבל זה **לא אומת**,
 *   ולכן הוא אינו מוצג כקיצור של הכפתור. §12: לא מממשים דרך DOM פנימי.)
 *
 * שתי חלופות ציבוריות נשקלו:
 *
 * 1. **`create.sectionBreak({ breakType: 'nextPage' })`** — נדחתה. היא אינה
 *    מעבר עמוד אלא מעבר **מקטע**: החוזה מתעד שהיא פולטת פסקת-נשא
 *    `<w:p><w:pPr><w:sectPr/></w:pPr></w:p>` „just before the existing final
 *    body section”, כלומר בסוף הגוף ולא בסמן. מקטע חדש גם מנתק כותרות
 *    עליונות/תחתונות והגדרות עמוד, וזה שינוי מבני שהמשתמש לא ביקש.
 * 2. **`format.paragraph.setFlowOptions({ pageBreakBefore: true })`** —
 *    נבחרה. זה `w:pageBreakBefore`, בדיוק התכונה ש-Word מציג כ„מעבר עמוד
 *    לפני” בדיאלוג הפסקה. OOXML אמיתי שעושה round-trip, בלי שינוי מבנה.
 *
 * ההבדל הסמנטי אינו מוסתר: `pageBreakBefore` מזיז את **כל הפסקה** לעמוד הבא,
 * ולא מפצל אותה בסמן. לכן התווית היא „התחל בעמוד חדש” ולא „מעבר עמוד”, וה-
 * tooltip אומר בדיוק מה יקרה. תווית שמבטיחה את התנהגות Word ומבצעת אחרת גרועה
 * מתווית מדויקת.
 *
 * ## NO_OP אינה שגיאה
 *
 * `possibleFailureCodes` של הפעולה הוא `['NO_OP']` בלבד, והמנוע מחזיר אותו כש-
 * ה-XML לא השתנה — כלומר הפסקה כבר מתחילה בעמוד חדש. מבחינת המשתמש זו הצלחה,
 * ולחיצה שנייה אינה אמורה להראות שגיאה. אותה הכרעה כמו ב-page-setup.ts.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';
import { readDocSelection, type SelectionDocumentApi } from './doc-selection';
import { readDocCapabilities } from './doc-capabilities';

/** מזהה הפעולה בקטלוג של המנוע. מיוצא כדי שהבדיקה תקבע אותו מול החבילה. */
export const PAGE_BREAK_OPERATION = 'format.paragraph.setFlowOptions';

/** הנוסח שהתכנית קובעת ב-§12 לפקד שאין לו API זמין. */
const UNAVAILABLE_TEXT = 'אינו זמין בגרסה זו';

/** ההסבר כשאין בכלל מה לשאול. זהה לנוסח ב-doc-capabilities.ts. */
const LOADING_TEXT = 'המסמך עדיין נטען';

const FAILED_ACTION = 'הגדרת התחלה בעמוד חדש נכשלה';

/** `ParagraphTarget` — `nodeType: 'paragraph'` גם לכותרת ולפריט רשימה. ראו למטה. */
interface ParagraphTarget {
  kind: 'block';
  nodeType: 'paragraph';
  nodeId: string;
  story?: unknown;
}

interface FlowOptionsInput {
  target: ParagraphTarget;
  pageBreakBefore: boolean;
}

/** הצורה שנצרכת מ-`doc`. ראו ההסבר ב-document-defaults.ts למה מוגדרת ולא מיובאת. */
export interface PageBreakDocumentApi extends SelectionDocumentApi {
  capabilities?: {
    get?: () => MaybePromise<
      { operations?: Partial<Record<string, { available?: boolean } | undefined>> } | undefined
    >;
  };
  format?: {
    paragraph?: {
      setFlowOptions?: (input: FlowOptionsInput) => MaybePromise<DocReceipt>;
    };
  };
}

export interface PageBreakHost {
  activeEditor?: { doc?: PageBreakDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type PageBreakTarget = SuperDoc | PageBreakHost | null | undefined;

/** האם הפקד זמין, ומה להציג ב-tooltip כשלא. */
export interface PageBreakSupport {
  available: boolean;
  /** הסבר בעברית, מוכן ל-tooltip. מחרוזת ריקה כשזמין. */
  explanation: string;
}

/**
 * קוראת את זמינות הפעולה.
 *
 * **למה כאן ולא ב-doc-capabilities.ts**, שזה מקומה הנכון: המודול ההוא מחזיק
 * מרחב שאלות סגור (`CAPABILITY_SPECS`), ואין בו שאלה על
 * `format.paragraph.setFlowOptions`. הוא היה בבעלות גל אחר בזמן כתיבת הקומיט
 * הזה, ולכן לא נגעתי בו. התוספת שנדרשת שם היא שורה אחת —
 * השאלה `canSetPageBreakBefore` נוספה ל-doc-capabilities.ts, ולכן הפונקציה
 * הזאת רק מתרגמת את הדוח שלו לשני המצבים שה-tooltip צריך.
 *
 * לעולם אינה זורקת: כשל של קריאת יכולות אינו סיבה להפיל את רינדור הרצועה.
 * נכשלת **סגור** — „אולי כן” הוא בדיוק הכפתור המת.
 */
export async function readPageBreakSupport(host: PageBreakTarget): Promise<PageBreakSupport> {
  const doc = (host as PageBreakHost | null | undefined)?.activeEditor?.doc;
  if (!doc) return { available: false, explanation: LOADING_TEXT };

  // נוכחות הפונקציה נבדקת **לפני** היכולות, ולא רק בגללן: מפת ה-`operations`
  // של המנוע נבנית מקטלוג הפעולות, ולכן גרסה שהסירה את המימוש ועוד מכריזה על
  // הפעולה בקטלוג הייתה מחזירה „זמין” לפקד שאין לו למה לקרוא. בדיקה שכיסתה
  // בדיוק את המקרה הזה תפסה את ההסרה שלה.
  if (typeof doc.format?.paragraph?.setFlowOptions !== 'function') {
    return { available: false, explanation: UNAVAILABLE_TEXT };
  }

  const report = await readDocCapabilities(host);

  // אין Document API לשאול — המסמך עדיין נטען. שונה מ„הפעולה אינה נתמכת”,
  // ולכן ההסבר שונה: פקד שנעלם לרגע בזמן פתיחה אינו פקד חסר.
  if (!report.available) return { available: false, explanation: LOADING_TEXT };

  if (report.can('canSetPageBreakBefore')) return { available: true, explanation: '' };

  // ההסבר של הדוח נושא את קוד הסיבה שהמנוע נתן; UNAVAILABLE_TEXT הוא הנוסח
  // כשהוא לא נתן כלום.
  return { available: false, explanation: report.explain('canSetPageBreakBefore') || UNAVAILABLE_TEXT };
}

/**
 * מסמנת את הפסקה שבה הסמן כ„מתחילה בעמוד חדש”.
 *
 * הפסקה היא זו שהבחירה **מתחילה** בה. בבחירה שפרושה על כמה פסקאות זו הפסקה
 * הראשונה, וזו גם ההתנהגות המתבקשת: „שהחלק הזה יתחיל בעמוד חדש”.
 *
 * `nodeType: 'paragraph'` נשלח גם כשהסמן בכותרת או בפריט רשימה. זה אינו קיצור
 * דרך: פתרון היעד במנוע נעשה לפי `nodeId` ו-`story` בלבד ואינו מסתכל על
 * `nodeType` (נמדד), וזה בדיוק מה ש-`paragraphTarget` של ה-controller עצמו
 * שולח לכל פקודות `format.paragraph.*`.
 *
 * לעולם אינה זורקת: הוולידטורים של ה-Document API **זורקים** `INVALID_INPUT`
 * על קלט פסול במקום להחזיר קבלה, וחריגה מפקד ב-Ribbon מפילה את רינדור הרצועה.
 */
export async function startParagraphOnNewPage(host: PageBreakTarget): Promise<CommandOutcome> {
  const setFlowOptions = (host as PageBreakHost | null | undefined)?.activeEditor?.doc?.format
    ?.paragraph?.setFlowOptions;

  if (typeof setFlowOptions !== 'function') {
    // אותו נוסח שהיכולת מחזירה, כדי שהמשתמש יראה את אותו הסבר בין אם הפקד
    // מנוטרל ובין אם הוא נלחץ לפני שהיכולות נקראו.
    return {
      ok: false,
      message: `${FAILED_ACTION}: ${UNAVAILABLE_TEXT}`,
      reason: 'command-unsupported',
    };
  }

  const selection = await readDocSelection(host);
  if (!selection.blockId) {
    return { ok: false, message: 'יש למקם את הסמן במסמך', reason: 'selection-required' };
  }

  const target: ParagraphTarget = {
    kind: 'block',
    nodeType: 'paragraph',
    nodeId: selection.blockId,
    // נשלח רק כשיש: בהיעדרו היעד מתפרש כגוף המסמך, וזו ברירת המחדל הנכונה.
    // `story: null` מפורש היה נכשל בוולידציה.
    ...(selection.story ? { story: selection.story } : {}),
  };

  let receipt: DocReceipt;
  try {
    receipt = await setFlowOptions({ target, pageBreakBefore: true });
  } catch (error) {
    return { ok: false, message: thrownText(FAILED_ACTION, error), reason: 'threw' };
  }

  // הפסקה כבר מתחילה בעמוד חדש. הצלחה מבחינת המשתמש.
  if (receipt?.success === false && receipt.failure?.code === 'NO_OP') return { ok: true };

  if (receipt?.success === false) {
    return {
      ok: false,
      message: receiptFailureText(FAILED_ACTION, receipt),
      reason: receipt.failure?.code,
    };
  }

  return { ok: true };
}
