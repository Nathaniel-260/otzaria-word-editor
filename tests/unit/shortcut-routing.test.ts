/**
 * הניתוב המלא: צירוף → מה שרץ. הבדיקה רצה על **הרג'יסטרי האמיתי** ועל המנתב
 * האמיתי, ומחליפה רק את שני הקצוות (מה שמריץ פקודה, ומה שמריץ פעולה).
 *
 * למה כאן ולא על המעטפת: המעטפת כבר מוכיחה שהחיווט קיים (`shortcuts-core`),
 * ומה שנשאר להוכיח הוא שכל צירוף מגיע למזהה הנכון עם ה-payload הנכון —
 * שתים-עשרה בדיקות מעטפת לאותה שאלה היו איטיות ולא מדויקות יותר. כאן כל
 * צירוף נבדק, כולל ה-payload, בלי להרכיב דבר.
 */
import { describe, it, expect, vi } from 'vitest';
import { createShortcutDispatcher } from '../../src/ui/shortcuts/dispatch';
import { SHORTCUTS, type ShellAction, type Shortcut } from '../../src/ui/shortcuts/registry';

/** הרשומות כטיפוס הרחב — `as const` הופך כל אחת לליטרל משלה. */
const ENTRIES: readonly Shortcut[] = SHORTCUTS;

interface Ran {
  commands: Array<{ id: string; payload: unknown }>;
  actions: ShellAction[];
}

function press(init: Partial<KeyboardEvent> & { code?: string; key?: string }): Ran {
  const ran: Ran = { commands: [], actions: [] };
  const dispatcher = createShortcutDispatcher({
    runCommand: (id, payload) => ran.commands.push({ id, payload }),
    runAction: (action) => {
      ran.actions.push(action);
      return true;
    },
    target: { addEventListener: () => {}, removeEventListener: () => {} },
  });

  dispatcher.handle({
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...init,
  } as unknown as KeyboardEvent);

  dispatcher.dispose();
  return ran;
}

describe('עיצוב תו', () => {
  it('Ctrl+Shift+X — קו חוצה', () => {
    expect(press({ code: 'KeyX', ctrlKey: true, shiftKey: true }).commands).toEqual([
      { id: 'strikethrough', payload: undefined },
    ]);
  });

  it('Ctrl+Space — ניקוי עיצוב', () => {
    expect(press({ code: 'Space', ctrlKey: true }).commands).toEqual([
      { id: 'clear-formatting', payload: undefined },
    ]);
  });

  it('Ctrl+Shift+C — מברשת עיצוב', () => {
    expect(press({ code: 'KeyC', ctrlKey: true, shiftKey: true }).commands).toEqual([
      { id: 'copy-format', payload: undefined },
    ]);
  });

  it('Ctrl+Shift+C אינו Ctrl+C — ההעתקה נשארת של הדפדפן', () => {
    const copy = press({ code: 'KeyC', ctrlKey: true });
    expect(copy.commands).toEqual([]);
    expect(copy.actions).toEqual([]);
  });

  it('Ctrl+] ו-Ctrl+[ הם פעולות, כי הגודל תלוי במנוע', () => {
    expect(press({ key: ']', code: 'BracketRight', ctrlKey: true }).actions).toEqual(['font-grow']);
    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true }).actions).toEqual(['font-shrink']);
  });

  it('הגדלה והקטנה מותאמות לפי התו, ולכן עובדות בכל פריסה פיזית', () => {
    // ב-code שונה לגמרי — מקלדת שבה „]” יושב במקום אחר.
    expect(press({ key: ']', code: 'Digit9', ctrlKey: true }).actions).toEqual(['font-grow']);
  });

  it('Ctrl+= ו-Ctrl+Shift+= — תחתי ועילי', () => {
    expect(press({ key: '=', code: 'Equal', ctrlKey: true }).actions).toEqual(['subscript']);
    expect(press({ key: '=', code: 'Equal', ctrlKey: true, shiftKey: true }).actions).toEqual([
      'superscript',
    ]);
  });
});

