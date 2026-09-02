/**
 * המעטפת עצמה — `App.vue` — מורכבת ונלחצת.
 *
 * ## למה הקובץ הזה קיים
 *
 * 915 שורות של חיווט מעטפת (שמירה, פתיחה, autosave, שם המסמך, דיאלוגים,
 * מטריקות) היו מאומתות **רק** ב-`readFileSync` + regex. סריקת מקור אינה יכולה
 * להבחין בין „הפונקציה קיימת” ל„הפונקציה מחוברת לפקד ומגיעה למי שאמור לענות
 * לה”, וזה נמדד: מוטציה שהסירה את `save?.setAutosaveEnabled(...)` מ-
 * `toggleAutosave` — כלומר החזירה את מתג השמירה האוטומטית להיות דקורטיבי,
 * הבאג המקורי בדיוק — עברה 203 בדיקות בירוק.
 *
 * ## הכפילים, ומה שנשאר אמיתי
 *
 * `onMounted` של המעטפת מקים מנוע SuperDoc אמיתי, ולכן מוחלפים בכפיל בדיוק
 * הדברים שאין להם קיום ב-jsdom או שהתשובה שלהם היא מה שנבדק:
 *
 *   * `engine/create-editor` — מייבא `superdoc` ו-workers. לא מגיעים אליו כאן
 *     בכלל (ה-swap מוחלף), אבל הייבוא הסטטי לבדו מפיל את ההרכבה.
 *   * `sessions/editor-swap` — מחזיר session מזויף שמצליח מיד.
 *   * `sessions/save-coordinator` — **זה מה שנמדד**: כל קריאה אליו מוקלטת, וגם
 *     ה-deps שלו נשמרים כדי שהבדיקה תוכל לדחוף snapshot ולראות מה הפס מציג.
 *   * `engine/command-adapter`, `engine/search`, `engine/doc-metrics`,
 *     `engine/document-defaults` — נשענים על handle של מנוע חי.
 *   * `host/settings` — כדי שהמתג יימדד גם על השאלה אם הבחירה נשמרה.
 *
 * מה שנשאר אמיתי: `TitleBar`, `Ribbon`, `StatusBar` והדיאלוגים, כל הזרימה של
 * `openDocument`, מטפל המקלדת, ו-`host/files`/`otzaria-client` (הם ניגשים
 * ל-`window.Otzaria` שאינו קיים ומחזירים כשל בשקט — בדיוק כמו בדפדפן).
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
import type { SaveCoordinatorDeps, SaveSnapshot } from '../../src/sessions/save-coordinator';
import { COMMAND_REPORTER, STATUS_NOTIFIER, type CommandReporter } from '../../src/composables/keys';

/**
 * המצב המשותף לכפילים. `vi.hoisted` נדרש: מפעלי ה-`vi.mock` מורמים אל מעל
 * הייבואים ורצים לפני גוף הקובץ, ולכן משתנה רגיל בהיקף המודול היה TDZ.
 */
const stub = vi.hoisted(() => ({
  /** מה שהקואורדינטור קיבל. `[]` אחרי מוטציה שמנתקת את המתג. */
  autosaveCalls: [] as boolean[],
  /** מה ש-`saveNow` קיבל, לפי הסדר. */
  saveNowCalls: [] as Array<{ forceSaveAs?: boolean; suggestedName?: string } | undefined>,
  markDirtyCalls: 0,
  resetCalls: 0,
  /** מה שנשמר להפעלה הבאה. */
  persistedAutosave: [] as boolean[],
  /** מה שההעדפה השמורה מחזירה בעלייה. */
  storedAutosave: true,
  /** מצב הסרגל שנשמר בהפעלה הקודמת. */
  storedRuler: false,
  /** מה שנכתב לאחסון בשביל הסרגל, לפי הסדר. */
  persistedRuler: [] as boolean[],
  /** רשומת ההפעלה שה-storage מחזיר בעלייה. */
  storedSession: null as unknown,
  /** כל מה שנכתב לרשומת ההפעלה, לפי הסדר. */
  persistedSessions: [] as unknown[],
  searchOpens: 0,
  /** ה-deps שהמעטפת נתנה לקואורדינטור — דרך לדחוף snapshot כמו המנוע. */
  saveDeps: null as SaveCoordinatorDeps | null,
  /** ה-session שה-swap „פתח”. מוגדר בכל בדיקה מחדש. */
  session: null as unknown,
  /** כפיל המופע שבתוך ה-session, כדי לראות מה המעטפת ביקשה מהמנוע. */
  superdoc: null as SuperdocDouble | null,
  /** האדפטר שהמעטפת תזריק לרצועה. */
  adapter: null as unknown,
  /** מה שכל פתיחה קיבלה כמקור: URL, Blob, או undefined למסמך ריק. */
  openSources: [] as unknown[],
  /** מה ש-`resolveFileUrl` מחזיר — `null` = הקובץ אינו נגיש יותר. */
  resolvedFile: null as unknown,
  /** בייטי הטיוטה שבמרחב הפרטי, או `null` כשאין. */
  draftBytes: null as Uint8Array | null,
  /** כמה פעמים נמחקה הטיוטה. */
  draftRemovals: 0,
  /** מה ש-`ui.selection.apply` קיבל — כלומר לאן הסמן הוחזר. */
  caretApplied: [] as unknown[],
  /** המפתח הישן, בשביל מסלול השדרוג. */
  lastDocument: null as unknown,
  /** האם המפתח הישן נמחק אחרי שהומר. */
  forgotLastDocument: false,
  /** כמה פתיחות הבאות ייכשלו. */
  openFailures: 0,
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
    open: async (source?: unknown) => {
      stub.openSources.push(source);
      if (stub.openFailures > 0) {
        stub.openFailures -= 1;
        return { status: 'failed', error: new Error('worker לא עלה') };
      }
      return { status: 'opened', session: stub.session };
    },
    destroy: () => {},
  }),
}));

