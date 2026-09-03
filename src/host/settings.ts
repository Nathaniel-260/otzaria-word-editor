/**
 * מה שהתוסף זוכר בין הפעלות.
 *
 * ה-`storage` של אוצריא הוא KV של JSON, ולכן נשמרים בו **רק** metadata
 * ו-tokens אטומים — לא bytes ולא Blob של מסמך. ה-token הוא מה ששורד: ה-URL
 * שאוצריא מחזירה תקף לריצה אחת בלבד, כי הפורט של שרת ה-loopback מתחלף.
 */
import { call, tryCall } from './otzaria-client';

/**
 * המסמך שהיה פתוח לאחרונה.
 *
 * **מפתח מדור קודם.** מאז ש„חזרה בדיוק למה שהיה” כוללת גם את הסמן, את התצוגה
 * ואת מה שלא נשמר, זהות המסמך היא שדה אחד ברשומת ההפעלה (`SESSION_KEY`)
 * ואינה נכתבת לכאן יותר. הקריאה נשארה בשביל מסלול אחד בלבד: משתמש שמעדכן
 * מגרסה קודמת ויש לו רק את המפתח הזה. אחרי שהוא נקרא פעם אחת הוא נמחק, כדי
 * שלא יישאר מקור שני לאותה שאלה.
 */
export interface LastDocument {
  token: string;
  name: string;
  /** האם ה-token ניתן לכתיבה — כלומר „שמור” לא יפתח דיאלוג. */
  writable: boolean;
}

const LAST_DOCUMENT_KEY = 'last-document';

/**
 * קוראת את המסמך האחרון. כשל או ערך פגום מוחזרים כ-`null`: זיכרון של מסמך
 * אחרון אינו סיבה להיכשל בעלייה.
 */
export async function loadLastDocument(): Promise<LastDocument | null> {
  const raw = await tryCall<unknown>('storage.get', { key: LAST_DOCUMENT_KEY });
  if (!raw || typeof raw !== 'object') return null;

  const value = raw as Partial<LastDocument>;
  if (typeof value.token !== 'string' || value.token === '') return null;
  return {
    token: value.token,
    name: typeof value.name === 'string' && value.name !== '' ? value.name : 'מסמך',
    writable: value.writable === true,
  };
}

/** נמחק אחרי שהומר לרשומת ההפעלה — ראו ההערה על `LastDocument`. */
export async function forgetLastDocument(): Promise<void> {
  await tryCall('storage.remove', { key: LAST_DOCUMENT_KEY });
}

const SESSION_KEY = 'session';

/**
 * הרשומה הגולמית של מצב ההפעלה. הפירוש שלה — כולל אימות הגרסה והמסלול
 * ממשתמש שיש לו רק `last-document` מגרסה קודמת — יושב ב-sessions/session-state.ts,
 * כדי שההחלטות יהיו נבדקות בלי לזייף את הגשר.
 */
export async function loadSessionRecord(): Promise<unknown> {
  return tryCall<unknown>('storage.get', { key: SESSION_KEY });
}

export async function saveSessionRecord(value: unknown): Promise<void> {
  await tryCall('storage.set', { key: SESSION_KEY, value });
}

const AUTOSAVE_KEY = 'autosave-enabled';

/**
 * מתג „שמירה אוטומטית”. ברירת המחדל היא **דלוק**, וכל מה שאינו `false` מפורש
 * נקרא כדלוק: כשל קריאה או ערך פגום אינם סיבה להשאיר מסמך בלי שמירה
 * אוטומטית — הכיוון הבטוח כאן הוא לשמור יותר, לא פחות.
 */
export async function loadAutosaveEnabled(): Promise<boolean> {
  const raw = await tryCall<unknown>('storage.get', { key: AUTOSAVE_KEY });
  return raw !== false;
}

export async function saveAutosaveEnabled(enabled: boolean): Promise<void> {
  await tryCall('storage.set', { key: AUTOSAVE_KEY, value: enabled });
}

