/**
 * „לבדוק capability בעת boot” (docs/word-plugin-implementation-plan.md §12)
 * מול הדרך הקנונית שהמנוע נותן לזה: `doc.capabilities.get()`.
 *
 * למה עטיפה ולא קריאה ישירה מכל פקד:
 *
 * 1. **הצורה אינה הצורה שהממשק שואל.** המנוע מחזיר
 *    `operations: Record<OperationId, {available, tracked, dryRun, reasons}>`
 *    ו-`global` — כלומר תשובה לפי מזהה פעולה. פקד ב-Ribbon שואל שאלה אחרת:
 *    „האם אפשר להוסיף הערת שוליים”. פקד שיתרגם את זה בעצמו יקודד את מזהה
 *    הפעולה של המנוע לתוך התבנית, וכל שינוי בגרסה יתפזר על עשרות אתרי קריאה.
 * 2. **חלק מהיכולות תלויות בשני מקומות.** „תגובה חדשה” דורשת גם
 *    `operations['comments.create'].available` וגם `global.comments.enabled`;
 *    הראשון אומר שהפעולה קיימת, השני שהיא מאופשרת במסמך הזה.
 * 3. **נכשל סגור.** אם אין Document API, אם `capabilities` חסר, אם הקריאה
 *    זורקת או מחזירה משהו שאינו אובייקט — כל התשובות `false` עם סיבה, ולא
 *    „אולי כן”. פקד שמוצג פעיל ואינו עובד הוא בדיוק התקלה שהמודול הזה נכתב
 *    בגללה: תשע כפתורים בלי `@click` שנראו כמו כפתור עובד.
 *
 * מרחב השאלות מכסה גם את לשונית „הוספה” (תמונה, קישור, מעבר מקטע, תוכן
 * עניינים) ולא רק „פריסה”/„סקירה”: אותה בדיקה תידרש שם, ושני מודולים כאלה
 * היו נותנים שתי תשובות לאותה שאלה.
 */
import type { SuperDoc } from 'superdoc';
import type { MaybePromise } from './document-api';

/**
 * קודי הסיבה של המנוע (`CAPABILITY_REASON_CODES` ב-2.8.0), ועוד אחד שלנו:
 * `DOCUMENT_API_UNAVAILABLE` נוצר כאן כשאין בכלל מה לשאול, כדי שגם המצב הזה
 * יגיע לממשק כסיבה מפורשת ולא כ-`false` בלי הסבר.
 */
export const DOC_CAPABILITY_REASONS = [
  'COMMAND_UNAVAILABLE',
  'HELPER_UNAVAILABLE',
  'OPERATION_UNAVAILABLE',
  'TRACKED_MODE_UNAVAILABLE',
  'DRY_RUN_UNAVAILABLE',
  'NAMESPACE_UNAVAILABLE',
  'STYLES_PART_MISSING',
  'COLLABORATION_ACTIVE',
  'DOCUMENT_API_UNAVAILABLE',
] as const;

export type DocCapabilityReasonCode = (typeof DOC_CAPABILITY_REASONS)[number];

/** ההסבר שמגיע ל-tooltip. הנוסח של `NAMESPACE_UNAVAILABLE` הוא זה שהתכנית קובעת ב-§12. */
const REASON_TEXT: Record<DocCapabilityReasonCode, string> = {
  COMMAND_UNAVAILABLE: 'הפקודה אינה זמינה במנוע',
  HELPER_UNAVAILABLE: 'רכיב שהפעולה נשענת עליו אינו זמין במנוע',
  OPERATION_UNAVAILABLE: 'הפעולה אינה זמינה בגרסה הזאת של המנוע',
  TRACKED_MODE_UNAVAILABLE: 'הפעולה אינה נתמכת במצב מעקב אחר שינויים',
  DRY_RUN_UNAVAILABLE: 'הרצה יבשה אינה נתמכת בפעולה הזאת',
  NAMESPACE_UNAVAILABLE: 'אינו זמין בגרסה זו',
  STYLES_PART_MISSING: 'חסר חלק הסגנונות במסמך',
  COLLABORATION_ACTIVE: 'הפעולה אינה זמינה בזמן עבודה משותפת',
  DOCUMENT_API_UNAVAILABLE: 'המסמך עדיין נטען',
};

