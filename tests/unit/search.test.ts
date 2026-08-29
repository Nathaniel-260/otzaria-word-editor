/**
 * הבדיקות כאן נגזרות מבאג אחד: הקוד הקודם קרא ל-`ui.search.find(query)` —
 * מתודה שאינה בחוזה — מתוך `as any` ובתוך `catch` ריק, ולכן החיפוש לא רץ
 * מעולם ואף אחד לא ידע. לכן הכפיל כאן אינו „מחזיר true ומקליט ארגומנטים”
 * (זה בדיוק מה שהיה מאשר בירוק את הקוד השבור), אלא `Proxy` שזורק על כל גישה
 * לשם שאינו ב-`SearchHandle`.
 *
 * שמות המתודות למטה הם החוזה כפי שהוא מוצהר ב-superdoc@2.8.0
 * (`SearchHandle extends SnapshotSubscribable<SearchSlice>`). כל קריאה לשם אחר
 * — או קריאה בחתימה אחרת, כמו `replace(search, replacement)` — נכשלת כאן.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BorrowedSuperDocUI } from 'superdoc';
import { REASON_TEXT } from '../../src/engine/command-adapter';
import {
  createSearchAdapter,
  searchCounterText,
  idleSearchState,
  replaceControlsVisible,
  NO_MATCHES_TEXT,
  NO_QUERY_TEXT,
  REPLACE_UNAVAILABLE_TEXT,
  SEARCH_DEBOUNCE_MS,
  type SearchHost,
  type SearchSlice,
  type SearchState,
} from '../../src/engine/search';

/** ה-handle נגזר מהמשטח הציבורי, בדיוק כפי שהמודול הנבדק גוזר אותו. */
type SearchHandle = BorrowedSuperDocUI['search'];

/** החוזה: `SnapshotSubscribable` + פעולות החיפוש. אין בו `find`. */
const CONTRACT_MEMBERS = [
  'getSnapshot',
  'get',
  'subscribe',
  'observe',
  'open',
  'close',
  'search',
  'next',
  'previous',
  'clear',
  'replace',
  'replaceAll',
] as const;

interface Call {
  name: string;
  args: unknown[];
}

type ActionResult = { ok: boolean; reason?: string };

interface Behaviour {
  slice?: Partial<SearchSlice>;
  /** מה ש-`search` מחזיר. ברירת מחדל: ה-slice עם השאילתה החדשה. */
  onSearch?: (query: string, slice: SearchSlice) => Partial<SearchSlice>;
  onNext?: () => ActionResult;
  onPrevious?: () => ActionResult;
  onOpen?: () => ActionResult;
  onReplace?: (replacement: string) => ActionResult | Promise<ActionResult>;
  onReplaceAll?: (replacement: string) => ActionResult | Promise<ActionResult>;
}

interface Double {
  host: SearchHost;
  /** ה-handle עצמו, כדי לבדוק שהוא זורק על מה שאינו בחוזה. */
  handle: SearchHandle;
  calls: Call[];
  /** שמות הקריאות בלבד — לבדיקת ניתוב וסדר. */
  names: () => string[];
  patch: (slice: Partial<SearchSlice>) => void;
  slice: () => SearchSlice;
}

