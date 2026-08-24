/**
 * שלב 0.1 בתכנית: המופע מחזיק controller אחד, וההקמה שלנו לא יוצרת שני.
 * ה-mock של superdoc/ui הוא הליבה של הבדיקה — אם מישהו יחזיר את
 * createSuperDocUI לקוד ההקמה, הבדיקה תיפול במקום שהתוסף ירוץ עם שני
 * controllers שאינם מסונכרנים.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeConfig {
  selector: HTMLElement;
  document?: unknown;
  ui: false;
  telemetry: { enabled: boolean };
  workerUrls?: unknown;
  modules?: unknown;
  onEditorUpdate?: () => void;
  onPaginationUpdate?: (params: { totalPages: number; superdoc: FakeSuperDoc }) => void;
  onReady: (params: { superdoc: FakeSuperDoc }) => void;
  onException: (payload: unknown) => void;
}

class FakeSuperDoc {
  static instances: FakeSuperDoc[] = [];
  readonly config: FakeConfig;
  readonly ui = { destroy: vi.fn(), commands: { has: () => true } };
  readonly destroy = vi.fn();

  constructor(config: FakeConfig) {
    this.config = config;
    FakeSuperDoc.instances.push(this);
  }
}

const createSuperDocUI = vi.fn();

vi.mock('superdoc', () => ({ SuperDoc: FakeSuperDoc }));
vi.mock('superdoc/ui', () => ({ createSuperDocUI }));
vi.mock('superdoc/style.css', () => ({}));

const { createEditor, exceptionToError } = await import('../../src/engine/create-editor');

/** המופע האחרון שנבנה. lib היא ES2020 — בכוונה, כמו ה-build — ולכן אין Array.at. */
function lastInstance(): FakeSuperDoc | undefined {
  return FakeSuperDoc.instances[FakeSuperDoc.instances.length - 1];
}

function mount(): { container: HTMLElement; session: Promise<Awaited<ReturnType<typeof createEditor>>>; instance: FakeSuperDoc } {
  const container = document.createElement('div');
  const session = createEditor({ container });
  const instance = lastInstance();
  if (!instance) throw new Error('הבנאי של SuperDoc לא נקרא');
  return { container, session, instance };
}

