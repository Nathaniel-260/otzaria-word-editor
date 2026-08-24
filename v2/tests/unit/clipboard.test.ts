/**
 * שכבת הלוח.
 *
 * שני דברים נמדדים כאן, ושניהם היו התקלה:
 *
 * 1. **מה נשלח למנוע.** הכפיל אינו „מקליט ומחזיר true”. הוא **מאמת** — target
 *    שאינו `SelectionTarget`, `serializeSelection` בלי `includeHtml`, מחיקה
 *    בלי target — כל אחד מאלה מפיל את הבדיקה. הגרסה הקודמת של
 *    tests/unit/ribbon-commands.test.ts החזירה `true` לכל קריאה ואישרה בירוק
 *    payloads שהמנוע דוחה; כפיל כזה בודק ש-JavaScript מעביר ארגומנטים.
 *
 * 2. **שהכשל מגיע למשתמש.** לוח מערכת שנחסם, `serializeSelection` שזורק,
 *    קבלה עם `success: false` — כל אחד מהם חייב לחזור כ-`ok: false` עם הודעה
 *    בעברית. „העתקה שקטה שלא קרתה” היא בדיוק מה שהיה כאן קודם.
 *
 * `navigator.clipboard` אינו קיים ב-jsdom, ולכן הוא נשתל לכל מקרה בנפרד. זה
 * גם מה שמאפשר לכפול את המצב הנפוץ באמת ב-`file://`: `NotAllowedError`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copySelection,
  cutSelection,
  internalClipboard,
  pasteFromClipboard,
  type ClipboardDocumentApi,
  type ClipboardHost,
  type ClipboardPayload,
  type ClipboardPayloadItem,
  type ClipboardPlan,
  type SelectionSnapshot,
} from '../../src/engine/clipboard';

/* ------------------------------------------------------------------ */
/* כפיל הבחירה                                                        */
/* ------------------------------------------------------------------ */

/** בחירה חוקית: טווח בין שתי נקודות טקסט. זו הצורה שפעולות הכתיבה מקבלות. */
const RANGE = {
  kind: 'selection',
  start: { kind: 'text', blockId: 'p1', offset: 0 },
  end: { kind: 'text', blockId: 'p1', offset: 5 },
} as const;

/** האם זה באמת `SelectionTarget`, ולא סתם אובייקט שהועבר הלאה. */
function isSelectionTarget(value: unknown): boolean {
  const target = value as { kind?: string; start?: { kind?: string }; end?: { kind?: string } } | null;
  if (!target || target.kind !== 'selection') return false;
  const points = [target.start, target.end];
  return points.every((point) => point?.kind === 'text' || point?.kind === 'nodeEdge');
}

function selectionSurface(snapshot: SelectionSnapshot | undefined) {
  return { getSnapshot: () => snapshot };
}

const READY_SELECTION: SelectionSnapshot = {
  status: 'ready',
  empty: false,
  selectionTarget: RANGE as never,
};

/* ------------------------------------------------------------------ */
/* כפיל ה-Document API                                                */
/* ------------------------------------------------------------------ */

/** ה-payload שהמנוע האמיתי מחזיר: text/plain, text/html ו-fragment פרטי. */
function enginePayload(text = 'שלום'): ClipboardPayload {
  return {
    source: 'api',
    items: [
      { type: 'text/plain', kind: 'string', data: text },
      { type: 'text/html', kind: 'string', data: `<p>${text}</p>` },
      { type: 'application/x-superdoc-v2-fragment', kind: 'string', data: '{"blocks":[]}' },
    ],
  };
}

interface FakeCall {
  op: string;
  input: unknown;
}

/**
 * הוולידטור של `clipboard.parse`/`clipboard.insert` כפי שהוא במנוע: `items`
 * מערך, `type` מחרוזת לא ריקה, `kind` אחד משניים, ו-`data` **מהטיפוס** שהוא
 * מכריז עליו. זה מה שהופך את הכפיל לבדיקה ולא להקלטה.
 */
