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
    blocksList?: () => Promise<{
      blocks: Array<{ nodeId: string; nodeType: string; paragraphNumbering?: unknown }>;
    }>;
    /** `lists.getState` — מזהה בלוק → isListItem. בלי המפה הפעולה חסרה (מנוע ישן). */
    listState?: Record<string, boolean>;
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

  if (options.listState) {
    const listState = options.listState;
    impls.getState = (input: unknown) => {
      const nodeId = (input as { target: { nodeId: string } }).target.nodeId;
      return nodeId in listState ? { success: true, isListItem: listState[nodeId] } : { success: false };
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

  it('פריט רשימה בתוך תא טבלה: אינו ב-blocks.list, ו-lists.getState מכריע', async () => {
    // issue #14 ג׳: blocks.list מונה בלוקים עליונים בלבד, ולכן הפריט שבטבלה
    // אינו שם — ובלי getState הפקד ענה „יש למקם את הסמן בתוך רשימה”.
    const selection = { target: { segments: [{ blockId: 'li-in-table' }] } };
    const blocksList = vi.fn(async () => ({ blocks: [{ nodeId: 'p1', nodeType: 'paragraph' }] }));
    const { host, calls } = fakeDoc({ selection, blocksList, listState: { 'li-in-table': true } });

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toMatchObject({
      target: { kind: 'block', nodeType: 'listItem', nodeId: 'li-in-table' },
    });
    expect(blocksList).not.toHaveBeenCalled();
  });

  it('כותרת ממוספרת: blocks.list אומר heading, lists.getState אומר פריט רשימה — נשלח', async () => {
    const selection = { target: { segments: [{ blockId: 'h1' }] } };
    const blocksList = vi.fn(async () => ({ blocks: [{ nodeId: 'h1', nodeType: 'heading' }] }));
    const { host, calls } = fakeDoc({ selection, blocksList, listState: { h1: true } });

    expect(await setListNumberStyle(host, 'hebrew1')).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toMatchObject({
      target: { nodeType: 'listItem', nodeId: 'h1' },
    });
  });

  it('lists.getState אומר שאינו פריט רשימה — הפקד מסביר, גם אם blocks.list היה אומר אחרת', async () => {
    const { host, calls } = fakeDoc({ listState: { li1: false } });

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toMatchObject({ ok: false, reason: 'selection-required' });
    expect(calls.get('setLevelNumberStyle')).toHaveLength(0);
  });

  it('מנוע בלי lists.getState: blocks.list בקריאה אחת, ו-paragraphNumbering נחשב פריט רשימה', async () => {
    // הנפילה לאחור. בלי ארגומנטים blocks.list מחזיר את כל הסיפור (נמדד),
    // וכותרת ממוספרת מגיעה שם כ-heading עם paragraphNumbering.
    const selection = { target: { segments: [{ blockId: 'h-numbered' }] } };
    const blocksList = vi.fn(async () => ({
      blocks: [{ nodeId: 'h-numbered', nodeType: 'heading', paragraphNumbering: { numId: 1, level: 0 } }],
    }));
    const { host, calls } = fakeDoc({ selection, blocksList });

    expect(await setListNumberStyle(host, 'hebrew1')).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')?.[0]).toMatchObject({ target: { nodeType: 'listItem', nodeId: 'h-numbered' } });
    expect(blocksList).toHaveBeenCalledTimes(1);
    expect(blocksList).toHaveBeenCalledWith();
  });

  it('getState שנכשל (success:false) או זורק — נופלים ל-blocks.list', async () => {
    // הבלוק אינו במפה → success:false → blocks.list (הכפיל: li1 הוא listItem).
    const { host: unknownHost, calls: unknownCalls } = fakeDoc({ listState: {} });
    expect(await setListNumberStyle(unknownHost, 'hebrew1')).toEqual({ ok: true });
    expect(unknownCalls.get('setLevelNumberStyle')).toHaveLength(1);

    const { host, calls, doc } = fakeDoc({ listState: {} });
    (doc as { lists: { getState: unknown } }).lists.getState = () => {
      throw new Error('boom');
    };
    expect(await setListNumberStyle(host, 'hebrew1')).toEqual({ ok: true });
    expect(calls.get('setLevelNumberStyle')).toHaveLength(1);
  });
});

/**
 * issue #14 ג׳ — „במספור פסקאות – רשימה מופיע ‚יש למקם את הסמן בתוך הרשימה׳”.
 *
 * שוחזר (scripts/qa/list-caret-qa.mjs): סמן בפסקה רגילה, תפריט המספור, „א, ב,
 * ג” — סירוב. המשתמש ביקש למספר את הפסקה; התפריט ענה שאלה טכנית על רשימה
 * קיימת. עם `createList` הפסקה הופכת קודם לרשימה — הפקודה של הכפתור — ואז
 * מקבלת את הסגנון.
 */
describe('setListNumberStyle — פסקה שאינה רשימה', () => {
  const IN_PARAGRAPH = { target: { segments: [{ blockId: 'p9' }] } };

  /** בחירה שמתחלפת: פסקה לפני `createList`, פריט רשימה אחריה — כמו במנוע. */
  function docWithConvertibleParagraph(createOutcome = { ok: true } as const) {
    let selection: unknown = IN_PARAGRAPH;
    const { host, calls, doc } = fakeDoc();
    (doc as { selection: { current: unknown } }).selection.current = vi.fn(async () => selection);
    const createList = vi.fn(async () => {
      if (createOutcome.ok) selection = SELECTION_IN_LIST;
      return createOutcome;
    });
    return { host, calls, createList };
  }

  it('יוצרת רשימה ואז מחילה את הסגנון על הפריט **החדש**', async () => {
    const { host, calls, createList } = docWithConvertibleParagraph();

    const outcome = await setListNumberStyle(host, 'hebrew1', { createList });

    expect(outcome).toEqual({ ok: true });
    expect(createList).toHaveBeenCalledTimes(1);
    expect(calls.get('setLevelNumberStyle')?.[0]).toEqual({
      target: { kind: 'block', nodeType: 'listItem', nodeId: 'li1' },
      level: 0,
      numberStyle: 'hebrew1',
    });
  });

  it('כשיצירת הרשימה נכשלה — הכשל שלה חוזר, והסגנון אינו נשלח', async () => {
    const failed = { ok: false, message: 'המנוע אינו מוכן', reason: 'not-ready' } as const;
    const { host, calls, createList } = docWithConvertibleParagraph(failed as never);

    const outcome = await setListNumberStyle(host, 'hebrew1', { createList });

    expect(outcome).toEqual(failed);
    expect(calls.get('setLevelNumberStyle')).toEqual([]);
  });

  it('בלי `createList` — הסירוב המפורש, כמו קודם', async () => {
    const { host, calls } = fakeDoc({ selection: IN_PARAGRAPH });

    const outcome = await setListNumberStyle(host, 'hebrew1');

    expect(outcome).toMatchObject({ ok: false, reason: 'selection-required' });
    expect(calls.get('setLevelNumberStyle')).toEqual([]);
  });

  it('כשהסמן כבר ברשימה — `createList` אינה נקראת', async () => {
    const { host, calls } = fakeDoc();
    const createList = vi.fn(async () => ({ ok: true }) as const);

    await setListNumberStyle(host, 'hebrew2', { createList });

    expect(createList).not.toHaveBeenCalled();
    expect(calls.get('setLevelNumberStyle')).toHaveLength(1);
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
