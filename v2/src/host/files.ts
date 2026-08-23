/**
 * קבצי משתמש דרך ה-SDK של אוצריא.
 *
 * הבייטים אינם עוברים בגשר ה-JS בשני הכיוונים. בקריאה: אוצריא מגישה את הקובץ
 * משרת loopback ומחזירה `url` שנמסר ישירות ל-`Config.document` של SuperDoc.
 * בכתיבה: התוסף מקבל `uploadUrl` ושולח אליו PUT יחיד, וה-commit הוא שמחליט
 * לאן הבייטים נכתבים. ה-url תקף לריצה אחת בלבד — הפורט משתנה בכל הפעלה —
 * ולכן ה-token הוא מה שנשמר, ובעלייה חוזרת קוראים `fs.resolveFileUrl`.
 */
import { call, tryCall } from './otzaria-client';
import { DOCX_MIME } from '../engine/export';

export interface UserFile {
  token: string;
  url: string;
  name: string;
  size: number;
  /** קיים מ-0.9.97. `readwrite` = ה-token יכול לשמש כיעד כתיבה. */
  access?: 'read' | 'readwrite';
}

interface PickResponse extends Partial<UserFile> {
  cancelled?: boolean;
}

/**
 * פותחת את בורר הקבצים של אוצריא. `null` = המשתמש ביטל — זה אינו כשל, ואין
 * לפרק בגללו את המסמך הפתוח.
 *
 * `readwrite` מבקש token שניתן לכתוב אליו בחזרה בלי דיאלוג נוסף. אם ההרשאה
 * חסרה, הבקשה נכשלת — ולכן נופלים לקריאה בלבד: עדיף מסמך שנפתח ואינו נשמר
 * מאשר מסמך שלא נפתח.
 */
export async function pickDocxFile(
  options: { title?: string; access?: 'read' | 'readwrite' } = {},
): Promise<UserFile | null> {
  const { title, access = 'readwrite' } = options;

  const request = async (mode: 'read' | 'readwrite'): Promise<UserFile | null> => {
    const res = await call<PickResponse>('fs.pickUserFile', {
      extensions: ['docx'],
      access: mode,
      ...(title ? { title } : {}),
    });
    if (!res || res.cancelled || !res.token || !res.url) return null;
    return {
      token: res.token,
      url: res.url,
      name: res.name ?? 'מסמך',
      size: res.size ?? 0,
      access: res.access ?? mode,
    };
  };

  try {
    return await request(access);
  } catch (error) {
    if (access === 'read' || !isPermissionDenied(error)) throw error;
    console.warn('[otzaria-word] אין הרשאת כתיבה; נפתח לקריאה בלבד', error);
    return request('read');
  }
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof Error && error.message.includes('permission_denied');
}

export interface WriteTicket {
  writeToken: string;
  uploadUrl: string;
  maxBytes: number;
}

export interface CommitResult {
  cancelled: boolean;
  token?: string;
  name?: string;
  size?: number;
}

/** פותחת העלאה. `expectedSize` מאפשר דחייה מוקדמת של קובץ גדול מדי. */
export async function beginBinaryWrite(expectedSize: number): Promise<WriteTicket> {
  const res = await call<Partial<WriteTicket>>('fs.beginBinaryWrite', {
    purpose: 'user-file',
    expectedSize,
  });
  if (!res?.writeToken || !res.uploadUrl) {
    throw new Error('אוצריא לא החזירה יעד לשמירה');
  }
  return {
    writeToken: res.writeToken,
    uploadUrl: res.uploadUrl,
    maxBytes: res.maxBytes ?? 0,
  };
}

/**
 * שולחת את הבייטים ב-PUT יחיד. לא עוברת בגשר — `fetch` ישירות לשרת ה-loopback.
 * `keepalive` אינו בשימוש בכוונה: הוא מוגבל לגוף קטן, וכאן מדובר במסמך.
 */
export async function uploadBytes(uploadUrl: string, blob: Blob): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || DOCX_MIME },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`העלאת המסמך נכשלה (${response.status})`);
  }
}

/**
 * מבטל העלאה שלא תגיע ל-commit — למשל שמירה שהמסמך שלה הוחלף באמצע. בלי זה
 * הקובץ הזמני והסלוט במכסה נתפסים עד שה-token פג (שתי דקות).
 *
 * לא זורק: זהו ניקוי, ואם הוא נכשל אין למשתמש מה לעשות עם זה.
 */
export async function abortBinaryWrite(writeToken: string): Promise<void> {
  const ok = await tryCall<boolean>('fs.abortBinaryWrite', { writeToken });
  if (ok !== true) {
    console.warn('[otzaria-word] ביטול ההעלאה לא הושלם', writeToken);
  }
}

export interface CommitOptions {
  writeToken: string;
  /** יעד קיים לכתיבה. בלעדיו נפתח „שמור בשם”. */
  targetToken?: string;
  suggestedName?: string;
  title?: string;
}

/** כותבת את ההעלאה לקובץ. `cancelled` פירושו שהמשתמש סגר את „שמור בשם”. */
export async function commitUserFileWrite(options: CommitOptions): Promise<CommitResult> {
  const { writeToken, targetToken, suggestedName, title } = options;
  const res = await call<CommitResult>('fs.commitUserFileWrite', {
    writeToken,
    ...(targetToken ? { targetToken } : {}),
    ...(suggestedName ? { suggestedName } : {}),
    ...(title ? { title } : {}),
    extension: 'docx',
  });
  if (!res) throw new Error('השמירה לא הושלמה');
  if (res.cancelled) return { cancelled: true };
  if (!res.token) throw new Error('השמירה הושלמה בלי מזהה קובץ');
  return res;
}

/**
 * ממירה token שמור ל-URL חדש. `null` פירושו שהקובץ הוזז, נמחק, או שההרשאה
 * בוטלה — המשתמש צריך לבחור אותו מחדש, ולא לקבל לולאת שגיאה.
 */
export async function resolveFileUrl(token: string): Promise<UserFile | null> {
  try {
    const res = await call<Partial<UserFile>>('fs.resolveFileUrl', { token });
    if (!res?.url) return null;
    return { token, url: res.url, name: res.name ?? 'מסמך', size: res.size ?? 0 };
  } catch {
    return null;
  }
}
