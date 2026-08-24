/**
 * תשתית ההרכבה של בדיקות הקומפוננטות.
 *
 * ## למה הקבצים כאן קיימים
 *
 * כל בדיקת `.vue` במאגר עד עכשיו הייתה **סריקת מקור** — regex על טקסט הקובץ.
 * היא תפסה דברים אמיתיים (שלוש-עשרה כפתורים בלי `@click`), אבל היא אינה יכולה
 * לתפוס „לחצתי והפקודה לא הגיעה למנוע”: `doCut(){}` הוא HTML ו-JavaScript
 * תקינים לחלוטין, ו-`{ fontFamily: 'X' }` נראה נכון בכל סריקה. שתי משפחות
 * הבאגים האלה הן מה שההרכבה כאן מודדת.
 *
 * ## הכפיל של האדפטר, וההבדל בין כפיל לכפיל
 *
 * הבדיקה שנמחקה (`tests/unit/ribbon-commands.test.ts`) הריצה את ה-payloads מול
 * `executeAsync(id, payload) { calls.push(...); return true; }` — כפיל שמסכים
 * לכל דבר, ולכן אישר בירוק את חמשת ה-payloads שהמנוע דוחה בשקט. הכפיל כאן
 * עושה את ההפוך: הוא **מריץ את ה-payload דרך הוולידטורים האמיתיים של
 * superdoc** (tests/support/superdoc-engine.ts), ומחזיר כשל על מה שהמנוע היה
 * דוחה. כלומר לחיצה על בורר גופן שמעבירה `{ fontFamily }` נכשלת כאן — וזו
 * בדיוק הבדיקה שהייתה חסרה.
 *
 * הוא גם מדגם את שאר מה שה-controller עושה לפני שהוא נוגע במסמך: מזהה פקודה
 * שאינו בקטלוג נדחה, ופקודה שהמצב שלה `enabled: false` אינה מנותבת. שלוש
 * הרשימות (`calls` / `applied` / `rejected` / `blocked`) הן ההבחנה בין „הלחיצה
 * הגיעה לאדפטר”, „המנוע היה משנה את המסמך” ו„המנוע היה מסרב”.
 *
 * ## הכפיל של המופע
 *
 * ל-`ACTIVE_SUPERDOC` יש מסלול שני, שאינו עובר בפקודות בכלל: שוליים, כיוון דף,
 * עמודות, הערות שוליים, לוח, בחירת הכל, מעבר עמוד וציטוט — כולם קוראים
 * ל-Document API ישירות. הכפיל מקליט כל קריאה כזאת, וזה מה שהופך „לחצתי על
 * „שוליים צרים”” לבדיקה.
 *
 * זמינות הפעולות נמסרת דרך Proxy ולא דרך רשימה כתובה: מרחב השאלות של
 * engine/doc-capabilities.ts גדל, ורשימה קשיחה כאן הייתה משאירה פקד חדש
 * מנוטרל בלי שאיש ישים לב — כלומר בדיקה שמאשרת בירוק כפתור מת.
 */
import { afterEach } from 'vitest';
import { nextTick, ref, shallowRef, type Component, type Ref } from 'vue';
import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils';
import type { SuperDoc } from 'superdoc';
import type { CommandState } from 'superdoc/ui';
import {
  reasonText,
  type CommandAdapter,
  type CommandOutcome,
} from '../../src/engine/command-adapter';
import {
  COMMAND_ADAPTER,
  COMMAND_REPORTER,
  FONT_OPTIONS,
  STYLE_GALLERY,
} from '../../src/composables/keys';
import { ACTIVE_SUPERDOC } from '../../src/engine/document-api';
import { fallbackFontOptions, type FontOptions } from '../../src/engine/font-options';
import { fallbackStyleGallery, type StyleGalleryState } from '../../src/engine/style-gallery';
import { checkPayload, commandDescriptor } from '../support/superdoc-engine';

