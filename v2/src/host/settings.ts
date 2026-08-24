/**
 * מה שהתוסף זוכר בין הפעלות.
 *
 * ה-`storage` של אוצריא הוא KV של JSON, ולכן נשמרים בו **רק** metadata
 * ו-tokens אטומים — לא bytes ולא Blob של מסמך. ה-token הוא מה ששורד: ה-URL
 * שאוצריא מחזירה תקף לריצה אחת בלבד, כי הפורט של שרת ה-loopback מתחלף.
 */
import { call, tryCall } from './otzaria-client';

/** המסמך שהיה פתוח לאחרונה. */
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

export async function saveLastDocument(document: LastDocument): Promise<void> {
  await tryCall('storage.set', { key: LAST_DOCUMENT_KEY, value: document });
}

/** לאחר שהמשתמש פתח מסמך חדש שאין לו token, או שה-token חדל להיות תקף. */
export async function forgetLastDocument(): Promise<void> {
  await tryCall('storage.remove', { key: LAST_DOCUMENT_KEY });
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

/** נשמר בנפרד מ-tryCall כדי שכשל בכתיבה לא ייעלם בשקט בקריאה מפורשת. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await call('storage.set', { key, value });
}