vi.mock('../../src/host/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/host/files')>()),
  resolveFileUrl: async () => stub.resolvedFile,
}));

vi.mock('../../src/host/workspace', () => ({
  MAX_PAYLOAD_BYTES: 10,
  MAX_CONTENT_BYTES: 7,
  readWorkspaceBytes: async () => stub.draftBytes,
  writeWorkspaceBytes: async () => true,
  deleteWorkspaceEntry: async () => {
    stub.draftRemovals += 1;
  },
}));

vi.mock('../../src/sessions/save-coordinator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/sessions/save-coordinator')>()),
  createSaveCoordinator: (deps: SaveCoordinatorDeps) => {
    stub.saveDeps = deps;
    return {
      snapshot: {
        state: 'idle',
        isDirty: false,
        isSaving: false,
        targetToken: null,
        name: null,
        lastError: null,
      },
      markDirty: () => {
        stub.markDirtyCalls += 1;
      },
      setAutosaveEnabled: (enabled: boolean) => {
        stub.autosaveCalls.push(enabled);
      },
      adoptTarget: () => {},
      reset: () => {
        stub.resetCalls += 1;
      },
      saveNow: async (options?: { forceSaveAs?: boolean; suggestedName?: string }) => {
        stub.saveNowCalls.push(options);
        // הכפיל מודיע על השמירה כמו הקואורדינטור האמיתי. בלי זה כל בדיקה
        // כאן הייתה מודדת מעטפת שאינה שומעת שמירה אוטומטית בכלל.
        stub.saveDeps?.onSaved?.({ token: 'token-1', name: 'מסמך.docx', size: 4_096 });
        return { status: 'saved', token: 'token-1', name: 'מסמך.docx', size: 4_096 };
      },
      dispose: () => {},
    };
  },
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
      open: () => {
        stub.searchOpens += 1;
        return { ok: true, snapshot: actual.idleSearchState() };
      },
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
  loadLastDocument: async () => stub.lastDocument,
  forgetLastDocument: async () => {
    stub.forgotLastDocument = true;
  },
  loadAutosaveEnabled: async () => stub.storedAutosave,
  saveAutosaveEnabled: async (enabled: boolean) => {
    stub.persistedAutosave.push(enabled);
  },
  loadRulerVisible: async () => stub.storedRuler,
  saveRulerVisible: async (visible: boolean) => {
    stub.persistedRuler.push(visible);
  },
  loadSessionRecord: async () => stub.storedSession,
  saveSessionRecord: async (value: unknown) => {
    stub.persistedSessions.push(value);
  },
  loadSpellcheckEnabled: async () => false,
  saveSpellcheckEnabled: async () => {},
  loadSpellcheckWords: async () => [],
  saveSpellcheckWords: async () => {},
}));

// הייבוא **אחרי** ה-mocks במכוון (הם מורמים בכל מקרה, וזה הסדר שקורא נכון).
const { default: App } = await import('../../src/App.vue');

autoUnmount();

/** מרכיבה את המעטפת ומחזירה בקרה רק אחרי שכל זרימת ה-`onMounted` נרגעה. */
async function mountShell(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(App, { attachTo: document.body });
  // זרימת העלייה היא שרשרת של await-ים (העדפה, swap, openDocument, ברירות
  // מחדל של מסמך חדש), ולכן nextTick אחד אינו מספיק.
  await settle(12);
  return wrapper;
}