/* ------------------------------------------------------------------ */
/* המתנה                                                              */
/* ------------------------------------------------------------------ */

/**
 * מחזירה את הבקרה עד שכל ה-watchers הא-סינכרוניים נרגעו.
 *
 * שתי הלשוניות שקוראות יכולות (`readDocCapabilities`) עושות זאת ב-`watch`
 * עם `immediate`, כלומר בשרשרת של כמה microtasks. בלי ההמתנה כל פקד היה נמדד
 * במצבו הראשוני — מנוטרל — וכל בדיקה כאן הייתה עוברת מהסיבה הלא נכונה.
 */
export async function settle(rounds = 6): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

/* ------------------------------------------------------------------ */
/* כפיל האדפטר                                                        */
/* ------------------------------------------------------------------ */

export interface CommandCall {
  id: string;
  payload?: unknown;
}

export interface RejectedCall extends CommandCall {
  /** איזה ולידטור של המנוע דחה, לצורך הודעת כשל שאפשר לעשות איתה משהו. */
  route: string;
}

export interface CommandDoubleOptions {
  /** מצב התחלתי לפקודות מסוימות. ברירת המחדל: נתמכת, זמינה, לא פעילה. */
  states?: Record<string, Partial<CommandState>>;
  /** ברירת המחדל לכל הפקודות שלא נזכרו ב-`states`. */
  defaultState?: Partial<CommandState>;
  /** מזהים שהמנוע „אינו מכיר”, כדי לבדוק את המסלול הזה. */
  unknown?: readonly string[];
  /** פקודות שהמנוע מנתב אך הן נכשלות, לפי `reason` של ה-controller. */
  failures?: Record<string, string>;
  /**
   * פקודות שהתשובה שלהן מושהית עד `release(id)`.
   *
   * למה זה נדרש: פקד שנשען על „מה שנבחר וטרם נענה” צריך להיבדק גם במצב הזה
   * בדיוק — בחירה שנייה בזמן שהראשונה באוויר. בלי שליטה על רגע התשובה אין דרך
   * להעמיד את המצב הזה, וההתנהגות היחידה שנמדדת היא זו של מנוע מיידי.
   */
  held?: readonly string[];
}

export interface CommandDouble extends CommandAdapter {
  /** כל קריאה ל-`run`, כולל כאלה שנחסמו — „הלחיצה הגיעה לאדפטר”. */
  readonly calls: CommandCall[];
  /** הקריאות שהמנוע היה מבצע בפועל. */
  readonly applied: CommandCall[];
  /** payload שהמנוע היה דוחה. רשימה שאינה ריקה = כפתור שנלחץ ולא קרה כלום. */
  readonly rejected: RejectedCall[];
  /** קריאה לפקודה שמצבה `enabled: false`. */
  readonly blocked: CommandCall[];
  /** ה-payloads שהוחלו עבור מזהה מסוים, לפי הסדר. */
  payloads(id: string): unknown[];
  /** מעדכנת מצב פקודה ומודיעה למי שמאזין — כמו המנוע כשהבחירה משתנה. */
  setState(id: string, patch: Partial<CommandState>): void;
  /** משחררת את התשובה המושהית **הראשונה** של הפקודה (FIFO). */
  release(id: string): void;
  reset(): void;
}

const BASE_STATE: CommandState = {
  supported: true,
  enabled: true,
  active: false,
  value: undefined,
};

