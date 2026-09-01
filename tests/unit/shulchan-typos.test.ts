/**
 * „שגיאות מצויות” — הכללים הטהורים (תרגום ה-wildcards של המקור) והריצה מול
 * הכפיל: מה נשלח ל-`doc.replace`, מה נמחק ב-`blocks.delete`, ומה הטקסט הסופי.
 */
import { describe, expect, it } from 'vitest';
import {
  applyEditsToText,
  defaultTyposOptions,
  ruleEdits,
  runTypos,
  typosSummaryText,
  type TyposOptions,
} from '../../src/engine/shulchan/typos';
import { fakeShulchanHost } from './shulchan-fake';

function applyRule(rule: keyof TyposOptions, text: string): string {
  return applyEditsToText(text, ruleEdits(rule, text));
}

describe('shulchan/typos — הכללים הטהורים', () => {
  it('רווחים כפולים מתמזגים לאחד', () => {
    expect(applyRule('extraSpaces', 'שלום  עולם   טוב')).toBe('שלום עולם טוב');
  });

  it('רווח לפני פיסוק עובר אל אחריו, בלי לייצר רווח כפול', () => {
    expect(applyRule('spaceBeforePunctuation', 'שלום , עולם')).toBe('שלום, עולם');
    expect(applyRule('spaceBeforePunctuation', 'שלום ,עולם')).toBe('שלום, עולם');
    expect(applyRule('spaceBeforePunctuation', 'שלום .')).toBe('שלום.');
  });

  it('סימני פיסוק כפולים מצטמצמים לאחרון, ושתי נקודות בדיוק — לאחת', () => {
    expect(applyRule('doublePunctuation', 'מה?? כן!!')).toBe('מה? כן!');
    expect(applyRule('doublePunctuation', 'סוף.. התחלה')).toBe('סוף. התחלה');
    // שלוש נקודות — אליפסה לגיטימית, הכלל של „בדיוק שתיים” אינו נוגע בה.
    expect(applyRule('doublePunctuation', 'המשך... כן')).toBe('המשך... כן');
  });

  it('ארבע נקודות ומעלה מתקצרות לשלוש', () => {
    expect(applyRule('manyDots', 'רגע.... עוד.......')).toBe('רגע... עוד...');
  });

  it('רווחים בצד הפנימי של סוגריים מתוקנים לשני הכיוונים', () => {
    expect(applyRule('bracketSpaces', 'שלום ( עולם ) טוב')).toBe('שלום (עולם) טוב');
    expect(applyRule('bracketSpaces', 'שלום( עולם )טוב')).toBe('שלום (עולם) טוב');
  });

  it('רווחי קצה פסקה נמחקים', () => {
    expect(applyRule('paragraphEdgeSpaces', '  שלום עולם ')).toBe('שלום עולם');
    expect(applyRule('paragraphEdgeSpaces', '   ')).toBe('');
  });

  it('זוג גרשים בודדים הופך לגרשיים', () => {
    expect(applyRule('doubleApostrophes', "רש''י")).toBe('רש"י');
  });

  it('אות אנגלית של Shift אחרי גרשיים מוחלפת לעברית הנכונה', () => {
    expect(applyRule('shiftedHebrewAfterQuote', 'אמר "Tבא')).toBe('אמר "אבא');
    expect(applyRule('shiftedHebrewAfterQuote', '"A"')).toBe('"ש"');
    expect(applyRule('shiftedHebrewAfterQuote', '"Q')).toBe('"Q'); // אין מיפוי — נשאר
  });
});

describe('shulchan/typos — ריצה מול המסמך', () => {
  it('מחיל את הכללים שנבחרו ומדווח מניין תיקונים', async () => {
    const { host, textOf } = fakeShulchanHost({
      blocks: [{ blockId: 'p1', text: 'שלום  עולם , טוב' }],
    });
    const options = { ...defaultTyposOptions(), shiftedHebrewAfterQuote: false };
    const result = await runTypos(host, options);

    expect(result.ok).toBe(true);
    expect(result.fixes).toBe(2);
    expect(textOf('p1')).toBe('שלום עולם, טוב');
  });

  it('מוחק פסקאות ריקות אבל משאיר בלוק אחרון במסמך', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [
        { blockId: 'p1', text: 'טקסט' },
        { blockId: 'p2', text: '' },
        { blockId: 'p3', text: '' },
      ],
    });
    const options: TyposOptions = { ...defaultTyposOptions(), emptyParagraphs: true };
    const result = await runTypos(host, options);

    expect(result.ok).toBe(true);
    expect(result.removedParagraphs).toBe(2);
    expect(calls.deletedBlocks).toEqual(['p2', 'p3']);
  });

  it('מסמך שכולו פסקאות ריקות אינו מתרוקן לגמרי', async () => {
    const { host, calls } = fakeShulchanHost({
      blocks: [
        { blockId: 'p1', text: '' },
        { blockId: 'p2', text: '' },
      ],
    });
    const options: TyposOptions = { ...defaultTyposOptions(), emptyParagraphs: true };
    const result = await runTypos(host, options);

    expect(result.ok).toBe(true);
    expect(result.removedParagraphs).toBe(1);
    expect(calls.deletedBlocks).toEqual(['p1']);
  });

  it('בלי מסמך — כשל סגור עם הודעה', async () => {
    const result = await runTypos(null, defaultTyposOptions());
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('נוסח הסיכום', () => {
    expect(typosSummaryText({ ok: true, fixes: 0, removedParagraphs: 0 })).toBe('לא נמצאו שגיאות לתיקון');
    expect(typosSummaryText({ ok: true, fixes: 3, removedParagraphs: 1 })).toBe('בוצעו 3 תיקונים, נמחקו 1 פסקאות ריקות');
  });
});