function assertPayload(payload: ClipboardPayload | undefined, op: string): void {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error(`${op} requires a ClipboardPayload with items`);
  }
  payload.items.forEach((item: ClipboardPayloadItem, index: number) => {
    if (!item || typeof item !== 'object') throw new Error(`${op} item ${index} must be an object`);
    if (typeof item.type !== 'string' || item.type.length === 0) {
      throw new Error(`${op} item ${index} requires a MIME type`);
    }
    if (item.kind !== 'string' && item.kind !== 'bytes') {
      throw new Error(`${op} item ${index} has an invalid kind`);
    }
    if (item.kind === 'string' && typeof item.data !== 'string') {
      throw new Error(`${op} item ${index} requires string data`);
    }
    if (item.kind === 'bytes' && !(item.data instanceof Uint8Array)) {
      throw new Error(`${op} item ${index} requires Uint8Array data`);
    }
  });
}

/** אותו דבר ל-`plan`: `fragment.blocks` מערך, ו-`diagnostics` מערך. */
function assertPlan(plan: ClipboardPlan | undefined, op: string): void {
  if (!plan || typeof plan !== 'object') throw new Error(`${op} plan must be an object`);
  if (!plan.fragment || typeof plan.fragment !== 'object' || !Array.isArray(plan.fragment.blocks)) {
    throw new Error(`${op} fragment.blocks must be an array`);
  }
  if (!Array.isArray(plan.diagnostics)) throw new Error(`${op} plan.diagnostics must be an array`);
}

/** התכנית שהמנוע מחזיר מ-`parse`. */
function enginePlan(): ClipboardPlan {
  return { fragment: { blocks: [{ kind: 'paragraph', runs: [] }] }, diagnostics: [] };
}

function fakeDoc(overrides: Partial<ClipboardDocumentApi> = {}) {
  const calls: FakeCall[] = [];

  const doc: ClipboardDocumentApi = {
    clipboard: {
      serializeSelection: (input) => {
        // הוולידטור של המנוע: קלט שאינו אובייקט זורק INVALID_INPUT, ו-target
        // שאינו SelectionTarget נדחה. כפיל שמקבל הכול אינו מודד כלום.
        if (input !== undefined && typeof input !== 'object') {
          throw new Error('serializeSelection input must be an object when provided');
        }
        if (input?.target !== undefined && !isSelectionTarget(input.target)) {
          throw new Error('serializeSelection target must be a SelectionTarget');
        }
        calls.push({ op: 'clipboard.serializeSelection', input });
        return { payload: enginePayload() };
      },
      parse: (payload) => {
        assertPayload(payload, 'clipboard.parse');
        calls.push({ op: 'clipboard.parse', input: payload });
        return { success: true, plan: enginePlan() };
      },
      insert: (input) => {
        // „exactly one of payload, plan, or fragment” — זה החוזה, והוא זורק
        // INVALID_INPUT על שניים או על אפס.
        const provided = [input?.payload, input?.plan].filter((value) => value !== undefined);
        if (provided.length !== 1) {
          throw new Error('clipboard.insert requires exactly one of payload, plan, or fragment');
        }
        if (input.payload !== undefined) assertPayload(input.payload, 'clipboard.insert');
        if (input.plan !== undefined) assertPlan(input.plan, 'clipboard.insert');
        calls.push({ op: 'clipboard.insert', input });
        return { success: true };
      },
    },
    delete: (input) => {
      if (!isSelectionTarget(input?.target)) {
        throw new Error('delete requires a SelectionTarget');
      }
      calls.push({ op: 'delete', input });
      return { success: true };
    },
    ...overrides,
  };

  const host: ClipboardHost = {
    activeEditor: { doc },
    ui: { selection: selectionSurface(READY_SELECTION) },
  };

  return { doc, host, calls };
}

/* ------------------------------------------------------------------ */
/* כפיל לוח המערכת                                                    */
/* ------------------------------------------------------------------ */

const NO_CLIPBOARD = Symbol('no-clipboard');

function setSystemClipboard(value: unknown): void {
  if (value === NO_CLIPBOARD) {
    Reflect.deleteProperty(navigator, 'clipboard');
    return;
  }
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true });
}

/**
 * `ClipboardItem` אינו קיים ב-jsdom, אבל הוא כן קיים ב-WebView2 — ולכן הוא
 * נשתל כברירת מחדל: המסלול הנפוץ במציאות הוא זה שכותב HTML, וסביבת בדיקה
 * שאין בה את הבנאי הייתה בודקת רק את מסלול הנפילה.
 */
class FakeClipboardItem {
  readonly types: string[];
  private readonly parts: Record<string, Blob>;
  constructor(parts: Record<string, Blob>) {
    this.parts = parts;
    this.types = Object.keys(parts);
  }
  async getType(type: string): Promise<Blob> {
    return this.parts[type]!;
  }
}