/**
 * מה כל שאלה בודקת. `operation` הוא מזהה הפעולה בקטלוג של המנוע, `global` הוא
 * דגל ברמת ה-namespace. שאלה עם שניהם דורשת את שניהם.
 */
interface CapabilitySpec {
  /** מזהה אחד, או רשימה שכולם נדרשים — יכולת שנשענת על שתי פעולות. */
  operation?: string | readonly string[];
  global?: 'trackChanges' | 'comments' | 'lists' | 'dryRun' | 'history';
}

const CAPABILITY_SPECS = {
  // פריסה
  canSetPageMargins: { operation: 'sections.setPageMargins' },
  canSetPageSetup: { operation: 'sections.setPageSetup' },
  canSetColumns: { operation: 'sections.setColumns' },
  canSetSectionDirection: { operation: 'sections.setSectionDirection' },
  canSetSectionBreak: { operation: 'sections.setBreakType' },
  canSetPageBorders: { operation: 'sections.setPageBorders' },
  // גופן. `format.vertAlign` הוא alias ציבורי של `format.apply` על מפתח אחד
  // ב-`InlineRunPatch`, והוא `OperationId` בקטלוג — ולכן הוא נשאל כמו כל פעולה
  // אחרת. ראו engine/vert-align.ts: אין לו פקודה ב-registry של ה-controller,
  // והמסלול היחיד אליו הוא ה-Document API.
  canSetVertAlign: { operation: 'format.vertAlign' },
  // הפניות והוספה
  canInsertFootnote: { operation: 'footnotes.insert' },
  canSetPageBreakBefore: { operation: 'format.paragraph.setFlowOptions' },
  // `insert` ולא `create.text`: הכנסת טקסט היא פעולת הליבה של הפאסדה
  // (`memberPath: 'insert'` בקטלוג), אחותה של `delete`, ולא אחת מ-`create.*`.
  canInsertText: { operation: 'insert' },
  canInsertImage: { operation: 'create.image' },
  canInsertLink: { operation: 'hyperlinks.insert' },
  canInsertSectionBreak: { operation: 'create.sectionBreak' },
  canInsertTableOfContents: { operation: 'create.tableOfContents' },
  canInsertTable: { operation: 'create.table' },
  // כותרת עליונה ותחתונה. שאלה אחת לכל פקד, ולא אחת לכל פעולה: „עריכה”
  // ו„הסרה” יושבות באותו כפתור תפריט, ופקד מנוטרל למחצה אינו מצב שאפשר להציג.
  // `parts.create` הוא הפעולה שבלעדיה אין מה ליצור, ולכן היא זו שנשאלת.
  canEditHeaderFooter: { operation: 'headerFooters.parts.create' },
  canSetTitlePage: { operation: 'sections.setTitlePage' },
  canSetOddEvenHeaders: { operation: 'sections.setOddEvenHeadersFooters' },
  canLinkToPrevious: { operation: 'headerFooters.refs.setLinkedToPrevious' },
  // שדות. „מספר עמוד” ו„תאריך” דורשים את **שתי** הפעולות ולא רק את ההכנסה:
  // `fields.insert` מכניס שדה עם תוצאה ריקה, ו-`fields.rebuild` הוא שמחשב
  // אותה. מנוע שיודע להכניס ואינו יודע לחשב מחדש היה מכניס למסמך שדה בלתי
  // נראה, מדווח „בוצע”, והמשתמש לא היה רואה כלום — שדה שאי אפשר לראות אינו
  // פיצ'ר, וכפתור מנוטרל עם הסבר עדיף על הצלחה מדומה. (ההערה הקודמת כאן טענה
  // שההכנסה „אינה תלויה ב-rebuild”; היא כן — ראו engine/fields.ts.)
  //
  // שתי השאלות עדיין נפרדות, כי אינן זהות: מנוע עם `rebuild` בלי `insert`
  // משאיר את „עדכן שדות” פעיל על שדות שכבר במסמך, ומנטרל רק את ההכנסה.
  //
  // `fields.remove` אינו נשאל: אין לו פקד ברצועה — ב-Word מוחקים שדה כמו
  // שמוחקים טקסט — ושאלה בלי פקד היא הצהרת יכולת שאיש אינו קורא.
  canInsertField: { operation: ['fields.insert', 'fields.rebuild'] },
  canRebuildFields: { operation: 'fields.rebuild' },
  // סקירה
  canAddComment: { operation: 'comments.create', global: 'comments' },
  canTrackChanges: { global: 'trackChanges' },
  // לוח ובחירה. `clipboard` הוא adapter אופציונלי בחוזה, בדיוק כמו `footnotes`,
  // ולכן אותה בדיקה נדרשת כאן. „גזור” הוא שתי יכולות (סדרוּר ומחיקה) ולא אחת,
  // ולכן הן שתי שאלות: מנוע שיודע להעתיק ואינו יודע למחוק צריך להשאיר את
  // „העתק” פעיל ולנטרל רק את „גזור”.
  canCopySelection: { operation: 'clipboard.serializeSelection' },
  canPasteContent: { operation: 'clipboard.insert' },
  canDeleteSelection: { operation: 'delete' },
  canResolveRange: { operation: 'ranges.resolve' },
} as const satisfies Record<string, CapabilitySpec>;

