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
  it('מבקשת docx בלבד ומחזירה את הקובץ', async () => {
    const call = hostReturns({
      cancelled: false,
      token: 'tok',
      url: 'http://127.0.0.1:1/f',
      name: 'חידושים.docx',
      size: 1234,
    });

    await expect(pickDocxFile()).resolves.toEqual({
      token: 'tok',
      url: 'http://127.0.0.1:1/f',
      name: 'חידושים.docx',
      size: 1234,
    });
    expect(call).toHaveBeenCalledWith('fs.pickUserFile', { extensions: ['docx'] });
  });

  it('מעבירה כותרת לדיאלוג כשנמסרה', async () => {
    const call = hostReturns({ cancelled: true });

    await pickDocxFile('בחר מסמך');

    expect(call).toHaveBeenCalledWith('fs.pickUserFile', {
      extensions: ['docx'],
      title: 'בחר מסמך',
    });
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