function setClipboardItem(available: boolean): void {
  if (!available) {
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
    return;
  }
  Object.defineProperty(globalThis, 'ClipboardItem', {
    value: FakeClipboardItem,
    configurable: true,
    writable: true,
  });
}

/** `Blob.text()` אינו קיים ב-jsdom שהבדיקות רצות בו; `FileReader` כן. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** לוח שעובד. שומר את מה שנכתב, כדי שנוכל לבדוק שנכתבו גם HTML וגם טקסט. */
function workingClipboard() {
  const written: Array<Record<string, string>> = [];
  return {
    written,
    api: {
      write: vi.fn(async (items: ClipboardItem[]) => {
        const entry: Record<string, string> = {};
        for (const item of items) {
          for (const type of item.types) entry[type] = await readBlob(await item.getType(type));
        }
        written.push(entry);
      }),
      writeText: vi.fn(async (text: string) => {
        written.push({ 'text/plain': text });
      }),
    },
  };
}

/** המצב הנפוץ ב-`file://`: ההרשאה נדחית. */
function deniedClipboard() {
  const denied = (): Promise<never> =>
    Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  return { write: vi.fn(denied), writeText: vi.fn(denied), read: vi.fn(denied), readText: vi.fn(denied) };
}

/**
 * פריט קריאה מלוח המערכת.
 *
 * ה-Blob כאן הוא כפיל ולא `new Blob(...)`, ובכוונה: ל-Blob של הדפדפן **יש**
 * `text()` ו-`arrayBuffer()`, ולזה של jsdom אין. כפיל עם המתודות האמיתיות
 * מתאר את המציאות יותר טוב מהאובייקט החסר שהסביבה מספקת.
 */
function readableItem(parts: Record<string, string | Uint8Array>) {
  return {
    types: Object.keys(parts),
    getType: async (type: string) => {
      const value = parts[type]!;
      return {
        type,
        text: async () => (typeof value === 'string' ? value : new TextDecoder().decode(value)),
        arrayBuffer: async () =>
          typeof value === 'string'
            ? new TextEncoder().encode(value).buffer
            : (value.buffer as ArrayBuffer),
      } as unknown as Blob;
    },
  } as unknown as ClipboardItem;
}

/** לוח שאפשר לקרוא ממנו. */
function readableClipboard(parts: Record<string, string | Uint8Array>) {
  return {
    read: vi.fn(async () => [readableItem(parts)]),
    readText: vi.fn(async () => String(parts['text/plain'] ?? '')),
  };
}

beforeEach(() => {
  internalClipboard.clear();
  setSystemClipboard(NO_CLIPBOARD);
  setClipboardItem(true);
});