const RULER_KEY = 'ruler-visible';

/**
 * האם סרגל המידות מוצג. ברירת המחדל **כבויה**, כמו ב-Word מ-2013 ואילך.
 *
 * למה זה נשמר בכלל: מצב הסרגל יושב על מופע המנוע (`config.rulers`), ומופע חדש
 * נולד בכל פתיחת מסמך — כלומר בלי הזיכרון הזה הסרגל היה נכבה בכל פעם שמסמך
 * נפתח. ב-Word זו העדפה של התוכנה ולא תכונה של המסמך, וכך גם כאן.
 */
export async function loadRulerVisible(): Promise<boolean> {
  return (await tryCall<unknown>('storage.get', { key: RULER_KEY })) === true;
}

export async function saveRulerVisible(visible: boolean): Promise<void> {
  await tryCall('storage.set', { key: RULER_KEY, value: visible });
}

/** נשמר בנפרד מ-tryCall כדי שכשל בכתיבה לא ייעלם בשקט בקריאה מפורשת. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await call('storage.set', { key, value });
}

/**
 * הגדרה גנרית לפי מפתח — לזיכרון של דיאלוגים (composables/useRememberedOptions.ts).
 *
 * `fallback` חוזר גם כשאין ערך, גם בכשל קריאה וגם מחוץ לאוצריא: זיכרון של
 * דיאלוג אינו סיבה שהדיאלוג לא ייפתח. האימות של הצורה נעשה אצל הקורא —
 * כאן רק ההבחנה בין „יש משהו” ל„אין”.
 */
export async function loadSetting<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): Promise<T> {
  const raw = await tryCall<unknown>('storage.get', { key });
  if (raw === null || raw === undefined) return fallback;
  return parse(raw) ?? fallback;
}

/** כתיבה שקטה — כשל בשמירת זיכרון של דיאלוג אינו כשל של הכלי. */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  await tryCall('storage.set', { key, value });
}

const SPELLCHECK_KEY = 'spellcheck-enabled';

/**
 * האם בדיקת האיות התורנית דלוקה. ברירת המחדל **כבויה**, ולא במקרה: הדלקה
 * מושכת את המילון (1.3MB בנכס נפרד, engine/spellcheck-dictionary.ts), ומשתמש
 * שלא ביקש אותה לא אמור לשלם עליו.
 *
 * העדפה של התוכנה ולא תכונה של המסמך — כמו הסרגל שמעל, ומאותה סיבה: המצב
 * חי על שכבת התצוגה שלנו, ומסמך חדש היה מכבה אותה בכל פתיחה.
 */
export async function loadSpellcheckEnabled(): Promise<boolean> {
  return (await tryCall<unknown>('storage.get', { key: SPELLCHECK_KEY })) === true;
}

export async function saveSpellcheckEnabled(enabled: boolean): Promise<void> {
  await tryCall('storage.set', { key: SPELLCHECK_KEY, value: enabled });
}

const SPELLCHECK_WORDS_KEY = 'spellcheck-user-words';

/**
 * מילון המשתמש — מה שנוסף דרך „הוסף למילון” בתפריט ההקשר.
 *
 * נשמר לבד, ולא כעותק של המילון הקבוע: 102,465 הערכים אינם עוברים ב-`storage`
 * לעולם. ערך פגום נקרא כרשימה ריקה — מילון משתמש שאבד אינו סיבה להיכשל
 * בעלייה, והמשתמש פשוט יוסיף שוב.
 */
export async function loadSpellcheckWords(): Promise<string[]> {
  const raw = await tryCall<unknown>('storage.get', { key: SPELLCHECK_WORDS_KEY });
  if (!Array.isArray(raw)) return [];
  return raw.filter((word): word is string => typeof word === 'string' && word.length > 0);
}

export async function saveSpellcheckWords(words: readonly string[]): Promise<void> {
  await tryCall('storage.set', { key: SPELLCHECK_WORDS_KEY, value: [...words] });
}