export function createCommandDouble(options: CommandDoubleOptions = {}): CommandDouble {
  const calls: CommandCall[] = [];
  const applied: CommandCall[] = [];
  const rejected: RejectedCall[] = [];
  const blocked: CommandCall[] = [];

  const unknown = new Set(options.unknown ?? []);
  const failures = options.failures ?? {};
  const held = new Set(options.held ?? []);
  const waiting = new Map<string, Array<() => void>>();
  const states = new Map<string, CommandState>();
  const listeners = new Map<string, Set<(state: CommandState) => void>>();

  const has = (id: string): boolean => !unknown.has(id) && commandDescriptor(id) !== null;

  const stateOf = (id: string): CommandState => {
    const existing = states.get(id);
    if (existing) return existing;
    const initial: CommandState = {
      ...BASE_STATE,
      ...options.defaultState,
      ...options.states?.[id],
    };
    states.set(id, initial);
    return initial;
  };

  const double: CommandDouble = {
    calls,
    applied,
    rejected,
    blocked,

    has,

    getState(id) {
      // המנוע אינו מציע מצב לפקודה שאינה בקטלוג, ופקד שקורא מצב בלי לשאול
      // `has` תחילה הוא באג שקט — עדיף שייפול כאן.
      if (!has(id)) throw new Error(`אין לקרוא מצב של הפקודה ${id} — היא אינה מוכרת למנוע`);
      return stateOf(id);
    },

    observe(id, listener) {
      const set = listeners.get(id) ?? new Set();
      set.add(listener);
      listeners.set(id, set);
      return () => {
        set.delete(listener);
      };
    },

    async run(id, payload): Promise<CommandOutcome> {
      calls.push({ id, payload });

      if (!has(id)) {
        return {
          ok: false,
          message: `הפעולה ${id} אינה מוכרת למנוע`,
          reason: 'unknown-command',
        };
      }

      const state = stateOf(id);
      if (!state.enabled) {
        blocked.push({ id, payload });
        const reason = state.reason ?? 'selection-required';
        return { ok: false, message: reasonText(reason), reason };
      }

      // כאן ההבדל בין הכפיל הזה לכפיל שהיה: ה-payload עובר דרך הוולידטורים
      // של superdoc עצמו, ולא דרך `return true`.
      const verdict = checkPayload(id, payload);
      if (!verdict.accepted) {
        rejected.push({ id, payload, route: verdict.route });
        return {
          ok: false,
          message: `המנוע דחה את ה-payload של ${id} (${verdict.route})`,
          reason: 'payload-rejected',
        };
      }

      applied.push({ id, payload });

      if (held.has(id)) {
        await new Promise<void>((resolve) => {
          const queue = waiting.get(id) ?? [];
          queue.push(resolve);
          waiting.set(id, queue);
        });
      }

      const failure = failures[id];
      if (failure) return { ok: false, message: reasonText(failure), reason: failure };
      return { ok: true };
    },

    payloads(id) {
      return applied.filter((call) => call.id === id).map((call) => call.payload);
    },

    setState(id, patch) {
      const next: CommandState = { ...stateOf(id), ...patch };
      states.set(id, next);
      for (const listener of listeners.get(id) ?? []) listener(next);
    },

    release(id) {
      const next = waiting.get(id)?.shift();
      if (!next) throw new Error(`אין תשובה מושהית לשחרור עבור ${id}`);
      next();
    },

    reset() {
      calls.length = 0;
      applied.length = 0;
      rejected.length = 0;
      blocked.length = 0;
    },
  };

  return double;
}

/* ------------------------------------------------------------------ */
/* כפיל המופע (Document API)                                          */
/* ------------------------------------------------------------------ */

export interface DocCall {
  op: string;
  input?: unknown;
}

export interface SuperdocDoubleOptions {
  /** פעולות שהמנוע מדווח כלא-זמינות. משמש לבדוק פקד מנוטרל ואת ה-tooltip שלו. */
  denied?: readonly string[];
  /** מסלולים שאינם קיימים בפאסדה בכלל — גרסת מנוע שאין לה את היכולת. */
  missing?: readonly string[];
  /** מסלול שנכשל, עם קוד הכשל שהקבלה מחזירה. */
  failures?: Record<string, { code: string; message?: string }>;
  /** מה שהבחירה במסמך מדווחת. */
  selection?: { blockId?: string | null; hasRange?: boolean; text?: string };
}

