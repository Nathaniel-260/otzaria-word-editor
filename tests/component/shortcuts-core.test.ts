/**
 * שלב 1 — הקיצורים נמדדים על המעטפת האמיתית.
 *
 * למה לא על המנתב לבדו: המנתב כבר נבדק ב-`tests/unit/shortcut-dispatch.test.ts`
 * מול כפילים. מה שהוא **אינו** יכול להוכיח הוא שהמעטפת חיווטה אותו למי שאמור
 * לענות — שהפקודה הגיעה ל-controller, שהפעולה הגיעה ל-Document API, ושהמזהה
 * וה-payload הם אלה שהמנוע מקבל ולא מה שנראה נכון. זו בדיוק המחלקה של באגים
 * ש-`App.vue` סבל ממנה: פונקציה שקיימת ואינה מחוברת.
 *
 * הקיצורים חייבים לעבוד ללא תלות בלשונית הפתוחה — לשוניות הרצועה מורכבות רק
 * כשהן פעילות — ולכן כולם נמדדים כאן, על המעטפת, ולא דרך פקד בלשונית.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  autoUnmount,
  createCommandDouble,
  createSuperdocDouble,
  settle,
  type CommandDouble,
  type SuperdocDouble,
} from './harness';
import type { SaveCoordinatorDeps } from '../../src/sessions/save-coordinator';

const stub = vi.hoisted(() => ({
  saveNowCalls: [] as Array<{ forceSaveAs?: boolean } | undefined>,
  session: null as unknown,
  adapter: null as unknown,
  pickCalls: 0,
  /** מצב השמירה שהקואורדינטור מדווח. בדיקה יכולה להפוך אותו למלוכלך. */
  isDirty: false,
  /** מה שנשאל בדיאלוג האישור של אוצריא, לפי הסדר. */
  confirms: [] as string[],
  /** התשובה של המשתמש בדיאלוג. */
  confirmAnswer: false,
  /** כמה פעמים מצב השמירה אופס — כלומר מסמך חדש נפתח. */
  resets: 0,
}));

vi.mock('../../src/engine/create-editor', () => ({
  createEditor: vi.fn(),
  OPEN_TIMEOUT_MS: 1_000,
}));

vi.mock('../../src/sessions/editor-swap', () => ({
  createEditorSwap: () => ({
    get current() {
      return stub.session;
    },
    get isOpening() {
      return false;
    },
    open: async () => ({ status: 'opened', session: stub.session }),
    destroy: () => {},
  }),
}));

vi.mock('../../src/sessions/save-coordinator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/sessions/save-coordinator')>()),
  createSaveCoordinator: (_deps: SaveCoordinatorDeps) => ({
    get snapshot() {
      return {
        state: 'idle',
        isDirty: stub.isDirty,
        isSaving: false,
        targetToken: null,
        name: null,
        lastError: null,
      };
    },
    markDirty: () => {},
    setAutosaveEnabled: () => {},
    adoptTarget: () => {},
    reset: () => {
      stub.resets += 1;
    },
    saveNow: async (options?: { forceSaveAs?: boolean }) => {
      stub.saveNowCalls.push(options);
      return { status: 'saved', token: 'token-1', name: 'מסמך.docx' };
    },
    dispose: () => {},
  }),
}));

vi.mock('../../src/engine/command-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/engine/command-adapter')>()),
  createCommandAdapter: () => stub.adapter,
}));

vi.mock('../../src/engine/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/search')>();
  return {
    ...actual,
    createSearchAdapter: () => ({
      getState: () => actual.idleSearchState(),
      subscribe: () => () => {},
      open: () => ({ ok: true, snapshot: actual.idleSearchState() }),
      close: () => {},
      clear: () => {},
      find: () => ({ ok: true, snapshot: actual.idleSearchState() }),
      findDebounced: () => {},
      replace: async () => ({ ok: true, snapshot: actual.idleSearchState() }),
      replaceAll: async () => ({ ok: true, snapshot: actual.idleSearchState() }),
      dispose: () => {},
    }),
  };
});

