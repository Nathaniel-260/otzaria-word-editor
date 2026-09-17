/**
 * ההחלה עצמה, מול מנוע מזויף שקולט הקשות באיחור, מפצל בלוק ב-Enter, ויודע
 * לחסום קריאות — כמו המנוע האמיתי בזמן הקלדה רציפה (ראו ההערה בראש
 * list-autoformat-install.ts). הסמן שמצטייר וה-OOXML נמדדים בשער
 * scripts/qa/list-autoformat-qa.mjs.
 *
 * ועוד שלוש התנהגויות של המנוע האמיתי, כולן נמדדו:
 *   - הקשה שה-keydown שלה לא הגיע אליו מגיעה כ-`beforeinput`, כמו בדפדפן.
 *   - הוא ממיר בעצמו „1. ”, „- ” וכדומה כשהרווח מגיע כ-`insertText` — ולא
 *     כשהוא מגיע כ-`insertReplacementText`.
 *   - יש לו היסטוריה, ויצירת רשימה בסגנון היא בה שני צעדים.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { installListAutoformat } from '../../src/engine/list-autoformat-install';

const ALEF = 'א';
const BET = 'ב';
const BULLET = '•';
const SHALOM = 'שלום';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function settle(ms = 120): Promise<void> {
  await sleep(ms);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

interface FakeBlock {
  id: string;
  text: string;
  list: boolean;
}

interface FakeOptions {
  blocks?: Array<{ text: string; list?: boolean }>;
  caret?: { block: number; offset: number };
  /** כמה זמן המנוע לוקח לקלוט הקשה. */
  lagMs?: number;
  /** מקשים שהמנוע דוחה בלי להכניס. */
  rejectKeys?: string[];
  /** מקשים שהמנוע קולט לאט מהרגיל. */
  slowKeys?: Record<string, number>;
  createOk?: boolean;
  /** קריאות חסומות מההתחלה, עד `releaseReads`. */
  readsBlocked?: boolean;
}

/** מה שהמנוע האמיתי ממיר בעצמו כשבא אחריו רווח. */
const ENGINE_RULE = /^\s*(?:[-+*]|\d+\.)$/;

