/**
 * מה שהתוסף זוכר בין הפעלות, וכיצד קוראים אותו בחזרה.
 *
 * ## הכלל שקובע את הצורה: רשומה אחת
 *
 * עד כאן נשמר מפתח אחד — `last-document` — והוא ענה על שאלה אחת: איזה קובץ
 * היה פתוח. „לפתוח בדיוק כמו לפני הסגירה” הן חמש שאלות: איזה קובץ, איפה היה
 * הסמן, באיזה גודל תצוגה, איזו לשונית הייתה פתוחה, ומה **לא נשמר**. חמישה
 * מפתחות נפרדים היו מאפשרים לחמש התשובות להיפרד: סמן של מסמך אחד מעל מסמך
 * אחר. לכן זו רשומה אחת שנכתבת בבת אחת, וכל מה שבתוכה שייך לאותו רגע.
 *
 * ## הכלל השני: כל חלק מזדהה מול המסמך שנפתח בפועל
 *
 * גם רשומה עקבית אינה מספיקה. ה-token של המסמך האחרון עשוי לא להיפתר (הקובץ
 * הוזז, ההרשאה בוטלה), ואז נפתח מסמך אחר לגמרי — ועליו אסור להחיל את הסמן
 * ואת הטיוטה של מי שלא נפתח. `viewFor` ו-`decideDraftRecovery` הן שתי הפונקציות
 * ששואלות את השאלה הזאת, וזו הסיבה שהן כאן ולא במעטפת: הן מחליטות אם עבודה
 * של המשתמש נמחקת או נכתבת למקום הלא נכון, וקוד כזה חייב להיות נבדק.
 *
 * ## גרסה
 *
 * `version` אינו קישוט: רשומה בצורה ישנה נזרקת ואינה „מנוסה בכל זאת”. שדה
 * שהשתנה משמעות הוא בדיוק המקום שבו שחזור שקט הופך לנזק שקט.
 */
import type { CaretAnchor } from '../engine/caret-anchor';
import type { LastDocument } from '../host/settings';

/** הצורה הנוכחית. כל שינוי שאינו תוספת של שדה אופציונלי מעלה אותה. */
export const SESSION_VERSION = 1;

/**
 * הנתיב של הטיוטה במרחב הפרטי של התוסף.
 *
 * שטוח ובשם קבוע, ולא נתיב לכל מסמך: מסמך אחד פתוח בכל רגע (ריבוי מסמכים הוא
 * שלב עתידי), ושם קבוע פירושו שאין קבצים יתומים להצטבר במכסה — הכתיבה הבאה
 * דורסת את הקודמת. השם עצמו מסתיים ב-`docx` מפני שזה בדיוק מה שיש בו.
 */
export const DRAFT_PATH = 'session-draft.docx';

/** המסמך שהיה פתוח. `null` = מסמך חדש שאין לו קובץ. */
export interface SessionDocument {
  token: string;
  name: string;
  /** האם ה-token ניתן לכתיבה — כלומר „שמור” לא יפתח דיאלוג. */
  writable: boolean;
}

/** מה שהמשתמש כיוון בעצמו במעטפת, ואינו שייך למסמך. */
export interface SessionView {
  /** גודל התצוגה באחוזים, או `null` כשלא נמדד. */
  zoom: number | null;
  focusMode: boolean;
  /** מזהה הלשונית ברצועה. אינו מאומת כאן — הרצועה נופלת ל„בית” על מזהה זר. */
  ribbonTab: string | null;
  ribbonCollapsed: boolean;
}

/**
 * טיוטה של עבודה שלא נשמרה, במרחב הפרטי של התוסף.
 *
 * `documentToken` הוא מה שהופך אותה לבטוחה: טיוטה מוחלת **רק** על המסמך שהיא
 * נכתבה ממנו. בלעדיו טיוטה של מסמך א' הייתה יכולה להיפתח מעל מסמך ב' ואז
 * להישמר לקובץ שלו.
 *
 * `sourceSize` הוא גודל הקובץ בדיסק ברגע שהטיוטה נכתבה. הוא אינו זהה לגודל
 * הטיוטה, ואינו אמור להיות: הטיוטה מכילה שינויים שהקובץ אינו מכיל. מה שהוא
 * מגלה הוא שינוי **מבחוץ** — מישהו ערך את הקובץ ב-Word בין ההפעלות — ואז
 * שחזור שקט היה דורס אותו.
 */