vi.mock('../../src/engine/doc-metrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/doc-metrics')>();
  return {
    ...actual,
    createDocMetrics: () => ({
      getState: () => actual.emptyDocMetrics(),
      noteDocumentChanged: () => {},
      noteSelectionChanged: () => {},
      notePaginationUpdate: () => {},
      measureNow: () => {},
      dispose: () => {},
    }),
  };
});

vi.mock('../../src/engine/document-defaults', () => ({
  applyHebrewDocumentDefaults: async () => ({ failures: [] }),
  applyHebrewPaperSize: async () => ({ applied: true }),
}));

vi.mock('../../src/host/settings', () => ({
  loadLastDocument: async () => null,
  saveLastDocument: async () => {},
  forgetLastDocument: async () => {},
  loadAutosaveEnabled: async () => true,
  saveAutosaveEnabled: async () => {},
}));

vi.mock('../../src/host/otzaria-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/host/otzaria-client')>()),
  confirm: async (question: { title: string }) => {
    stub.confirms.push(question.title);
    return stub.confirmAnswer;
  },
  notifyError: () => {},
}));

vi.mock('../../src/host/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/host/files')>()),
  pickDocxFile: async () => {
    stub.pickCalls += 1;
    return null;
  },
}));

const { default: App } = await import('../../src/App.vue');

autoUnmount();

let adapter: CommandDouble;
let superdoc: SuperdocDouble;

async function mountShell() {
  const wrapper = mount(App, { attachTo: document.body });
  await settle(12);
  return wrapper;
}

/** אירוע מקלדת אמיתי על `window`, בדיוק כמו לחיצה של המשתמש. */
function press(over: Partial<KeyboardEventInit> & { code: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...over });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  stub.saveNowCalls.length = 0;
  stub.confirms.length = 0;
  stub.pickCalls = 0;
  stub.resets = 0;
  stub.isDirty = false;
  stub.confirmAnswer = false;
  adapter = createCommandDouble();
  superdoc = createSuperdocDouble();
  stub.adapter = adapter;
  stub.session = {
    superdoc: superdoc.host,
    ui: { selection: { observe: () => () => {} } },
    onDispose: () => {},
    destroy: () => {},
  };
});

describe('פקודות המנוע', () => {
  const cases: ReadonlyArray<readonly [string, Partial<KeyboardEventInit> & { code: string }, string]> = [
    ['Ctrl+Z', { code: 'KeyZ', ctrlKey: true }, 'undo'],
    ['Ctrl+Y', { code: 'KeyY', ctrlKey: true }, 'redo'],
    ['Ctrl+Shift+Z', { code: 'KeyZ', ctrlKey: true, shiftKey: true }, 'redo'],
    ['Ctrl+B', { code: 'KeyB', ctrlKey: true }, 'bold'],
    ['Ctrl+I', { code: 'KeyI', ctrlKey: true }, 'italic'],
    ['Ctrl+U', { code: 'KeyU', ctrlKey: true }, 'underline'],
    ['Ctrl+Shift+8', { code: 'Digit8', ctrlKey: true, shiftKey: true }, 'formatting-marks'],
  ];

  for (const [label, init, commandId] of cases) {
    it(`${label} מריץ ${commandId}`, async () => {
      await mountShell();

      const event = press(init);
      await settle();

      expect(adapter.calls.map((call) => call.id)).toEqual([commandId]);
      expect(event.defaultPrevented).toBe(true);
    });
  }

  it('כותרות שולחות את מזהה הסגנון ש-linked-style מקבל', async () => {
    await mountShell();

    press({ code: 'Digit1', ctrlKey: true, altKey: true });
    press({ code: 'Digit2', ctrlKey: true, altKey: true });
    press({ code: 'Digit3', ctrlKey: true, altKey: true });
    await settle();

    expect(adapter.calls).toEqual([
      { id: 'linked-style', payload: { style: 'Heading1' } },
      { id: 'linked-style', payload: { style: 'Heading2' } },
      { id: 'linked-style', payload: { style: 'Heading3' } },
    ]);
  });

  it('Ctrl+B עובד גם בפריסת מקלדת עברית', async () => {
    await mountShell();

    press({ key: 'נ', code: 'KeyB', ctrlKey: true });
    await settle();

    expect(adapter.calls.map((call) => call.id)).toEqual(['bold']);
  });

  it('פקודה חסומה מדווחת בעברית ואינה נופלת', async () => {
    adapter = createCommandDouble({ failures: { undo: 'history-empty' } });
    stub.adapter = adapter;
    const wrapper = await mountShell();

    press({ code: 'KeyZ', ctrlKey: true });
    await settle();

    expect(wrapper.find('.status-message').text()).toContain('אין פעולה לבטל');
  });

  it('פקודה שאינה זמינה: המנוע מסרב, והמשתמש מקבל הסבר', async () => {
    // ההבדל מכפתור: כפתור מנוטרל אינו נלחץ בכלל, וקיצור אין דרך „לנטרל”.
    // לכן הוא כן מגיע לאדפטר — והתשובה היא סירוב מנומק ולא שינוי שקט במסמך.
    adapter = createCommandDouble({ states: { bold: { enabled: false } } });
    stub.adapter = adapter;
    const wrapper = await mountShell();

    press({ code: 'KeyB', ctrlKey: true });
    await settle();

    expect(adapter.applied, 'המסמך לא שונה').toEqual([]);
    expect(adapter.blocked.map((call) => call.id)).toEqual(['bold']);
    expect(wrapper.find('.status-message').text().length).toBeGreaterThan(0);
  });
});