function fakeEditor(options: FakeOptions = {}) {
  const calls: Array<{ name: string; input: unknown }> = [];
  const record = (name: string, input: unknown) => calls.push({ name, input });
  let nextId = 1;
  const blocks: FakeBlock[] = (options.blocks ?? [{ text: '' }]).map((b) => ({
    id: `b${nextId++}`,
    text: b.text,
    list: b.list ?? false,
  }));
  let cur = options.caret?.block ?? 0;
  let offset = options.caret?.offset ?? blocks[cur].text.length;
  const lag = options.lagMs ?? 4;

  let blocked = options.readsBlocked ?? false;

  // היסטוריה: תמונת מצב לפני כל צעד.
  type Snapshot = { blocks: FakeBlock[]; cur: number; offset: number };
  const snap = (): Snapshot => ({ blocks: blocks.map((b) => ({ ...b })), cur, offset });
  const restore = (state: Snapshot) => {
    blocks.splice(0, blocks.length, ...state.blocks.map((b) => ({ ...b })));
    cur = state.cur;
    offset = state.offset;
  };
  const undoStack: Snapshot[] = [];
  const redoStack: Snapshot[] = [];
  const step = () => {
    undoStack.push(snap());
    redoStack.length = 0;
  };
  let sawKeydown = false;
  const waiting: Array<() => void> = [];
  async function read<T>(name: string, input: unknown, answer: () => T): Promise<T> {
    record(name, input);
    // כמו במנוע: קריאה עונה רק אחרי שההקשות שבדרך נקלטו.
    await sleep(lag * 2);
    if (blocked) await new Promise<void>((resolve) => waiting.push(resolve));
    return answer();
  }

  const byId = (id: string) => blocks.find((b) => b.id === id);
  const target = () => ({
    kind: 'selection',
    start: { kind: 'text', blockId: blocks[cur].id, offset },
    end: { kind: 'text', blockId: blocks[cur].id, offset },
  });

  const container = document.createElement('div');
  const textarea = document.createElement('textarea');
  container.appendChild(textarea);
  document.body.appendChild(container);

  /** הכנסת טקסט, עם הכלל של המנוע — אלא אם הרווח הגיע כהחלפה. */
  function typeText(key: string, rule: boolean): void {
    const block = blocks[cur];
    step();
    if (rule && key === ' ' && !block.list && ENGINE_RULE.test(block.text.slice(0, offset))) {
      block.text = block.text.slice(offset);
      block.list = true;
      offset = 0;
      return;
    }
    block.text = block.text.slice(0, offset) + key + block.text.slice(offset);
    offset += 1;
  }

  // „המנוע”: מטפל בהקשה על המטרה, אחרי המאזין שלנו ב-capture, ובאיחור.
  textarea.addEventListener('beforeinput', (event) => {
    const input = event as InputEvent;
    if (input.inputType !== 'insertText' && input.inputType !== 'insertReplacementText') return;
    event.preventDefault();
    const data = input.data ?? '';
    const rule = input.inputType === 'insertText';
    setTimeout(() => {
      for (const ch of data) if (!options.rejectKeys?.includes(ch)) typeText(ch, rule);
    }, options.slowKeys?.[data] ?? lag);
  });

  textarea.addEventListener('keydown', (event) => {
    const { key } = event;
    sawKeydown = true;
    if (event.ctrlKey && (event.code === 'KeyZ' || event.code === 'KeyY')) {
      setTimeout(() => void (event.code === 'KeyZ' && !event.shiftKey ? history.undo() : history.redo()), lag);
      return;
    }
    setTimeout(() => {
      const block = blocks[cur];
      if (options.rejectKeys?.includes(key)) return;
      if ([...key].length === 1 && !event.ctrlKey) {
        typeText(key, true);
      } else if (key === 'Enter') {
        step();
        const tail = block.text.slice(offset);
        const exitsList = block.list && block.text === '';
        block.text = block.text.slice(0, offset);
        if (exitsList) block.list = false;
        blocks.splice(cur + 1, 0, { id: `b${nextId++}`, text: tail, list: block.list });
        cur += 1;
        offset = 0;
      } else if (key === 'Tab') {
        step();
        block.text = `${block.text.slice(0, offset)}\t${block.text.slice(offset)}`;
        offset += 1;
      } else if (key === 'Home') {
        offset = 0;
      } else if (key === 'End') {
        offset = block.text.length;
      } else if (key === 'Backspace' && offset > 0) {
        step();
        block.text = block.text.slice(0, offset - 1) + block.text.slice(offset);
        offset -= 1;
      }
    }, options.slowKeys?.[key] ?? lag);
  });

  const history = {
    get: async () => ({ undoDepth: undoStack.length, redoDepth: redoStack.length }),
    undo: async () => {
      record('history.undo', null);
      const state = undoStack.pop();
      if (!state) return { noop: true };
      redoStack.push(snap());
      restore(state);
      return { noop: false };
    },
    redo: async () => {
      record('history.redo', null);
      const state = redoStack.pop();
      if (!state) return { noop: true };
      undoStack.push(snap());
      restore(state);
      return { noop: false };
    },
  };

  const doc = {
    history,
    selection: { current: () => read('selection.current', null, () => ({ selectionTarget: target() })) },
    ranges: {
      resolve: (input: unknown) =>
        read('ranges.resolve', input, () => {
          const req = input as { start: { point: { blockId: string; offset: number } }; end: { point: { offset: number } } };
          const text = byId(req.start.point.blockId)?.text ?? '';
          return {
            preview: { text: text.slice(req.start.point.offset, req.end.point.offset), truncated: false },
            target: { start: { offset: req.start.point.offset } },
          };
        }),
    },
    blocks: {
      list: (input?: { nodeIds?: string[] }) =>
        read('blocks.list', input, () => ({
          blocks: blocks
            .filter((b) => !input?.nodeIds || input.nodeIds.includes(b.id))
            .map((b) => ({
              nodeId: b.id,
              nodeType: b.list ? 'listItem' : 'paragraph',
              ...(b.list ? { paragraphNumbering: { numId: 1, level: 0 } } : {}),
            })),
        })),
    },
    insert: (input: unknown) => {
      record('insert', input);
      const { value, target: at } = input as {
        value: string;
        target: { start: { blockId: string; offset: number }; end: { offset: number } };
      };
      const block = byId(at.start.blockId);
      if (!block) return { success: false, failure: { code: 'TARGET_NOT_FOUND' } };
      step();
      const { offset: from } = at.start;
      const to = at.end.offset;
      block.text = block.text.slice(0, from) + value + block.text.slice(to);
      if (blocks[cur] === block) {
        if (offset >= to) offset += value.length - (to - from);
        else if (offset > from) offset = from + value.length;
      }
      return { success: true };
    },
    lists: {
      getState: (input: unknown) =>
        read('lists.getState', input, () => {
          const id = (input as { target: { nodeId: string } }).target.nodeId;
          return { success: true, isListItem: byId(id)?.list ?? false };
        }),
      create: (input: unknown) => {
        record('lists.create', input);
        if (options.createOk === false) return { success: false, failure: { code: 'INVALID_TARGET' } };
        const id = (input as { target: { nodeId: string } }).target.nodeId;
        const block = byId(id);
        if (block) {
          // שני צעדים, כמו במנוע: הרשימה, ואחריה הסגנון.
          step();
          block.list = true;
          step();
        }
        return { success: true };
      },
    },
  };

  const ui = {
    selection: { get: () => ({ status: 'ready', selectionTarget: target() }) },
  };

  return {
    host: { activeEditor: { doc }, ui },
    container,
    textarea,
    calls,
    blocks: () => blocks.map((b) => ({ ...b })),
    caret: () => ({ blockId: blocks[cur].id, offset }),
    depth: () => ({ undo: undoStack.length, redo: redoStack.length }),
    /** צעד היסטוריה שאינו שלנו — עריכה ממקור אחר. */
    foreignStep: step,
    resetSaw: () => {
      sawKeydown = false;
    },
    saw: () => sawKeydown,
    blockReads: () => {
      blocked = true;
    },
    releaseReads: () => {
      blocked = false;
      waiting.splice(0).forEach((resolve) => resolve());
    },
  };
}

