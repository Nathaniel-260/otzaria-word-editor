/**
 * מערכת המאקרו — ההתקנה, קיצורי ההקלטה והפירוק.
 *
 * המנוע מוחלף בכפיל מבני (אותה תבנית כמו בדיקות האדפטרים): מה שנבדק כאן הוא
 * החיווט שלנו — לא superdoc-macros עצמה, שמגיעה עם חבילת הבדיקות שלה.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { SuperDoc } from 'superdoc';
import {
  MACRO_STATUS,
  installMacros,
  recordingSavedText,
  type MacrosSession,
} from '../../src/engine/macros';

interface FakeEngine {
  ui: {
    commands: {
      has(id: string): boolean;
      get(id: string): { getState(): { reason?: string } };
      executeAsync(id: string, payload?: unknown): Promise<unknown>;
    };
  };
  activeEditor: null;
}

function createFakeSession(): { session: MacrosSession; engine: FakeEngine } {
  const engine: FakeEngine = {
    ui: {
      commands: {
        has: (id) => id === 'bold',
        get: () => ({ getState: () => ({}) }),
        executeAsync: async () => ({ success: true }),
      },
    },
    activeEditor: null,
  };
  // כפיל מבני של המופע: ההתקנה צורכת רק את המשטחים שלמעלה.
  return { session: { superdoc: engine as unknown as SuperDoc }, engine };
}

function pressCtrlAltR(container: HTMLElement): void {
  container.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, altKey: true, bubbles: true }),
  );
}

function typeChar(container: HTMLElement, char: string): void {
  container.dispatchEvent(
    new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true }),
  );
}

describe('installMacros', () => {
  beforeEach(() => {
    // המאקרו נשמרים ב-localStorage; בלי ניקוי בדיקה אחת מזהמת את הבאה.
    localStorage.clear();
  });

  it('Ctrl+Alt+R מקליט הקלדה ופקודות ושומר בשם רץ', async () => {
    const { session, engine } = createFakeSession();
    const container = document.createElement('div');
    const statuses: string[] = [];
    const handle = installMacros(session, container, (message) => statuses.push(message));

    pressCtrlAltR(container);
    expect(statuses).toEqual([MACRO_STATUS.recordingStarted]);

    typeChar(container, 'ש');
    typeChar(container, 'לום'); // גם קלט רב-תווי (הדבקה) נקלט, ומתלכד עם ההקשה שלפניו
    await engine.ui.commands.executeAsync('bold');
    pressCtrlAltR(container);

    expect(statuses[1]).toBe(recordingSavedText('מאקרו 1'));
    const recordings = handle.kit.listRecordings();
    expect(recordings).toHaveLength(1);
    expect(recordings[0].steps).toEqual([
      { type: 'insert-text', text: 'שלום' },
      { type: 'command', id: 'bold' },
    ]);

    handle.dispose();
  });

  it('Ctrl+Alt+P בלי הקלטה מדווח שאין מה לנגן', () => {
    const { session } = createFakeSession();
    const container = document.createElement('div');
    const statuses: Array<{ message: string; isError?: boolean }> = [];
    const handle = installMacros(session, container, (message, isError) =>
      statuses.push({ message, isError }),
    );

    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, altKey: true, bubbles: true }),
    );

    expect(statuses).toEqual([{ message: MACRO_STATUS.noRecordings, isError: true }]);
    handle.dispose();
  });

  it('שותל קטע ברירת מחדל פעם אחת בלבד', () => {
    const { session } = createFakeSession();
    const container = document.createElement('div');
    const first = installMacros(session, container, () => undefined);
    expect(first.kit.listSnippets()).toHaveLength(1);
    first.dispose();

    const second = installMacros(session, container, () => undefined);
    expect(second.kit.listSnippets()).toHaveLength(1);
    second.dispose();
  });

  it('dispose מסיר את הקיצורים, את עטיפת ה-controller ואת ידית ה-QA', async () => {
    const { session, engine } = createFakeSession();
    const original = engine.ui.commands.executeAsync;
    const container = document.createElement('div');
    const statuses: string[] = [];
    const handle = installMacros(session, container, (message) => statuses.push(message));

    expect(engine.ui.commands.executeAsync).not.toBe(original);
    expect(
      (window as unknown as { __otzariaMacros?: unknown }).__otzariaMacros,
    ).toBe(handle.kit);

    handle.dispose();

    expect(engine.ui.commands.executeAsync).toBe(original);
    expect(
      (window as unknown as { __otzariaMacros?: unknown }).__otzariaMacros,
    ).toBeUndefined();

    pressCtrlAltR(container);
    expect(statuses).toEqual([]);
  });
});