export interface SuperdocDouble {
  /** מה שמוזרק ל-`ACTIVE_SUPERDOC`. אינו SuperDoc אמיתי, ומטופס כך בכוונה. */
  readonly host: SuperDoc;
  readonly calls: DocCall[];
  /** הקלטים שמסלול מסוים קיבל, לפי הסדר. */
  inputs(op: string): unknown[];
  ops(): string[];
  reset(): void;
}

export function createSuperdocDouble(options: SuperdocDoubleOptions = {}): SuperdocDouble {
  const calls: DocCall[] = [];
  const denied = new Set(options.denied ?? []);
  const missing = new Set(options.missing ?? []);
  const failures = options.failures ?? {};

  const blockId = options.selection?.blockId === undefined ? 'block-1' : options.selection.blockId;
  const hasRange = options.selection?.hasRange ?? false;
  const selectionText = options.selection?.text ?? '';

  /**
   * זמינות הפעולות כ-Proxy. `readDocCapabilities` שואל מפה לפי שם הפעולה,
   * ורשימה כתובה כאן הייתה מתיישנת בכל פקד חדש — ואז הבדיקה של אותו פקד הייתה
   * מודדת אותו מנוטרל.
   */
  const operations = new Proxy(
    {},
    {
      get: (_target, key: string | symbol) =>
        typeof key === 'string' && denied.has(key)
          ? { available: false, reasons: ['OPERATION_UNAVAILABLE'] }
          : { available: true, reasons: [] },
    },
  );

  const globalFlags = new Proxy(
    {},
    {
      get: (_target, key: string | symbol) =>
        typeof key === 'string' && denied.has(key)
          ? { enabled: false, reasons: ['OPERATION_UNAVAILABLE'] }
          : { enabled: true, reasons: [] },
    },
  );

  /** מסלול שנרשם, מקליט, ומחזיר קבלה — או `undefined` אם הוא „חסר במנוע”. */
  function route<T>(op: string, impl: (input: unknown) => T): ((input: unknown) => T) | undefined {
    if (missing.has(op)) return undefined;
    return (input: unknown) => {
      calls.push({ op, input });
      return impl(input);
    };
  }

  function receipt(op: string): { success: boolean; failure?: { code: string; message?: string } } {
    const failure = failures[op];
    if (failure) return { success: false, failure };
    return { success: true };
  }

  const selectionTarget = {
    kind: 'text',
    story: { kind: 'body' },
    segments: blockId
      ? [{ blockId, range: { start: 0, end: hasRange ? selectionText.length || 4 : 0 } }]
      : [],
  };

  /**
   * ה-`SelectionTarget` — מודל אחר מ-`TextTarget` שמעל, ולא כינוי שלו: החוזה
   * קובע ש-`target` הוא ה-`TextTarget` לצריכה של תגובות, ו-`selectionTarget`
   * הוא „the public selection-target model the write APIs consume directly”.
   * `format.*` מקבל את השני, ולכן כפיל שמחזיר רק את הראשון היה מודד פקד
   * שנכשל סגור על „יש לסמן טקסט”.
   */
  const selectionEnvelope = {
    kind: 'selection',
    start: { kind: 'text', blockId, offset: 0 },
    end: { kind: 'text', blockId, offset: selectionText.length || 4 },
  };

  const clipboardPayload = {
    source: 'superdoc',
    items: [{ type: 'text/plain', kind: 'string', data: selectionText || 'טקסט' }],
  };

  const doc = {
    capabilities: {
      get: route('capabilities.get', () => ({ operations, global: globalFlags })),
    },
    sections: {
      list: route('sections.list', () => ({
        items: [
          {
            address: { sectionIndex: 0 },
            pageSetup: { width: 11906, height: 16838, orientation: 'portrait' },
          },
        ],
      })),
      setPageMargins: route('sections.setPageMargins', () => receipt('sections.setPageMargins')),
      setPageSetup: route('sections.setPageSetup', () => receipt('sections.setPageSetup')),
      setColumns: route('sections.setColumns', () => receipt('sections.setColumns')),
    },
    footnotes: {
      insert: route('footnotes.insert', () => receipt('footnotes.insert')),
    },
    format: {
      paragraph: {
        setFlowOptions: route('format.paragraph.setFlowOptions', () =>
          receipt('format.paragraph.setFlowOptions'),
        ),
      },
      vertAlign: route('format.vertAlign', () => receipt('format.vertAlign')),
    },
    selection: {
      current: route('selection.current', () => ({
        empty: !hasRange,
        target: selectionTarget,
        // נמסר רק כשיש טווח: המנוע מקרין `null` כשאין מה להקרין, וכתיבה
        // דורשת טווח.
        selectionTarget: hasRange ? selectionEnvelope : null,
        text: selectionText,
      })),
    },
    clipboard: {
      serializeSelection: route('clipboard.serializeSelection', () => ({
        payload: clipboardPayload,
      })),
      parse: route('clipboard.parse', () => ({
        success: true,
        plan: { fragment: { blocks: [] }, diagnostics: [] },
      })),
      insert: route('clipboard.insert', () => receipt('clipboard.insert')),
    },
    delete: route('delete', () => receipt('delete')),
    ranges: {
      resolve: route('ranges.resolve', () => ({ target: selectionTarget })),
    },
    insert: route('insert', () => receipt('insert')),
  };

  const host = {
    activeEditor: { doc },
    ui: {
      selection: {
        getSnapshot: () => {
          calls.push({ op: 'ui.selection.getSnapshot' });
          return {
            status: 'ready',
            empty: !hasRange,
            selectionTarget: hasRange ? selectionTarget : null,
          };
        },
        apply: route('ui.selection.apply', () => ({ ok: true })),
      },
    },
  };

  return {
    host: host as unknown as SuperDoc,
    calls,
    inputs: (op) => calls.filter((call) => call.op === op).map((call) => call.input),
    ops: () => calls.map((call) => call.op),
    reset: () => {
      calls.length = 0;
    },
  };
}