beforeEach(() => {
  stub.autosaveCalls.length = 0;
  stub.saveNowCalls.length = 0;
  stub.persistedAutosave.length = 0;
  stub.persistedSessions.length = 0;
  stub.storedSession = null;
  stub.openSources.length = 0;
  stub.resolvedFile = null;
  stub.draftBytes = null;
  stub.draftRemovals = 0;
  stub.caretApplied.length = 0;
  stub.lastDocument = null;
  stub.forgotLastDocument = false;
  stub.openFailures = 0;
  stub.markDirtyCalls = 0;
  stub.resetCalls = 0;
  stub.searchOpens = 0;
  stub.storedAutosave = true;
  stub.storedRuler = false;
  stub.persistedRuler.length = 0;
  stub.saveDeps = null;
  stub.adapter = createCommandDouble();
  stub.superdoc = createSuperdocDouble();
  stub.session = {
    superdoc: stub.superdoc.host,
    // ה-controller המזויף: רק מה שהמעטפת נוגעת בו ישירות. שאר הקוראים
    // (`observeZoom`, `observeFontOptions`, `observeStyleGallery`) מתוכננים
    // ליפול לברירת מחדל כשה-handle חסר, וזה מה שנמדד בבדיקות שלהם.
    ui: {
      selection: {
        observe: () => () => {},
        // מה ששחזור הסמן נשען עליו. `apply` מקליט את מה שהוא קיבל, ומצליח
        // תמיד — השאלה כאן היא אם המעטפת חיווטה אותו, לא אם המנוע יודע.
        apply: (target: unknown) => {
          stub.caretApplied.push(target);
          return { ok: true };
        },
      },
      viewport: { scrollIntoView: async () => ({ success: true }) },
    },
    onDispose: () => {},
    destroy: () => {},
  };
});

describe('הרכבת המעטפת', () => {
  it('העלייה פותחת מסמך ומחווטת את הפס, הרצועה ושורת המצב', async () => {
    // בלי זה כל הבדיקות למטה יכולות לעבור בירוק על מעטפת שלא סיימה לעלות.
    const wrapper = await mountShell();

    expect(wrapper.find('.word-titlebar').exists()).toBe(true);
    expect(wrapper.find('.word-statusbar').exists()).toBe(true);
    expect(wrapper.find('.editor-stack').exists()).toBe(true);
    expect(stub.saveDeps, 'הקואורדינטור הוקם').not.toBeNull();
    expect(stub.resetCalls, 'הפתיחה איפסה את מצב השמירה').toBe(1);
  });

  it('המסמך שנפתח מקבל את הסמן — אפשר להקליד בלי קליק מקדים', async () => {
    // הבאג שהתיקון בא לו: העורך נפתח, ההקלדה לא הגיעה לשום מקום, והמשתמש היה
    // צריך ללחוץ עם העכבר בגוף הטקסט לפני שיכול היה לכתוב מילה.
    await mountShell();

    expect(stub.superdoc?.ops(), 'הפתיחה ביקשה מהמנוע להחזיר את הסמן').toContain('focus');
  });

  it('פתיחה אינה חוטפת את הפוקוס משדה שמקלידים בו', async () => {
    // הפתיחה אסינכרונית ויכולה להימשך שניות. אם בינתיים המשתמש הקליד בשורת
    // החיפוש (שאינה מודאלית ונשארת פתוחה מעל המסמך), קפיצה לגוף המסמך הייתה
    // מוחקת לו את ההקלדה באמצע.
    const wrapper = await mountShell();
    await wrapper.find('.search-box').trigger('click');
    await settle();
    document.querySelector<HTMLInputElement>('#fr-search-input')?.focus();
    stub.superdoc?.reset();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', ctrlKey: true }));
    await settle(12);

    expect(stub.resetCalls, 'המסמך החדש אכן נפתח').toBe(2);
    expect(stub.superdoc?.ops(), 'הפוקוס נשאר בשדה החיפוש').not.toContain('focus');
  });
});