function strictSearchHandle(behaviour: Behaviour = {}): Double {
  const calls: Call[] = [];
  let slice: SearchSlice = {
    query: '',
    total: 0,
    activeIndex: -1,
    open: false,
    available: true,
    caseSensitive: false,
    includeDeletedText: false,
    includeTrackedDeletions: false,
    regex: false,
    canReplace: true,
    ...behaviour.slice,
  };

  const subscribers = new Set<(event: { snapshot: SearchSlice }) => void>();

  function record(name: string, args: unknown[]): void {
    calls.push({ name, args });
  }

  const impl: Record<string, unknown> = {
    getSnapshot: (...args: unknown[]) => {
      record('getSnapshot', args);
      return slice;
    },
    get: (...args: unknown[]) => {
      record('get', args);
      return slice;
    },
    subscribe: (listener: (event: { snapshot: SearchSlice }) => void) => {
      record('subscribe', []);
      subscribers.add(listener);
      listener({ snapshot: slice });
      return () => subscribers.delete(listener);
    },
    observe: (listener: (snapshot: SearchSlice) => void) => {
      record('observe', []);
      listener(slice);
      return () => {};
    },
    open: (...args: unknown[]) => {
      record('open', args);
      slice = { ...slice, open: true };
      return behaviour.onOpen?.() ?? { ok: true };
    },
    close: (...args: unknown[]) => {
      record('close', args);
      slice = { ...slice, open: false, query: '', total: 0, activeIndex: -1 };
    },
    search: (...args: unknown[]) => {
      record('search', args);
      const query = args[0] as string;
      const patch = behaviour.onSearch?.(query, slice) ?? { query, total: 3, activeIndex: 0 };
      slice = { ...slice, query, ...patch };
      return slice;
    },
    next: (...args: unknown[]) => {
      record('next', args);
      const result = behaviour.onNext?.() ?? { ok: true };
      if (result.ok) slice = { ...slice, activeIndex: slice.activeIndex + 1 };
      return result;
    },
    previous: (...args: unknown[]) => {
      record('previous', args);
      const result = behaviour.onPrevious?.() ?? { ok: true };
      if (result.ok) slice = { ...slice, activeIndex: Math.max(0, slice.activeIndex - 1) };
      return result;
    },
    clear: (...args: unknown[]) => {
      record('clear', args);
      slice = { ...slice, query: '', total: 0, activeIndex: -1 };
    },
    replace: (...args: unknown[]) => {
      record('replace', args);
      return behaviour.onReplace?.(args[0] as string) ?? { ok: true };
    },
    replaceAll: (...args: unknown[]) => {
      record('replaceAll', args);
      return behaviour.onReplaceAll?.(args[0] as string) ?? { ok: true };
    },
  };

  const handle = new Proxy(impl, {
    get(target, property) {
      const name = String(property);
      if (!(CONTRACT_MEMBERS as readonly string[]).includes(name)) {
        throw new Error(`ui.search.${name} אינו קיים בחוזה SearchHandle`);
      }
      return target[name];
    },
  }) as unknown as SearchHandle;

  return {
    host: { search: handle } as SearchHost,
    handle,
    calls,
    names: () => calls.filter((call) => call.name !== 'getSnapshot').map((call) => call.name),
    patch: (next) => {
      slice = { ...slice, ...next };
      for (const listener of subscribers) listener({ snapshot: slice });
    },
    slice: () => slice,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('הכפיל הקפדני של SearchHandle', () => {
  it('זורק על גישה לשם שאינו בחוזה — זו הבדיקה שהייתה תופסת את find()', () => {
    const { handle } = strictSearchHandle();
    expect(() => (handle as unknown as Record<string, unknown>).find).toThrow(/find/);
    expect(() => (handle as unknown as Record<string, unknown>).findNext).toThrow();
  });

  it('כל שמות החוזה נגישים', () => {
    const { handle } = strictSearchHandle();
    for (const name of CONTRACT_MEMBERS) {
      expect(typeof (handle as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('createSearchAdapter — חיפוש', () => {
  it('שאילתה חדשה עוברת ל-search של המנוע, ולא לשם אחר', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('בראשית', 'next');

    expect(outcome.ok).toBe(true);
    expect(double.names()).toEqual(['search']);
    expect(double.calls.find((call) => call.name === 'search')?.args).toEqual(['בראשית']);
  });

  it('search מסמן את ההתאמה הראשונה, ולכן „מצא הבא” על שאילתה חדשה אינו מקדם', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('בראשית', 'next');

    expect(double.names()).not.toContain('next');
    expect(outcome.ok && outcome.snapshot.activeIndex).toBe(0);
  });

  it('„מצא הבא” על אותה שאילתה מנותב ל-next', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.find('בראשית', 'next');
    const outcome = adapter.find('בראשית', 'next');

    expect(double.names()).toEqual(['search', 'next']);
    expect(outcome.ok && outcome.snapshot.activeIndex).toBe(1);
  });

  it('„מצא קודם” מנותב ל-previous ולא ל-next', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.find('בראשית', 'next');
    adapter.find('בראשית', 'prev');

    expect(double.names()).toEqual(['search', 'previous']);
  });

  it('„מצא קודם” על שאילתה חדשה מחפש ואז נסוג', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.find('בְּרֵאשִׁית', 'prev');

    expect(double.names()).toEqual(['search', 'previous']);
  });

  it('שאילתה בלי התאמות אינה כשל — המונה אומר „אין תוצאות”', () => {
    const double = strictSearchHandle({
      onSearch: (query) => ({ query, total: 0, activeIndex: -1 }),
    });
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('אשכנז', 'next');

    expect(outcome.ok).toBe(true);
    expect(double.names()).toEqual(['search']);
    expect(outcome.ok && searchCounterText(outcome.snapshot)).toBe('אין תוצאות');
  });

  it('שאילתה ריקה מנקה במקום לחפש', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('', 'next');

    expect(outcome.ok).toBe(true);
    expect(double.names()).toEqual(['clear']);
  });

  it('כשל של next מגיע כהודעה בעברית מהטבלה המשותפת', () => {
    const double = strictSearchHandle({
      onNext: () => ({ ok: false, reason: 'operation-unavailable' }),
    });
    const adapter = createSearchAdapter(double.host);

    adapter.find('בראשית', 'next');
    const outcome = adapter.find('בראשית', 'next');

    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['operation-unavailable'],
      reason: 'operation-unavailable',
    });
  });
});

describe('createSearchAdapter — חיפוש שאינו זמין', () => {
  it('available: false מחזיר הודעה בעברית ולא נכשל בשקט', () => {
    const double = strictSearchHandle({ slice: { available: false } });
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('בראשית', 'next');

    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['search-unavailable'],
      reason: 'search-unavailable',
    });
    // הפעולה נעצרה לפני המנוע: אין קריאה ל-search על מסמך שאין בו חיפוש.
    expect(double.names()).toEqual([]);
  });

  it('reason של המנוע עדיף על ברירת המחדל', () => {
    const double = strictSearchHandle({
      slice: { available: false, reason: 'document-api-unavailable' },
    });
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('בראשית', 'next');

    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['document-api-unavailable'],
      reason: 'document-api-unavailable',
    });
  });

  it('search שמחזיר slice לא-זמין מדווח כשל', () => {
    const double = strictSearchHandle({
      onSearch: (query) => ({ query, available: false, reason: 'search-invalid-pattern' }),
    });
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('[', 'next');

    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['search-invalid-pattern'],
      reason: 'search-invalid-pattern',
    });
  });

  it('open שנכשל מדווח ולא מחזיר ok', () => {
    const double = strictSearchHandle({
      onOpen: () => ({ ok: false, reason: 'search-unavailable' }),
    });
    const adapter = createSearchAdapter(double.host);

    expect(adapter.open()).toEqual({
      ok: false,
      message: REASON_TEXT['search-unavailable'],
      reason: 'search-unavailable',
    });
  });

  it('זריקה מהמנוע חוזרת כהודעה ולא מפילה את הממשק', () => {
    const double = strictSearchHandle({
      onSearch: () => {
        throw new Error('המנוע קרס');
      },
    });
    const adapter = createSearchAdapter(double.host);

    const outcome = adapter.find('בראשית', 'next');

    expect(outcome).toEqual({ ok: false, message: 'המנוע קרס', reason: 'threw' });
  });
});