/* ------------------------------------------------------------------ */
/* ההרכבה                                                             */
/* ------------------------------------------------------------------ */

export interface ReportedOutcome {
  outcome: CommandOutcome;
  commandId: string;
}

export interface HarnessOptions {
  /** ברירת המחדל: כפיל אדפטר חדש עם כל הפקודות זמינות. `null` = אין מנוע. */
  adapter?: CommandDouble | null;
  /** ברירת המחדל: כפיל מופע עם כל היכולות. `null` = אין מסמך פתוח. */
  superdoc?: SuperdocDouble | null;
  fontOptions?: FontOptions;
  styleGallery?: StyleGalleryState;
  props?: Record<string, unknown>;
}

export interface Harness {
  wrapper: VueWrapper;
  adapter: CommandDouble;
  superdoc: SuperdocDouble;
  /** מה שהמדווח קיבל — המסלול שמגיע למשתמש כהודעה בעברית. */
  reports: ReportedOutcome[];
  /** הכשלים בלבד. */
  failures(): ReportedOutcome[];
  /** מחליפה את המסמך הפעיל, כמו פתיחת מסמך חדש במעטפת. */
  setSuperdoc(next: SuperdocDouble | null): Promise<void>;
}

/**
 * מרכיבה קומפוננטה עם בדיוק מה שהמעטפת מזריקה, ולא פחות: פקד שנשען על מפתח
 * שלא הוזרק נופל לברירת המחדל של ה-inject ונראה עובד — וזה באג שקט שבדיקה
 * חייבת לא לחזור עליו.
 */