describe('מתג השמירה האוטומטית', () => {
  it('לחיצה מגיעה לקואורדינטור — לא רק לצבע של הפיל', async () => {
    // זו המוטציה שחמקה: הסרת `save?.setAutosaveEnabled(...)` השאירה מתג שמזיז
    // את הכפתור ואינו מכבה שום דבר, ו-203 בדיקות עברו.
    const wrapper = await mountShell();

    // העלייה טוענת את ההעדפה השמורה ומעבירה אותה לקואורדינטור.
    expect(stub.autosaveCalls).toEqual([true]);

    const toggle = wrapper.find('.autosave-toggle');
    expect(toggle.attributes('aria-checked')).toBe('true');

    await toggle.trigger('click');
    await settle();

    expect(stub.autosaveCalls, 'הכיבוי הגיע לקואורדינטור').toEqual([true, false]);
    expect(wrapper.find('.autosave-toggle').attributes('aria-checked')).toBe('false');
  });

  it('הבחירה נשמרת להפעלה הבאה', async () => {
    const wrapper = await mountShell();

    await wrapper.find('.autosave-toggle').trigger('click');
    await settle();

    expect(stub.persistedAutosave).toEqual([false]);
  });

  it('ההעדפה השמורה היא זו שנטענת, ולא ברירת המחדל', async () => {
    // כיבוי בהפעלה קודמת חייב להגיע לקואורדינטור **לפני** העריכה הראשונה,
    // אחרת סבב ה-autosave הראשון רץ לפי ברירת המחדל.
    stub.storedAutosave = false;

    const wrapper = await mountShell();

    expect(stub.autosaveCalls).toEqual([false]);
    expect(wrapper.find('.autosave-toggle').attributes('aria-checked')).toBe('false');
  });
});

describe('שמירה', () => {
  it('כפתור השמירה בסרגל המהיר מריץ שמירה על המסמך הפתוח', async () => {
    const wrapper = await mountShell();

    await wrapper.findAll('.qa-btn')[0]!.trigger('click');
    await settle();

    expect(stub.saveNowCalls).toHaveLength(1);
    expect(stub.saveNowCalls[0]).toMatchObject({ forceSaveAs: false });
  });

  it('Ctrl+S שומר, ו-Ctrl+Shift+S הוא „שמור בשם”', async () => {
    // המטפל יושב על `window`, ולכן זה מה שמעיד שהוא נרשם בפועל.
    await mountShell();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true }));
    await settle();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, shiftKey: true }),
    );
    await settle();

    expect(stub.saveNowCalls.map((call) => call?.forceSaveAs)).toEqual([false, true]);
  });

  it('Ctrl+S שומר גם בפריסת מקלדת עברית', async () => {
    // הרגרסיה שהתיקון בא לה: בפריסה עברית הדפדפן מדווח `key: 'ד'`, וההשוואה
    // הישנה (`event.key === 's'`) פשוט לא תפסה. בעורך לכתיבת חידושי תורה זה
    // אומר שהשמירה מתה בדיוק כשהמשתמש עשה את מה שהתוסף נועד לו.
    await mountShell();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ד', code: 'KeyS', ctrlKey: true }));
    await settle();

    expect(stub.saveNowCalls).toHaveLength(1);
  });

  it('Ctrl+P מדפיס גם בפריסה עברית, ו-Ctrl+G אינו נבלע', async () => {
    await mountShell();

    // `cancelable` נדרש כדי ש-`defaultPrevented` יהיה מדיד. keydown אמיתי
    // בדפדפן הוא cancelable; אירוע מלאכותי בלי הדגל אינו, ו-preventDefault בו
    // הוא no-op שקט.
    const options = { ctrlKey: true, cancelable: true };
    const print = new KeyboardEvent('keydown', { key: 'פ', code: 'KeyP', ...options });
    const unknown = new KeyboardEvent('keydown', { key: 'ג', code: 'KeyG', ...options });
    window.dispatchEvent(print);
    window.dispatchEvent(unknown);
    await settle();

    expect(print.defaultPrevented).toBe(true);
    // צירוף שאינו שלנו נשאר של הדפדפן.
    expect(unknown.defaultPrevented).toBe(false);
  });

  it('שינוי שם המסמך מסמן אותו כלא-שמור', async () => {
    const wrapper = await mountShell();

    const input = wrapper.find('.doc-title-input');
    (input.element as HTMLInputElement).value = 'חידושי בבא קמא';
    await input.trigger('change');
    await settle();

    expect(stub.markDirtyCalls).toBe(1);
    expect((wrapper.find('.doc-title-input').element as HTMLInputElement).value).toBe(
      'חידושי בבא קמא',
    );
  });

  it('מצב השמירה שהקואורדינטור מדווח מגיע לפס הכותרת', async () => {
    // החיווט הזה (`:is-dirty`, `:save-state-text`) היה מאומת רק ב-regex, וכפיל
    // שמדווח „מלוכלך” ופס שאינו משתנה נראים בסריקת מקור זהים.
    const wrapper = await mountShell();
    expect(wrapper.find('.dirty-indicator').exists()).toBe(false);

    const dirty: SaveSnapshot = {
      state: 'idle',
      isDirty: true,
      isSaving: false,
      targetToken: null,
      name: null,
      lastError: null,
    };
    stub.saveDeps!.onStateChange!(dirty);
    await settle();

    expect(wrapper.find('.dirty-indicator').exists()).toBe(true);
    expect(wrapper.find('.save-state-pill').text()).toBe('שינויים לא שמורים');
  });
});