describe('createSearchAdapter — החלפה', () => {
  it('replace נקרא עם ארגומנט אחד, והוא טקסט ההחלפה ולא מחרוזת החיפוש', async () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.find('לפני', 'next');
    const outcome = await adapter.replace('אחרי');

    const call = double.calls.find((entry) => entry.name === 'replace');
    expect(outcome.ok).toBe(true);
    expect(call).toBeDefined();
    // הבאג שהיה: `replace(search, replacement)` — כלומר „לפני” נכתב למסמך.
    expect(call?.args).toEqual(['אחרי']);
    expect(call?.args).toHaveLength(1);
    expect(call?.args).not.toContain('לפני');
  });

  it('replaceAll נקרא עם ארגומנט אחד, והוא טקסט ההחלפה', async () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.find('לפני', 'next');
    await adapter.replaceAll('אחרי');

    const call = double.calls.find((entry) => entry.name === 'replaceAll');
    expect(call?.args).toEqual(['אחרי']);
    expect(call?.args).toHaveLength(1);
  });

  it('בלי שאילתה אין החלפה, ואין קריאה למנוע', async () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    const outcome = await adapter.replace('אחרי');

    expect(outcome).toEqual({ ok: false, message: NO_QUERY_TEXT, reason: 'no-query' });
    expect(double.names()).not.toContain('replace');
  });

  it('שאילתה בלי התאמות מדווחת „אין התאמות” — ולא חוסר בגרסת המנוע', async () => {
    // זה הבאג עצמו: במסמך ריק, חיפוש מילה שאינה בו החזיר אפס התאמות, והמשתמש
    // קיבל „החלפת טקסט אינה נתמכת בגרסה הזאת של המנוע”.
    const double = strictSearchHandle({ onSearch: (query) => ({ query, total: 0, activeIndex: -1 }) });
    const adapter = createSearchAdapter(double.host);

    adapter.find('מילה שאינה במסמך', 'next');
    const outcome = await adapter.replace('אחרי');

    expect(outcome).toEqual({ ok: false, message: NO_MATCHES_TEXT, reason: 'no-matches' });
    expect(double.names()).not.toContain('replace');
  });

  it('`canReplace: false` עם התאמות **כן** נשלח למנוע — הוא זה שיודע למה', async () => {
    // הגייט שהיה כאן עצר את הקריאה והמציא לה סיבה. `canReplace` הוא תלוי-מצב,
    // וכשיש התאמות והוא `false` הסיבה האמיתית יכולה להיות מצב קריאה או החלפה
    // שאינה מחוברת — והמנוע הוא שמבחין ביניהן.
    const double = strictSearchHandle({
      slice: { canReplace: false },
      onReplace: () => ({ ok: false, reason: 'document-readonly' }),
    });
    const adapter = createSearchAdapter(double.host);

    adapter.find('לפני', 'next');
    const outcome = await adapter.replace('אחרי');

    expect(double.names()).toContain('replace');
    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['document-readonly'],
      reason: 'document-readonly',
    });
  });

  it('`replace-unsupported` אינו קוד שהמנוע פולט, ולכן אינו ברירת מחדל שלנו', async () => {
    // הוא מוגדר ב-`SUPERDOC_UI_REASONS` ואין לו אתר ייצור אחד ב-2.8.0 (נמדד
    // על ה-chunk של ה-controller). ההודעה שהדיאלוג מציג אינה טוענת על הגרסה.
    const chunkDir = join(process.cwd(), 'node_modules/superdoc/dist/chunks');
    const chunk = readdirSync(chunkDir).find((name) => /^create-super-doc-ui-.*\.es\.js$/.test(name));
    expect(chunk, 'לא נמצא ה-chunk של controller ה-UI').toBeTruthy();
    const source = readFileSync(join(chunkDir, chunk!), 'utf8');

    // מופע אחד בלבד: ההגדרה בטבלת ה-reasons. אין קריאה שמחזירה אותו.
    expect(source.match(/replaceUnsupported/g)).toHaveLength(1);
    expect(source).not.toContain('SUPERDOC_UI_REASONS.replaceUnsupported');

    expect(REPLACE_UNAVAILABLE_TEXT).not.toBe(REASON_TEXT['replace-unsupported']);
    expect(REPLACE_UNAVAILABLE_TEXT).not.toContain('גרסה');
    expect(REPLACE_UNAVAILABLE_TEXT).not.toContain('מנוע');
  });

  describe('replaceControlsVisible — מה שהדיאלוג מרנדר', () => {
    const state = (patch: Partial<SearchState>): SearchState => ({
      ...idleSearchState(),
      available: true,
      ...patch,
    });

    it('אין חיפוש במסמך → אין פקדי החלפה', () => {
      expect(replaceControlsVisible(state({ available: false, total: 5, canReplace: true }))).toBe(
        false,
      );
    });

    it('אין התאמות → הפקדים נשארים, וזה התיקון של „השדה נעלם בהקלדה”', () => {
      expect(replaceControlsVisible(state({ total: 0, canReplace: false }))).toBe(true);
    });

    it('יש התאמות → `canReplace` של המנוע מכריע, כי אז הוא תשובה אמיתית', () => {
      expect(replaceControlsVisible(state({ total: 5, canReplace: true }))).toBe(true);
      expect(replaceControlsVisible(state({ total: 5, canReplace: false }))).toBe(false);
    });
  });

  it('replace שמחזיר Promise — המצב מוחזק עד ש-settled, והתוצאה מדווחת', async () => {
    let settle: ((result: ActionResult) => void) | undefined;
    const double = strictSearchHandle({
      onReplace: () =>
        new Promise<ActionResult>((resolve) => {
          settle = resolve;
        }),
    });
    const adapter = createSearchAdapter(double.host);
    const states: boolean[] = [];
    adapter.subscribe((state) => states.push(state.isReplacing));

    adapter.find('לפני', 'next');
    const pending = adapter.replace('אחרי');

    // עוד לא נפתר: המצב מסומן כהחלפה שרצה, וכך פקדי ההחלפה מושתקים.
    expect(adapter.getState().isReplacing).toBe(true);
    expect(states).toContain(true);

    settle?.({ ok: true });
    const outcome = await pending;

    expect(outcome.ok).toBe(true);
    expect(adapter.getState().isReplacing).toBe(false);
    expect(states[states.length - 1]).toBe(false);
  });

  it('כשל א-סינכרוני של replace מגיע כהודעה, והמצב משתחרר', async () => {
    const double = strictSearchHandle({
      onReplace: async () => ({ ok: false, reason: 'operation-unavailable' }),
    });
    const adapter = createSearchAdapter(double.host);

    adapter.find('לפני', 'next');
    const outcome = await adapter.replace('אחרי');

    expect(outcome).toEqual({
      ok: false,
      message: REASON_TEXT['operation-unavailable'],
      reason: 'operation-unavailable',
    });
    expect(adapter.getState().isReplacing).toBe(false);
  });

  it('החלפה שנייה בזמן שהראשונה רצה אינה נשלחת למנוע', async () => {
    let settle: ((result: ActionResult) => void) | undefined;
    const double = strictSearchHandle({
      onReplace: () =>
        new Promise<ActionResult>((resolve) => {
          settle = resolve;
        }),
    });
    const adapter = createSearchAdapter(double.host);

    adapter.find('לפני', 'next');
    const first = adapter.replace('אחרי');
    const second = await adapter.replace('אחרי');

    expect(second.ok).toBe(false);
    expect(double.calls.filter((call) => call.name === 'replace')).toHaveLength(1);

    settle?.({ ok: true });
    await first;
  });
});