afterEach(() => {
  setSystemClipboard(NO_CLIPBOARD);
  setClipboardItem(false);
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */

describe('copySelection', () => {
  it('מסדרת את הבחירה עם ה-target שנקרא, ומבקשת גם HTML', async () => {
    const { host, calls } = fakeDoc();
    setSystemClipboard(workingClipboard().api);

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(calls).toEqual([
      { op: 'clipboard.serializeSelection', input: { target: RANGE, includeHtml: true } },
    ]);
  });

  it('כותבת ללוח המערכת גם text/html וגם text/plain', async () => {
    // זה מה שמאפשר להדביק ל-Word אמיתי בלי לאבד עיצוב. `writeText` לבדו היה
    // משטח את הכול.
    const { host } = fakeDoc();
    const clipboard = workingClipboard();
    setSystemClipboard(clipboard.api);

    await copySelection(host);

    expect(clipboard.api.write).toHaveBeenCalledTimes(1);
    expect(clipboard.written[0]).toEqual({ 'text/html': '<p>שלום</p>', 'text/plain': 'שלום' });
  });

  it('אינה שולחת את ה-MIME הפרטי של המנוע ללוח המערכת', async () => {
    // לוח המערכת מסנן טיפוסים שאינם ברשימה המותרת, וניסיון כזה מפיל את כל
    // הקריאה — כלומר היה מבטל גם את ההעתקה של הטקסט.
    const { host } = fakeDoc();
    const clipboard = workingClipboard();
    setSystemClipboard(clipboard.api);

    await copySelection(host);

    expect(Object.keys(clipboard.written[0]!)).not.toContain('application/x-superdoc-v2-fragment');
  });

  it('נופלת ל-writeText כשאין ClipboardItem בסביבה', async () => {
    const { host } = fakeDoc();
    const clipboard = workingClipboard();
    setSystemClipboard(clipboard.api);
    setClipboardItem(false);

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(clipboard.api.write).not.toHaveBeenCalled();
    expect(clipboard.api.writeText).toHaveBeenCalledWith('שלום');
  });

  it('נופלת ל-writeText כש-`write` נדחה אבל `writeText` עובר', async () => {
    // המצב שנמדד ב-WebView2: הכתיבה העשירה נחסמת, והמצומצמת כן עוברת.
    const { host } = fakeDoc();
    const writeText = vi.fn(async () => {});
    setSystemClipboard({
      write: vi.fn(() => Promise.reject(new Error('denied'))),
      writeText,
    });

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('שלום');
  });

  it('הרשאה שנדחתה: התוכן בלוח הפנימי, וההודעה אומרת את זה', async () => {
    const { host } = fakeDoc();
    setSystemClipboard(deniedClipboard());

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('system-clipboard-blocked');
    expect(outcome.message).toContain('לוח המערכת');
    expect(outcome.message).toContain('Ctrl+C');
    // לא שקר על הצלחה — אבל גם לא אובדן: התוכן קיים.
    expect(internalClipboard.read()).toEqual(enginePayload());
  });

  it('אין `navigator.clipboard` בכלל — אותה הודעה, בלי חריגה', async () => {
    const { host } = fakeDoc();

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('system-clipboard-blocked');
    expect(internalClipboard.read()).not.toBeNull();
  });

  it('בחירה ריקה נעצרת לפני המנוע, עם „יש לסמן טקסט תחילה”', async () => {
    const { host, calls } = fakeDoc();
    host.ui = { selection: selectionSurface({ status: 'ready', empty: true, selectionTarget: null }) };

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('יש לסמן טקסט תחילה');
    expect(calls).toEqual([]);
  });

  it('קריאת בחירה שטרם הסתיימה אינה עוצרת העתקה', async () => {
    // `status: 'pending'` אינו „לא סימנת”: המנוע כן יודע מה הבחירה החיה, גם
    // אם ה-slice של ה-UI עוד לא התעדכן. רק בחירה **ריקה** ודאית עוצרת.
    const { host, calls } = fakeDoc();
    host.ui = { selection: selectionSurface({ status: 'pending', selectionTarget: null }) };
    setSystemClipboard(workingClipboard().api);

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(calls[0]!.input).toEqual({ includeHtml: true });
  });

  it('אין משטח בחירה — מסדרת את הבחירה החיה בלי target', async () => {
    // החוזה קובע ש-serializeSelection מסדר "the current or supplied model
    // selection", ולכן „העתק” אינו נופל רק מפני שלא הצלחנו לקרוא את הבחירה.
    const { host, calls } = fakeDoc();
    host.ui = null;
    setSystemClipboard(workingClipboard().api);

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(calls[0]!.input).toEqual({ includeHtml: true });
  });

  it('אין `doc.clipboard` — מנוטרל עם „אינו זמין בגרסה זו”', async () => {
    const { host } = fakeDoc({ clipboard: undefined });

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('command-unsupported');
      expect(outcome.message).toBe('ההעתקה נכשלה: אינו זמין בגרסה זו');
    }
  });

  it('אין Document API בכלל — אותו כשל סגור', async () => {
    for (const host of [null, undefined, {}, { activeEditor: null }, { activeEditor: { doc: null } }]) {
      const outcome = await copySelection(host as ClipboardHost);

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe('command-unsupported');
    }
  });

  it('סובלת גם קריאה שמחזירה הבטחה — הפאסדה בדפדפן א-סינכרונית', async () => {
    const { host } = fakeDoc({
      clipboard: { serializeSelection: () => Promise.resolve({ payload: enginePayload('א') }) },
    });
    setSystemClipboard(workingClipboard().api);

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(true);
    expect(internalClipboard.read()).toEqual(enginePayload('א'));
  });

  it('סדרוּר שזורק אינו מפיל את הרצועה', async () => {
    const { host } = fakeDoc({
      clipboard: {
        serializeSelection: () => {
          throw new Error('boom');
        },
      },
    });

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('threw');
      expect(outcome.message).toBe('ההעתקה נכשלה: boom');
    }
  });

  it('הבטחה שנדחית מטופלת כמו זריקה', async () => {
    const { host } = fakeDoc({
      clipboard: { serializeSelection: () => Promise.reject(new Error('boom')) },
    });

    const outcome = await copySelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('threw');
  });

  it('payload ריק או חסר אינו „העתקה שהצליחה”', async () => {
    for (const payload of [undefined, { items: [] }, { items: null }]) {
      internalClipboard.clear();
      const { host } = fakeDoc({
        clipboard: { serializeSelection: () => ({ payload: payload as never }) },
      });

      const outcome = await copySelection(host);

      expect(outcome.ok, JSON.stringify(payload)).toBe(false);
      if (!outcome.ok) expect(outcome.message).toContain('יש לסמן טקסט תחילה');
      expect(internalClipboard.read()).toBeNull();
    }
  });
});

