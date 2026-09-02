/**
 * מיקום הגלילה של מסמך שיורד מהמסך וחוזר.
 *
 * ## מה נשמר כאן
 *
 * שני כללים, וההבדל ביניהם הוא כל התוכן של המודול: „החזר את מה שנשמר”
 * (מעבר טאב — המיכל נולד מחדש, מה שנשמר הוא האמת היחידה) מול „תקן רק אם
 * אבד” (חזרה מהרקע — המיכל אולי לא איבד דבר, וכתיבה גורפת שם היא קפיצה).
 *
 * מוטציה שמחליפה את `repairPaneScroll` ב-`applyPaneScroll` נראית תמימה
 * לחלוטין, ובפועל היא זו שגורמת למסמך לקפוץ ממקום שהמשתמש בחר. הבדיקות כאן
 * הן מה שמפריד ביניהן.
 */
import { describe, it, expect } from 'vitest';
import {
  applyPaneScroll,
  PANE_SCROLL_ORIGIN,
  readPaneScroll,
  repairPaneScroll,
  samePaneScroll,
  type ScrollPane,
} from '../../src/sessions/pane-scroll';

/** מיכל גלילה מזויף — שני מספרים, וזה כל מה שהמודול נוגע בו. */
function pane(top = 0, left = 0): ScrollPane {
  return { scrollTop: top, scrollLeft: left };
}

describe('readPaneScroll', () => {
  it('קוראת את שני הצירים', () => {
    expect(readPaneScroll(pane(420, 17))).toEqual({ top: 420, left: 17 });
  });

  it('בלי מיכל — ראש המסמך, ולא קריסה', () => {
    // טאב שממתין לטעינה או שנרדם: אין לו host כלל.
    expect(readPaneScroll(null)).toEqual(PANE_SCROLL_ORIGIN);
    expect(readPaneScroll(undefined)).toEqual(PANE_SCROLL_ORIGIN);
  });

  it('ערך פגום נקרא כאפס ולא נשמר כפי שהוא', () => {
    // מספר שלילי או NaN שנשמר היה חוזר אחר כך כהשמה ל-`scrollTop`.
    expect(readPaneScroll({ scrollTop: -5, scrollLeft: Number.NaN })).toEqual(PANE_SCROLL_ORIGIN);
  });

  it('מחזירה עותק ולא הפניה לקבוע המשותף', () => {
    const read = readPaneScroll(null);
    read.top = 99;

    expect(PANE_SCROLL_ORIGIN.top, 'הקבוע נשאר ראש המסמך לכל הקוראים').toBe(0);
  });
});

describe('applyPaneScroll', () => {
  it('מחזירה את שני הצירים', () => {
    const host = pane();

    expect(applyPaneScroll(host, { top: 300, left: 40 })).toBe(true);
    expect(host).toEqual({ scrollTop: 300, scrollLeft: 40 });
  });

  it('אינה כותבת כשאין הבדל', () => {
    // השמה ל-`scrollTop` היא בקשת גלילה, והיא מבטלת גלילה חלקה שרצה ברגע זה.
    const host = pane(120, 0);

    expect(applyPaneScroll(host, { top: 120, left: 0 })).toBe(false);
  });

  it('מחזירה גם לראש המסמך — זה מיקום ולא „אין מיקום”', () => {
    const host = pane(500);

    expect(applyPaneScroll(host, PANE_SCROLL_ORIGIN)).toBe(true);
    expect(host.scrollTop).toBe(0);
  });

  it('בלי מיכל — לא עושה דבר', () => {
    expect(applyPaneScroll(null, { top: 10, left: 0 })).toBe(false);
  });
});

describe('repairPaneScroll', () => {
  it('מיכל שהתאפס ואנחנו זוכרים אחרת — מתוקן', () => {
    // זו החתימה של „המיקום נמחק”, וזה כל מה שהתיקון הזה מכסה.
    const host = pane(0, 0);

    expect(repairPaneScroll(host, { top: 900, left: 12 })).toBe(true);
    expect(host).toEqual({ scrollTop: 900, scrollLeft: 12 });
  });

  it('מיכל ששרד אינו נגרר למקום אחר', () => {
    // הכלל שמונע את הנזק ההפוך: המסמך התעמד מחדש והמשתמש כבר במקום אחר.
    const host = pane(140, 0);

    expect(repairPaneScroll(host, { top: 900, left: 0 })).toBe(false);
    expect(host.scrollTop).toBe(140);
  });

  it('לא זכרנו כלום — אין מה לתקן', () => {
    const host = pane(0, 0);

    expect(repairPaneScroll(host, PANE_SCROLL_ORIGIN)).toBe(false);
  });

  it('אידמפוטנטית: קריאה שנייה אינה כותבת שוב', () => {
    // שלושת מקורות „חזר” יורים יחד (host/lifecycle.ts), והתיקון נקרא כמה פעמים.
    const host = pane(0, 0);
    const remembered = { top: 900, left: 0 };

    expect(repairPaneScroll(host, remembered)).toBe(true);
    expect(repairPaneScroll(host, remembered)).toBe(false);
  });

  it('בלי מיכל — לא עושה דבר', () => {
    expect(repairPaneScroll(null, { top: 10, left: 0 })).toBe(false);
  });
});

describe('samePaneScroll', () => {
  it('משווה את שני הצירים', () => {
    expect(samePaneScroll({ top: 1, left: 2 }, { top: 1, left: 2 })).toBe(true);
    expect(samePaneScroll({ top: 1, left: 2 }, { top: 1, left: 3 })).toBe(false);
  });
});
