/**
 * שלושת הכפתורים בלשונית „אוצריא” הציגו הודעת סטטוס ולא עשו כלום. הבדיקות
 * כאן מקבעות את שני הצדדים של התיקון: שה-RPC נשלח עם ה-payload שאוצריא מצפה
 * לו, ושכל צורת כשל — הרשאה, פרמטר פסול, סירוב, זריקה, תשובה בצורה לא צפויה —
 * מגיעה כהודעה בעברית ולא כשקט.
 *
 * הכפיל מאמת את ה-input ואינו מחזיר `true` לכל קריאה: הכפיל ההפוך (שהיה ב-
 * ribbon-commands.test.ts) אישר בירוק payloads שהצד השני דוחה.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  READER_PERMISSIONS,
  goTo,
  normalizeSelectedText,
  openLibrary,
  openSearchTab,
} from '../../src/host/otzaria-reader';

/** כפיל שמצליח ומחזיר את מה שאוצריא מתועדת כמחזירה. */
function hostReturns(data: unknown): ReturnType<typeof vi.fn> {
  const call = vi.fn(async () => ({ success: true, data, error: null }));
  window.Otzaria = { call } as never;
  return call;
}

/** כפיל שנכשל עם קוד ואת ההודעה שאוצריא נותנת. */
function hostFails(code: string, message: string): ReturnType<typeof vi.fn> {
  const call = vi.fn(async () => ({ success: false, data: null, error: { code, message } }));
  window.Otzaria = { call } as never;
  return call;
}

afterEach(() => {
  delete (window as Partial<Window>).Otzaria;
  vi.restoreAllMocks();
});

describe('openLibrary', () => {
  it('קוראת ל-navigation.goTo עם היעד library', async () => {
    const call = hostReturns(true);

    await expect(openLibrary()).resolves.toEqual({ ok: true, value: undefined });
    expect(call).toHaveBeenCalledWith('navigation.goTo', { target: 'library' });
  });

  it('הרשאה חסרה מגיעה כהודעה שאומרת איזו הרשאה חסרה', async () => {
    hostFails('error.permission_denied', 'permission denied');

    const outcome = await openLibrary();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('permission-denied');
    expect(outcome.message).toContain('navigation.write');
  });

  it('גם הקוד בלי התחילית error. מזוהה כהרשאה חסרה', async () => {
    // טבלת ה-RPC bridge בתיעוד כותבת `permission_denied` בלי התחילית.
    hostFails('permission_denied', 'denied');

    const outcome = await openLibrary();

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('permission-denied');
  });

  it('סירוב מפורש של אוצריא הוא כשל ולא הצלחה שקטה', async () => {
    hostReturns(false);

    const outcome = await openLibrary();

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('refused');
    expect(outcome.message).toContain('לא ביצעה');
  });

  it('תשובה בצורה לא צפויה נרשמת ללוג ואינה מוצגת כשגיאה', async () => {
    // ה-stub של הפיתוח מחזיר null לכל מתודה שאינה ממומשת בו, וגרסת מארח
    // אחרת עשויה להחזיר צורה אחרת. אזעקת שקר על מסך שהתחלף גרועה מלוג.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hostReturns(null);

    await expect(openLibrary()).resolves.toEqual({ ok: true, value: undefined });
    expect(warn).toHaveBeenCalled();
  });

  it('RPC שזורק מגיע כהודעה ולא מפיל את הקורא', async () => {
    window.Otzaria = {
      call: vi.fn(async () => {
        throw new Error('הגשר מת');
      }),
    } as never;

    const outcome = await openLibrary();

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.message).toContain('הגשר מת');
  });

  it('בלי SDK כלל הכשל הוא הודעה בעברית', async () => {
    const outcome = await openLibrary();

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.message).toContain('ה-SDK של אוצריא אינו זמין');
  });
});

describe('goTo', () => {
  it('מעבירה את היעד שהתבקש', async () => {
    const call = hostReturns(true);

    await goTo('settings');

    expect(call).toHaveBeenCalledWith('navigation.goTo', { target: 'settings' });
  });
});

describe('openSearchTab', () => {
  it('שולחת את השאילתה בלי לכפות autoSearch', async () => {
    // ברירת המחדל של אוצריא היא `true`, וזה מה שנדרש: המשתמש סימן טקסט
    // וביקש לחפש אותו. שליחת המפתח במפורש הייתה קיבוע מיותר של ברירת מחדל.
    const call = hostReturns(true);

    await expect(openSearchTab({ query: 'ברכת המזון' })).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(call).toHaveBeenCalledWith('reader.openSearchTab', { query: 'ברכת המזון' });
  });

  it('מעבירה שדות נוספים כפי שנמסרו', async () => {
    const call = hostReturns(true);

    await openSearchTab({ query: 'ואהבת', autoSearch: false });

    expect(call).toHaveBeenCalledWith('reader.openSearchTab', {
      query: 'ואהבת',
      autoSearch: false,
    });
  });

  it('פרמטר פסול מגיע עם הקוד של אוצריא', async () => {
    hostFails('error.invalid_params', 'unknown setting');

    const outcome = await openSearchTab({ query: 'x' });

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('error.invalid_params');
    expect(outcome.message).toContain('unknown setting');
  });

  it('הרשאה חסרה מצביעה על reader.open', async () => {
    hostFails('error.permission_denied', 'denied');

    const outcome = await openSearchTab({ query: 'x' });

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.message).toContain('reader.open');
  });
});

describe('READER_PERMISSIONS', () => {
  it('כל מתודה שהמודול קורא לה ממופה להרשאה', () => {
    expect(READER_PERMISSIONS['reader.getSelection']).toBe('reader.open');
    expect(READER_PERMISSIONS['reader.openSearchTab']).toBe('reader.open');
    expect(READER_PERMISSIONS['navigation.goTo']).toBe('navigation.write');
  });
});

describe('normalizeSelectedText', () => {
  it('מאחדת רווחים ושברי שורה לשורה אחת', () => {
    expect(normalizeSelectedText('  ויאמר\n אלהים \t יהי  אור ')).toBe('ויאמר אלהים יהי אור');
  });

  it('אינה נוגעת בניקוד ובטעמים', () => {
    expect(normalizeSelectedText('וַיֹּ֥אמֶר אֱלֹהִ֖ים')).toBe('וַיֹּ֥אמֶר אֱלֹהִ֖ים');
  });

  it('בחירה ריקה או שאינה מחרוזת מחזירה מחרוזת ריקה', () => {
    expect(normalizeSelectedText('   \n ')).toBe('');
    expect(normalizeSelectedText(undefined as unknown as string)).toBe('');
  });
});
