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
  type ClipboardDocumentApi,
  type ClipboardHost,
  type ClipboardPayload,
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
