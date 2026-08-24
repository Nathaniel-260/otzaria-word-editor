/**
 * מה שנשמר בין הפעלות הוא token אטום, לא bytes ולא URL — ה-URL תקף לריצה
 * אחת. ערך פגום או כשל קריאה אינם סיבה להיכשל בעלייה, ולכן שניהם מוחזרים
 * כ-null ולא כשגיאה.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  forgetLastDocument,
  loadAutosaveEnabled,
  loadLastDocument,
  saveAutosaveEnabled,
  saveLastDocument,
} from '../../src/host/settings';

function hostReturns(data: unknown): ReturnType<typeof vi.fn> {
  const call = vi.fn(async () => ({ success: true, data, error: null }));
  window.Otzaria = { call } as never;
  return call;
}

afterEach(() => {
  delete (window as Partial<Window>).Otzaria;
});

describe('loadLastDocument', () => {
  it('מחזיר את המסמך שנשמר', async () => {
    const call = hostReturns({ token: 'tok', name: 'א.docx', writable: true });

    await expect(loadLastDocument()).resolves.toEqual({
      token: 'tok',
      name: 'א.docx',
      writable: true,
    });
    expect(call).toHaveBeenCalledWith('storage.get', { key: 'last-document' });
  });

  it('משלים שם חסר ומתייחס ל-writable חסר כקריאה בלבד', async () => {
    hostReturns({ token: 'tok' });

    await expect(loadLastDocument()).resolves.toEqual({
      token: 'tok',
      name: 'מסמך',
      writable: false,
    });
  });

  it('ערך בלי token מוחזר כ-null', async () => {
    hostReturns({ name: 'א.docx' });

    await expect(loadLastDocument()).resolves.toBeNull();
  });

  it('ערך שאינו אובייקט מוחזר כ-null', async () => {
    hostReturns('לא-אובייקט');

    await expect(loadLastDocument()).resolves.toBeNull();
  });

  it('כשל של ה-Host מוחזר כ-null ולא כשגיאה', async () => {
    window.Otzaria = {
      call: vi.fn(async () => ({
        success: false,
        data: null,
        error: { code: 'error.internal', message: 'boom' },
      })),
    } as never;

    await expect(loadLastDocument()).resolves.toBeNull();
  });

  it('היעדר SDK אינו מפיל את העלייה', async () => {
    await expect(loadLastDocument()).resolves.toBeNull();
  });
});

describe('saveLastDocument / forgetLastDocument', () => {
  it('שומר token, שם ומצב כתיבה', async () => {
    const call = hostReturns(true);

    await saveLastDocument({ token: 'tok', name: 'א.docx', writable: true });

    expect(call).toHaveBeenCalledWith('storage.set', {
      key: 'last-document',
      value: { token: 'tok', name: 'א.docx', writable: true },
    });
  });

  it('שוכח את המסמך', async () => {
    const call = hostReturns(true);

    await forgetLastDocument();

    expect(call).toHaveBeenCalledWith('storage.remove', { key: 'last-document' });
  });
});

/**
 * המתג „שמירה אוטומטית”. הכיוון הבטוח כאן הוא **דלוק**: כשל קריאה או ערך
 * פגום אינם סיבה להשאיר מסמך בלי שמירה אוטומטית, ולכן רק `false` מפורש מכבה.
 */
describe('loadAutosaveEnabled / saveAutosaveEnabled', () => {
  it('קורא כיבוי מפורש', async () => {
    const call = hostReturns(false);

    await expect(loadAutosaveEnabled()).resolves.toBe(false);
    expect(call).toHaveBeenCalledWith('storage.get', { key: 'autosave-enabled' });
  });

  it('מפתח שלא נשמר מעולם נקרא כדלוק', async () => {
    hostReturns(null);

    await expect(loadAutosaveEnabled()).resolves.toBe(true);
  });

  it('ערך פגום וכשל של ה-Host נקראים כדלוק ולא כשגיאה', async () => {
    hostReturns('כן');
    await expect(loadAutosaveEnabled()).resolves.toBe(true);

    // בלי SDK בכלל — הכיוון הבטוח נשמר.
    delete (window as Partial<Window>).Otzaria;
    await expect(loadAutosaveEnabled()).resolves.toBe(true);
  });

  it('שומר את הבחירה', async () => {
    const call = hostReturns(true);

    await saveAutosaveEnabled(false);

    expect(call).toHaveBeenCalledWith('storage.set', {
      key: 'autosave-enabled',
      value: false,
    });
  });
});
