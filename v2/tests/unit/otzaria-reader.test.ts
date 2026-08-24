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
import type { DocReceipt } from '../../src/engine/document-api';
import type { SelectionInfoLike } from '../../src/engine/doc-selection';
import {
  READER_PERMISSIONS,
  buildCitationText,
  canInsertText,
  getReaderSelection,
  goTo,
  insertCitation,
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

describe('getReaderSelection', () => {
  it('null אינו כשל — אין בחירה, או שהטאב אינו טאב טקסט', async () => {
    const call = hostReturns(null);

    await expect(getReaderSelection()).resolves.toEqual({ ok: true, value: null });
    expect(call).toHaveBeenCalledWith('reader.getSelection', undefined);
  });

  it('תשובה בצורה לא צפויה נחשבת „אין בחירה” ולא זורקת', async () => {
    hostReturns('ויאמר');

    await expect(getReaderSelection()).resolves.toEqual({ ok: true, value: null });
  });

  it('הרשאה חסרה מצביעה על reader.open', async () => {
    hostFails('error.permission_denied', 'denied');

    const outcome = await getReaderSelection();

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.message).toContain('reader.open');
  });

  it('מחזירה את הבחירה כפי שאוצריא נתנה', async () => {
    hostReturns({ text: 'ויאמר', currentRef: 'בראשית פרק א' });

    const outcome = await getReaderSelection();

    if (!outcome.ok) throw new Error('נדרשת הצלחה');
    expect(outcome.value?.currentRef).toBe('בראשית פרק א');
  });
});

describe('buildCitationText', () => {
  it('טקסט המקור ואחריו המקור בסוגריים', () => {
    const text = buildCitationText({
      text: 'ויאמר אלהים',
      sourceSelectedText: 'וַיֹּאמֶר אֱלֹהִים',
      renderedSelectedText: 'ויאמר אלהים',
      currentRef: 'בראשית פרק א',
    } as never);

    expect(text).toBe('וַיֹּאמֶר אֱלֹהִים (בראשית פרק א)');
  });

  it('מעדיפה את טקסט המקור על מה שהוצג בקורא', () => {
    // מה שהוצג תלוי בהגדרות התצוגה של מי שסימן; הציטוט צריך לשקף את הספר.
    const text = buildCitationText({
      text: 'ויאמר',
      sourceSelectedText: 'וַיֹּאמֶר',
      renderedSelectedText: 'ויאמר',
      currentRef: null,
    } as never);

    expect(text).toBe('וַיֹּאמֶר');
  });

  it('נופלת ל-renderedSelectedText ואז לשדה הוותיק', () => {
    expect(
      buildCitationText({ text: 'א', renderedSelectedText: 'ב', currentRef: null } as never),
    ).toBe('ב');
    expect(buildCitationText({ text: 'א', currentRef: null } as never)).toBe('א');
  });

  it('שדה ריק אינו „קיים” ואינו חוסם את הגיבוי', () => {
    const text = buildCitationText({
      text: 'ויאמר',
      sourceSelectedText: '',
      renderedSelectedText: '   ',
      currentRef: null,
    } as never);

    expect(text).toBe('ויאמר');
  });

  it('בלי currentRef מכניסה את הטקסט לבדו, בלי סוגריים ריקים', () => {
    expect(buildCitationText({ text: 'ויאמר', currentRef: null } as never)).toBe('ויאמר');
    expect(buildCitationText({ text: 'ויאמר', currentRef: '  ' } as never)).toBe('ויאמר');
  });

  it('בחירה ריקה, null ותשובה שאינה אובייקט מחזירות מחרוזת ריקה', () => {
    expect(buildCitationText(null)).toBe('');
    expect(buildCitationText(undefined)).toBe('');
    expect(buildCitationText({ text: '', currentRef: 'בראשית' } as never)).toBe('');
    expect(buildCitationText('ויאמר' as never)).toBe('');
  });

  it('מאחדת שברי שורה בבחירה לפסקה אחת', () => {
    const text = buildCitationText({
      text: 'שורה ראשונה\n\nשורה שנייה',
      currentRef: 'בראשית פרק א',
    } as never);

    expect(text).toBe('שורה ראשונה שורה שנייה (בראשית פרק א)');
  });

  it('בחירה בכמה פסקאות נבנית מ-sections', () => {
    // מ-0.9.97 השדות ברמה העליונה אינם נושאים את הבחירה במלואה.
    const text = buildCitationText({
      text: '',
      currentRef: null,
      sections: [
        { sourceSelectedText: 'וַיֹּאמֶר', currentRef: 'בראשית פרק א' },
        { sourceSelectedText: 'אֱלֹהִים', currentRef: 'בראשית פרק ב' },
      ],
    } as never);

    expect(text).toBe('וַיֹּאמֶר אֱלֹהִים (בראשית פרק א)');
  });
});

