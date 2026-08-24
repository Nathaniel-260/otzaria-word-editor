/**
 * שדות Word — מספר עמוד, מספר העמודים ותאריך — דרך `doc.fields`.
 *
 * ## למה `instruction` גולמי ולא „סוג שדה”
 *
 * `FieldInsertInput` בחוזה נושא `at`, `instruction`, `mode: 'raw'`, ועוד שני
 * שדות אופציונליים שאינם נצרכים כאן (`cachedResultText` ו-`updatePolicy`, ראו
 * „למה אין תאריך קבוע” למטה). אין בו `fieldType` ואין קטלוג של שדות מוכרים —
 * מה שנשלח הוא **קוד השדה של Word** כמחרוזת, בדיוק כפי שהוא נכתב בין הסוגריים
 * המסולסלים במסמך. לכן כל מחרוזת כאן היא קוד שדה תקני של Word ותו לא:
 * `PAGE`, `NUMPAGES`, `DATE \\@ "dd/MM/yyyy"`.
 *
 * ## למה `DATE` נושא מתג `\@`, ומה בדיוק נמדד
 *
 * מי שמחשב את תוצאת השדה כאן אינו Word: `fields.insert` מכניס שדה עם תוצאה
 * ריקה, ו-`fields.rebuild` הוא שמחשב אותה בתוך המנוע (כך כתוב בחוזה:
 * „inserted with an empty cached result and is expected to be recomputed via
 * `fields.rebuild`”). החוזה אינו מצהיר על אילו מתגים ה-rebuild יודע לפרש,
 * ומתג שאינו מוכר אינו מייצר שגיאה אלא תוצאה שגויה בשקט — ולכן המתגים נמדדו
 * במנוע האמיתי (Chrome, `file://`, מסמך זרוע, `fields.insert` + `rebuild`
 * ואז `fields.list().items[].resolvedText`) ולא נוחשו. שלוש המדידות, ביום
 * 25.8.2026:
 *
 * - `DATE` עירום            → `2026-08-24`      (ISO, ובאזור זמן UTC — יום אחורה)
 * - `DATE \@ "dd/MM/yyyy"`  → `25/08/2026`      המתג מפורש, והתאריך מקומי
 * - `DATE \@ "d בMMMM yyyy"`→ `25 בAugust 2026` המתג מפורש, שמות החודשים לועזיים
 * - `DATE \* HEBREW`        → `2026-08-24`      המתג נבלע בשקט, בלי שגיאה
 *
 * כלומר: מתג תמונת-הפורמט `\@` מפורש כהלכה, ומתג לוח השנה אינו קיים. לכן
 * הפורמט המספרי הישראלי `dd/MM/yyyy` נשלח — הוא נכון בעברית, אינו נשען על
 * שמות חודשים שהמנוע אינו מתרגם, והוא גם מה שמתקן את ה-ISO וההיסט של יום
 * שהתוצאה העירומה נותנת. לוח שנה עברי אינו אפשרי כאן, ואין להוסיף `\*` —
 * הוא נמדד כמתג שנבלע.
 *
 * הפורמט הזה הוא מה שנראה בתוסף. בפתיחת הקובץ ב-Word, Word מחשב את השדה
 * מחדש בעצמו לפי אותו מתג `\@` — זו תמונת פורמט תקנית שלו.
 *
 * ## למה אין „עמוד X מתוך Y”
 *
 * זה אינו שדה אחד אלא רצף של חמישה חלקים — טקסט „עמוד ”, שדה `PAGE`, טקסט
 * „ מתוך ”, שדה `NUMPAGES` — ולשם כך צריך להכניס טקסט **בין** שני שדות.
 * `fields.insert` מקבל `at: TextTarget`, כלומר כתובת טקסט מוחלטת, והקבלה
 * שהוא מחזיר נושאת `FieldAddress` (`blockId`/`occurrenceIndex`) ולא היסט
 * טקסט. כלומר אחרי ההכנסה הראשונה אין דרך ציבורית לדעת באיזה היסט להכניס את
 * החלק הבא, וכל ניחוש היה מייצר משפט מעורבב. שני הפקדים הנפרדים —
 * „מספר עמוד” ו„מספר העמודים במסמך” — הם מה שהחוזה מאפשר בוודאות.
 *
 * ## למה אין „תאריך קבוע” ואין „הסרת שדה”
 *
 * תאריך קבוע ב-Word הוא **טקסט**, לא שדה (זה מה ש„עדכן אוטומטית” הכבוי
 * בדיאלוג עושה), והחלופה בחוזה — `updatePolicy: 'preserveCached'` —
 * מוצהרת בקטלוג הפעולות ככזאת שמחזירה כרגע `CAPABILITY_UNAVAILABLE`. אין
 * כאן מה לממש.
 *
 * `fields.remove` קיים, אבל ב-Word אין לו פקד ברצועה: מוחקים שדה כמו שמוחקים
 * טקסט. פונקציה בלי פקד היא קוד מת, ולכן היא אינה כאן.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';
import { readDocSelection, type SelectionDocumentApi, type SelectionTarget } from './doc-selection';

/**
 * קודי השדות שהמודול מכיר, לפי שמם ב-Word. קבועים ולא נבנים: מחרוזת שנבנית
 * מקלט של הממשק היא בדיוק הדרך שבה נשתל קוד שדה שגוי במסמך.
 */
