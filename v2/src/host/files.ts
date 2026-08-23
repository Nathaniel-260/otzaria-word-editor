/**
 * קבצי משתמש דרך ה-SDK של אוצריא.
 *
 * הבייטים אינם עוברים בגשר ה-JS: אוצריא מגישה את הקובץ משרת loopback פנימי
 * ומחזירה `url` שנמסר ישירות ל-`Config.document` של SuperDoc, ו-`token`
 * שנשמר להפעלה הבאה. ה-url תקף לריצה אחת בלבד — הפורט משתנה בכל הפעלה — ולכן
 * בעלייה חוזרת קוראים `fs.resolveFileUrl` עם ה-token.
 *
 * כתיבה: ל-SDK אין כיום שום API שכותב בייטים לדיסק (`fs.user_files.write`
 * אינה הרשאה קיימת). „שמור” אמיתי חסום עד שיתווסף API כתיבה — תכנית §7.
 */
import { call } from './otzaria-client';

export interface UserFile {
  token: string;
  url: string;
  name: string;
  size: number;
}

interface PickResponse extends Partial<UserFile> {
  cancelled?: boolean;
}

/**
 * פותחת את בורר הקבצים של אוצריא. `null` = המשתמש ביטל — זה אינו כשל, ואין
 * לפרק בגללו את המסמך הפתוח.
 */
export async function pickDocxFile(title?: string): Promise<UserFile | null> {
  const res = await call<PickResponse>('fs.pickUserFile', {
    extensions: ['docx'],
    ...(title ? { title } : {}),
  });

  if (!res || res.cancelled || !res.token || !res.url) return null;

  return { token: res.token, url: res.url, name: res.name ?? 'מסמך', size: res.size ?? 0 };
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
