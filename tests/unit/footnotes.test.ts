/**
 * הוספת הערת שוליים והערת סיום.
 *
 * מה שנבדק כאן הוא בעיקר מה **לא** נשלח: `at` נשאר בחוץ כדי שההוספה תיפול על
 * הסמן (המסלול שהחוזה מגדיר לסרגל), ו-`content` הוא מחרוזת ריקה ולא טקסט
 * מקום. ומעל הכול — ש-namespace חסר מדווח „אינו זמין בגרסה זו” ולא מנסה מסלול
 * חלופי.
 */
import { describe, expect, it } from 'vitest';
import { insertNote, type FootnotesHost } from '../../src/engine/footnotes';

function fakeEngine(receipt: () => unknown = () => ({ success: true })) {
  const calls: unknown[] = [];
  const host: FootnotesHost = {
    activeEditor: {
      doc: {
        footnotes: {
          insert: (input) => {
            calls.push(input);
            // הוולידציה של המנוע: type מבין השניים, ו-content מחרוזת.
            if (input.type !== 'footnote' && input.type !== 'endnote') {
              throw new Error("footnotes.insert requires a type of 'footnote' or 'endnote'.");
            }
            if (typeof input.content !== 'string') {
              throw new Error('footnotes.insert requires a content string.');
            }
            return receipt() as never;
          },
        },
      },
    },
  };
  return { host, calls };
}

describe('insertNote', () => {
  it('שולחת type ו-content בלבד — בלי `at`, כדי שההוספה תיפול על הסמן', async () => {
    const { host, calls } = fakeEngine();

    expect(await insertNote(host, 'footnote')).toEqual({ ok: true });
    expect(calls).toEqual([{ type: 'footnote', content: '' }]);
  });

  it('הערת סיום היא אותה פעולה עם type אחר', async () => {
    const { host, calls } = fakeEngine();

    expect(await insertNote(host, 'endnote')).toEqual({ ok: true });
    expect(calls).toEqual([{ type: 'endnote', content: '' }]);
  });

  it('namespace חסר מדווח „אינו זמין בגרסה זו” ואינו מנסה מסלול אחר', async () => {
    for (const host of [
      null,
      undefined,
      {},
      { activeEditor: null },
      { activeEditor: { doc: null } },
      { activeEditor: { doc: {} } },
      { activeEditor: { doc: { footnotes: {} } } },
    ]) {
      const outcome = await insertNote(host as FootnotesHost, 'footnote');

      expect(outcome).toEqual({
        ok: false,
        message: 'הוספת הערת שוליים נכשלה: אינו זמין בגרסה זו',
        reason: 'command-unsupported',
      });
    }
  });

  it('קבלה שנכשלה מתורגמת לעברית', async () => {
    const { host } = fakeEngine(() => ({ success: false, failure: { code: 'NO_SELECTION' } }));

    expect(await insertNote(host, 'footnote')).toEqual({
      ok: false,
      message: 'הוספת הערת שוליים נכשלה: יש למקם את הסמן במסמך',
      reason: 'NO_SELECTION',
    });
  });

  it('פעולה שזורקת מדווחת ואינה מפילה את התוסף', async () => {
    const { host } = fakeEngine(() => {
      throw new Error('boom');
    });

    expect(await insertNote(host, 'endnote')).toEqual({
      ok: false,
      message: 'הוספת הערת סיום נכשלה: boom',
      reason: 'threw',
    });
  });

  it('סובלת קבלה סינכרונית וקבלה כהבטחה', async () => {
    const sync = fakeEngine(() => ({ success: true }));
    expect(await insertNote(sync.host, 'footnote')).toEqual({ ok: true });

    const async = fakeEngine(() => Promise.resolve({ success: true }));
    expect(await insertNote(async.host, 'footnote')).toEqual({ ok: true });
  });
});