function named(calls: Array<{ name: string; input: unknown }>, name: string): unknown[] {
  return calls.filter((c) => c.name === name).map((c) => c.input);
}

/**
 * הקשה, כמו בדפדפן: אם ה-keydown לא הגיע למנוע ואיש לא ביטל אותו, התו מגיע
 * אליו כ-`beforeinput`. `saw` — האם המנוע ראה את ה-keydown.
 */
let lastFake: { resetSaw(): void; saw(): boolean } | null = null;

function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  lastFake?.resetSaw();
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(down);
  const printable = [...key].length === 1 && !init.ctrlKey && !init.metaKey && !init.altKey;
  if (printable && lastFake && !lastFake.saw() && !down.defaultPrevented) {
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: key }));
  }
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));
  return down;
}

async function type(el: HTMLElement, text: string, gapMs = 0): Promise<void> {
  for (const ch of text) {
    press(el, ch);
    if (gapMs > 0) await sleep(gapMs);
  }
}

const ctrl = (el: HTMLElement, code: 'KeyZ' | 'KeyY', key = code === 'KeyZ' ? 'z' : 'y', shiftKey = false) =>
  press(el, key, { ctrlKey: true, code, shiftKey });

const handles: Array<{ dispose(): void }> = [];

/** מתקינה, ומחכה שסוג הבלוק הראשון ייקרא — אלא אם הקריאות חסומות. */
async function install(options: FakeOptions & { enabled?: boolean } = {}) {
  const fake = fakeEditor(options);
  lastFake = fake;
  const handle = installListAutoformat({ container: fake.container, host: fake.host as never, enabled: options.enabled });
  handles.push(handle);
  await settle(20);
  return { ...fake, handle };
}

afterEach(() => {
  while (handles.length > 0) handles.pop()?.dispose();
  lastFake = null;
  document.body.innerHTML = '';
});