describe('cutSelection', () => {
  it('מסדרת ואז מוחקת — באותו target', async () => {
    const { host, calls } = fakeDoc();
    setSystemClipboard(workingClipboard().api);

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['clipboard.serializeSelection', 'delete']);
    expect(calls[1]!.input).toEqual({ target: RANGE });
  });

  it('סדרוּר שנכשל אינו מוחק כלום', async () => {
    // זה כל הטעם בסדר הפעולות: מחיקה לפני שיש עותק היא טקסט שנעלם.
    const { calls, host } = fakeDoc();
    const doc = host.activeEditor!.doc!;
    doc.clipboard = {
      serializeSelection: () => {
        throw new Error('boom');
      },
    };

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    expect(calls.map((call) => call.op)).not.toContain('delete');
  });

  it('לוח מערכת שנחסם כן ממשיך למחיקה, וההודעה אומרת מה קרה', async () => {
    // התוכן קיים בלוח הפנימי, ולכן הגזירה אינה אובדן. הודעה שקטה כאן הייתה
    // משאירה את המשתמש עם טקסט שנמחק ולוח מערכת ריק.
    const { host, calls } = fakeDoc();
    setSystemClipboard(deniedClipboard());

    const outcome = await cutSelection(host);

    expect(calls.map((call) => call.op)).toEqual(['clipboard.serializeSelection', 'delete']);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('system-clipboard-blocked');
      expect(outcome.message).toContain('Ctrl+X');
    }
    expect(internalClipboard.read()).toEqual(enginePayload());
  });

  it('אין מסלול לקרוא את הבחירה — נכשלת, ולא מנחשת target', async () => {
    const { host, calls } = fakeDoc();
    host.ui = null;

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('host-capability-unavailable');
    expect(calls).toEqual([]);
  });

  it('בחירה שטרם נקראה — „המסמך עדיין נטען”, ולא „לא סימנת”', async () => {
    // שני המצבים מגיעים כ-`selectionTarget: null`, וההבחנה ביניהם היא ההבדל
    // בין הודעה שאפשר לפעול לפיה לבין הודעה מבלבלת.
    const { host, calls } = fakeDoc();
    host.ui = { selection: selectionSurface({ status: 'pending', selectionTarget: null }) };

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('not-ready');
      expect(outcome.message).toBe('הגזירה נכשלה: המסמך עדיין נטען');
    }
    expect(calls).toEqual([]);
  });

  it('בחירה ריקה — „יש לסמן טקסט תחילה”', async () => {
    const { host, calls } = fakeDoc();
    host.ui = { selection: selectionSurface({ status: 'ready', empty: true, selectionTarget: null }) };

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toBe('הגזירה נכשלה: יש לסמן טקסט תחילה');
    expect(calls).toEqual([]);
  });

  it('`getSnapshot` שזורק אינו מפיל את הכפתור', async () => {
    const { host } = fakeDoc();
    host.ui = {
      selection: {
        getSnapshot: () => {
          throw new Error('boom');
        },
      },
    };

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('המסמך עדיין נטען');
  });

  it('אין `doc.delete` — „גזור” מנוטרל, בלי לסדר כלום', async () => {
    const { host, calls } = fakeDoc({ delete: undefined });

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('command-unsupported');
      expect(outcome.message).toBe('הגזירה נכשלה: אינו זמין בגרסה זו');
    }
    expect(calls).toEqual([]);
  });

  it('קבלת מחיקה שנכשלה מגיעה למשתמש עם הקוד של המנוע', async () => {
    const { host } = fakeDoc({
      delete: () => ({ success: false, failure: { code: 'DOCUMENT_READONLY' } }),
    });
    setSystemClipboard(workingClipboard().api);

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('DOCUMENT_READONLY');
      expect(outcome.message).toBe('הגזירה נכשלה: המסמך פתוח לקריאה בלבד');
    }
  });

  it('מחיקה שזורקת אינה מפילה את הרצועה', async () => {
    const { host } = fakeDoc({
      delete: () => {
        throw new Error('boom');
      },
    });
    setSystemClipboard(workingClipboard().api);

    const outcome = await cutSelection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('threw');
      expect(outcome.message).toBe('הגזירה נכשלה: boom');
    }
  });
});