describe('canInsertText', () => {
  it('דורשת doc.insert ולא רק מסמך פתוח', () => {
    expect(canInsertText(null)).toBe(false);
    expect(canInsertText({ activeEditor: null })).toBe(false);
    expect(canInsertText({ activeEditor: { doc: {} } })).toBe(false);
    expect(canInsertText({ activeEditor: { doc: { insert: () => ({ success: true }) } } })).toBe(
      true,
    );
  });
});

/** מסמך מדומה: `insert` שמאמת את הקלט, ובחירה שאפשר להחליף. */
function fakeDoc(options: {
  insert?: (input: unknown) => DocReceipt | Promise<DocReceipt>;
  selection?: SelectionInfoLike;
} = {}) {
  const insert = vi.fn(options.insert ?? (() => ({ success: true })));
  const current = vi.fn(async () => options.selection);
  return { host: { activeEditor: { doc: { insert, selection: { current } } } }, insert, current };
}

/** תצלום בחירה עם יעד שהמנוע יתרגם לכתובת טקסט. */
const CURSOR = {
  target: { kind: 'selection', segments: [{ blockId: 'p1', range: { start: 3, end: 3 } }] },
  segments: [{ blockId: 'p1', range: { start: 3, end: 3 } }],
};

describe('insertCitation', () => {
  it('מכניסה במיקום הסמן כשיש בחירה במסמך', async () => {
    const { host, insert } = fakeDoc({
      selection: { empty: true, target: CURSOR.target },
    });

    await expect(insertCitation(host, 'וַיֹּאמֶר (בראשית פרק א)')).resolves.toEqual({
      ok: true,
      value: 'at-cursor',
    });
    expect(insert).toHaveBeenCalledWith({
      value: 'וַיֹּאמֶר (בראשית פרק א)',
      type: 'text',
      target: CURSOR.target,
    });
  });

  it('בלי סמן מכניסה בסוף המסמך ומדווחת על כך', async () => {
    // החוזה של insert: „בלי target ההכנסה נעשית בסוף המסמך”. השתקה של זה
    // הייתה מחזירה את הבעיה שכל הגל הזה בא לתקן.
    const { host, insert } = fakeDoc({ selection: undefined });

    await expect(insertCitation(host, 'ויאמר')).resolves.toEqual({
      ok: true,
      value: 'document-end',
    });
    expect(insert).toHaveBeenCalledWith({ value: 'ויאמר', type: 'text' });
  });

  it('בלי doc.insert מחזירה את נוסח §12 ולא זורקת', async () => {
    const outcome = await insertCitation({ activeEditor: { doc: {} } }, 'ויאמר');

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('command-unsupported');
    expect(outcome.message).toContain('אינו זמין בגרסה זו');
  });

  it('מלל ריק נדחה לפני הקריאה למנוע', async () => {
    const { host, insert } = fakeDoc();

    const outcome = await insertCitation(host, '');

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('empty-text');
    expect(insert).not.toHaveBeenCalled();
  });

  it('קבלה כושלת מגיעה כהודעה עם קוד הכשל', async () => {
    const { host } = fakeDoc({
      insert: () => ({ success: false, failure: { code: 'READ_ONLY' } }),
    });

    const outcome = await insertCitation(host, 'ויאמר');

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('READ_ONLY');
    expect(outcome.message).toContain('הכנסת הציטוט נכשלה');
  });

  it('קבלה שמגיעה כ-Promise מטופלת כמו קבלה סינכרונית', async () => {
    const { host } = fakeDoc({ insert: () => Promise.resolve({ success: true }) });

    await expect(insertCitation(host, 'ויאמר')).resolves.toMatchObject({ ok: true });
  });

  it('insert שזורק מגיע כהודעה ולא מפיל את הרצועה', async () => {
    const { host } = fakeDoc({
      insert: () => {
        throw new Error('INVALID_INPUT');
      },
    });

    const outcome = await insertCitation(host, 'ויאמר');

    if (outcome.ok) throw new Error('נדרש כשל');
    expect(outcome.reason).toBe('threw');
  });

  it('קריאת בחירה שזורקת אינה חוסמת את ההכנסה', async () => {
    // readDocSelection לעולם אינו זורק; התוצאה היא הכנסה בסוף המסמך.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { host, insert } = fakeDoc();
    host.activeEditor.doc.selection.current = vi.fn(async () => {
      throw new Error('נפל');
    }) as never;

    await expect(insertCitation(host, 'ויאמר')).resolves.toEqual({
      ok: true,
      value: 'document-end',
    });
    expect(insert).toHaveBeenCalledWith({ value: 'ויאמר', type: 'text' });
  });
});
