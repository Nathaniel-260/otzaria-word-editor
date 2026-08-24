/**
 * שילוב עם הקורא של אוצריא: ניווט לספרייה, פתיחת חיפוש, והבחירה בטאב הטקסט.
 *
 * למה מודול נפרד ולא קריאות מתוך `App.vue`: שלושת ה-RPC כאן חולקים שני דברים
 * שאין להם מקום בקומפוננטה — מיפוי המתודה להרשאה שהיא דורשת (`reader.open`,
 * `navigation.write`), והתשובה לשאלה „מה אומרים למשתמש כשההרשאה חסרה”. בלי
 * המיפוי הזה כשל הרשאה מגיע כהודעה של אוצריא באנגלית, או נבלע — וזה בדיוק
 * הכשל שהמודול הזה נכתב כדי למנוע: שלושת הכפתורים בלשונית „אוצריא” הציגו
 * הודעת סטטוס שמתארת פעולה שלא קרתה.
 *
 * ההרשאות מוצהרות ב-`public/manifest.json`, ו-tests/unit/manifest.test.ts
 * מקבע שמה שנצרך כאן אכן מוצהר שם.
 */
import { call, isPermissionDenied, hostErrorCode } from './otzaria-client';
import type { NavigationTarget, OpenSearchTabArgs } from '../types/otzaria_plugin';

/**
 * תוצאת פעולה מול הקורא. מטופסת ולא זריקה, מאותו טעם כמו `ImageDataUrlResult`
 * ב-host/files.ts: הקורא בממשק צריך הודעה אחת בעברית ולא שלושה מסלולי טיפול.
 */
export type ReaderResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; message: string; reason: string };

/**
 * ההרשאה שכל מתודה דורשת, לפי docs/plugin-sdk/API_REFERENCE.md. המפה היא גם
 * המקור לבדיקת המניפסט — כך „הכפתור נכשל בהרשאה” אינו יכול להגיע למשתמש
 * בגלל הצהרה שנשכחה.
 */
export const READER_PERMISSIONS: Record<string, string> = {
  'reader.getSelection': 'reader.open',
  'reader.openSearchTab': 'reader.open',
  'navigation.goTo': 'navigation.write',
};

/**
 * מנרמלת טקסט מסומן לשורה אחת.
 *
 * גם הבחירה במסמך וגם הבחירה בקורא מגיעות עם שברי שורות ורווחים כפולים —
 * פסקה בקורא היא שורה בקובץ המקור, ובחירה בשתי פסקאות מביאה את שתיהן. שאילתת
 * חיפוש עם שבר שורה בתוכה אינה מה שהמשתמש סימן, וציטוט שנכנס למסמך צריך
 * להיות פסקה אחת. הנרמול הוא של רווחים בלבד: ניקוד, טעמים וסימני פיסוק הם
 * חלק מהטקסט המצוטט ואין לגעת בהם.
 */
export function normalizeSelectedText(text: string): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

/**
 * הודעה בעברית לכשל שחזר מאוצריא.
 *
 * הרשאה חסרה היא המקרה שחוזר בשטח, והיא צריכה לומר **מה** חסר: המשתמש יכול
 * לאשר הרשאה בהגדרות התוסף, אבל לא אם ההודעה אומרת „הפעולה נכשלה”. שאר
 * הקודים נמסרים כפי שהם לצד ההודעה של אוצריא — הם מיועדים לדיווח באג, לא
 * להוראה למשתמש.
 */
function hostFailure(
  method: string,
  failedAction: string,
  error: unknown,
): { ok: false; message: string; reason: string } {
  if (isPermissionDenied(error)) {
    const permission = READER_PERMISSIONS[method] ?? method;
    return {
      ok: false,
      reason: 'permission-denied',
      message: `${failedAction}: לתוסף חסרה ההרשאה „${permission}”. יש לאשר אותה לתוסף בהגדרות אוצריא ולטעון את הלשונית מחדש`,
    };
  }
  const code = hostErrorCode(error);
  const detail = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    reason: code ?? 'threw',
    message: code ? `${failedAction}: ${detail} (${code})` : `${failedAction}: ${detail}`,
  };
}

/**
 * קוראת ל-RPC שהתשובה שלו היא „בוצע” בוליאני (`navigation.goTo`,
 * `reader.openSearchTab` — שניהם מתועדים כמחזירים `true`).
 *
 * `false` הוא סירוב מפורש של אוצריא ולכן הוא כשל. כל צורה אחרת — `null`,
 * אובייקט, `undefined` — נחשבת הצלחה ונרשמת ללוג בלבד: התוצאה הנראית של שתי
 * הפעולות היא מסך שמתחלף, המשתמש רואה בעצמו אם זה קרה, והודעת שגיאה על גרסה
 * שהחזירה צורה אחרת היא אזעקת שקר. זה גם ההסבר ל-stub של הפיתוח, שמחזיר
 * `null` לכל מתודה שאינה ממומשת בו.
 */
async function callAck(
  method: string,
  failedAction: string,
  payload: Record<string, unknown>,
): Promise<ReaderResult> {
  let data: unknown;
  try {
    data = await call<unknown>(method, payload);
  } catch (error) {
    return hostFailure(method, failedAction, error);
  }

  if (data === false) {
    return { ok: false, reason: 'refused', message: `${failedAction}: אוצריא לא ביצעה את הפעולה` };
  }
  if (data !== true) {
    console.warn(`[otzaria-word] ${method} החזירה תשובה בצורה לא צפויה`, data);
  }
  return { ok: true, value: undefined };
}

/** מעבר למסך ראשי באוצריא. */
export function goTo(target: NavigationTarget): Promise<ReaderResult> {
  return callAck('navigation.goTo', 'המעבר באוצריא נכשל', { target });
}

/**
 * פותחת את מסך הספרייה של אוצריא.
 *
 * הפעולה מוציאה את המשתמש מלשונית התוסף — זה מה ש„פתח ספרייה” אומר, והמסמך
 * נשאר פתוח בלשונית שלו. השמירה אינה מופעלת כאן: היא כבר אוטומטית, ולכפות
 * שמירה על ניווט היה הופך כפתור ניווט לכפתור שכותב לדיסק.
 */
export function openLibrary(): Promise<ReaderResult> {
  return goTo('library');
}

/**
 * פותחת את מסך החיפוש הרגיל של אוצריא עם השאילתה.
 *
 * `autoSearch` נשאר בברירת המחדל (`true`): המשתמש סימן טקסט וביקש לחפש אותו,
 * ולפתוח לו את המסך בלי להריץ היה מבקש ממנו ללחוץ Enter על מה שהוא כבר בחר.
 */
export function openSearchTab(args: OpenSearchTabArgs): Promise<ReaderResult> {
  const { query, ...rest } = args;
  return callAck('reader.openSearchTab', 'פתיחת החיפוש באוצריא נכשלה', { query, ...rest });
}
