/**
 * ההחלטות שקובעות אם עבודה של המשתמש נמחקת. הן יושבות במודול נפרד בדיוק כדי
 * שיהיו כאן: מוטציה שהחליפה את כל הזרימה ב„פשוט תמחק” עברה בעבר את כל
 * הבדיקות, כי היא הייתה בתוך המעטפת שאין עליה כיסוי.
 */
import { describe, it, expect, vi } from 'vitest';
import { decideDocumentSwitch, saveShortcut } from '../../src/sessions/open-flow';

function deps(options: {
  dirty?: boolean;
  saving?: boolean;
  answers?: boolean[];
}) {
  const answers = [...(options.answers ?? [])];
  const asked: string[] = [];
  const confirm = vi.fn(async (q: { title: string; content: string }) => {
    asked.push(q.title);
    return answers.shift() === true;
  });
  return {
    asked,
    confirm,
    deps: {
      isDirty: () => options.dirty ?? false,
      isSaving: () => options.saving ?? false,
      confirm,
      documentName: () => 'חידושים',
    },
  };
}

describe('decideDocumentSwitch', () => {
  it('מסמך נקי — מחליפים בלי לשאול', async () => {
    const h = deps({ dirty: false });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({ action: 'switch' });
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it('בזמן שמירה — לא מחליפים ולא שואלים', async () => {
    const h = deps({ dirty: true, saving: true });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({
      action: 'cancel',
      reason: 'saving',
    });
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it('„לשמור?” → כן ⇒ לשמור קודם', async () => {
    const h = deps({ dirty: true, answers: [true] });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({ action: 'save-first' });
    expect(h.asked).toEqual(['המסמך לא נשמר']);
  });

  it('„לשמור?” → לא, „למחוק?” → כן ⇒ מחליפים', async () => {
    const h = deps({ dirty: true, answers: [false, true] });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({ action: 'switch' });
    // „לא לשמור” אינו „למחוק”, ולכן חייבת לבוא שאלה שנייה.
    expect(h.asked).toEqual(['המסמך לא נשמר', 'לפתוח בלי לשמור?']);
  });

  it('„לשמור?” → לא, „למחוק?” → לא ⇒ ביטול', async () => {
    const h = deps({ dirty: true, answers: [false, false] });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({
      action: 'cancel',
      reason: 'user',
    });
  });

  it('דיאלוג שנכשל נחשב „לא” ⇒ ביטול, לא מחיקה', async () => {
    // confirm מחזירה false גם כשה-Host לא ענה. פייל-קלוז: לא מוחקים.
    const h = deps({ dirty: true, answers: [] });

    await expect(decideDocumentSwitch(h.deps)).resolves.toEqual({
      action: 'cancel',
      reason: 'user',
    });
  });

  it('שם המסמך מופיע בשתי השאלות', async () => {
    const h = deps({ dirty: true, answers: [false, false] });

    await decideDocumentSwitch(h.deps);

    for (const call of h.confirm.mock.calls) {
      expect(call[0].content).toContain('חידושים');
    }
  });
});

describe('saveShortcut', () => {
  const key = (over: Partial<KeyboardEvent> = {}) => ({
    key: 's',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...over,
  });

  it('Ctrl+S שומר', () => {
    expect(saveShortcut(key({ ctrlKey: true }), false)).toEqual({
      isSaveKey: true,
      handled: true,
      saveAs: false,
    });
  });

  it('Cmd+Shift+S הוא „שמור בשם”', () => {
    expect(saveShortcut(key({ metaKey: true, shiftKey: true }), false)).toEqual({
      isSaveKey: true,
      handled: true,
      saveAs: true,
    });
  });

  it('בזמן שמירה מיירטים אבל לא מריצים', () => {
    // הרגרסיה: saveNow היה מצטרף לסבב שרץ, ולכן Ctrl+Shift+S נראה כאילו פתח
    // „שמור בשם” ובפועל לא פתח שום דיאלוג.
    expect(saveShortcut(key({ ctrlKey: true, shiftKey: true }), true)).toMatchObject({
      isSaveKey: true,
      handled: false,
    });
  });

  it('S לבד או צירוף אחר אינם הקיצור', () => {
    expect(saveShortcut(key(), false).isSaveKey).toBe(false);
    expect(saveShortcut(key({ key: 'a', ctrlKey: true }), false).isSaveKey).toBe(false);
  });

  it('אות גדולה נתפסת (Shift משנה את key)', () => {
    expect(saveShortcut(key({ key: 'S', ctrlKey: true, shiftKey: true }), false)).toMatchObject({
      isSaveKey: true,
      saveAs: true,
    });
  });
});
