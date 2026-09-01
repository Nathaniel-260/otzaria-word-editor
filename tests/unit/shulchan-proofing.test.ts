/**
 * „סוגריים לא סגורים” ו„טקסט מתחלף” — הלוגיקה הטהורה, והחלת ההדגשות מול
 * הכפיל.
 */
import { describe, expect, it } from 'vitest';
import { scanBlockForUnclosed, scanForUnclosed } from '../../src/engine/shulchan/unclosed-parens';
import {
  alternatingRanges,
  defaultAlternatingOptions,
  runTextAlternating,
} from '../../src/engine/shulchan/text-alternating';
import { fakeShulchanHost } from './shulchan-fake';

describe('shulchan/unclosed-parens', () => {
  it('פסקה מאוזנת — כולל קינון — נקייה', () => {
    expect(scanBlockForUnclosed({ blockId: 'p', text: 'שלום (עולם [טוב] מאוד) כן' })).toEqual([]);
  });

  it('פותח ללא סוגר מדווח על מיקום הפותח', () => {
    const findings = scanBlockForUnclosed({ blockId: 'p', text: 'שלום (עולם' });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'open-without-close', start: 5, end: 6 });
  });

  it('סוגר ללא פותח וסוגר לא תואם מזוהים כל אחד בסוגו', () => {
    expect(scanBlockForUnclosed({ blockId: 'p', text: 'שלום) עולם' })[0]?.kind).toBe('close-without-open');
    // הממצאים ממוינים לפי מיקום: הפותח (0) לפני הסוגר הלא-תואם (5).
    expect(scanBlockForUnclosed({ blockId: 'p', text: '(שלום] עולם' }).map((f) => f.kind)).toEqual([
      'open-without-close',
      'mismatched-close',
    ]);
  });

  it('סורק את כל הבלוקים בסדר המסמך', () => {
    const findings = scanForUnclosed([
      { blockId: 'p1', text: 'תקין (כן)' },
      { blockId: 'p2', text: 'חסר (' },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.blockId).toBe('p2');
  });
});

describe('shulchan/text-alternating', () => {
  it('קטע ראשון מתחילת הפסקה עד תו הסיום, ואחריו קטעים בין : ל-.', () => {
    const text = 'דיבור ראשון. הסבר ארוך כאן: קטע שני. עוד הסבר: קטע שלישי. סוף';
    expect(alternatingRanges(text, defaultAlternatingOptions())).toEqual([
      { start: 0, end: 12 },
      { start: 28, end: 36 },
      { start: 47, end: 57 },
    ]);
  });

  it('פסקה בלי תו סיום — אין הדגשות', () => {
    expect(alternatingRanges('אין כאן נקודה', defaultAlternatingOptions())).toEqual([]);
  });

  it('מדגיש דרך format.apply עם bold ו-bCs', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'פתיחה. ואמרו: המשך.' }],
    });
    const result = await runTextAlternating(host, defaultAlternatingOptions());

    expect(result).toMatchObject({ ok: true, bolded: 2 });
    expect(calls.inline).toEqual([
      { blockId: 'p1', start: 0, end: 6, inline: { bold: true, bCs: true } },
      { blockId: 'p1', start: 14, end: 19, inline: { bold: true, bCs: true } },
    ]);
  });

  it('בלי בחירה — כשל סגור, לא עיבוד של כל המסמך', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'פתיחה. עוד: כן.' }],
      selected: [],
    });
    const result = await runTextAlternating(host, defaultAlternatingOptions());
    expect(result.ok).toBe(false);
    expect(calls.inline).toEqual([]);
  });
});