export const FIELD_INSTRUCTIONS = {
  pageNumber: 'PAGE',
  pageCount: 'NUMPAGES',
  date: 'DATE \\@ "dd/MM/yyyy"',
} as const;

export type FieldKind = keyof typeof FIELD_INSTRUCTIONS;

/** `FieldMutationResult` — הצלחה נושאת `field`, כשל נושא `failure` כמו כל קבלה. */
interface FieldReceipt extends DocReceipt {
  field?: unknown;
}

/** `FieldDomain` בחלק שנצרך כאן. `address` הוא מה ש-`rebuild` מקבל כ-`target`. */
interface FieldEntry {
  address?: unknown;
  instruction?: string;
  fieldType?: string;
}

export interface FieldsDocumentApi extends SelectionDocumentApi {
  fields?: {
    list?: (query?: {
      type?: string;
      limit?: number;
      offset?: number;
    }) => MaybePromise<{ items?: readonly FieldEntry[]; total?: number } | undefined>;
    insert?: (input: {
      at: unknown;
      instruction: string;
      mode: 'raw';
    }) => MaybePromise<FieldReceipt>;
    rebuild?: (input: { target: unknown }) => MaybePromise<DocReceipt>;
  };
}

/** מה שנדרש מ-SuperDoc: רק הפאסדה של המסמך. ראו page-setup.ts. */
export interface FieldsHost {
  activeEditor?: { doc?: FieldsDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type FieldsTarget = SuperDoc | FieldsHost | null | undefined;

/**
 * הטיית הכשל בעברית תקנית לכל שדה. „מספר העמוד” זכר, „התאריך” זכר — הביטוי
 * נשמר שלם ואינו נגזר מהמזהה. ראו document-api.ts.
 */
const INSERT_FAILED: Record<FieldKind, string> = {
  pageNumber: 'הוספת מספר העמוד נכשלה',
  pageCount: 'הוספת מספר העמודים נכשלה',
  date: 'הוספת התאריך נכשלה',
};

const REBUILD_FAILED = 'עדכון השדות נכשל';
/**
 * החוזה מונה שלוש סיבות ל-`target: null`: מסמך ריק, בחירת node (תמונה, טבלה)
 * וחוסר מיקוד בעורך. „יש למקם את הסמן” לא הבחין ביניהן ונקרא כשקר למי שהסמן
 * שלו כבר במקום. הנוסח כאן מכוון לפעולה שמכסה את שלושתן: לחיצה בגוף המסמך
 * מחזירה מיקוד ומחליפה בחירת node בסמן טקסט, ותו אחד לפחות פותר מסמך ריק.
 */
const NO_TARGET_DETAIL = 'יש ללחוץ בגוף המסמך, על שורת טקסט שיש בה תו אחד לפחות, ואז להוסיף את השדה';
const READ_FAILED = 'קריאת שדות המסמך נכשלה';

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

/**
 * כשל הקבלה, או `null` כשהיא הצליחה. `NO_OP` נחשב הצלחה — שדה שהמנוע כבר
 * חישב מחדש אינו טעון עדכון, וזה בדיוק מה שהמשתמש ביקש. ראו header-footer.ts.
 */
function failureOf(failedAction: string, receipt: DocReceipt | undefined): CommandOutcome | null {
  const code = receipt?.failure?.code;
  if (receipt?.success !== false || code === 'NO_OP') return null;
  return { ok: false, message: receiptFailureText(failedAction, receipt), reason: code };
}

function docOf(host: FieldsTarget): FieldsDocumentApi | null {
  return (host as FieldsHost | null | undefined)?.activeEditor?.doc ?? null;
}

/* ------------------------------------------------------------------ */
/* הכנסת שדה                                                           */
/* ------------------------------------------------------------------ */

/**
 * מכניסה שדה במקום הסמן.
 *
 * `at` הוא פרמטר **חובה** בחוזה, ואין לו ברירת מחדל „במקום הסמן” כמו שיש
 * ל-`footnotes.insert`. לכן הבחירה נקראת כאן ונמסרת כמו שהיא: היא ה-
 * `TextTarget` שהמנוע עצמו הקרין, ובנייה מחדש שלה הייתה מקבעת אצלנו אחת
 * מכמה צורות אפשריות. ראו doc-selection.ts.
 *
 * סמן מכווץ הוא יעד חוקי לחלוטין — `TextTarget` דורש קטע אחד לפחות, לא טווח
 * לא-ריק — וזה המצב הרגיל של הפקד: לוחצים בלי לסמן כלום, והשדה נכנס בסמן.
 */
async function insertField(host: FieldsTarget, kind: FieldKind): Promise<CommandOutcome> {
  const failedAction = INSERT_FAILED[kind];
  const doc = docOf(host);
  if (!doc) return unavailable(failedAction, 'המסמך עדיין נטען', 'document-api-unavailable');

  const insert = doc.fields?.insert;
  if (typeof insert !== 'function') return unsupported(failedAction);

  const selection = await readDocSelection(host as SelectionTarget);
  if (!selection.target) {
    return unavailable(failedAction, NO_TARGET_DETAIL, 'no-selection');
  }

  const inserted = await attempt(failedAction, () =>
    insert({ at: selection.target, instruction: FIELD_INSTRUCTIONS[kind], mode: 'raw' }),
  );
  if (!inserted.ok) return inserted.outcome;

  const failure = failureOf(failedAction, inserted.value);
  if (failure) return failure;

  // השדה נכנס עם תוצאה ריקה, וה-rebuild הוא שמחשב אותה. בלעדיו המשתמש רואה
  // מקום ריק ולא „3”, ואין לו שום רמז שצריך ללחוץ על „עדכן שדות”.
  return rebuildInsertedField(doc, inserted.value?.field, failedAction);
}

/**
 * מחשבת את התוצאה של השדה שזה עתה נכנס.
 *
 * כשל כאן אינו כשל של ההכנסה: השדה **במסמך**, והוא ייראה ברגע שיעודכן —
 * מ„עדכן שדות”, מפתיחה מחדש ב-Word, או מהדפסה. הודעת כשל על פעולה שהצליחה
 * היא בדיוק סוג הרעש שמלמד את המשתמש להתעלם מהודעות, ולכן החזרה כאן היא
 * `{ ok: true }` בכל מקרה.
 */
async function rebuildInsertedField(
  doc: FieldsDocumentApi,
  field: unknown,
  failedAction: string,
): Promise<CommandOutcome> {
  const rebuild = doc.fields?.rebuild;
  if (typeof rebuild !== 'function' || field === undefined || field === null) return { ok: true };

  await attempt(failedAction, () => rebuild({ target: field }));
  return { ok: true };
}

/** „מספר עמוד” — `{ PAGE }`. */
export function insertPageNumber(host: FieldsTarget): Promise<CommandOutcome> {
  return insertField(host, 'pageNumber');
}

/** „מספר העמודים במסמך” — `{ NUMPAGES }`. ראו הערת הפתיחה על „עמוד X מתוך Y”. */
export function insertPageCount(host: FieldsTarget): Promise<CommandOutcome> {
  return insertField(host, 'pageCount');
}

/** „תאריך ושעה” — `{ DATE \\@ "dd/MM/yyyy" }`. המתג נמדד, ראו הערת הפתיחה. */
export function insertDate(host: FieldsTarget): Promise<CommandOutcome> {
  return insertField(host, 'date');
}

/* ------------------------------------------------------------------ */
/* קריאה ועדכון                                                        */
/* ------------------------------------------------------------------ */

/** מה שהממשק צריך לדעת: האם יש בכלל מה לעדכן. תצלום ולא מנוי, כמו header-footer.ts. */
export interface FieldsState {
  count: number;
}

export function emptyFieldsState(): FieldsState {
  return { count: 0 };
}

/**
 * מונה את שדות המסמך. לעולם אינה זורקת: כשל של קריאה מחזיר „אין שדות”, כלומר
 * ה-tooltip יאמר שאין מה לעדכן — ולא ימציא מספר.
 */
export async function readFieldsState(host: FieldsTarget): Promise<FieldsState> {
  const list = docOf(host)?.fields?.list;
  if (typeof list !== 'function') return emptyFieldsState();

  const listed = await attempt(READ_FAILED, () => list());
  if (!listed.ok) return emptyFieldsState();

  // `total` ולא `items.length`: `FieldsListResult` הוא `DiscoveryOutput`, כלומר
  // `items` הוא עמוד תחת `limit`/`offset` ו-`total` הוא המספר במסמך כולו. מונה
  // שסופר עמוד אחד היה אומר „20 שדות” במסמך של מאות. הנפילה ל-`items.length`
  // היא לגרסה שאינה חושפת `total` — עדיף מספר חלקי על אפס שקרי.
  const { items, total } = listed.value ?? {};
  if (typeof total === 'number' && Number.isFinite(total)) return { count: total };
  return { count: Array.isArray(items) ? items.length : 0 };
}

/**
 * „עדכן שדות” — מחשבת מחדש כל שדה במסמך, כמו F9 על מסמך שכולו מסומן.
 *
 * העצירה בכשל הראשון מכוונת: `rebuild` נכשל על תנאי מסמך (מסמך נעול, שדה
 * שאינו נתמך), וכשל כזה יחזור על עצמו בכל שדה — רצף של אותה הודעה עשרים פעם
 * אינו מוסיף מידע.
 *
 * מסמך בלי שדות מחזיר הצלחה שקטה: המשתמש ביקש שכל השדות יהיו מעודכנים, וכולם
 * מעודכנים. אין כאן כשל שיש לדווח עליו.
 */
export async function rebuildAllFields(host: FieldsTarget): Promise<CommandOutcome> {
  const doc = docOf(host);
  if (!doc) return unavailable(REBUILD_FAILED, 'המסמך עדיין נטען', 'document-api-unavailable');

  const list = doc.fields?.list;
  const rebuild = doc.fields?.rebuild;
  if (typeof list !== 'function' || typeof rebuild !== 'function') return unsupported(REBUILD_FAILED);

  // `list()` מחזיר **עמוד** ולא את כל המסמך: `items` נשלט ב-`limit`/`offset`,
  // ו-`total` הוא המספר האמיתי. „עדכן שדות” שרץ על העמוד הראשון בלבד היה
  // משאיר שדות לא מעודכנים במסמך גדול — ובלי שום סימן, כי הפעולה מדווחת
  // הצלחה. לכן נשאבים עמודים עד שנספרו `total` שדות.
  //
  // `PAGE_SIZE` מפורש ולא ברירת המחדל של המנוע: בלעדיו אין דרך לדעת בכמה
  // להתקדם. `guard` הוא בלם מפני מנוע שיחזיר `total` שאינו יורד לעולם —
  // לולאה אינסופית בלחיצת כפתור היא תקלה גרועה יותר משדה שלא עודכן.
  const PAGE_SIZE = 200;
  let offset = 0;
  let guard = 0;

  for (;;) {
    const listed = await attempt(REBUILD_FAILED, () => list({ limit: PAGE_SIZE, offset }));
    if (!listed.ok) return listed.outcome;

    const items = listed.value?.items ?? [];
    if (items.length === 0) return { ok: true };

    for (const entry of items) {
      // שדה בלי כתובת אינו יעד חוקי ל-`rebuild`, ושליחתו הייתה חריגת
      // `INVALID_INPUT` על שדה שאיש לא ביקש במיוחד.
      if (entry.address === undefined || entry.address === null) continue;

      const rebuilt = await attempt(REBUILD_FAILED, () => rebuild({ target: entry.address }));
      if (!rebuilt.ok) return rebuilt.outcome;
      const failure = failureOf(REBUILD_FAILED, rebuilt.value);
      if (failure) return failure;
    }

    offset += items.length;

    const total = listed.value?.total;
    if (!Number.isFinite(total) || offset >= (total as number)) return { ok: true };
    if (++guard > 1000) return { ok: true };
  }
}
