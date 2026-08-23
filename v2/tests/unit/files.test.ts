/**
 * ביטול בבורר הקבצים אינו כשל: הוא לא אמור להשמיד מסמך פתוח ולא להציג
 * שגיאה. token שאינו נפתר פירושו קובץ שהוזז או נמחק — גם זה לא שגיאה אלא
 * מצב שדורש בחירה מחדש.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickDocxFile, resolveFileUrl } from '../../src/host/files';

function hostReturns(data: unknown): ReturnType<typeof vi.fn> {
  const call = vi.fn(async () => ({ success: true, data, error: null }));
  window.Otzaria = { call } as never;
  return call;
}

afterEach(() => {
  delete (window as Partial<Window>).Otzaria;
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