describe('המעטפת מחוברת להכרעה הזאת', () => {
  const APP = readFileSync(join(process.cwd(), 'src/App.vue'), 'utf8');

  it('הדיאלוג מקבל את `replaceControlsVisible` ולא את `canReplace` של המנוע', () => {
    // החיבור הישיר הוא מה שהעלים את שדה ההחלפה ברגע שהוקלדה מילה שאינה במסמך.
    expect(APP).toContain('replaceControlsVisible(searchState.value)');
    expect(APP).toContain(':can-replace="canShowReplace"');
    expect(APP).not.toContain(':can-replace="searchState.canReplace"');
  });

  it('„אין התאמות” אינו מגיע לשורת המצב כשגיאה', () => {
    // `setStatus(..., true)` צובע באדום **ושולח ל-notifyError של אוצריא**.
    // שאילתה שלא נמצאה היא מידע, ולא תקלה שצריך לדווח עליה.
    expect(APP).toContain("REPLACE_NOT_AN_ERROR = new Set(['no-matches', 'no-query'])");
    expect(APP).toContain('REPLACE_NOT_AN_ERROR.has(outcome.reason');
  });
});

describe('createSearchAdapter — השקטה של חיפוש בזמן הקלדה', () => {
  it('כמה הקשות רצופות מתלכדות לקריאת search אחת', () => {
    vi.useFakeTimers();
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);
    const outcomes: string[] = [];
    const collect = (): void => {
      outcomes.push('called');
    };

    adapter.findDebounced('ב', collect);
    adapter.findDebounced('בר', collect);
    adapter.findDebounced('ברא', collect);
    adapter.findDebounced('בראשית', collect);

    // לפני שהמרווח חלף אין שום קריאה למנוע.
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    expect(double.names()).toEqual([]);

    vi.advanceTimersByTime(1);
    const searches = double.calls.filter((call) => call.name === 'search');
    expect(searches).toHaveLength(1);
    expect(searches[0].args).toEqual(['בראשית']);
    expect(outcomes).toHaveLength(1);
  });

  it('חיפוש בזמן הקלדה אינו מקדם התאמות', () => {
    vi.useFakeTimers();
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.findDebounced('בראשית', () => {});
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(double.names()).toEqual(['search']);
  });

  it('סגירת הדיאלוג מבטלת הקלדה שממתינה', () => {
    vi.useFakeTimers();
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.findDebounced('בראשית', () => {});
    adapter.close();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);

    expect(double.names()).toEqual(['close']);
  });

  it('פירוק האדפטר מבטל הקלדה שממתינה', () => {
    vi.useFakeTimers();
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    adapter.findDebounced('בראשית', () => {});
    adapter.dispose();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);

    expect(double.names()).toEqual([]);
  });
});