describe('חיפוש', () => {
  it('כפתור החיפוש בפס פותח session במנוע ולא רק דיאלוג', async () => {
    // פתיחת הדיאלוג בלי `searchAdapter.open()` היא דיאלוג שכל חיפוש בו נכשל
    // סגור — ואת זה רואים רק ממעטפת מורכבת.
    const wrapper = await mountShell();

    await wrapper.find('.search-box').trigger('click');
    await settle();

    expect(stub.searchOpens).toBe(1);
  });
});

/**
 * ההעדפה של הסרגל, ולמה היא צריכה בדיקה משלה.
 *
 * מצב הסרגל שייך למנוע (`config.rulers`), ומופע מנוע חדש נולד כבוי — כלומר
 * בכל פתיחת מסמך המעטפת רואה `false` בדיוק ברגע שבו היא אמורה להחיל `true`
 * שנשמר בהפעלה הקודמת. הבאג שהיה כאן: הסנכרון ההתחלתי כתב את מה שראה אל תוך
 * ההעדפה, וכך **מחק** אותה לפני שהספיקה לחול — ואז לא היה מה להחיל.
 *
 * הבדיקות מקבעות את שני הכיוונים, מפני שתיקון של אחד מהם לבדו נראה נכון:
 * שההעדפה חלה, ושסנכרון לבדו אינו כותב אותה.
 */
describe('ההעדפה של סרגל המידות', () => {
  it('סרגל שנשמר דלוק מתבקש מהמנוע בפתיחה הבאה', async () => {
    stub.storedRuler = true;
    await mountShell();

    const adapter = stub.adapter as CommandDouble;
    expect(
      adapter.calls.map((call) => call.id),
      'המעטפת ביקשה מהמנוע להדליק את הסרגל',
    ).toContain('ruler');
  });

  it('הסנכרון עם מנוע שנולד כבוי אינו מוחק את ההעדפה', async () => {
    stub.storedRuler = true;
    await mountShell();

    // זה הלב: `getState('ruler').active` הוא `false` בפתיחה, ואסור שהוא
    // ייכתב לאחסון — אחרת ההפעלה הבאה כבר לא תדע שהמשתמש רצה סרגל.
    expect(stub.persistedRuler, 'ההעדפה לא נדרסה בסנכרון').not.toContain(false);
  });

  it('הסרגל מופיע כשהמנוע מאשר שהדגל התחלף', async () => {
    stub.storedRuler = true;
    const wrapper = await mountShell();

    // המנוע עונה על `run('ruler')` דרך אותו מסלול שהכפתור ברצועה עובר בו.
    (stub.adapter as CommandDouble).setState('ruler', { active: true });
    await settle();

    const ruler = wrapper.find('.doc-ruler').element as HTMLElement;
    expect(ruler.style.display, 'הרצועה מוצגת').not.toBe('none');
  });

  it('כיבוי יזום נשמר להפעלה הבאה', async () => {
    stub.storedRuler = true;
    await mountShell();
    const adapter = stub.adapter as CommandDouble;

    adapter.setState('ruler', { active: true });
    await settle();
    adapter.setState('ruler', { active: false });
    await settle();

    expect(stub.persistedRuler[stub.persistedRuler.length - 1], 'הכיבוי נשמר').toBe(false);
  });
});

/**
 * „חוזרים לתוסף והוא נפתח בדיוק כמו לפני הסגירה”.
 *
 * מה שנמדד כאן הוא החיווט, ולא ההחלטות: ההחלטות עצמן נבדקות ביחידה
 * (`sessions/session-state.ts`, `engine/caret-anchor.ts`), ומה שאף בדיקת
 * יחידה אינה יכולה לתפוס הוא „הכול נכון, ואף אחד לא קרא לזה”.
 */