describe('createEditor', () => {
  beforeEach(() => {
    FakeSuperDoc.instances.length = 0;
    createSuperDocUI.mockClear();
  });

  it('אינו יוצר controller שני', async () => {
    const { session, instance } = mount();
    instance.config.onReady({ superdoc: instance });
    await session;

    expect(createSuperDocUI).not.toHaveBeenCalled();
  });

  it('מחזיר את ה-controller המושאל של המופע המוכן', async () => {
    const { session, instance } = mount();
    instance.config.onReady({ superdoc: instance });
    const editor = await session;

    expect(editor.superdoc).toBe(instance);
    expect(editor.ui).toBe(instance.ui);
  });

  it('מקים את המנוע בלי ממשק מובנה ובלי טלמטריה', () => {
    const { container, instance } = mount();

    expect(instance.config.selector).toBe(container);
    expect(instance.config.ui).toBe(false);
    expect(instance.config.telemetry).toEqual({ enabled: false });
  });

  it('מחבר את onEditorUpdate כשנמסר, ולא כשלא', () => {
    // זה מה שמסמן את המסמך כלא-שמור. בלי החיבור הזה „שמור” לא ידע שיש מה לשמור.
    const onUpdate = vi.fn();
    createEditor({ container: document.createElement('div'), onUpdate });
    const withHook = lastInstance()!;
    withHook.config.onEditorUpdate?.();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    createEditor({ container: document.createElement('div') });
    expect(lastInstance()!.config.onEditorUpdate).toBeUndefined();
  });

  it('מחבר את onPaginationUpdate ומעביר את מספר העמודים בלבד', () => {
    // זה המקור **היחיד** למספר העמודים: אין getter ציבורי לשאול בו. בלי
    // החיבור הזה שורת המצב יכולה רק להמציא מספר, וזה מה שהיא עשתה.
    const onPaginationUpdate = vi.fn();
    createEditor({ container: document.createElement('div'), onPaginationUpdate });
    const withHook = lastInstance()!;

    withHook.config.onPaginationUpdate?.({ totalPages: 24, superdoc: withHook });

    // המופע שב-payload אינו מועבר הלאה: מי שרשם את ה-callback מחזיק את ה-session.
    expect(onPaginationUpdate).toHaveBeenCalledTimes(1);
    expect(onPaginationUpdate).toHaveBeenCalledWith(24);

    createEditor({ container: document.createElement('div') });
    expect(lastInstance()!.config.onPaginationUpdate).toBeUndefined();
  });

  it('מכבה את דיאלוג הסיסמה המובנה', () => {
    // הוא surface של modules ולכן פועל גם כש-ui: false, ובמצב הזה הוא בולע
    // את הכשל של DOCX מוצפן — הפתיחה לא מסתיימת לא בהצלחה ולא בכשל.
    const { instance } = mount();

    expect(instance.config.modules).toEqual({ surfaces: { passwordPrompt: false } });
  });

  it('פתיחה שאינה מסתיימת נכשלת בזמן קצוב ומפרקת את המנוע', async () => {
    vi.useFakeTimers();
    try {
      const container = document.createElement('div');
      const pending = createEditor({ container, timeoutMs: 1000 });
      const instance = lastInstance()!;
      const assertion = expect(pending).rejects.toThrow('לא הסתיימה בזמן סביר');

      await vi.advanceTimersByTimeAsync(1000);
      await assertion;

      expect(instance.destroy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('פתיחה שהצליחה מבטלת את השעון', async () => {
    vi.useFakeTimers();
    try {
      const container = document.createElement('div');
      const promise = createEditor({ container, timeoutMs: 1000 });
      const instance = lastInstance()!;
      instance.config.onReady({ superdoc: instance });
      const session = await promise;

      await vi.advanceTimersByTimeAsync(5000);

      expect(session.superdoc).toBe(instance);
      expect(instance.destroy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('בפירוק קורא רק ל-destroy של המנוע', async () => {
    const { session, instance } = mount();
    instance.config.onReady({ superdoc: instance });
    const editor = await session;

    editor.destroy();

    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(instance.ui.destroy).not.toHaveBeenCalled();
  });

  it('מבטל subscriptions לפני פירוק המנוע, ופעם אחת בלבד', async () => {
    const { session, instance } = mount();
    instance.config.onReady({ superdoc: instance });
    const editor = await session;

    const order: string[] = [];
    editor.onDispose(() => order.push('dispose-1'));
    editor.onDispose(() => order.push('dispose-2'));
    instance.destroy.mockImplementation(() => order.push('destroy'));

    editor.destroy();
    editor.destroy();

    expect(order).toEqual(['dispose-1', 'dispose-2', 'destroy']);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it('רישום disposer אחרי הפירוק מריץ אותו מיד', async () => {
    const { session, instance } = mount();
    instance.config.onReady({ superdoc: instance });
    const editor = await session;
    editor.destroy();

    const dispose = vi.fn();
    editor.onDispose(dispose);

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('כשל לפני onReady דוחה ומפרק את המופע החצי-בנוי', async () => {
    const { session, instance } = mount();
    const onError = vi.fn();
    const failing = createEditor({ container: document.createElement('div'), onError });
    const failingInstance = lastInstance();
    if (!failingInstance || failingInstance === instance) throw new Error('לא נוצר מופע שני');

    failingInstance.config.onException({ error: new Error('boom'), code: 'password-required' });

    await expect(failing).rejects.toThrow('boom');
    expect(failingInstance.destroy).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    instance.config.onReady({ superdoc: instance });
    await session;
  });

  it('כשל אחרי onReady מדווח ואינו מפרק את המסמך', async () => {
    const container = document.createElement('div');
    const onError = vi.fn();
    const pending = createEditor({ container, onError });
    const instance = lastInstance()!;
    instance.config.onReady({ superdoc: instance });
    await pending;

    instance.config.onException({ error: 'הפעולה נכשלה' });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(instance.destroy).not.toHaveBeenCalled();
  });
});

describe('exceptionToError', () => {
  it('מעביר Error כפי שהוא', () => {
    const error = new Error('כשל מקורי');
    expect(exceptionToError({ error } as never)).toBe(error);
  });

  it('עוטף מחרוזת', () => {
    expect(exceptionToError({ error: 'טקסט' } as never).message).toBe('טקסט');
  });

  it('נופל ל-code כשהשגיאה אינה קריאה', () => {
    expect(exceptionToError({ error: {}, code: 'password-required' } as never).message).toContain(
      'password-required',
    );
  });

  it('נופל להודעה בעברית כשאין מידע', () => {
    expect(exceptionToError({ error: undefined } as never).message).toBe('טעינת המסמך נכשלה');
  });
});
