/**
 * הבדיקה המרכזית כאן היא "מסמך פעיל + פתיחה נכשלת ⇒ הקודם נשאר פעיל". זה
 * המצב שבו אובדת עבודה: קובץ פגום או מוגן בסיסמה שמפרק את המסמך שהמשתמש כתב.
 * שאר הבדיקות מכסות את מה שקורה כששתי פתיחות מתרוצצות, כולל סיום מחוץ לסדר.
 */
import { describe, it, expect, vi } from 'vitest';
import type { EditorSession } from '../../src/engine/create-editor';
import { createEditorSwap, HOST_CLASS, PENDING_CLASS } from '../../src/sessions/editor-swap';

interface Deferred {
  promise: Promise<EditorSession>;
  resolve: (session: EditorSession) => void;
  reject: (error: Error) => void;
}

function deferred(): Deferred {
  let resolve!: (session: EditorSession) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<EditorSession>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeSession(name: string): EditorSession & { name: string; destroy: ReturnType<typeof vi.fn> } {
  return {
    name,
    superdoc: {} as EditorSession['superdoc'],
    ui: {} as EditorSession['ui'],
    onDispose: vi.fn(),
    destroy: vi.fn(),
  } as unknown as EditorSession & { name: string; destroy: ReturnType<typeof vi.fn> };
}

function setup() {
  const container = document.createElement('div');
  document.body.replaceChildren(container);

  const opens: Array<{ host: HTMLElement; source?: unknown; deferred: Deferred }> = [];
  const swap = createEditorSwap(container, (host, source) => {
    const d = deferred();
    opens.push({ host, source, deferred: d });
    return d.promise;
  });

  return { container, opens, swap };
}

const hosts = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(`.${HOST_CLASS}`));

describe('createEditorSwap', () => {
  it('פתיחה ראשונה הופכת לפעילה ונחשפת', async () => {
    const { container, opens, swap } = setup();

    const promise = swap.open('a.docx');
    expect(hosts(container)).toHaveLength(1);
    expect(hosts(container)[0].classList.contains(PENDING_CLASS)).toBe(true);
    expect(swap.isOpening).toBe(true);

    const first = fakeSession('a');
    opens[0].deferred.resolve(first);

    await expect(promise).resolves.toEqual({ status: 'opened', session: first });
    expect(swap.current).toBe(first);
    expect(swap.isOpening).toBe(false);
    expect(hosts(container)).toHaveLength(1);
    expect(hosts(container)[0].classList.contains(PENDING_CLASS)).toBe(false);
  });

  it('מוסר את ה-source לפותח', async () => {
    const { opens, swap } = setup();
    void swap.open('http://127.0.0.1/f/tok');

    expect(opens[0].source).toBe('http://127.0.0.1/f/tok');
  });

  it('פתיחה מוצלחת מפרקת את הקודם ומשאירה host אחד', async () => {
    const { container, opens, swap } = setup();

    const first = fakeSession('a');
    const firstOpen = swap.open('a.docx');
    opens[0].deferred.resolve(first);
    await firstOpen;

    const second = fakeSession('b');
    const secondOpen = swap.open('b.docx');
    expect(hosts(container)).toHaveLength(2);
    expect(first.destroy).not.toHaveBeenCalled();

    opens[1].deferred.resolve(second);
    await secondOpen;

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(swap.current).toBe(second);
    expect(hosts(container)).toHaveLength(1);
  });

  it('מסמך פעיל ופתיחה שנכשלת — הקודם נשאר פעיל', async () => {
    const { container, opens, swap } = setup();

    const first = fakeSession('a');
    const firstOpen = swap.open('a.docx');
    opens[0].deferred.resolve(first);
    await firstOpen;

    const failing = swap.open('corrupt.docx');
    opens[1].deferred.reject(new Error('הקובץ מוגן בסיסמה'));
    const outcome = await failing;

    expect(outcome).toEqual({ status: 'failed', error: expect.any(Error) });
    expect(outcome.status === 'failed' && outcome.error.message).toBe('הקובץ מוגן בסיסמה');
    // העיקר: המסמך שהמשתמש עבד עליו לא נגע ולא פורק.
    expect(swap.current).toBe(first);
    expect(first.destroy).not.toHaveBeenCalled();
    expect(hosts(container)).toHaveLength(1);
    expect(hosts(container)[0].classList.contains(PENDING_CLASS)).toBe(false);
  });

  it('כשל בפתיחה ראשונה משאיר את המצב ריק ובלי hosts', async () => {
    const { container, opens, swap } = setup();

    const failing = swap.open('corrupt.docx');
    opens[0].deferred.reject(new Error('הקובץ פגום'));

    const outcome = await failing;

    expect(outcome.status).toBe('failed');
    expect(swap.current).toBeNull();
    expect(swap.isOpening).toBe(false);
    expect(hosts(container)).toHaveLength(0);
  });

  it('פתיחה שהוחלפה מפרקת את עצמה ואינה נוגעת בפעיל', async () => {
    const { container, opens, swap } = setup();

    const slow = swap.open('slow.docx');
    const fast = swap.open('fast.docx');

    const fastSession = fakeSession('fast');
    opens[1].deferred.resolve(fastSession);
    await expect(fast).resolves.toEqual({ status: 'opened', session: fastSession });

    const slowSession = fakeSession('slow');
    opens[0].deferred.resolve(slowSession);

    await expect(slow).resolves.toEqual({ status: 'superseded' });
    expect(slowSession.destroy).toHaveBeenCalledTimes(1);
    expect(fastSession.destroy).not.toHaveBeenCalled();
    expect(swap.current).toBe(fastSession);
    expect(hosts(container)).toHaveLength(1);
  });

  it('כשל של פתיחה שהוחלפה אינו מדווח כשגיאה', async () => {
    const { opens, swap } = setup();

    const slow = swap.open('slow.docx');
    const fast = swap.open('fast.docx');
    opens[1].deferred.resolve(fakeSession('fast'));
    await fast;

    opens[0].deferred.reject(new Error('בוטל'));

    await expect(slow).resolves.toEqual({ status: 'superseded' });
  });

  it('destroy מפרק את הפעיל ומנקה את המסך', async () => {
    const { container, opens, swap } = setup();
    const first = fakeSession('a');
    const open = swap.open();
    opens[0].deferred.resolve(first);
    await open;

    swap.destroy();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(swap.current).toBeNull();
    expect(hosts(container)).toHaveLength(0);
  });

  it('פתיחה שהייתה בדרך בזמן destroy מפרקת את עצמה', async () => {
    const { container, opens, swap } = setup();

    const inFlight = swap.open();
    swap.destroy();
    const late = fakeSession('late');
    opens[0].deferred.resolve(late);

    await expect(inFlight).resolves.toEqual({ status: 'superseded' });
    expect(late.destroy).toHaveBeenCalledTimes(1);
    expect(swap.current).toBeNull();
    expect(hosts(container)).toHaveLength(0);
  });
});
