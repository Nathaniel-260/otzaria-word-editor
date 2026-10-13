import { describe, it, expect } from 'vitest';
import { applyFixesToText, buildMenu, stopCorrecting } from '../../src/engine/autocorrect-indicator';
import { DEFAULT_AUTOCORRECT, planAutoCorrect } from '../../src/engine/autocorrect';

describe('סימון התיקון האוטומטי', () => {
  it('התפריט כמו ב-Word: חזור, הפסק, אפשרויות', () => {
    const items = buildMenu({ rule: 'table', original: 'teh', replacement: 'the' }, { stop: true, options: true });
    expect(items.map((i) => i.id)).toEqual(['undo', 'stop', 'options']);
    expect(items[0]!.label).toBe('חזור ל„teh”');
    expect(items[1]!.label).toBe('הפסק לתקן אוטומטית את „teh”');
  });

  it('פריטים בלי מטפל אינם מוצגים', () => {
    const items = buildMenu({ rule: 'table', original: 'a', replacement: 'b' }, { stop: false, options: false });
    expect(items.map((i) => i.id)).toEqual(['undo']);
  });

  it('הפסק לתקן מוריד רשומה מהטבלה', () => {
    const options = { ...DEFAULT_AUTOCORRECT, replacements: [{ from: 'teh', to: 'the' }, { from: 'x', to: 'y' }] };
    const next = stopCorrecting(options, { rule: 'table', original: 'Teh', replacement: 'The' });
    expect(next.replacements).toEqual([{ from: 'x', to: 'y' }]);
  });

  it('הפסק לתקן מכבה דגל של חוק', () => {
    const next = stopCorrecting(DEFAULT_AUTOCORRECT, { rule: 'dashes', original: '--', replacement: '—' });
    expect(next.dashes).toBe(false);
    expect(stopCorrecting(next, { rule: 'dashes', original: '--', replacement: '—' })).toBe(next);
  });

  it('היסטים אחרי החלפה מוזזים לפי מה שלפניהם', () => {
    const options = { ...DEFAULT_AUTOCORRECT, replacements: [{ from: 'teh', to: 'the' }, { from: 'abcd', to: 'x' }] };
    const text = 'abcd teh ';
    const fixes = planAutoCorrect(text, options, {});
    const applied = applyFixesToText(text, fixes);
    expect(applied.text).toBe('x the ');
    fixes.forEach((fix, i) => expect(applied.text.startsWith(fix.replacement, applied.starts[i]!)).toBe(true));
  });
});