describe('installListAutoformat — המרה מההקשות', () => {
  it('„א) ” מוחק את הסמן ויוצר רשימה עברית', async () => {
    const app = await install();
    await type(app.textarea, `${ALEF}) `);
    await settle();

    expect(named(app.calls, 'insert')).toEqual([
      expect.objectContaining({ value: '', target: expect.objectContaining({ start: expect.objectContaining({ offset: 0 }), end: expect.objectContaining({ offset: 3 }) }) }),
    ]);
    expect(named(app.calls, 'lists.create')[0]).toMatchObject({
      mode: 'fromParagraphs',
      target: { kind: 'block', nodeType: 'paragraph', nodeId: 'b1' },
      kind: 'ordered',
      style: { version: 1, levels: [{ level: 0, numFmt: 'hebrew1', lvlText: '%1)' }] },
      sequence: { mode: 'new', startAt: 1 },
    });
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  /*
   * הדיווח: „אם אני ממשיך להקליד, זה עובר רק כשאני גומר”. במנוע האמיתי כל
   * קריאה חסומה בזמן הקלדה — ולכן ההמרה חייבת לצאת בלי אף קריאה.
   */
  it('ממיר תוך כדי הקלדה רציפה, כשכל הקריאות חסומות', async () => {
    const app = await install();
    app.blockReads();
    await type(app.textarea, `${ALEF}) ${SHALOM}`, 12);
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(1);
    expect(app.blocks()[0]).toMatchObject({ text: SHALOM, list: true });
    expect(app.caret()).toEqual({ blockId: 'b1', offset: SHALOM.length });
  });

  it('ההמרה יוצאת לפני שההקלדה נגמרת', async () => {
    const app = await install();
    app.blockReads();
    const typing = type(app.textarea, `${ALEF}) ${SHALOM} ${SHALOM}`, 25);
    await sleep(3 * 25 + 60);
    const createdEarly = named(app.calls, 'lists.create').length;
    await typing;
    await settle();

    expect(createdEarly).toBe(1);
    expect(app.blocks()[0].text).toBe(`${SHALOM} ${SHALOM}`);
  });

  it('רמה 0 בלבד נכתבת', async () => {
    const app = await install();
    await type(app.textarea, '1. ');
    await settle();

    const created = named(app.calls, 'lists.create')[0] as { style: { levels: unknown[] } };
    expect(created.style.levels).toHaveLength(1);
  });

  it('„* ” יוצר תבליט', async () => {
    const app = await install();
    await type(app.textarea, '* ');
    await settle();

    expect(named(app.calls, 'lists.create')[0]).toMatchObject({
      kind: 'bullet',
      style: { levels: [{ level: 0, numFmt: 'bullet', lvlText: BULLET, markerFont: 'Symbol' }] },
    });
  });

  it('„0. ” מתחיל מאפס', async () => {
    const app = await install();
    await type(app.textarea, '0. ');
    await settle();

    expect(named(app.calls, 'lists.create')[0]).toMatchObject({ sequence: { mode: 'new', startAt: 0 } });
  });

  it('„ב. ” ו„שלום ” אינם נוגעים במסמך', async () => {
    const app = await install();
    await type(app.textarea, `${BET}. `);
    press(app.textarea, 'Enter');
    await type(app.textarea, `${SHALOM} `);
    await settle();

    expect(named(app.calls, 'insert')).toHaveLength(0);
    expect(named(app.calls, 'lists.create')).toHaveLength(0);
  });

  it('תו רגיל אינו מוטציה', async () => {
    const app = await install();
    await type(app.textarea, ALEF);
    await settle();

    expect(named(app.calls, 'insert')).toHaveLength(0);
  });

  it('Home ואז סמן — ממיר את הפסקה שהסמן בתחילתה', async () => {
    const app = await install({ blocks: [{ text: 'xyz' }] });
    press(app.textarea, 'Home');
    await settle(20);
    await type(app.textarea, `${ALEF}) `);
    await settle();

    expect(app.blocks()[0]).toMatchObject({ text: 'xyz', list: true });
  });
});

describe('installListAutoformat — מה אינו מומר', () => {
  it('סמן שהוקלד באמצע פסקה', async () => {
    const app = await install({ blocks: [{ text: 'abc' }] });
    await type(app.textarea, `${ALEF}) `);
    await settle(1500);

    expect(named(app.calls, 'insert')).toHaveLength(0);
    expect(app.blocks()[0].text).toBe(`abc${ALEF}) `);
  });

  /*
   * „x” ואז „- ” מהר, והמנוע קולט את ה-„-” לפני הרווח: יש רגע שבו ההיסט (2)
   * שווה לאורך הסמן. בלי הוכחה שהרצף התחיל בהיסט 0, זה היה מוחק את „x-”.
   */
  it('סמן אחרי תו קיים, כשהמנוע מפגר ברווח — אין מחיקה', async () => {
    const app = await install({ blocks: [{ text: 'x' }], slowKeys: { ' ': 60 } });
    press(app.textarea, 'End');
    await sleep(12);
    await type(app.textarea, '- ');
    await settle(1500);

    expect(named(app.calls, 'insert')).toHaveLength(0);
    expect(app.blocks()[0].text).toBe('x- ');
  });

  it('רווח בפסקה שכבר מתחילה בסמן, כשהסמן רחוק ממנו', async () => {
    const app = await install({ blocks: [{ text: `${ALEF}) xyz` }] });
    await type(app.textarea, ' ');
    await settle();

    expect(named(app.calls, 'insert')).toHaveLength(0);
  });

  it('פריט רשימה קיים', async () => {
    const app = await install({ blocks: [{ text: '', list: true }] });
    await type(app.textarea, `${ALEF}) `);
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(0);
    expect(named(app.calls, 'insert')).toHaveLength(0);
  });

  /*
   * מקש שהמנוע דחה: ההקשות כבר אינן מתארות את הטקסט. ההיסט לא יתיישב, והנתיב
   * המאומת קורא „א ” ולא „א. ” — ואינו מוחק דבר.
   */
  it('הקשה שנדחתה אינה גורמת למחיקה עיוורת', async () => {
    const app = await install({ rejectKeys: ['.'] });
    await type(app.textarea, `${ALEF}. `);
    await type(app.textarea, 'xy', 10);
    await settle(1500);

    expect(named(app.calls, 'insert')).toHaveLength(0);
    expect(app.blocks()[0].text).toBe(`${ALEF} xy`);
  });

  it('Backspace באמצע הרצף מבטל', async () => {
    const app = await install();
    await type(app.textarea, `${ALEF}x`);
    press(app.textarea, 'Backspace');
    await settle(20);
    await type(app.textarea, ') ');
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(0);
  });
});

describe('installListAutoformat — סוג הבלוק', () => {
  it('פסקה אחרי Enter יורשת „רגילה” — ממיר בלי קריאה', async () => {
    const app = await install({ blocks: [{ text: 'abc' }] });
    app.blockReads();
    press(app.textarea, 'Enter');
    await sleep(12);
    await type(app.textarea, `${ALEF}) ${SHALOM}`, 12);
    await settle();

    expect(named(app.calls, 'lists.create')[0]).toMatchObject({ target: { nodeId: 'b2' } });
    expect(app.blocks().map((b) => [b.text, b.list])).toEqual([
      ['abc', false],
      [SHALOM, true],
    ]);
  });

  /*
   * התו הראשון נלחץ לפני שהמנוע קלט את ה-Enter: המצב שנראה בו הוא עוד
   * הבלוק הקודם. הבלוק ש-Enter יוצר מתחיל תמיד בהיסט 0, ולכן העוגן נקבע
   * כשהסמן נראה בבלוק אחר — בלי קריאה.
   */
  it('Enter שעוד לא נקלט — העוגן נקבע כשהמנוע קולט אותו', async () => {
    const app = await install({ blocks: [{ text: 'abc' }] });
    app.blockReads();
    press(app.textarea, 'Enter');
    await type(app.textarea, `${ALEF}) ${SHALOM}`, 12);
    await settle();

    expect(named(app.calls, 'lists.create')[0]).toMatchObject({ target: { nodeId: 'b2' } });
    expect(app.blocks().map((b) => [b.text, b.list])).toEqual([
      ['abc', false],
      [SHALOM, true],
    ]);
  });

  it('שני מקשי איפוס צמודים — אין עוגן', async () => {
    const app = await install({ blocks: [{ text: 'abc' }] });
    app.blockReads();
    press(app.textarea, 'Enter');
    press(app.textarea, 'End');
    await sleep(12);
    await type(app.textarea, `${ALEF}) `, 12);
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(0);
  });

  it('לחיצה בתוך המסמך שומרת את הזיכרון', async () => {
    const app = await install();
    app.blockReads();
    app.textarea.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await sleep(520);
    await type(app.textarea, `${ALEF}) `, 12);
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(1);
  });

  it('Enter מתוך פריט רשימה אינו מוריש „רגילה”', async () => {
    const app = await install({ blocks: [{ text: 'abc', list: true }] });
    press(app.textarea, 'Enter');
    await type(app.textarea, `${ALEF}) `);
    await settle();

    expect(named(app.calls, 'lists.create')).toHaveLength(0);
  });

  it('Enter שמוציא פריט ריק מהרשימה — אין זיכרון ישן', async () => {
    const app = await install({ blocks: [{ text: '', list: true }] });
    press(app.textarea, 'Enter');
    await sleep(12);
    await type(app.textarea, `${ALEF}) `, 12);
    await settle(300);

    expect(named(app.calls, 'lists.create')[0]).toMatchObject({ target: { nodeId: 'b2' } });
  });

  it('מקש מחוץ למסמך מוחק את הזיכרון', async () => {
    const app = await install();
    app.blockReads();
    const ribbon = document.createElement('button');
    document.body.appendChild(ribbon);
    press(ribbon, 'Enter');
    await sleep(320);
    await type(app.textarea, `${ALEF}) `, 12);
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(0);

    app.releaseReads();
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(1);
  });

  it('סוג לא ידוע — ממתין לקריאה, וממיר כשהיא עונה', async () => {
    const app = await install({ readsBlocked: true });
    await type(app.textarea, `${ALEF}) `);
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(0);

    app.releaseReads();
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(1);
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('לחיצת עכבר מוחקת את הזיכרון — ואז ממתינים לקריאה', async () => {
    const app = await install();
    app.blockReads();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await type(app.textarea, `${ALEF}) `);
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(0);

    app.releaseReads();
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(1);
  });

  it('Tab ממיר רק דרך הנתיב המאומת', async () => {
    const app = await install();
    await type(app.textarea, `${ALEF})`);
    press(app.textarea, 'Tab');
    await settle(80);

    expect(named(app.calls, 'ranges.resolve').length).toBeGreaterThan(0);
    expect(named(app.calls, 'lists.create')).toHaveLength(1);
  });
});

describe('installListAutoformat — כשל ופירוק', () => {
  it('כשל ביצירה מחזיר בדיוק את מה שהוקלד', async () => {
    const app = await install({ createOk: false });
    await type(app.textarea, `${ALEF}) `);
    await settle();

    const inserts = named(app.calls, 'insert') as Array<{ value: string }>;
    expect(inserts.map((i) => i.value)).toEqual(['', `${ALEF}) `]);
    expect(app.blocks()[0].text).toBe(`${ALEF}) `);
  });

  it('אחרי dispose אין תגובה', async () => {
    const app = await install();
    app.handle.dispose();
    await type(app.textarea, '1. ');
    await settle();

    expect(named(app.calls, 'insert')).toHaveLength(0);
  });

  /*
   * Backspace שייך למנוע (scripts/qa/list-backspace-owner-probe.mjs). המודול
   * אינו מונע מקש רגיל, ו-Backspace אינו מפעיל אותו. (Ctrl+Z מיד אחרי
   * ההמרה הוא החריג היחיד — למטה.)
   */
  it('אף מקש אינו נמנע, ו-Backspace אינו קורא למסמך', async () => {
    const app = await install();
    await type(app.textarea, '1. ');
    await settle();

    const before = app.calls.length;
    const events = [press(app.textarea, 'Backspace'), press(app.textarea, ' '), press(app.textarea, 'Tab')];
    await settle();

    expect(events.map((e) => e.defaultPrevented)).toEqual([false, false, false]);
    expect(named(app.calls.slice(before), 'insert')).toHaveLength(0);
  });
});

describe('installListAutoformat — הצורות שהמנוע ממיר בעצמו', () => {
  it('בקרה: בלי המודול המנוע המזויף ממיר „1. ”, כמו האמיתי', async () => {
    const fake = fakeEditor();
    lastFake = fake;
    await type(fake.textarea, '1. ');
    await settle();
    expect(fake.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('כבוי: „1. ” נשאר טקסט — הרווח עובר כהחלפה', async () => {
    const app = await install({ enabled: false });
    await type(app.textarea, '1. אבג');
    await settle();

    expect(app.blocks()[0]).toMatchObject({ text: '1. אבג', list: false });
    expect(named(app.calls, 'lists.create')).toHaveLength(0);
    expect(named(app.calls, 'insert')).toHaveLength(0);
  });

  for (const marker of ['- ', '* ', '+ ', '12. ', ' - ']) {
    it(`כבוי: „${marker}” נשאר טקסט`, async () => {
      const app = await install({ enabled: false });
      await type(app.textarea, marker);
      await settle();
      expect(app.blocks()[0]).toMatchObject({ text: marker, list: false });
    });
  }

  it('כבוי: „א) ” — המנוע אינו ממיר אותו, והמודול אינו ממיר דבר', async () => {
    const app = await install({ enabled: false });
    await type(app.textarea, `${ALEF}) `);
    await settle();
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
    expect(app.calls.filter((c) => c.name !== 'history.undo')).toEqual([]);
  });

  it('כבוי: הקלדה מהירה שומרת על סדר התווים', async () => {
    const app = await install({ enabled: false });
    await type(app.textarea, '1. מהיר מאוד', 0);
    await settle(200);
    expect(app.blocks()[0]).toMatchObject({ text: '1. מהיר מאוד', list: false });
  });

  it('כבוי: רווח באמצע פסקה אינו נעצר', async () => {
    const app = await install({ enabled: false });
    app.resetSaw();
    await type(app.textarea, 'abc');
    const space = press(app.textarea, ' ');
    expect(app.saw(), 'המנוע ראה את ה-keydown').toBe(true);
    expect(space.defaultPrevented).toBe(false);
  });

  /**
   * רצף ההקלדה נקטע לפני הרווח: Backspace, חץ או לחיצה מאפסים את
   * הרצף שנשמר מהמקלדת — אבל המנוע קורא את הפסקה, ולכן המיר בכל זאת
   * (נמדד בסבב ה-QA: „1x”, Backspace, „. ” החזיר listItem עם סמן „1.”).
   */
  const interrupted: Array<{ name: string; run: (el: HTMLElement) => void }> = [
    { name: 'Backspace', run: (el) => void press(el, 'Backspace') },
    { name: 'חץ שמאלה וימינה', run: (el) => {
      press(el, 'ArrowLeft');
      press(el, 'ArrowRight');
    } },
  ];

  for (const c of interrupted) {
    it(`כבוי: ${c.name} באמצע הסימן — „1. ” עדיין נשאר טקסט`, async () => {
      const app = await install({ enabled: false });
      await type(app.textarea, c.name === 'Backspace' ? '1x' : '1');
      await settle(30);
      c.run(app.textarea);
      await settle(30);
      await type(app.textarea, '. ');
      await settle();

      expect(app.blocks()[0]).toMatchObject({ text: '1. ', list: false });
      expect(named(app.calls, 'lists.create')).toHaveLength(0);
    });

    it(`כבוי: ${c.name} עם קריאות חסומות`, async () => {
      // הקריאה מהמנוע נמדדה ב-242ms אחרי Backspace — לעיתים איטי מההקלדה.
      // מחיקת תו ידועה מהמקלדת, ולכן אינה מחכה לשום קריאה.
      const app = await install({ enabled: false, readsBlocked: true });
      await type(app.textarea, c.name === 'Backspace' ? '1x' : '1');
      await settle(30);
      c.run(app.textarea);
      await settle(30);
      await type(app.textarea, '. ');
      await settle();

      // בחץ אין מה לזכור — הסמן עשוי לנוח בכל מקום — ולכן שם הקריאה היא המקור היחיד.
      const expected =
        c.name === 'Backspace' ? { text: '1. ', list: false } : { text: '', list: true };
      expect(app.blocks()[0]).toMatchObject(expected);
    });

    it(`דלוק: ${c.name} באמצע הסימן — ההמרה עדיין קורית`, async () => {
      const app = await install();
      await type(app.textarea, c.name === 'Backspace' ? '1x' : '1');
      await settle(30);
      c.run(app.textarea);
      await settle(30);
      await type(app.textarea, '. ');
      await settle();

      expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
    });
  }

  it('דלוק: „- ” מומר בידי המודול, עם המקף ולא עם תבליט המנוע', async () => {
    const app = await install();
    await type(app.textarea, '- ');
    await settle();
    expect(named(app.calls, 'lists.create')[0]).toMatchObject({
      kind: 'bullet',
      style: { levels: [{ level: 0, numFmt: 'bullet', lvlText: '-', markerFont: 'Arial' }] },
    });
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('דלוק: „5. ” — אין תוכנית כאן, ולכן המנוע ממיר כמו קודם', async () => {
    const app = await install();
    await type(app.textarea, '5. ');
    await settle();
    expect(named(app.calls, 'lists.create')).toHaveLength(0);
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });
});

describe('installListAutoformat — Ctrl+Z מיד אחרי ההמרה', () => {
  async function converted() {
    const app = await install();
    await type(app.textarea, `${ALEF}) `);
    await settle();
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
    return app;
  }

  it('הקשה אחת מחזירה את „א) ” כטקסט — שלושה צעדים יחד', async () => {
    const app = await converted();
    const event = ctrl(app.textarea, 'KeyZ');
    await settle();

    expect(event.defaultPrevented, 'המנוע לא יבטל צעד נוסף').toBe(true);
    expect(named(app.calls, 'history.undo')).toHaveLength(3);
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
  });

  it('Ctrl+Y שאחריו מחזיר את ההמרה, שוב בהקשה אחת', async () => {
    const app = await converted();
    ctrl(app.textarea, 'KeyZ');
    await settle();
    const event = ctrl(app.textarea, 'KeyY');
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(named(app.calls, 'history.redo')).toHaveLength(3);
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('Ctrl+Shift+Z הוא „חזור” גם כן', async () => {
    const app = await converted();
    ctrl(app.textarea, 'KeyZ');
    await settle();
    ctrl(app.textarea, 'KeyZ', 'Z', true);
    await settle();
    expect(named(app.calls, 'history.redo')).toHaveLength(3);
  });

  it('בפריסה עברית (ז) — לפי `code`', async () => {
    const app = await converted();
    const event = ctrl(app.textarea, 'KeyZ', 'ז');
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
  });

  it('כיבוי המתג אחרי ההמרה — Ctrl+Z עדיין מחזיר אותה בהקשה אחת', async () => {
    // עד כה המתג התקין את המודול מחדש, וקבוצת הביטול נזרקה איתו.
    const app = await converted();
    app.handle.setEnabled(false);
    await settle(20);

    const event = ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(named(app.calls, 'history.undo')).toHaveLength(3);
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
  });

  it('אחרי כיבוי המתג אין המרה חדשה, וגם המנוע חסום', async () => {
    const app = await install();
    app.handle.setEnabled(false);
    await settle(20);
    await type(app.textarea, '1. ');
    await settle();
    expect(app.blocks()[0]).toMatchObject({ text: '1. ', list: false });
    expect(named(app.calls, 'lists.create')).toHaveLength(0);
  });

  it('הדלקת המתג מחזירה את ההמרה', async () => {
    const app = await install({ enabled: false });
    app.handle.setEnabled(true);
    await settle(20);
    await type(app.textarea, `${ALEF}) `);
    await settle();
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('אחרי הקלדה: Ctrl+Z מבטל את ההקלדה, והבא — את ההמרה כולה, כמו ב-Word', async () => {
    const app = await converted();
    await type(app.textarea, 'x');
    await settle();

    ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(named(app.calls, 'history.undo'), 'צעד אחד — ההקלדה').toHaveLength(1);
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });

    ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(named(app.calls, 'history.undo'), 'ועכשיו שלושת הצעדים של ההמרה').toHaveLength(4);
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
  });

  it('שתי הקשות רצופות בלי המתנה מסתדרות בתור', async () => {
    const app = await converted();
    await type(app.textarea, 'x');
    await settle();
    ctrl(app.textarea, 'KeyZ');
    ctrl(app.textarea, 'KeyZ');
    await settle(200);
    expect(named(app.calls, 'history.undo')).toHaveLength(4);
    expect(app.blocks()[0]).toMatchObject({ text: `${ALEF}) `, list: false });
  });

  it('לחיצה בעכבר אינה מבטלת את הקבוצה — „בטל” בפס הכותרת', async () => {
    const app = await converted();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(app.handle.undo()).toBe(true);
    await settle();
    expect(named(app.calls, 'history.undo')).toHaveLength(3);
    expect(app.handle.undo(), 'הקבוצה נצרכה').toBe(false);
    expect(app.handle.redo()).toBe(true);
    await settle();
    expect(app.blocks()[0]).toMatchObject({ text: '', list: true });
  });

  it('צעד זר מעל ההמרה — קודם הוא, ואז ההמרה', async () => {
    const app = await converted();
    app.foreignStep();
    ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(named(app.calls, 'history.undo')).toHaveLength(1);
    ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(named(app.calls, 'history.undo')).toHaveLength(4);
  });

  it('ההמרה בוטלה בדרך אחרת — הקבוצה נזרקת, והמקש חוזר למנוע', async () => {
    const app = await converted();
    // ביטול שלא עבר כאן (למשל מ„ספר לי”): העומק יורד מתחת להמרה.
    await (app.host.activeEditor.doc as unknown as { history: { undo(): Promise<unknown> } }).history.undo();
    ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(named(app.calls, 'history.undo'), 'אחד זר ואחד שלנו').toHaveLength(2);

    const event = ctrl(app.textarea, 'KeyZ');
    await settle();
    expect(event.defaultPrevented, 'הקבוצה נזרקה').toBe(false);
  });

  it('עריכה אחרי הביטול מוחקת את „חזור”', async () => {
    const app = await converted();
    ctrl(app.textarea, 'KeyZ');
    await settle();
    await type(app.textarea, 'q');
    await settle();
    const event = ctrl(app.textarea, 'KeyY');
    expect(event.defaultPrevented).toBe(false);
    expect(app.handle.redo()).toBe(false);
  });

  it('בלי המרה — Ctrl+Z אינו נגזל', async () => {
    const app = await install();
    await type(app.textarea, 'abc');
    await settle();
    const event = ctrl(app.textarea, 'KeyZ');
    expect(event.defaultPrevented).toBe(false);
    expect(app.handle.undo()).toBe(false);
  });
});