describe('createSearchAdapter — מצב והרשמה', () => {
  it('המצב נקרא מהמנוע ולא מ-state מקומי', () => {
    const double = strictSearchHandle({
      slice: { query: 'בראשית', total: 12, activeIndex: 2, open: true },
    });
    const adapter = createSearchAdapter(double.host);

    expect(adapter.getState()).toEqual({
      query: 'בראשית',
      total: 12,
      activeIndex: 2,
      open: true,
      available: true,
      canReplace: true,
      isReplacing: false,
    });
  });

  it('שינוי במנוע מגיע למי שנרשם', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);
    const seen: Array<{ total: number; activeIndex: number }> = [];

    const off = adapter.subscribe((state) =>
      seen.push({ total: state.total, activeIndex: state.activeIndex })
    );
    double.patch({ query: 'בראשית', total: 12, activeIndex: 2 });
    off();
    double.patch({ total: 99 });

    // ההרשמה יורה מיד עם המצב הנוכחי, ואז על כל שינוי — עד הביטול.
    expect(seen).toEqual([
      { total: 0, activeIndex: -1 },
      { total: 12, activeIndex: 2 },
    ]);
  });

  it('פתיחת הדיאלוג פותחת session, וסגירה מנקה הדגשות', () => {
    const double = strictSearchHandle();
    const adapter = createSearchAdapter(double.host);

    const opened = adapter.open();
    expect(opened.ok).toBe(true);
    expect(opened.ok && opened.snapshot.open).toBe(true);

    adapter.close();
    expect(double.names()).toEqual(['open', 'close']);
  });
});