export type DocCapabilityQuestion = keyof typeof CAPABILITY_SPECS;

export const DOC_CAPABILITY_QUESTIONS = Object.keys(CAPABILITY_SPECS) as DocCapabilityQuestion[];

/** התשובה לכל השאלות, כפי שנקראה פעם אחת. */
export interface DocCapabilityReport {
  /** האם היה בכלל Document API לשאול. `false` = כל התשובות `false`. */
  readonly available: boolean;
  /** האם היכולת זמינה. */
  can(question: DocCapabilityQuestion): boolean;
  /** קודי הסיבה שהמנוע נתן. ריק כשהיכולת זמינה. */
  reasons(question: DocCapabilityQuestion): readonly DocCapabilityReasonCode[];
  /** הסבר בעברית, מוכן ל-tooltip. מחרוזת ריקה כשהיכולת זמינה. */
  explain(question: DocCapabilityQuestion): string;
}

/** הצורה הגולמית שנקראת מהמנוע. כל שדה אופציונלי: גרסה אחרת עשויה לא לחשוף אותו. */
interface RawFlag {
  enabled?: boolean;
  reasons?: readonly string[];
}

interface RawOperation {
  available?: boolean;
  reasons?: readonly string[];
}

interface RawCapabilities {
  global?: Partial<Record<string, RawFlag | undefined>>;
  operations?: Partial<Record<string, RawOperation | undefined>>;
}

/** הצורה שנצרכת מ-`doc`. ראו ההסבר ב-document-defaults.ts למה מוגדרת ולא מיובאת. */
export interface CapabilitiesDocumentApi {
  capabilities?: {
    get?: () => MaybePromise<RawCapabilities | undefined>;
  };
}