describe('פעולות המעטפת', () => {
  it('Ctrl+A בוחר את כל המסמך דרך ה-Document API', async () => {
    await mountShell();

    const event = press({ code: 'KeyA', ctrlKey: true });
    await settle();

    expect(superdoc.ops()).toContain('ranges.resolve');
    expect(event.defaultPrevented).toBe(true);
    // לא דרך ה-controller: ל„בחר הכל” אין פקודה בקטלוג.
    expect(adapter.calls).toEqual([]);
  });

  it('Ctrl+Enter מתחיל פסקה בעמוד חדש', async () => {
    await mountShell();

    press({ code: 'Enter', ctrlKey: true });
    await settle();

    expect(superdoc.ops()).toContain('format.paragraph.setFlowOptions');
  });

  it('Enter לבד אינו מוסיף מעבר עמוד', async () => {
    await mountShell();

    const event = press({ code: 'Enter' });
    await settle();

    expect(superdoc.ops()).not.toContain('format.paragraph.setFlowOptions');
    expect(event.defaultPrevented).toBe(false);
  });

  it('Ctrl+O פותח את בורר הקבצים של אוצריא', async () => {
    await mountShell();

    press({ code: 'KeyO', ctrlKey: true });
    await settle();

    expect(stub.pickCalls).toBe(1);
  });

  it('Ctrl+N פותח מסמך חדש', async () => {
    await mountShell();
    stub.resets = 0;

    const event = press({ code: 'KeyN', ctrlKey: true });
    await settle();

    expect(stub.resets, 'מסמך חדש נפתח').toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Ctrl+N על מסמך מלוכלך שואל לפני שהוא מוחק עבודה', async () => {
    // המסלול המסוכן בשלב הזה: קיצור שמוחק את מה שהמשתמש כתב. הוא חייב לעבור
    // באותה הכרעה בדיוק שהכפתור עובר בה — `decideDocumentSwitch` — ולא לקצר.
    await mountShell();
    stub.isDirty = true;
    stub.resets = 0;

    press({ code: 'KeyN', ctrlKey: true });
    await settle();

    // אותה שרשרת שאלות בדיוק שהכפתור „מסמך חדש” עובר בה.
    expect(stub.confirms, 'המשתמש נשאל').toEqual(['המסמך לא נשמר', 'לפתוח בלי לשמור?']);
    expect(stub.resets, 'ובלי אישור — לא נפתח מסמך חדש').toBe(0);
  });

  it('Ctrl+O עובר באותו מסלול של הכפתור: קודם בורר הקבצים', async () => {
    // ב-`onPickAndOpen` הבחירה קודמת לשאלה על השינויים שלא נשמרו, ולכן ביטול
    // בבורר אינו מגיע לשאלה בכלל. הקיצור אינו מקצר את המסלול הזה.
    await mountShell();
    stub.isDirty = true;

    press({ code: 'KeyO', ctrlKey: true });
    await settle();

    expect(stub.pickCalls, 'בורר הקבצים נפתח').toBe(1);
    expect(stub.confirms, 'הבחירה בוטלה — אין מה לשאול').toEqual([]);
  });

  it('F12 הוא „שמור בשם”', async () => {
    await mountShell();

    const event = press({ code: 'F12' });
    await settle();

    expect(stub.saveNowCalls.map((call) => call?.forceSaveAs)).toEqual([true]);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('מה שהקיצורים אינם עושים', () => {
  it('פוקוס בשדה טקסט של הממשק: קיצור מסמך אינו נורה', async () => {
    const wrapper = await mountShell();

    const input = wrapper.find('.doc-title-input');
    (input.element as HTMLInputElement).focus();
    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await settle();

    expect(adapter.calls).toEqual([]);
  });

  it('Ctrl+A בשדה טקסט נשאר של הדפדפן', async () => {
    const wrapper = await mountShell();

    const input = wrapper.find('.doc-title-input');
    const event = new KeyboardEvent('keydown', {
      code: 'KeyA',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.element.dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(superdoc.ops()).not.toContain('ranges.resolve');
  });

  it('כל צירוף מוכר בולע את ברירת המחדל של הדפדפן', async () => {
    // בלי זה ה-WebView פותח את הדיאלוגים שלו („שמירת דף”, „הדפסה”) מעל התוסף.
    await mountShell();

    const combos: Array<Partial<KeyboardEventInit> & { code: string }> = [
      { code: 'KeyZ', ctrlKey: true },
      { code: 'KeyY', ctrlKey: true },
      { code: 'KeyB', ctrlKey: true },
      { code: 'KeyI', ctrlKey: true },
      { code: 'KeyU', ctrlKey: true },
      { code: 'KeyA', ctrlKey: true },
      { code: 'KeyN', ctrlKey: true },
      { code: 'KeyO', ctrlKey: true },
      { code: 'KeyP', ctrlKey: true },
      { code: 'Enter', ctrlKey: true },
      { code: 'NumpadEnter', ctrlKey: true },
      { code: 'Digit8', ctrlKey: true, shiftKey: true },
      { code: 'Digit1', ctrlKey: true, altKey: true },
      { code: 'F12' },
    ];

    const swallowed = combos.filter((init) => press(init).defaultPrevented);
    await settle();

    expect(swallowed).toHaveLength(combos.length);
  });

  it('Ctrl+Shift+8 הוא מתג: כל לחיצה שולחת את הפקודה מחדש', async () => {
    await mountShell();

    press({ code: 'Digit8', ctrlKey: true, shiftKey: true });
    press({ code: 'Digit8', ctrlKey: true, shiftKey: true });
    await settle();

    expect(adapter.calls.map((call) => call.id)).toEqual([
      'formatting-marks',
      'formatting-marks',
    ]);
  });

  it('Escape בלי חלון פתוח אינו נבלע', async () => {
    // נסיגה שנמצאה ב-QA: בליעה גורפת של Escape הייתה חוסמת את ה-Escape של
    // המנוע ושל הדפדפן, גם כשלא היה לנו מה לסגור.
    await mountShell();

    const event = press({ code: 'Escape' });
    await settle();

    expect(event.defaultPrevented).toBe(false);
  });

  it('צירוף שכבר טופל אינו רץ פעם שנייה', async () => {
    // המאזין שלנו יושב על window אחרי ה-keymap של המנוע. אם המנוע כבר טיפל
    // ב-Ctrl+B, הרצה נוספת שלנו הייתה מבטלת את ההדגשה שהוא זה עתה החיל.
    await mountShell();

    const event = new KeyboardEvent('keydown', {
      code: 'KeyB',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);
    await settle();

    expect(adapter.calls).toEqual([]);
  });

  it('צירוף שאינו ברשימה אינו נבלע', async () => {
    await mountShell();

    const event = press({ code: 'KeyQ', ctrlKey: true });
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(adapter.calls).toEqual([]);
  });
});
