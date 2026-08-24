/**
 * „התחל בעמוד חדש”. הבדיקה היא על **מה נשלח למנוע** ועל הדיווח — שההחלה
 * עצמה עובדת נבדק באימות בדפדפן.
 *
 * מה שנבדק כאן במיוחד: `NO_OP` אינו שגיאה, וכל מסלול כשל מחזיר תוצאה מטופסת
 * ולא זריקה. הוולידטורים של ה-Document API זורקים `INVALID_INPUT` על קלט
 * פסול במקום להחזיר קבלה, וחריגה מפקד ב-Ribbon מפילה את רינדור הרצועה כולה.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PAGE_BREAK_OPERATION,
  readPageBreakSupport,
  startParagraphOnNewPage,
  type PageBreakDocumentApi,
} from '../../src/engine/page-break';

const CARET = {
  target: { kind: 'text', segments: [{ blockId: 'p3', range: { start: 2, end: 2 } }] },
};

/**
 * מופע כפול. `flow` הוא מה ש-`setFlowOptions` יחזיר, ו-`calls` אוסף את הקלט
 * כדי שהבדיקה תראה מה בדיוק נשלח.
 */
function fakeDoc(
  options: {
    flow?: (input: unknown) => unknown;
    available?: boolean;
    capabilities?: PageBreakDocumentApi['capabilities'];
    selection?: unknown;
    omitFlow?: boolean;
  } = {},
) {
  // הדחיפה ל-`calls` נעשית **רק** בעטיפה, ולא גם ב-`flow`: כפילות שם הייתה
  // מייצרת שתי רשומות לקריאה אחת, וטענה על „נקרא פעם אחת” הייתה עוברת בטעות.
  const calls: unknown[] = [];
  const flow = options.flow ?? (() => ({ success: true }));

  const doc = {
    selection: { current: vi.fn(async () => options.selection ?? CARET) },
    capabilities:
      options.capabilities === undefined
        ? {
            get: async () => ({
              operations: { [PAGE_BREAK_OPERATION]: { available: options.available ?? true } },
            }),
          }
        : options.capabilities,
    ...(options.omitFlow
      ? {}
      : {
          format: {
            paragraph: {
              setFlowOptions: (input: unknown) => {
                calls.push(input);
                return flow(input) as never;
              },
            },
          },
        }),
  } as unknown as PageBreakDocumentApi;

  return { doc, calls, host: { activeEditor: { doc } } };
}