describe('חזרה למה שהיה', () => {
  const REMEMBERED = { token: 'tok', name: 'חידושים.docx', writable: true };

  /**
   * רשומת הפעלה מלאה (v2 — `documents` + `activeId`), עם מה שהבדיקה רוצה
   * לשנות בה. `view` הוא ברמת הרשומה כולה; שאר המפתחות שייכים לרשומת
   * המסמך היחיד שבאוסף.
   */
  function storedSession(patch: {
    document?: unknown;
    caret?: unknown;
    draft?: unknown;
    view?: unknown;
  } = {}): unknown {
    const { view, ...entryPatch } = patch;
    const entry = {
      id: 'doc-1',
      document: REMEMBERED,
      caret: null,
      draft: null,
      ...entryPatch,
    };
    return {
      version: 2,
      documents: [entry],
      activeId: entry.id,
      view: view ?? { zoom: null, focusMode: false, ribbonTab: null, ribbonCollapsed: false },
    };
  }

  it('המסמך האחרון נפתח מה-URL שאוצריא נתנה עכשיו', async () => {
    // ה-URL של הריצה הקודמת מת — הפורט מתחלף — ולכן מה שנשמר הוא ה-token,
    // ובעלייה הוא נפתר מחדש.
    stub.storedSession = storedSession();
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };

    await mountShell();

    expect(stub.openSources).toEqual(['loopback://fresh']);
  });

  it('קובץ שאינו נגיש יותר נפתח כמסמך חדש, עם הודעה', async () => {
    stub.storedSession = storedSession();
    stub.resolvedFile = null;

    const wrapper = await mountShell();

    expect(stub.openSources, 'מסמך ריק, בלי מקור').toEqual([undefined]);
    expect(wrapper.find('.word-statusbar').text()).toContain('לא נמצא');
  });

  it('קובץ שאינו נגיש — העבודה שלא נשמרה נפתחת כמסמך חדש ולא נמחקת', async () => {
    // אין לה יעד כתיבה בכל מקרה („שמור” יפתח „שמור בשם”), ולכן פתיחתה כמסמך
    // חדש אינה יכולה לדרוס דבר — והיא הדרך היחידה שלא לאבד אותה.
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'tok', sourceSize: 120 },
    });
    stub.resolvedFile = null;
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    const wrapper = await mountShell();

    expect(stub.openSources[0]).toBeInstanceOf(Blob);
    expect(wrapper.find('.word-statusbar').text()).toContain('נפתחו כמסמך חדש');
  });

  it('טיוטה שלא נשמרה נפתחת במקום הקובץ, והמסמך מסומן כלא-שמור', async () => {
    // זה המסלול שבו סגירת אוצריא הייתה מוחקת עבודה: מה שנכתב ולא נשמר.
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'tok', sourceSize: 120 },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    const wrapper = await mountShell();

    expect(stub.openSources[0], 'הבייטים של הטיוטה, לא ה-URL').toBeInstanceOf(Blob);
    expect(stub.markDirtyCalls, 'עבודה שאינה בדיסק חייבת להיראות כך').toBeGreaterThan(0);
    expect(wrapper.find('.word-statusbar').text()).toContain('שוחזרו שינויים');
  });

  it('טיוטה של מסמך אחר אינה נפתחת מעל המסמך הזה', async () => {
    // התרחיש היחיד שבו התכונה יכולה למחוק עבודה: תוכן של מסמך אחד שנפתח מעל
    // מסמך אחר, ואז נשמר לקובץ שלו.
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'other', sourceSize: 1 },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    await mountShell();

    expect(stub.openSources).toEqual(['loopback://fresh']);
  });

  it('מסמך חדש שמעולם לא נשמר חוזר מהטיוטה', async () => {
    // אין קובץ, אין token, ואין לאן לשמור — הטיוטה היא הדבר היחיד שמחזיק
    // את מה שנכתב.
    stub.storedSession = storedSession({
      document: null,
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: null, sourceSize: null },
    });
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    await mountShell();

    expect(stub.openSources[0]).toBeInstanceOf(Blob);
  });

  it('מצב המיקוד והלשונית ברצועה חוזרים', async () => {
    stub.storedSession = storedSession({
      view: { zoom: null, focusMode: true, ribbonTab: 'references', ribbonCollapsed: false },
    });

    const wrapper = await mountShell();

    expect(wrapper.find('.word-app-shell').classes()).toContain('focus-mode');
    const active = wrapper.findAll('.word-tab-btn').filter((tab) => tab.classes('active'));
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('הפניות');
  });

  it('לשונית שאינה מוכרת נופלת ל„בית” ואינה משאירה רצועה ריקה', async () => {
    stub.storedSession = storedSession({
      view: { zoom: null, focusMode: false, ribbonTab: 'לשונית שנמחקה', ribbonCollapsed: false },
    });

    const wrapper = await mountShell();

    const active = wrapper.findAll('.word-tab-btn').filter((tab) => tab.classes('active'));
    expect(active[0].text()).toBe('בית');
  });

  it('הזום והסמן חוזרים למסמך שנפתח', async () => {
    stub.storedSession = storedSession({
      view: { zoom: 150, focusMode: false, ribbonTab: null, ribbonCollapsed: false },
      caret: { start: { blockId: 'b9', ordinal: 8, offset: 4 }, end: null },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };

    await mountShell();

    const zoomCall = (stub.adapter as { calls: Array<{ id: string; payload?: unknown }> }).calls.find(
      (call) => call.id === 'zoom',
    );
    // `zoomPayload` הוא אחוז ולא אובייקט — ראו engine/payloads.ts.
    expect(zoomCall?.payload).toBe(150);
    expect(stub.caretApplied).toEqual([
      {
        kind: 'selection',
        start: { kind: 'text', blockId: 'b9', offset: 4 },
        end: { kind: 'text', blockId: 'b9', offset: 4 },
      },
    ]);
  });

  it('זום וסמן של מסמך אחר אינם מוחלים על מה שנפתח', async () => {
    // ה-token לא נפתר, נפתח מסמך חדש — וקפיצה לאמצע מסמך אחר עליו היא
    // בדיוק מה שאסור. סמן **הפתיחה** (תחילת המסמך, applyDocumentStartCaret)
    // כן מוצב — הוא של המסמך שנפתח, לא של האחר.
    stub.storedSession = storedSession({
      view: { zoom: 150, focusMode: false, ribbonTab: null, ribbonCollapsed: false },
      caret: { start: { blockId: 'b9', ordinal: 8, offset: 4 }, end: null },
    });
    stub.resolvedFile = null;

    await mountShell();

    expect(stub.caretApplied).toEqual([
      {
        kind: 'selection',
        start: { kind: 'text', blockId: 'block-1', offset: 0 },
        end: { kind: 'text', blockId: 'block-1', offset: 0 },
      },
    ]);
  });

  it('הרשומה נכתבת בפועל, ולא רק „הייתה אמורה להיכתב”', async () => {
    stub.storedSession = storedSession();
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };

    await mountShell();

    expect(stub.persistedSessions.length, 'שום דבר לא נשמר להפעלה הבאה').toBeGreaterThan(0);
    const record = stub.persistedSessions[stub.persistedSessions.length - 1] as {
      documents?: Array<{ document?: { token?: string } }>;
    };
    expect(record.documents?.[0]?.document?.token).toBe('tok');
  });

  it('פתיחה שנכשלה אינה מוחקת את הטיוטה ואינה שוכחת את המסמך', async () => {
    // כשל בפתיחה עשוי להיות זמני — worker שלא עלה, קובץ נעול. מחיקת הטיוטה
    // או רישום המסמך הריק היו הופכים אותו לאובדן קבוע.
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'tok', sourceSize: 120 },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);
    stub.openFailures = 1;

    await mountShell();

    expect(stub.draftRemovals, 'הטיוטה היא הדבר היחיד שמחזיק את העבודה').toBe(0);

    // המסמך הריק שנפתח כגיבוי אינו נרשם. כל רשומה שנכתבה בכל זאת חייבת
    // עדיין לנקוב במסמך האחרון — אחרת ההפעלה הבאה לא תדע במה לנסות שוב,
    // וגם לא לְמי הטיוטה שייכת.
    const forgotten = (
      stub.persistedSessions as Array<{ documents?: Array<{ document?: unknown }> } | null>
    ).filter((record) => (record?.documents?.[0]?.document ?? null) == null);
    expect(forgotten, 'רשומה ששכחה את המסמך האחרון').toEqual([]);
  });

  it('שמירה אוטומטית מוחקת את הטיוטה — לא רק שמירה ידנית', async () => {
    // הרגרסיה: הזוכר היה נתלה על `onSave` של המעטפת, ואילו ה-autosave יורה
    // מתוך הקואורדינטור ואינו עובר שם. התוצאה הייתה טיוטה שנשארת חיה
    // ומפסיקה להתעדכן — ואז נפתחת בהפעלה הבאה מעל עבודה חדשה ממנה, ונכתבת
    // לקובץ. כאן הקואורדינטור מדווח כמו שהוא מדווח על סבב אוטומטי.
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'tok', sourceSize: 120 },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    await mountShell();
    expect(stub.draftRemovals, 'עוד לא נשמר דבר').toBe(0);

    stub.saveDeps?.onSaved?.({ token: 'tok', name: 'חידושים.docx', size: 250 });
    await settle(6);

    expect(stub.draftRemovals, 'העבודה בדיסק — הטיוטה מיותרת ומסוכנת').toBe(1);
  });

  it('פתיחה רגילה אינה מוחקת שום טיוטה', async () => {
    stub.storedSession = storedSession({
      draft: { path: 'session-draft.docx', savedAt: 1, documentToken: 'other', sourceSize: 1 },
    });
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };
    stub.draftBytes = new Uint8Array([80, 75, 3, 4]);

    await mountShell();

    expect(stub.draftRemovals).toBe(0);
  });

  it('משתמש שמעדכן מגרסה קודמת אינו מאבד את המסמך שעבד עליו', async () => {
    // אין רשומת הפעלה, ויש רק את המפתח הישן.
    stub.storedSession = null;
    stub.lastDocument = REMEMBERED;
    stub.resolvedFile = { token: 'tok', url: 'loopback://fresh', name: 'חידושים.docx', size: 120 };

    await mountShell();

    expect(stub.openSources).toEqual(['loopback://fresh']);
    expect(stub.forgotLastDocument, 'המפתח הישן נמחק כדי שלא יישאר מקור שני').toBe(true);
  });
});