export interface SessionDraft {
  path: string;
  /** `Date.now()` בזמן הכתיבה, להצגה ולאבחון. */
  savedAt: number;
  documentToken: string | null;
  sourceSize: number | null;
}

export interface SessionState {
  version: number;
  document: SessionDocument | null;
  view: SessionView;
  caret: CaretAnchor | null;
  draft: SessionDraft | null;
}

/** מצב התצוגה של מי שעוד לא בחר דבר. */
export function defaultView(): SessionView {
  return { zoom: null, focusMode: false, ribbonTab: null, ribbonCollapsed: false };
}

/** רשומה ריקה. לא קבוע משותף — כדי שקורא לא ישנה אותה לכולם. */
export function emptySession(): SessionState {
  return { version: SESSION_VERSION, document: null, view: defaultView(), caret: null, draft: null };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readDocument(value: unknown): SessionDocument | null {
  if (!value || typeof value !== 'object') return null;
  const doc = value as Partial<SessionDocument>;
  const token = readString(doc.token);
  if (!token) return null;
  return {
    token,
    name: readString(doc.name) ?? 'מסמך',
    writable: doc.writable === true,
  };
}

function readView(value: unknown): SessionView {
  if (!value || typeof value !== 'object') return defaultView();
  const view = value as Partial<SessionView>;
  const zoom = readFiniteNumber(view.zoom);
  return {
    // גודל תצוגה שאינו חיובי אינו „ערך קיצוני” אלא ערך פגום, והפקדים היו
    // מקבלים ממנו סרגל תקוע. הגבולות עצמם נאכפים ב-engine/zoom.ts.
    zoom: zoom !== null && zoom > 0 ? zoom : null,
    focusMode: view.focusMode === true,
    ribbonTab: readString(view.ribbonTab),
    ribbonCollapsed: view.ribbonCollapsed === true,
  };
}

function readCaretPoint(value: unknown): CaretAnchor['start'] | null {
  if (!value || typeof value !== 'object') return null;
  const point = value as Partial<CaretAnchor['start']>;
  const blockId = readString(point.blockId);
  if (!blockId) return null;
  const ordinal = readFiniteNumber(point.ordinal);
  const offset = readFiniteNumber(point.offset) ?? 0;
  return {
    blockId,
    ordinal: ordinal !== null && ordinal >= 0 ? Math.trunc(ordinal) : null,
    offset: Math.max(0, Math.trunc(offset)),
  };
}

function readCaret(value: unknown): CaretAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const anchor = value as Partial<CaretAnchor>;
  const start = readCaretPoint(anchor.start);
  if (!start) return null;
  return { start, end: readCaretPoint(anchor.end) };
}

function readDraft(value: unknown): SessionDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<SessionDraft>;
  const path = readString(draft.path);
  if (!path) return null;
  const size = readFiniteNumber(draft.sourceSize);
  return {
    path,
    savedAt: readFiniteNumber(draft.savedAt) ?? 0,
    documentToken: readString(draft.documentToken),
    sourceSize: size !== null && size > 0 ? size : null,
  };
}

/**
 * קוראת רשומה מה-storage. `null` = אין מה לשחזר: אין רשומה, היא אינה
 * אובייקט, או שהיא בגרסה אחרת.
 *
 * שאר השדות נקראים בסלחנות — שדה פגום מתאפס ואינו פוסל את הרשומה כולה. זו
 * ההחלטה הנכונה כאן: הרשומה מחזיקה חמישה דברים בלתי תלויים, ו-`ribbonTab`
 * שנשמר פגום אינו סיבה לאבד את המסמך והטיוטה.
 */
export function normalizeSession(raw: unknown): SessionState | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<SessionState>;
  if (record.version !== SESSION_VERSION) return null;

  return {
    version: SESSION_VERSION,
    document: readDocument(record.document),
    view: readView(record.view),
    caret: readCaret(record.caret),
    draft: readDraft(record.draft),
  };
}

/**
 * מסלול השדרוג ממי שכבר יש לו `last-document` מגרסה קודמת של התוסף.
 *
 * בלעדיו כל משתמש קיים היה מקבל בעדכון „מסמך חדש” במקום המסמך שעבד עליו —
 * רגרסיה שנגרמה דווקא מהתכונה שנועדה לזכור יותר.
 */