describe('searchCounterText', () => {
  it('מונה התוצאות נגזר מ-total ומ-activeIndex', () => {
    expect(
      searchCounterText({ ...idleSearchState(), query: 'בראשית', total: 12, activeIndex: 2 })
    ).toBe('3 מתוך 12');
  });

  it('אין התאמות — „אין תוצאות” ולא מונה ריק', () => {
    expect(searchCounterText({ ...idleSearchState(), query: 'אשכנז', total: 0 })).toBe(
      'אין תוצאות'
    );
  });

  it('בלי שאילתה אין מונה', () => {
    expect(searchCounterText(idleSearchState())).toBe('');
    expect(searchCounterText({ ...idleSearchState(), total: 12, activeIndex: 0 })).toBe('');
  });

  it('התאמות בלי התאמה פעילה מציגות את המספר, ולא „1 מתוך”', () => {
    expect(
      searchCounterText({ ...idleSearchState(), query: 'בראשית', total: 12, activeIndex: -1 })
    ).toBe('12 תוצאות');
  });
});

/**
 * הבאג המקורי לא היה במודול הזה אלא בחיווט: `(ui as any).search?.find?.()`
 * בתוך `catch` ריק. הכפיל הקפדני שומר על המודול, והבדיקה הזאת שומרת על
 * החיווט — מקום שאין בו כרגע תשתית לבדיקת קומפוננטות.
 */
describe('החיווט ב-App.vue', () => {
  const app = readFileSync(join(process.cwd(), 'src', 'App.vue'), 'utf8');

  it('אין `as any` על ה-controller', () => {
    expect(app).not.toMatch(/as any/);
  });

  it('אין קריאה ל-search.find ואין catch ריק', () => {
    expect(app).not.toMatch(/\.find\?\.\(/);
    expect(app).not.toMatch(/catch\s*\{\s*(\/\/[^\n]*\n\s*)?\}/);
  });

  it('החיפוש עובר דרך האדפטר', () => {
    expect(app).toMatch(/createSearchAdapter/);
    expect(app).toMatch(/searchAdapter\?\.find\(/);
  });
});