/**
 * הצלחה שיש עליה מה לומר — `CommandOutcome.note`.
 *
 * הפקד ב-Ribbon אינו יודע לומר דבר: הוא מעביר את התוצאה ל-`COMMAND_REPORTER`
 * שהמעטפת מספקת, וכל ההחלטה מה יופיע בפס היא של `reportCommand`. לכן נמדד
 * כאן המדווח עצמו, בדיוק כפי שהפקד קורא לו.
 */
describe('הודעת-מידע על פקודה שהצליחה', () => {
  const NOTE = 'העמודה הראשונה מצוירת בצד שמאל, וגם הסימון עובר שמאל→ימין. הקובץ יישמר נכון.';

  function reporterOf(wrapper: Awaited<ReturnType<typeof mountShell>>): CommandReporter {
    const provides = (wrapper.vm.$ as unknown as { provides: Record<symbol, unknown> }).provides;
    const report = provides[COMMAND_REPORTER as unknown as symbol];
    if (typeof report !== 'function') throw new Error('המעטפת לא סיפקה מדווח פקודות');
    return report as CommandReporter;
  }

  const statusOf = (wrapper: Awaited<ReturnType<typeof mountShell>>): string =>
    wrapper.find('.status-message').exists() ? wrapper.find('.status-message').text() : '';

  it('ההודעה מגיעה לפס המצב', async () => {
    const wrapper = await mountShell();

    reporterOf(wrapper)({ ok: true, note: NOTE }, 'page-columns');
    await settle();

    expect(statusOf(wrapper)).toContain(NOTE);
  });

  it('הצלחה בלי הודעה מנקה הודעה שהפכה לשקר', async () => {
    // „עמודות ← שתיים” ואז „עמודות ← אחת”. בלי הניקוי הפס היה ממשיך לתאר
    // סדר טורים הפוך על מסמך שכבר אין בו טורים כלל.
    const wrapper = await mountShell();
    const report = reporterOf(wrapper);

    report({ ok: true, note: NOTE }, 'page-columns');
    await settle();
    report({ ok: true }, 'page-columns');
    await settle();

    expect(statusOf(wrapper)).toBe('');
  });

  it('אינה מוחקת הודעה של ערוץ אחר שנכתבה בינתיים', async () => {
    // הפס יש לו כותב שני: `STATUS_NOTIFIER`, שכלי הלשוניות מודיעים דרכו
    // („בוצעו 3 תיקונים”). הניקוי מותנה בכך שההודעה שעל המסך היא **זו**
    // שהוצגה, ובלי התנאי הזה כל פקודה מוצלחת הייתה מוחקת הודעה של הערוץ ההוא.
    const wrapper = await mountShell();
    const provides = (wrapper.vm.$ as unknown as { provides: Record<symbol, unknown> }).provides;
    const notify = provides[STATUS_NOTIFIER as unknown as symbol] as (text: string) => void;
    const report = reporterOf(wrapper);

    report({ ok: true, note: NOTE }, 'page-columns');
    await settle();
    notify('בוצעו 3 תיקונים');
    await settle();
    report({ ok: true }, 'page-columns');
    await settle();

    expect(statusOf(wrapper)).toContain('בוצעו 3 תיקונים');
  });

  it('כשל דוחה את ההודעה ומסמן שגיאה', async () => {
    const wrapper = await mountShell();
    const report = reporterOf(wrapper);

    report({ ok: true, note: NOTE }, 'page-columns');
    await settle();
    report({ ok: false, message: 'שינוי מספר העמודות ל-2 נכשל', reason: 'threw' }, 'page-columns');
    await settle();

    expect(statusOf(wrapper)).toContain('נכשל');
    expect(wrapper.find('.status-message').classes()).toContain('error');
  });
});
