/**
 * ביטול בבורר הקבצים אינו כשל: הוא לא אמור להשמיד מסמך פתוח ולא להציג
 * שגיאה. token שאינו נפתר פירושו קובץ שהוזז או נמחק — גם זה לא שגיאה אלא
 * מצב שדורש בחירה מחדש.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  pickDocxFile,
  pickImageFile,
  readImageAsDataUrl,
  resolveFileUrl,
  type UserFile,
} from '../../src/host/files';

function hostReturns(data: unknown): ReturnType<typeof vi.fn> {
  const call = vi.fn(async () => ({ success: true, data, error: null }));
  window.Otzaria = { call } as never;
  return call;
}

afterEach(() => {
  delete (window as Partial<Window>).Otzaria;
  vi.unstubAllGlobals();
});

describe('pickDocxFile', () => {
  it('מבקשת docx לכתיבה ומחזירה את הקובץ', async () => {
    const call = hostReturns({
      cancelled: false,
      token: 'tok',
      url: 'http://127.0.0.1:1/f',
      name: 'חידושים.docx',
      size: 1234,
      access: 'readwrite',
    });

    await expect(pickDocxFile()).resolves.toEqual({
      token: 'tok',
      url: 'http://127.0.0.1:1/f',
      name: 'חידושים.docx',
      size: 1234,
      access: 'readwrite',
    });
    // ברירת המחדל היא readwrite, אחרת „שמור” יצטרך דיאלוג בכל פעם.
    expect(call).toHaveBeenCalledWith('fs.pickUserFile', {
      extensions: ['docx'],
      access: 'readwrite',
    });
  });

  it('מעבירה כותרת לדיאלוג כשנמסרה', async () => {
    const call = hostReturns({ cancelled: true });

    await pickDocxFile({ title: 'בחר מסמך' });

    expect(call).toHaveBeenCalledWith('fs.pickUserFile', {
      extensions: ['docx'],
      access: 'readwrite',
      title: 'בחר מסמך',
    });
  });

  it('בלי הרשאת כתיבה נופלת לקריאה בלבד ולא מפילה את הפתיחה', async () => {
    const call = vi.fn(async (_method: string, payload?: Record<string, unknown>) => {
      if (payload?.access === 'readwrite') {
        return {
          success: false,
          data: null,
          error: { code: 'error.permission_denied', message: 'permission_denied' },
        };
      }
      return {
        success: true,
        data: { cancelled: false, token: 't', url: 'u', name: 'a.docx', size: 1 },
        error: null,
      };
    });
    window.Otzaria = { call } as never;

    const file = await pickDocxFile();

    expect(file?.access).toBe('read');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('שגיאה שאינה הרשאה אינה מנסה שוב', async () => {
    const call = vi.fn(async () => ({
      success: false,
      data: null,
      error: { code: 'error.internal', message: 'boom' },
    }));
    window.Otzaria = { call } as never;

    await expect(pickDocxFile()).rejects.toThrow('boom');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('ביטול מחזיר null', async () => {
    hostReturns({ cancelled: true });

    await expect(pickDocxFile()).resolves.toBeNull();
  });

  it('תשובה בלי url מחזירה null ולא אובייקט חלקי', async () => {
    hostReturns({ cancelled: false, token: 'tok' });

    await expect(pickDocxFile()).resolves.toBeNull();
  });
});

describe('resolveFileUrl', () => {
  it('מחזירה url חדש לאותו token', async () => {
    const call = hostReturns({ url: 'http://127.0.0.1:2/f', name: 'a.docx', size: 5 });

    await expect(resolveFileUrl('tok')).resolves.toEqual({
      token: 'tok',
      url: 'http://127.0.0.1:2/f',
      name: 'a.docx',
      size: 5,
    });
    expect(call).toHaveBeenCalledWith('fs.resolveFileUrl', { token: 'tok' });
  });

  it('כשל של ה-Host מחזיר null ולא זריקה', async () => {
    window.Otzaria = {
      call: vi.fn(async () => ({
        success: false,
        data: null,
        error: { code: 'error.not_found', message: 'הקובץ לא נמצא' },
      })),
    } as never;

    await expect(resolveFileUrl('tok')).resolves.toBeNull();
  });
});

describe('pickImageFile', () => {
  it('מבקשת רק את הסיומות שהמנוע מטמיע, ולקריאה בלבד', async () => {
    const call = hostReturns({
      cancelled: false,
      token: 'tok',
      url: 'http://127.0.0.1:1/i',
      name: 'ציון.png',
      size: 4096,
    });

    await expect(pickImageFile()).resolves.toEqual({
      token: 'tok',
      url: 'http://127.0.0.1:1/i',
      name: 'ציון.png',
      size: 4096,
      access: 'read',
    });

    // gif/bmp/webp אינם ברשימה בכוונה: `create.image` דוחה אותם, וסיומת
    // שתיכשל אחרי הבחירה גרועה מסיומת שלא הוצעה.
    expect(call).toHaveBeenCalledWith('fs.pickUserFile', {
      extensions: ['png', 'jpg', 'jpeg'],
      access: 'read',
      title: 'בחירת תמונה',
    });
  });

  it('ביטול מחזיר null ולא כשל', async () => {
    hostReturns({ cancelled: true });

    await expect(pickImageFile()).resolves.toBeNull();
  });

  it('תשובה בלי url מחזירה null ולא אובייקט חלקי', async () => {
    hostReturns({ cancelled: false, token: 'tok', name: 'a.png' });

    await expect(pickImageFile()).resolves.toBeNull();
  });

  it('דחיית הרשאה מגיעה לקורא ואינה נבלעת', async () => {
    // אין נפילה חזרה כמו ב-pickDocxFile: הבקשה כאן ממילא `read`, וההרשאה
    // `fs.user_files.read` היא היחידה שנדרשת. אם היא נדחתה אין מסלול שני.
    window.Otzaria = {
      call: vi.fn(async () => ({
        success: false,
        data: null,
        error: { code: 'error.permission_denied', message: 'permission_denied' },
      })),
    } as never;

    await expect(pickImageFile()).rejects.toThrow('permission_denied');
  });

  it('כשל RPC אחר מגיע לקורא', async () => {
    window.Otzaria = {
      call: vi.fn(async () => ({
        success: false,
        data: null,
        error: { code: 'error.internal', message: 'boom' },
      })),
    } as never;

    await expect(pickImageFile()).rejects.toThrow('boom');
  });
});

/** קובץ מהבורר, לצורך `readImageAsDataUrl`. */
function imageFile(overrides: Partial<UserFile> = {}): UserFile {
  return {
    token: 'tok',
    url: 'http://127.0.0.1:1/i',
    name: 'ציון.png',
    size: 8,
    access: 'read',
    ...overrides,
  };
}

