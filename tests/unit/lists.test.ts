/**
 * רשימות (גל 14א). הבדיקה על **מה נשלח למנוע** — במיוחד hebrew1
 * (string חופשי בחוזה; נמדד שנכתב w:numFmt="hebrew1"), השער על numFmt
 * לא-תקני, ופתרון היעד מהבחירה דרך blocks.list.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  continuePreviousList,
  convertListToText,
  NUMBER_STYLES,
  NUMBER_STYLE_LABELS,
  restartListAt,
  setListNumberStyle,
} from '../../src/engine/lists';

const SELECTION_IN_LIST = {
  target: { segments: [{ blockId: 'li1' }] },
};

const LIST_BLOCKS = {
  blocks: [
    { nodeId: 'li1', nodeType: 'listItem' },
    { nodeId: 'p9', nodeType: 'paragraph' },
  ],
};

function fakeDoc(
  options: {
    receipts?: Record<string, unknown>;
    selection?: unknown;
    blocksList?: (input?: { offset?: number; limit?: number }) => Promise<{
      total?: number;
      blocks: Array<{ nodeId: string; nodeType: string }>;
    }>;
  } = {},
) {
  const calls = new Map<string, unknown[]>();
  const impls: Record<string, (input: unknown) => unknown> = {};
  for (const name of ['setLevelNumberStyle', 'restartAt', 'continuePrevious', 'convertToText']) {
    calls.set(name, []);
    const receipt = options.receipts?.[name] ?? { success: true };
    impls[name] = (input: unknown) => {
      calls.get(name)?.push(input);
      return receipt;
    };
  }

  const listFn = options.blocksList ?? vi.fn(async () => LIST_BLOCKS);
  const doc = {
    selection: { current: vi.fn(async () => options.selection ?? SELECTION_IN_LIST) },
    blocks: { list: listFn },
    lists: impls,
  } as never;

  return { doc, calls, host: { activeEditor: { doc } } };
}

describe('setListNumberStyle', () => {
  it('hebrew1 נשלח ברמה 0 — המספור העברי', async () => {
    const { host, calls } = fakeDoc();

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toEqual({
      target: { kind: 'block', nodeType: 'listItem', nodeId: 'li1' },
      level: 0,
      numberStyle: 'hebrew1',
    });
  });

  it('ערך מחוץ ל-numFmt של ECMA-376 נעצר — string חופשי בחוזה', async () => {
    const { host, calls } = fakeDoc();

    const outcome = await setListNumberStyle(host, 'zigzag');

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-number-style' });
    expect(calls.get('setLevelNumberStyle')).toHaveLength(0);
  });

  /**
   * `hebrew2` נוסף במעבר ל-superdoc@2.10.0. הוא לא נחסם קודם — החוזה מקבל
   * מחרוזת חופשית — אלא פשוט לא הוצע, כי הסמן צויר ריק. שני הפורמטים נמדדו
   * על ה-dist הבנוי: `hebrew1` הוא גימטריה (…יד, טו, טז, יז…) ו-`hebrew2`
   * הוא סדר האלף-בית (…י, כ, ל, מ…).
   */
  it('hebrew2 נשלח ברמה 0 — מספור לפי סדר האלף-בית', async () => {
    const { host, calls } = fakeDoc();

    const outcome = await setListNumberStyle(host, 'hebrew2');

    expect(outcome).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toEqual({
      target: { kind: 'block', nodeType: 'listItem', nodeId: 'li1' },
      level: 0,
      numberStyle: 'hebrew2',
    });
  });

  it('כל הערכים ב-NUMBER_STYLES מוכרים', () => {
    expect(NUMBER_STYLES).toContain('hebrew1');
    expect(NUMBER_STYLES).toContain('hebrew2');
    expect(NUMBER_STYLES).toContain('decimal');
  });

  it('לכל ערך ב-NUMBER_STYLES יש תווית — אחרת הוא יופיע בתפריט כמזהה גולמי', () => {
    for (const style of NUMBER_STYLES) {
      expect(NUMBER_STYLE_LABELS[style], style).toBeTruthy();
    }
  });
});

describe('resolveListItem', () => {
  it('פסקה שאינה פריט רשימה — „יש למקם את הסמן ברשימה" ולא קריאה', async () => {
    const selection = { target: { segments: [{ blockId: 'p9' }] } };
    const { host, calls } = fakeDoc({ selection });

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toMatchObject({ ok: false, reason: 'selection-required' });
    expect(calls.get('setLevelNumberStyle')).toHaveLength(0);
  });

  it('פריט רשימה שנמצא בדף השני (מעבר ל-50 בלוקים) מאותר דרך דפדוף', async () => {
    const selection = { target: { segments: [{ blockId: 'li-page-2' }] } };
    const page1 = Array.from({ length: 500 }, (_, i) => ({ nodeId: `p-${i}`, nodeType: 'paragraph' }));
    const page2 = [{ nodeId: 'li-page-2', nodeType: 'listItem' }];

    const blocksList = vi.fn(async (input?: { offset?: number; limit?: number }) => {
      const offset = input?.offset ?? 0;
      if (offset === 0) return { total: 501, blocks: page1 };
      return { total: 501, blocks: page2 };
    });

    const { host, calls } = fakeDoc({ selection, blocksList });

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toEqual({
      target: { kind: 'block', nodeType: 'listItem', nodeId: 'li-page-2' },
      level: 0,
      numberStyle: 'hebrew1',
    });
    expect(blocksList).toHaveBeenCalledTimes(2);
  });
});

describe('restartListAt', () => {
  it('startAt נשלח כמות שהוא', async () => {
    const { host, calls } = fakeDoc();

    await restartListAt(host, 5);

    expect(calls.get('restartAt')?.[0]).toMatchObject({ startAt: 5 });
  });

  it('שלילי/שברוני נעצר', async () => {
    const { host, calls } = fakeDoc();

    const outcome = await restartListAt(host, -3);

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-start' });
    expect(calls.get('restartAt')).toHaveLength(0);
  });
});

describe('continuePreviousList', () => {
  it('כשאין רשימה קודמת — קבלת הכשל מתורגמת (NO_PREVIOUS_LIST)', async () => {
    const { host } = fakeDoc({
      receipts: {
        continuePrevious: { success: false, failure: { code: 'INVALID_CONTEXT', message: 'NO_PREVIOUS_LIST' } },
      },
    });

    const outcome = await continuePreviousList(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('INVALID_CONTEXT');
  });
});

describe('convertListToText', () => {
  it('includeMarker:true נשלח — הסמן מועתק לטקסט (נמדד)', async () => {
    const { host, calls } = fakeDoc();

    await convertListToText(host);

    expect(calls.get('convertToText')?.[0]).toMatchObject({
      target: { nodeId: 'li1' },
      includeMarker: true,
    });
  });
});