export function mountUi(component: Component, options: HarnessOptions = {}): Harness {
  const adapter = options.adapter === undefined ? createCommandDouble() : options.adapter;
  const superdoc = options.superdoc === undefined ? createSuperdocDouble() : options.superdoc;

  const adapterRef: Ref<CommandAdapter | null> = shallowRef(adapter ?? null);
  const superdocRef = shallowRef<SuperDoc | null>(superdoc ? superdoc.host : null);
  const reports: ReportedOutcome[] = [];

  const provide: Record<symbol, unknown> = {};
  provide[COMMAND_ADAPTER as unknown as symbol] = adapterRef;
  provide[COMMAND_REPORTER as unknown as symbol] = (
    outcome: CommandOutcome,
    commandId: string,
  ): void => {
    reports.push({ outcome, commandId });
  };
  provide[FONT_OPTIONS as unknown as symbol] = ref(options.fontOptions ?? fallbackFontOptions());
  provide[STYLE_GALLERY as unknown as symbol] = shallowRef(
    options.styleGallery ?? fallbackStyleGallery(),
  );
  provide[ACTIVE_SUPERDOC as unknown as symbol] = superdocRef;

  const wrapper = mount(component, {
    props: options.props,
    attachTo: document.body,
    global: { provide },
  });

  return {
    wrapper,
    // הכפילים מוחזרים גם כשלא הוזרקו, כדי שבדיקה תוכל לאשר שלא נגעו בהם.
    adapter: adapter ?? createCommandDouble(),
    superdoc: superdoc ?? createSuperdocDouble(),
    reports,
    failures: () => reports.filter((report) => !report.outcome.ok),
    async setSuperdoc(next) {
      superdocRef.value = next ? next.host : null;
      await settle();
    },
  };
}

/**
 * מספר ה-events שהקומפוננטה **פלטה** — בלי אירועי DOM שרק עברו דרכה.
 *
 * @vue/test-utils רושם ב-`emitted()` לא רק `emit` של הקומפוננטה אלא גם כל
 * אירוע DOM מקורי שעולה לשורש שלה (חיקוי של fallthrough listeners; ראו
 * `recordEvent` ב-VTU). התוצאה: כל `trigger('click')` מופיע שם כ-`click` —
 * גם כשנלחץ כפתור שאין לו מטפל בכלל. שער „אין כפתור מת” שסופר אותו היה
 * מאשר בירוק בדיוק את מה שהוא נבנה לתפוס.
 */
export function emittedCount(wrapper: VueWrapper, ignore: readonly string[] = ['click']): number {
  return Object.entries(wrapper.emitted())
    .filter(([name]) => !ignore.includes(name))
    .reduce((total, [, occurrences]) => total + occurrences.length, 0);
}

/** מפרקת אוטומטית כל הרכבה בסוף בדיקה. נקראת פעם אחת בראש קובץ בדיקה. */
export function autoUnmount(): void {
  enableAutoUnmount(afterEach);
}

/* ------------------------------------------------------------------ */
/* לוח המערכת                                                          */
/* ------------------------------------------------------------------ */

/**
 * ל-jsdom אין `navigator.clipboard`, ובלעדיו כל פעולות הלוח נכשלות ב„לוח
 * המערכת חסם” — כלומר הבדיקה הייתה מודדת את מסלול החסימה ולא את הפעולה.
 */
export function installSystemClipboard(text = 'טקסט מהלוח'): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {},
      readText: async () => text,
    },
  });
  return () => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    // ב-jsdom המאפיין אינו קיים מראש, ולכן „החזרה למצב הקודם” היא הסרתו.
    else Reflect.deleteProperty(navigator, 'clipboard');
  };
}

/** לחיצה מחוץ לפקד, כפי שמאזין ה-`pointerdown` הגלובלי רואה אותה. */
export function clickOutside(): void {
  // jsdom אינו מממש PointerEvent, ו-MouseEvent בשם הזה מפעיל את אותו מאזין.
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
}