/** תגובת loopback עם בייטים. `fetch` ולא הגשר — כך גם בקוד. */
function loopbackReturns(bytes: Uint8Array, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('readImageAsDataUrl', () => {
  it('ממירה את הבייטים ל-data URI — לא מעבירה את ה-URL', async () => {
    // זו נקודת אובדן הנתונים כולה: `create.image` דורש base64 data URI, ו-URL
    // של ה-loopback היה גם נדחה וגם שובר את התמונה בפתיחה הבאה.
    const fetchMock = loopbackReturns(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await readImageAsDataUrl(imageFile({ size: 4 }));

    expect(result).toEqual({ ok: true, dataUrl: 'data:image/png;base64,iVBORw==' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1/i');
  });

  it('ה-mime נגזר מהסיומת ולא מהתגובה', async () => {
    // שרת ה-loopback רשאי להחזיר `application/octet-stream`, וה-mime שב-data
    // URI הוא זה שקובע לאיזה מסלול המנוע ינתב את הבייטים.
    loopbackReturns(new Uint8Array([0xff, 0xd8, 0xff]));

    const result = await readImageAsDataUrl(imageFile({ name: 'צילום.JPG', size: 3 }));

    expect(result).toEqual({ ok: true, dataUrl: 'data:image/jpeg;base64,/9j/' });
  });

  it('סיומת שהמנוע אינו מטמיע נדחית לפני ההורדה', async () => {
    const fetchMock = loopbackReturns(new Uint8Array([1, 2, 3]));

    const result = await readImageAsDataUrl(imageFile({ name: 'הנפשה.gif' }));

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    if (!result.ok) expect(result.reason).toBe('unsupported-format');
  });

  it('webp נדחה גם הוא — המנוע פורס אותו ואז דוחה במפורש', async () => {
    const result = await readImageAsDataUrl(imageFile({ name: 'a.webp' }));

    expect(result.ok).toBe(false);
  });

  it('קובץ גדול מהמותר נדחה לפני ההורדה', async () => {
    const fetchMock = loopbackReturns(new Uint8Array([1]));

    const result = await readImageAsDataUrl(imageFile({ size: MAX_IMAGE_BYTES + 1 }));

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    if (!result.ok) expect(result.reason).toBe('too-large');
  });

  it('גודל שהבורר לא דיווח נתפס אחרי ההורדה', async () => {
    // `size: 0` פירושו „לא דווח”, ולכן הבדיקה השנייה היא זו שמגנה בפועל.
    loopbackReturns(new Uint8Array(MAX_IMAGE_BYTES + 1));

    const result = await readImageAsDataUrl(imageFile({ size: 0 }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too-large');
  });

  it('תגובה שאינה ok מוחזרת כהודעה ולא כזריקה', async () => {
    loopbackReturns(new Uint8Array([1]), { ok: false, status: 404 });

    const result = await readImageAsDataUrl(imageFile());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('fetch-failed');
      expect(result.message).toContain('404');
    }
  });

  it('זריקה של fetch הופכת להודעה בעברית', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('הרשת נפלה');
      }),
    );

    const result = await readImageAsDataUrl(imageFile());

    expect(result).toEqual({ ok: false, reason: 'fetch-threw', message: 'הרשת נפלה' });
  });

  it('קובץ ריק אינו „הצלחה עם data URI ריק”', async () => {
    // `data:image/png;base64,` היה עובר את ה-regex של המנוע ונכשל רק בפרסור
    // הכותרת, עם הודעה באנגלית על מידות.
    loopbackReturns(new Uint8Array(0));

    const result = await readImageAsDataUrl(imageFile({ size: 0 }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty');
  });

  it('קובץ גדול אינו זורק RangeError בהמרה', async () => {
    // `String.fromCharCode(...bytes)` על מערך גדול חורג ממגבלת הארגומנטים,
    // ולכן ההמרה בגושים. 200KB עוברים את גבול ה-32KB פי כמה.
    loopbackReturns(new Uint8Array(200 * 1024).fill(0x41));

    const result = await readImageAsDataUrl(imageFile({ size: 200 * 1024 }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataUrl.startsWith('data:image/png;base64,QUFB')).toBe(true);
  });
});