describe('פסקה', () => {
  const alignments = [
    ['KeyR', 'right'],
    ['KeyE', 'center'],
    ['KeyL', 'left'],
    ['KeyJ', 'justify'],
  ] as const;

  for (const [code, alignment] of alignments) {
    it(`Ctrl+${code.slice(3)} — יישור ${alignment}`, () => {
      expect(press({ code, ctrlKey: true }).commands).toEqual([
        { id: 'text-align', payload: { alignment } },
      ]);
    });
  }

  it('Ctrl+M ו-Ctrl+Shift+M — כניסה', () => {
    expect(press({ code: 'KeyM', ctrlKey: true }).commands).toEqual([
      { id: 'indent-increase', payload: undefined },
    ]);
    expect(press({ code: 'KeyM', ctrlKey: true, shiftKey: true }).commands).toEqual([
      { id: 'indent-decrease', payload: undefined },
    ]);
  });

  it('ריווח שורות שולח מספר, לא מחרוזת', () => {
    // `unwrapScalar` של המנוע מכיר את המפתח `lineHeight` עם מספר. מחרוזת
    // נדחית בשקט — וזה בדיוק סוג הכשל שהכפתורים סבלו ממנו קודם.
    expect(press({ code: 'Digit1', ctrlKey: true }).commands).toEqual([
      { id: 'line-height', payload: { lineHeight: 1 } },
    ]);
    expect(press({ code: 'Digit2', ctrlKey: true }).commands).toEqual([
      { id: 'line-height', payload: { lineHeight: 2 } },
    ]);
    expect(press({ code: 'Digit5', ctrlKey: true }).commands).toEqual([
      { id: 'line-height', payload: { lineHeight: 1.5 } },
    ]);
  });

  it('Ctrl+Shift+N — סגנון רגיל', () => {
    expect(press({ code: 'KeyN', ctrlKey: true, shiftKey: true }).commands).toEqual([
      { id: 'linked-style', payload: { style: 'Normal' } },
    ]);
  });

  it('Ctrl+1 אינו Ctrl+Alt+1 — ריווח מול כותרת', () => {
    expect(press({ code: 'Digit1', ctrlKey: true }).commands[0]?.id).toBe('line-height');
    expect(press({ code: 'Digit1', ctrlKey: true, altKey: true }).commands[0]?.id).toBe(
      'linked-style',
    );
  });

  it('Ctrl+Shift+N אינו Ctrl+N — סגנון מול מסמך חדש', () => {
    expect(press({ code: 'KeyN', ctrlKey: true }).actions).toEqual(['new-document']);
    expect(press({ code: 'KeyN', ctrlKey: true, shiftKey: true }).commands[0]?.id).toBe(
      'linked-style',
    );
  });
});

describe('הרשימה כולה', () => {
  it('לכל רשומה שאינה של הדפדפן יש ניתוב בפועל', () => {
    // שער נגד רשומה שנוספה ונשכחה: היא תיראה בדיאלוג העזרה ולא תעשה דבר.
    const dead: string[] = [];

    for (const shortcut of ENTRIES) {
      if (shortcut.native) continue;
      // כיווניות מזוהה בשחרור מודיפייר — נבדקת ב-shortcut-direction.test.ts.
      if (shortcut.onKeyUp) continue;
      const codes =
        shortcut.code === undefined
          ? ['']
          : typeof shortcut.code === 'string'
            ? [shortcut.code]
            : [...shortcut.code];

      for (const code of codes) {
        const ran = press({
          code,
          key: shortcut.key ?? '',
          ctrlKey: shortcut.ctrl === true,
          shiftKey: shortcut.shift === true,
          altKey: shortcut.alt === true,
        });
        if (ran.commands.length + ran.actions.length !== 1) dead.push(`${shortcut.id}:${code}`);
      }
    }

    expect(dead).toEqual([]);
  });
});
