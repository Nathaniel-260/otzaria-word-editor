/**
 * ההחלטות שקובעות אם עבודה של המשתמש נמחקת. הן יושבות במודול נפרד בדיוק כדי
 * שיהיו כאן: מוטציה שהחליפה את כל הזרימה ב„פשוט תמחק” עברה בעבר את כל
 * הבדיקות, כי היא הייתה בתוך המעטפת שאין עליה כיסוי.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  decideDocumentSwitch,
  decidePendingTabClose,
  type SwitchIntent,
} from '../../src/sessions/open-flow';

function deps(options: {
  dirty?: boolean;
  saving?: boolean;
  answers?: boolean[];
  intent?: SwitchIntent;
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
      ...(options.intent ? { intent: options.intent } : {}),
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

/**
 * `intent` משנה נוסח בלבד. הבדיקות כאן מקבעות בדיוק את זה — שההחלטה זהה
 * ושהנוסח אינו: פונקציה שנייה ליציאה הייתה עותק שני של הקוד שקובע אם עבודה
 * נמחקת, ופיצול שקט בין השניים הוא בדיוק מה שאין דרך לראות.
 */
describe('decideDocumentSwitch עם intent: exit', () => {
  it('שואלת על שמירה לפני יציאה, ולא על פתיחת מסמך אחר', async () => {
    const h = deps({ dirty: true, answers: [true], intent: 'exit' });

    const decision = await decideDocumentSwitch(h.deps);

    expect(decision).toEqual({ action: 'save-first' });
    expect(h.confirm.mock.calls[0]![0].content).toBe('לשמור את חידושים לפני יציאה?');
  });

  it('שאלת המחיקה מנוסחת כיציאה', async () => {
    const h = deps({ dirty: true, answers: [false, false], intent: 'exit' });

    await decideDocumentSwitch(h.deps);

    expect(h.asked).toEqual(['המסמך לא נשמר', 'לצאת בלי לשמור?']);
    // תוכן האזהרה זהה בשתי הכוונות: הסיכון הוא אותו סיכון.
    expect(h.confirm.mock.calls[1]![0].content).toContain('יימחקו ואין דרך לשחזר');
  });

  it('ההחלטה עצמה זהה לזו של מעבר מסמך', async () => {
    // אותם קלטים, אותן תשובות, אותה תוצאה — בכל אחד מארבעת המסלולים.
    const paths: Array<{ dirty: boolean; saving?: boolean; answers: boolean[] }> = [
      { dirty: false, answers: [] },
      { dirty: true, saving: true, answers: [] },
      { dirty: true, answers: [false, true] },
      { dirty: true, answers: [false, false] },
    ];

    for (const path of paths) {
      const asSwitch = await decideDocumentSwitch(deps({ ...path }).deps);
      const asExit = await decideDocumentSwitch(deps({ ...path, intent: 'exit' }).deps);
      expect(asExit, JSON.stringify(path)).toEqual(asSwitch);
    }
  });

  it('ברירת המחדל בלי `intent` היא הנוסח של מעבר מסמך', async () => {
    // קריאות קיימות אינן מוסרות `intent`, ואסור שהנוסח שלהן ישתנה.
    const h = deps({ dirty: true, answers: [false, false] });

    await decideDocumentSwitch(h.deps);

    expect(h.asked).toEqual(['המסמך לא נשמר', 'לפתוח בלי לשמור?']);
    expect(h.confirm.mock.calls[0]![0].content).toBe('לשמור את חידושים לפני פתיחת מסמך אחר?');
  });
});

/**
 * סגירת טאב ששוחזר ועדיין לא נטען. אין בו מנוע שיענה „יש שינויים?”, ויש בו
 * טיוטה שהסגירה מוחקת — ולכן ההחלטה כאן ולא במעטפת.
 */
describe('decidePendingTabClose', () => {
  function pending(options: { hasDraft: boolean; answer?: boolean }) {
    const asked: Array<{ title: string; content: string }> = [];
    const confirm = vi.fn(async (question: { title: string; content: string }) => {
      asked.push(question);
      return options.answer === true;
    });
    return {
      asked,
      confirm,
      deps: {
        hasDraft: () => options.hasDraft,
        confirm,
        documentName: () => 'חידושים',
      },
    };
  }

  it('אין טיוטה — אין מה לאבד, ואין שאלה', async () => {
    const h = pending({ hasDraft: false });

    expect(await decidePendingTabClose(h.deps)).toEqual({ action: 'switch' });
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it('יש טיוטה — שואלים, ו„לא” משאיר את הטאב', async () => {
    // הכשל החמור שהשאלה הזאת מונעת: מחיקה שקטה של עבודה שהמשתמש עוד לא ראה.
    const h = pending({ hasDraft: true, answer: false });

    expect(await decidePendingTabClose(h.deps)).toEqual({ action: 'cancel', reason: 'user' });
    expect(h.asked[0]?.title).toBe('לסגור בלי לשמור?');
    expect(h.asked[0]?.content).toContain('חידושים');
  });

  it('יש טיוטה, והמשתמש אישר — סוגרים', async () => {
    const h = pending({ hasDraft: true, answer: true });

    expect(await decidePendingTabClose(h.deps)).toEqual({ action: 'switch' });
    expect(h.confirm).toHaveBeenCalledTimes(1);
  });

  it('„לשמור קודם” אינו מוצע: אין מסמך פתוח שאפשר לייצא ממנו', async () => {
    // שאלה שאין לה מסלול ביצוע גרועה משאלה שלא נשאלה.
    for (const hasDraft of [true, false]) {
      const h = pending({ hasDraft, answer: true });
      expect(await decidePendingTabClose(h.deps)).not.toEqual({ action: 'save-first' });
    }
  });
});
