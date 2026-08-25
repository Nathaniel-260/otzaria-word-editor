/**
 * כיווניות פסקה — הקיצור היחיד בתוסף שנופל על **שחרור** מודיפייר.
 *
 * הוא גם הקיצור שהכי קל לשבור בו משהו אחר: כל `Ctrl+Shift+משהו` בממשק נגמר
 * בשחרור של אותו `Shift` בדיוק, ולכן זיהוי רשלני היה הופך את כיוון הפסקה בכל
 * פעם שמשתמש לוחץ „קו חוצה”.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createDirectionDetector,
  createDirectionShortcut,
  DIRECTION_COMMANDS,
  type ModifierEventLike,
} from '../../src/ui/shortcuts/direction';

function shift(side: 'ShiftLeft' | 'ShiftRight', over: Partial<ModifierEventLike> = {}) {
  return { code: side, key: 'Shift', ctrlKey: true, metaKey: false, ...over };
}

function letter(code: string, over: Partial<ModifierEventLike> = {}) {
  return { code, key: code.slice(3).toLowerCase(), ctrlKey: true, metaKey: false, ...over };
}

describe('זיהוי הכיווניות', () => {
  it('Ctrl + Shift ימני — מימין לשמאל', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight'));

    expect(detector.keyup(shift('ShiftRight'))).toBe('rtl');
  });

  it('Ctrl + Shift שמאלי — משמאל לימין', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftLeft'));

    expect(detector.keyup(shift('ShiftLeft'))).toBe('ltr');
  });

  it('Shift בלי Ctrl אינו כיווניות', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight', { ctrlKey: false }));

    expect(detector.keyup(shift('ShiftRight', { ctrlKey: false }))).toBeNull();
  });

  it('Ctrl+Shift+X אינו הופך את כיוון הפסקה', () => {
    // הבאג שהמכונה הזאת קיימת בשבילו: „קו חוצה” נגמר בשחרור אותו Shift.
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftLeft'));
    detector.keydown(letter('KeyX', { ctrlKey: true }));

    expect(detector.keyup(shift('ShiftLeft'))).toBeNull();
  });

  it('Ctrl ששוחרר לפני ה-Shift מבטל', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight'));

    expect(detector.keyup(shift('ShiftRight', { ctrlKey: false }))).toBeNull();
  });

  it('שחרור של Shift אחר מזה שנלחץ אינו נחשב', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight'));

    expect(detector.keyup(shift('ShiftLeft'))).toBeNull();
  });

  it('בלי code — נופל ל-location', () => {
    const detector = createDirectionDetector();
    const right = { key: 'Shift', location: 2, ctrlKey: true, metaKey: false };

    detector.keydown(right);

    expect(detector.keyup(right)).toBe('rtl');
  });

  it('Shift בלי צד ידוע אינו מנחש כיוון', () => {
    const detector = createDirectionDetector();
    const unknown = { key: 'Shift', ctrlKey: true, metaKey: false };

    detector.keydown(unknown);

    expect(detector.keyup(unknown)).toBeNull();
  });

  it('שחרור חוזר בלי לחיצה חדשה אינו יורה שוב', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight'));

    expect(detector.keyup(shift('ShiftRight'))).toBe('rtl');
    expect(detector.keyup(shift('ShiftRight'))).toBeNull();
  });

  it('שתי לחיצות רצופות הן שתי פעולות נפרדות', () => {
    const detector = createDirectionDetector();

    detector.keydown(shift('ShiftRight'));
    expect(detector.keyup(shift('ShiftRight'))).toBe('rtl');

    detector.keydown(shift('ShiftLeft'));
    expect(detector.keyup(shift('ShiftLeft'))).toBe('ltr');
  });

  it('Meta שקול ל-Ctrl', () => {
    const detector = createDirectionDetector();
    const withMeta = shift('ShiftRight', { ctrlKey: false, metaKey: true });

    detector.keydown(withMeta);

    expect(detector.keyup(withMeta)).toBe('rtl');
  });
});

/** יעד מזויף, כדי לוודא שהמאזינים נרשמים ומנותקים. */
function fakeTarget() {
  const listeners: Record<string, EventListener[]> = {};
  return {
    total: () => Object.values(listeners).flat().length,
    fire: (type: string, event: unknown) =>
      (listeners[type] ?? []).forEach((listener) => listener(event as Event)),
    addEventListener: (type: string, listener: unknown) => {
      (listeners[type] ??= []).push(listener as EventListener);
    },
    removeEventListener: (type: string, listener: unknown) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    },
  };
}

describe('החיבור לאירועים', () => {
  it('מריץ את הפקודה של הכיוון', () => {
    const runCommand = vi.fn();
    const target = fakeTarget();
    createDirectionShortcut({ runCommand, target });

    target.fire('keydown', shift('ShiftRight'));
    target.fire('keyup', shift('ShiftRight'));

    expect(runCommand).toHaveBeenCalledExactlyOnceWith(DIRECTION_COMMANDS.rtl);
  });

  it('נחסם כשהפוקוס בשדה טקסט של הממשק', () => {
    const runCommand = vi.fn();
    const target = fakeTarget();
    createDirectionShortcut({ runCommand, target, isBlocked: () => true });

    target.fire('keydown', shift('ShiftRight'));
    target.fire('keyup', shift('ShiftRight'));

    expect(runCommand).not.toHaveBeenCalled();
  });

  it('dispose מנתק את שני המאזינים', () => {
    const runCommand = vi.fn();
    const target = fakeTarget();
    const handle = createDirectionShortcut({ runCommand, target });
    expect(target.total()).toBe(2);

    handle.dispose();
    expect(target.total()).toBe(0);

    target.fire('keydown', shift('ShiftRight'));
    target.fire('keyup', shift('ShiftRight'));
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('מזהי הפקודות הם אלה שב-registry של היכולות', () => {
    expect(DIRECTION_COMMANDS).toEqual({ rtl: 'direction-rtl', ltr: 'direction-ltr' });
  });
});
