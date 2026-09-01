/**
 * „המרת סוגריים ⇄ הערות שוליים” — התאמת הסוגריים הטהורה ושני כיווני ההמרה
 * מול הכפיל: סדר העיבוד (מהאחרון לראשון), מה נמחק, מה הוכנס ולאן.
 */
import { describe, expect, it } from 'vitest';
import {
  bracketRanges,
  convertBracketsToFootnotes,
  convertFootnotesToBrackets,
} from '../../src/engine/shulchan/brackets-notes';
import { fakeShulchanHost } from './shulchan-fake';

describe('shulchan/brackets-notes — bracketRanges', () => {
  it('טווחים ברמה העליונה, קינון נשאר בפנים', () => {
    expect(bracketRanges('א (ב (ג) ד) ה (ו)', 'round')).toEqual([
      { start: 2, end: 10 },
      { start: 14, end: 16 },
    ]);
  });

  it('פותח שלא נסגר — מדולג', () => {
    expect(bracketRanges('א (ב', 'round')).toEqual([]);
  });

  it('סוגריים מרובעים לפי הסוג המבוקש', () => {
    expect(bracketRanges('א [ב] (ג)', 'square')).toEqual([{ start: 2, end: 4 }]);
  });
});

describe('shulchan/brackets-notes — סוגריים ⟵ הערות', () => {
  it('כל קטע נמחק, הסמן מוצב במקומו וההערה מוכנסת עם התוכן', async () => {
    const { host, calls, textOf } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום (עולם) טוב (מאוד) סוף' }],
    });
    const result = await convertBracketsToFootnotes(host, 'round');

    expect(result).toMatchObject({ ok: true, converted: 2 });
    // מהאחרון לראשון — ההיסטים של המוקדם נשארים תקפים.
    expect(calls.replace.map((call) => call.start)).toEqual([16, 5]);
    expect(calls.insertedNotes.map((note) => note.content)).toEqual(['מאוד', 'עולם']);
    expect(textOf('p1')).toBe('שלום  טוב  סוף');
  });

  it('סוגריים ריקים אינם הופכים להערה', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום ( ) עולם' }],
    });
    const result = await convertBracketsToFootnotes(host, 'round');
    expect(result).toMatchObject({ ok: true, converted: 0 });
    expect(calls.insertedNotes).toEqual([]);
  });
});

describe('shulchan/brackets-notes — הערות ⟵ סוגריים', () => {
  it('ההערה נמחקת והתוכן חוזר לגוף בסוגריים במקום ההפניה', async () => {
    const { host, calls, textOf } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום עולם' }],
      notes: { n1: { type: 'footnote', content: 'פירוש' } },
      refs: [{ noteId: 'n1', blockId: 'p1', offset: 4 }],
    });
    const result = await convertFootnotesToBrackets(host, 'round');

    expect(result).toMatchObject({ ok: true, converted: 1 });
    expect(calls.removedNotes).toEqual(['n1']);
    expect(textOf('p1')).toBe('שלום (פירוש) עולם');
  });

  it('כתובת שפותרת להערת סיום — מדולגת, לא נמחקת', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום' }],
      notes: { n1: { type: 'endnote', content: 'סיום' } },
      refs: [{ noteId: 'n1', blockId: 'p1', offset: 2 }],
    });
    const result = await convertFootnotesToBrackets(host, 'round');
    expect(result).toMatchObject({ ok: true, converted: 0 });
    expect(calls.removedNotes).toEqual([]);
  });

  it('מנוע בלי doc.find — כשל סגור עם הסבר', async () => {
    const { host } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום' }],
      notes: { n1: { type: 'footnote', content: 'פירוש' } },
    });
    const result = await convertFootnotesToBrackets(host, 'round');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('מיקומי ההערות');
  });
});