export interface CapabilitiesHost {
  activeEditor?: { doc?: CapabilitiesDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type CapabilitiesTarget = SuperDoc | CapabilitiesHost | null | undefined;

/** הסיבה כשהמנוע חסם ולא אמר למה. */
const FALLBACK_REASON: DocCapabilityReasonCode = 'OPERATION_UNAVAILABLE';

interface Answer {
  available: boolean;
  reasons: DocCapabilityReasonCode[];
}

/** קוד סיבה שהמנוע החזיר ואיננו מכירים אינו נזרק — הוא פשוט אינו מתורגם. */
function knownReasons(raw: readonly string[] | undefined): DocCapabilityReasonCode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((code): code is DocCapabilityReasonCode =>
    (DOC_CAPABILITY_REASONS as readonly string[]).includes(code),
  );
}

/** התשובה כשאין מה לשאול. */
function closedAnswers(): Map<DocCapabilityQuestion, Answer> {
  const answers = new Map<DocCapabilityQuestion, Answer>();
  for (const question of DOC_CAPABILITY_QUESTIONS) {
    answers.set(question, { available: false, reasons: ['DOCUMENT_API_UNAVAILABLE'] });
  }
  return answers;
}

function buildReport(answers: Map<DocCapabilityQuestion, Answer>, available: boolean): DocCapabilityReport {
  /** שאלה שאינה במפה מקבלת את אותה תשובה סגורה — גם אם היא הגיעה מקוד לא מטופס. */
  const answerFor = (question: DocCapabilityQuestion): Answer =>
    answers.get(question) ?? { available: false, reasons: ['DOCUMENT_API_UNAVAILABLE'] };

  return {
    available,
    can: (question) => answerFor(question).available,
    reasons: (question) => answerFor(question).reasons,
    explain: (question) => {
      const answer = answerFor(question);
      if (answer.available) return '';
      // סיבות כפולות קורות כשהפעולה וה-namespace מדווחים את אותו קוד.
      const texts = [...new Set(answer.reasons.map((code) => REASON_TEXT[code]))];
      return texts.length > 0 ? texts.join('; ') : 'הפעולה אינה זמינה כרגע';
    },
  };
}

/**
 * קוראת את היכולות פעם אחת ומחזירה תצלום.
 *
 * לעולם אינה זורקת: `capabilities.get()` הוא קריאה אל המנוע, וכשל שלה אינו
 * סיבה להפיל את רינדור הרצועה. תצלום ולא reactive בכוונה — הצרכן קורא אותו
 * מחדש כשהמסמך מתחלף, ולא מחזיק מנוי על המנוע.
 */
export async function readDocCapabilities(
  host: CapabilitiesTarget,
): Promise<DocCapabilityReport> {
  const get = (host as CapabilitiesHost | null | undefined)?.activeEditor?.doc?.capabilities?.get;
  if (typeof get !== 'function') return buildReport(closedAnswers(), false);

  let raw: RawCapabilities | undefined;
  try {
    raw = await get();
  } catch (error) {
    console.warn('[otzaria-word] קריאת יכולות ה-Document API נכשלה', error);
    return buildReport(closedAnswers(), false);
  }

  // `null`, מחרוזת, מספר — כל תשובה שאינה אובייקט אינה תשובה.
  if (!raw || typeof raw !== 'object') return buildReport(closedAnswers(), false);

  const answers = new Map<DocCapabilityQuestion, Answer>();
  for (const question of DOC_CAPABILITY_QUESTIONS) {
    const spec: CapabilitySpec = CAPABILITY_SPECS[question];
    const reasons: DocCapabilityReasonCode[] = [];
    let available = true;

    const operations =
      typeof spec.operation === 'string' ? [spec.operation] : (spec.operation ?? []);
    for (const operation of operations) {
      const entry = raw.operations?.[operation];
      // פעולה שאינה בטבלה כלל = גרסה שאינה מכירה אותה. גם פעולה שכן בטבלה
      // אך לא נתנה סיבה מוכרת מקבלת את הקוד הגנרי, כדי שלא תישאר בלי הסבר.
      if (!entry || entry.available !== true) {
        available = false;
        const entryReasons = entry ? knownReasons(entry.reasons) : [];
        reasons.push(...(entryReasons.length > 0 ? entryReasons : [FALLBACK_REASON]));
      }
    }

    if (spec.global) {
      const flag = raw.global?.[spec.global];
      if (!flag || flag.enabled !== true) {
        available = false;
        const flagReasons = flag ? knownReasons(flag.reasons) : [];
        reasons.push(...(flagReasons.length > 0 ? flagReasons : [FALLBACK_REASON]));
      }
    }

    answers.set(question, { available, reasons });
  }

  return buildReport(answers, true);
}