export function sessionFromLastDocument(last: LastDocument | null): SessionState | null {
  if (!last) return null;
  return {
    ...emptySession(),
    document: { token: last.token, name: last.name, writable: last.writable },
  };
}

/**
 * החלק ששייך למסמך מסוים — ורק אם זה המסמך שנפתח בפועל.
 *
 * ## ההפרדה שמאחורי הפונקציה הזאת
 *
 * ברשומה יש שני סוגי מצב, ורק אחד מהם מותנה:
 *
 * - **מצב המעטפת** — מצב מיקוד, הלשונית ברצועה, כיווץ. זו העדפה של מי שיושב
 *   מול המסך, והיא נכונה בכל מסמך. היא מוחלת תמיד, ולכן אינה עוברת כאן.
 * - **מצב המסמך** — הסמן וגודל התצוגה. „עמוד 40, 150%” הוא משפט על מסמך
 *   מסוים. אם ה-token לא נפתר ונפתח מסמך אחר, החלת המצב הזה עליו היא קפיצה
 *   שרירותית לאמצע מסמך שהמשתמש לא ביקש.
 *
 * `openedToken` הוא ה-token של מה שעל המסך עכשיו; `null` = מסמך חדש בלי קובץ.
 */
export function documentViewFor(
  session: SessionState | null,
  openedToken: string | null,
): { zoom: number | null; caret: CaretAnchor | null } {
  const sameDocument = (session?.document?.token ?? null) === openedToken;
  if (!session || !sameDocument) return { zoom: null, caret: null };
  return { zoom: session.view.zoom, caret: session.caret };
}

/** מה לעשות עם טיוטה שנמצאה. */
export type DraftDecision =
  /** לפתוח את המסמך מהטיוטה. יש בה עבודה שאינה בקובץ. */
  | { action: 'restore' }
  /** הקובץ בדיסק השתנה מאז שהטיוטה נכתבה — לשאול את המשתמש. */
  | { action: 'ask' }
  /** אין מה לשחזר, או שהטיוטה אינה שייכת למסמך הזה. */
  | { action: 'discard'; reason: 'none' | 'other-document' };

export interface DraftRecoveryInput {
  draft: SessionDraft | null;
  /** ה-token של המסמך שעומדים לפתוח, או `null` למסמך חדש. */
  openingToken: string | null;
  /** גודל הקובץ בדיסק כרגע. `null` או 0 = אוצריא לא דיווחה. */
  diskSize: number | null;
}

/**
 * האם לפתוח מהטיוטה.
 *
 * שלוש ההחלטות, ולמה כל אחת:
 *
 * - **`other-document`** — טיוטה מוחלת רק על המסמך שהיא נכתבה ממנו. זהו הכלל
 *   שמונע את התרחיש היחיד שבו התכונה הזאת יכולה למחוק עבודה: תוכן של מסמך
 *   אחד שנפתח מעל מסמך אחר, ואז נשמר לקובץ שלו.
 * - **`ask`** — הקובץ בדיסק שינה את גודלו מאז שהטיוטה נכתבה, כלומר מישהו ערך
 *   אותו מבחוץ. שתי התשובות לגיטימיות, ורק המשתמש יודע איזו — ולכן שואלים
 *   במקום להכריע. גודל שלא דווח (`null` או 0) אינו „לא השתנה” ואינו „השתנה”:
 *   אין עליו מידע, והשאלה על סמך לא-מידע היא הטרדה.
 * - **`restore`** — יש עבודה שאינה בקובץ, והקובץ הוא אותו קובץ. זה המסלול
 *   הרגיל, והוא זה שהופך „חזרתי והכול כמו שהיה” לאמת.
 */
export function decideDraftRecovery(input: DraftRecoveryInput): DraftDecision {
  const { draft, openingToken, diskSize } = input;
  if (!draft) return { action: 'discard', reason: 'none' };
  if (draft.documentToken !== openingToken) {
    return { action: 'discard', reason: 'other-document' };
  }

  const known = diskSize !== null && diskSize > 0 && draft.sourceSize !== null;
  if (known && diskSize !== draft.sourceSize) return { action: 'ask' };

  return { action: 'restore' };
}