describe('readPageBreakSupport', () => {
  it('זמין כשהמנוע מדווח שהפעולה זמינה', async () => {
    const { host } = fakeDoc();

    await expect(readPageBreakSupport(host)).resolves.toEqual({
      available: true,
      explanation: '',
    });
  });

  it('פעולה שאינה זמינה מקבלת את הנוסח של §12', async () => {
    const { host } = fakeDoc({ available: false });

    await expect(readPageBreakSupport(host)).resolves.toEqual({
      available: false,
      explanation: 'הפעולה אינה זמינה בגרסה הזאת של המנוע',
    });
  });

  it('פעולה שאינה בטבלה בכלל = גרסה שאינה מכירה אותה', async () => {
    const { host } = fakeDoc({ capabilities: { get: async () => ({ operations: {} }) } });

    await expect(readPageBreakSupport(host)).resolves.toMatchObject({ available: false });
  });

  it('גרסה שאינה חושפת setFlowOptions מסומנת „אינו זמין בגרסה זו”', async () => {
    const { host } = fakeDoc({ omitFlow: true });

    await expect(readPageBreakSupport(host)).resolves.toEqual({
      available: false,
      explanation: 'אינו זמין בגרסה זו',
    });
  });

  it('אין Document API — „המסמך עדיין נטען”, ולא זריקה', async () => {
    for (const host of [null, undefined, { activeEditor: null }, { activeEditor: { doc: null } }]) {
      await expect(readPageBreakSupport(host)).resolves.toEqual({
        available: false,
        explanation: 'המסמך עדיין נטען',
      });
    }
  });

  it('אין capabilities לשאול — נכשל סגור', async () => {
    const { host } = fakeDoc({ capabilities: {} });

    await expect(readPageBreakSupport(host)).resolves.toMatchObject({ available: false });
  });

  it('קריאת יכולות שזורקת אינה מפילה את הרצועה', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { host } = fakeDoc({
      capabilities: {
        get: () => {
          throw new Error('boom');
        },
      },
    });

    await expect(readPageBreakSupport(host)).resolves.toMatchObject({ available: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('תשובה שאינה אובייקט אינה תשובה', async () => {
    const { host } = fakeDoc({ capabilities: { get: async () => undefined } });

    await expect(readPageBreakSupport(host)).resolves.toMatchObject({ available: false });
  });
});

describe('startParagraphOnNewPage', () => {
  it('שולחת pageBreakBefore על הפסקה שבה הסמן', async () => {
    const { host, calls } = fakeDoc();

    await expect(startParagraphOnNewPage(host)).resolves.toEqual({ ok: true });
    expect(calls).toEqual([
      {
        target: { kind: 'block', nodeType: 'paragraph', nodeId: 'p3' },
        pageBreakBefore: true,
      },
    ]);
  });

  it('`nodeType: paragraph` גם לכותרת — פתרון היעד לפי nodeId בלבד', async () => {
    // זה מה ש-`paragraphTarget` של ה-controller עצמו שולח לכל
    // `format.paragraph.*`, ולכן זו הצורה הנכונה ולא קיצור דרך.
    const { host, calls } = fakeDoc({
      selection: { target: { kind: 'text', segments: [{ blockId: 'h1', range: { start: 0, end: 0 } }] } },
    });

    await startParagraphOnNewPage(host);

    expect(calls[0]).toMatchObject({ target: { nodeType: 'paragraph', nodeId: 'h1' } });
  });

  it('בבחירה על כמה פסקאות מוחל על זו שהבחירה מתחילה בה', async () => {
    const { host, calls } = fakeDoc({
      selection: {
        target: {
          kind: 'text',
          segments: [
            { blockId: 'p1', range: { start: 4, end: 9 } },
            { blockId: 'p2', range: { start: 0, end: 3 } },
          ],
        },
      },
    });

    await startParagraphOnNewPage(host);

    expect(calls[0]).toMatchObject({ target: { nodeId: 'p1' } });
  });

  it('story נשלח כשהבחירה אינה בגוף המסמך', async () => {
    const story = { kind: 'story', storyType: 'headerFooterSlot' };
    const { host, calls } = fakeDoc({
      selection: {
        target: { kind: 'text', segments: [{ blockId: 'h1', range: { start: 0, end: 0 } }], story },
      },
    });

    await startParagraphOnNewPage(host);

    expect(calls[0]).toMatchObject({ target: { story } });
  });

  it('בגוף המסמך `story` אינו נשלח בכלל', async () => {
    // `story: null` מפורש היה נכשל בוולידציה; היעדרו פירושו גוף המסמך.
    const { host, calls } = fakeDoc();

    await startParagraphOnNewPage(host);

    const target = (calls[0] as { target: Record<string, unknown> }).target;
    expect(Object.prototype.hasOwnProperty.call(target, 'story')).toBe(false);
    expect(Object.keys(target).sort()).toEqual(['kind', 'nodeId', 'nodeType']);
  });

  it('NO_OP הוא הצלחה — הפסקה כבר מתחילה בעמוד חדש', async () => {
    // לחיצה שנייה אינה אמורה להראות שגיאה. `possibleFailureCodes` של הפעולה
    // הוא `['NO_OP']` בלבד.
    const { host } = fakeDoc({
      flow: () => ({ success: false, failure: { code: 'NO_OP', message: 'no changes' } }),
    });

    await expect(startParagraphOnNewPage(host)).resolves.toEqual({ ok: true });
  });

  it('קבלה שנכשלה מתורגמת לעברית עם הקוד', async () => {
    const { host } = fakeDoc({
      flow: () => ({ success: false, failure: { code: 'DOCUMENT_READONLY', message: 'readonly' } }),
    });

    const outcome = await startParagraphOnNewPage(host);

    expect(outcome).toMatchObject({ ok: false, reason: 'DOCUMENT_READONLY' });
    if (!outcome.ok) expect(outcome.message).toContain('לקריאה בלבד');
  });

  it('קוד שאין לו תרגום מוצג עם ההסבר של המנוע — ולא נעלם', async () => {
    const { host } = fakeDoc({
      flow: () => ({ success: false, failure: { code: 'WEIRD_CODE', message: 'something odd' } }),
    });

    const outcome = await startParagraphOnNewPage(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.message).toContain('something odd');
      expect(outcome.message).toContain('WEIRD_CODE');
    }
  });

  it('Promise נתמך בדיוק כמו קבלה סינכרונית', async () => {
    const { host } = fakeDoc({ flow: () => Promise.resolve({ success: true }) });

    await expect(startParagraphOnNewPage(host)).resolves.toEqual({ ok: true });
  });

  it('זריקה הופכת להודעה ולא מפילה את הרצועה', async () => {
    const { host } = fakeDoc({
      flow: () => {
        throw new Error('INVALID_INPUT: target is required');
      },
    });

    const outcome = await startParagraphOnNewPage(host);

    expect(outcome).toMatchObject({ ok: false, reason: 'threw' });
    if (!outcome.ok) expect(outcome.message).toContain('INVALID_INPUT');
  });

  it('בלי סמן במסמך — הודעה מדויקת ולא קריאה למנוע', async () => {
    const { host, calls } = fakeDoc({ selection: { target: null } });

    await expect(startParagraphOnNewPage(host)).resolves.toEqual({
      ok: false,
      message: 'יש למקם את הסמן במסמך',
      reason: 'selection-required',
    });
    expect(calls).toEqual([]);
  });

  it('גרסה שאינה חושפת את הפעולה מדווחת „אינו זמין בגרסה זו”', async () => {
    const { host } = fakeDoc({ omitFlow: true });

    const outcome = await startParagraphOnNewPage(host);

    expect(outcome).toMatchObject({ ok: false, reason: 'command-unsupported' });
    if (!outcome.ok) expect(outcome.message).toContain('אינו זמין בגרסה זו');
  });

  it('אין Document API — תוצאה מטופסת, לא זריקה', async () => {
    await expect(startParagraphOnNewPage(null)).resolves.toMatchObject({ ok: false });
    await expect(startParagraphOnNewPage({ activeEditor: { doc: null } })).resolves.toMatchObject({
      ok: false,
    });
  });
});