describe('pasteFromClipboard', () => {
  it('קוראת מלוח המערכת, מפרקת, ומדביקה את התכנית שהתקבלה', async () => {
    const { host, calls } = fakeDoc();
    setSystemClipboard(readableClipboard({ 'text/html': '<p>טקסט</p>', 'text/plain': 'טקסט' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['clipboard.parse', 'clipboard.insert']);
    // text/html לפני text/plain: הראשון הוא זה שנושא עיצוב, והמנוע בוחר
    // את הייצוג הנאמן ביותר מבין הפריטים.
    expect(calls[0]!.input).toEqual({
      source: 'browser',
      items: [
        { type: 'text/html', kind: 'string', data: '<p>טקסט</p>' },
        { type: 'text/plain', kind: 'string', data: 'טקסט' },
      ],
    });
    expect(calls[1]!.input).toEqual({ plan: enginePlan() });
  });

  it('תמונה מהלוח נקראת כ-bytes, כפי שהוולידטור דורש', async () => {
    // `data instanceof Uint8Array` הוא תנאי מפורש במנוע; מחרוזת base64 כאן
    // הייתה נדחית ב-INVALID_INPUT.
    const png = new Uint8Array([137, 80, 78, 71]);
    const { host, calls } = fakeDoc();
    setSystemClipboard(readableClipboard({ 'image/png': png }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(true);
    const payload = calls[0]!.input as ClipboardPayload;
    expect(payload.items[0]!.kind).toBe('bytes');
    expect(payload.items[0]!.data).toBeInstanceOf(Uint8Array);
  });

  it('`read` שנדחה נופל ל-`readText`', async () => {
    const { host, calls } = fakeDoc();
    setSystemClipboard({
      read: vi.fn(() => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))),
      readText: vi.fn(async () => 'רק טקסט'),
    });

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(true);
    expect(calls[0]!.input).toEqual({
      source: 'browser',
      items: [{ type: 'text/plain', kind: 'string', data: 'רק טקסט' }],
    });
  });

  it('הרשאה שנדחתה לגמרי — נופלת ללוח הפנימי', async () => {
    // זה המסלול שמאפשר להעתיק ולהדביק בתוך התוסף גם כשלוח המערכת חסום לגמרי.
    const { host, calls } = fakeDoc();
    internalClipboard.write(enginePayload('מהתוסף'));
    setSystemClipboard(deniedClipboard());

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(true);
    expect(calls[0]!.input).toEqual(enginePayload('מהתוסף'));
  });

  it('העתק ואז הדבק דרך הלוח הפנימי מכניס בדיוק את מה שהועתק', async () => {
    // מסלול ה-round-trip: `file://` חוסם גם כתיבה וגם קריאה, ובלי הלוח הפנימי
    // שני הכפתורים היו חסרי תוחלת.
    const { host, calls } = fakeDoc();
    setSystemClipboard(deniedClipboard());

    const copied = await copySelection(host);
    const pasted = await pasteFromClipboard(host);

    expect(copied.ok).toBe(false); // ההודעה הכנה: לא הגיע ללוח המערכת
    expect(pasted.ok).toBe(true);
    const parseCall = calls.find((call) => call.op === 'clipboard.parse');
    expect(parseCall!.input).toEqual(enginePayload());
  });

  it('אין הרשאה ואין לוח פנימי — הודעה שמפנה ל-Ctrl+V', async () => {
    const { host, calls } = fakeDoc();
    setSystemClipboard(deniedClipboard());

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('system-clipboard-blocked');
      expect(outcome.message).toContain('Ctrl+V');
    }
    expect(calls).toEqual([]);
  });

  it('לוח שנקרא והיה ריק אינו מדביק תוכן ישן מהלוח הפנימי', async () => {
    // ההבחנה בין „נחסם” ל„ריק”: הדבקה של משהו שהועתק לפני חצי שעה בתוך
    // התוסף, בזמן שהמשתמש רואה לוח מערכת ריק, היא הפתעה ולא נוחות.
    const { host, calls } = fakeDoc();
    internalClipboard.write(enginePayload('ישן'));
    setSystemClipboard({ read: vi.fn(async () => []), readText: vi.fn(async () => '') });

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('לוח המערכת ריק');
    expect(calls).toEqual([]);
  });

  it('`parse` שנכשל אינו נוגע במסמך, וההסבר הוא הסיבה המדויקת', async () => {
    const { host, calls } = fakeDoc();
    const clipboard = host.activeEditor!.doc!.clipboard!;
    clipboard.parse = () => ({
      success: false,
      failure: {
        code: 'CAPABILITY_UNSUPPORTED',
        message: 'no faithful representation',
        details: { unsupportedReason: 'paste-no-faithful-representation' },
      },
    });
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.message).toBe('ההדבקה נכשלה: אין דרך להדביק את התוכן הזה בלי לשנות אותו');
      expect(outcome.reason).toBe('CAPABILITY_UNSUPPORTED');
    }
    expect(calls.map((call) => call.op)).not.toContain('clipboard.insert');
  });

  it('`parse` שנכשל בלי unsupportedReason מציג את קוד המנוע', async () => {
    const { host } = fakeDoc();
    host.activeEditor!.doc!.clipboard!.parse = () => ({
      success: false,
      failure: { code: 'EMPTY_FRAGMENT' },
    });
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toBe('ההדבקה נכשלה: אין תוכן להדבקה');
  });

  it('`insert` עם success:false מגיע למשתמש עם הקוד', async () => {
    const { host } = fakeDoc();
    host.activeEditor!.doc!.clipboard!.insert = () => ({
      success: false,
      failure: { code: 'DOCUMENT_READONLY' },
    });
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('DOCUMENT_READONLY');
      expect(outcome.message).toBe('ההדבקה נכשלה: המסמך פתוח לקריאה בלבד');
    }
  });

  it('`insert` שזורק אינו מפיל את הרצועה', async () => {
    const { host } = fakeDoc();
    host.activeEditor!.doc!.clipboard!.insert = () => {
      throw new Error('boom');
    };
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('threw');
      expect(outcome.message).toBe('ההדבקה נכשלה: boom');
    }
  });

  it('גרסה שאין בה `parse` שולחת payload גולמי ל-`insert`', async () => {
    // החוזה מקבל בדיוק אחד מ-payload/plan/fragment, ולכן שליחת שניהם או
    // אפס הייתה זורקת. הכפיל מאמת את זה.
    const { host, calls } = fakeDoc();
    host.activeEditor!.doc!.clipboard!.parse = undefined;
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['clipboard.insert']);
    expect(calls[0]!.input).toEqual({
      payload: { source: 'browser', items: [{ type: 'text/plain', kind: 'string', data: 'א' }] },
    });
  });

  it('אין `doc.clipboard.insert` — מנוטרל עם „אינו זמין בגרסה זו”, בלי לקרוא את הלוח', async () => {
    const { host } = fakeDoc({ clipboard: {} });
    const clipboard = readableClipboard({ 'text/plain': 'א' });
    setSystemClipboard(clipboard);

    const outcome = await pasteFromClipboard(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('command-unsupported');
      expect(outcome.message).toBe('ההדבקה נכשלה: אינו זמין בגרסה זו');
    }
    expect(clipboard.read).not.toHaveBeenCalled();
  });

  it('סובלת גם קריאות שמחזירות הבטחה', async () => {
    const { host } = fakeDoc();
    const clipboard = host.activeEditor!.doc!.clipboard!;
    clipboard.parse = () => Promise.resolve({ success: true, plan: enginePlan() });
    clipboard.insert = () => Promise.resolve({ success: true });
    setSystemClipboard(readableClipboard({ 'text/plain': 'א' }));

    expect((await pasteFromClipboard(host)).ok).toBe(true);
  });
});
