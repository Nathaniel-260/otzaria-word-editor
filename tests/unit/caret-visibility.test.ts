/**
 * החשבון שמביא את הסמן לתצוגה בחלון צר.
 *
 * המספרים נמדדו בכרום על ה-dist הארוז, מסמך עברי בחלון 600px: מיכל הגלילה
 * מדווח `scrollWidth` 794 מול `clientWidth` 600 (כלומר 209px גלילה זמינה),
 * הסמן בתחילת השורה יושב על `x = 698`, ואחרי שלושה תווים על `672` — שניהם
 * מעבר לקצה התצוגה. ההנמקה המלאה בראש engine/caret-visibility.ts.
 *
 * הבדיקה כאן היא על הנוסחה בלבד. „הדף באמת זז” אינו נמדד ב-jsdom — אין בו
 * פריסה, `getBoundingClientRect` מחזיר אפסים ו-`scrollWidth` הוא 0 תמיד,
 * כלומר כל נוסחה שהיא עוברת שם ירוק. את זה מודד scripts/qa/caret-visibility-qa.mjs.
 */
import { describe, expect, it } from 'vitest';
import { CARET_MARGIN_PX, horizontalScrollDelta } from '../../src/engine/caret-visibility';

/** התצוגה כפי שנמדדה: מאגס 600px שמתחיל בקצה החלון. */
const VIEW = { left: 0, right: 600 };

/** סמן מכווץ — `width: 0`, כפי שהמנוע מדווח אותו. */
const caretAt = (x: number) => ({ left: x, right: x });

describe('horizontalScrollDelta', () => {
  it('סמן בתחילת שורה עברית, מעבר לקצה — גולל עד שהוא נכנס עם המרווח', () => {
    // 698 הוא המקום שנמדד; הגבול הוא 600 − 48.
    expect(horizontalScrollDelta(caretAt(698), VIEW, CARET_MARGIN_PX)).toBe(698 - (600 - 48));
  });

  it('גם אחרי שלושה תווים הסמן עדיין בחוץ, ועדיין נגלל', () => {
    expect(horizontalScrollDelta(caretAt(672), VIEW, CARET_MARGIN_PX)).toBe(672 - (600 - 48));
  });

  it('סמן שכבר בתצוגה, הרחק משני הקצוות — אין לזוז', () => {
    expect(horizontalScrollDelta(caretAt(300), VIEW, CARET_MARGIN_PX)).toBe(0);
  });

  /*
   * הקצה השני הוא סוף השורה בעברית, ושם הדלתא **שלילית**: המיכל `ltr`, ולכן
   * הקטנת `scrollLeft` היא החשיפה שמאלה. בלי הסימן הזה ההקלדה לקצה השמאלי
   * הייתה גוררת את הדף לכיוון ההפוך בדיוק.
   */
  it('סמן שחרג בקצה השמאלי נגלל אחורה', () => {
    expect(horizontalScrollDelta(caretAt(10), VIEW, CARET_MARGIN_PX)).toBe(10 - 48);
  });

  it('בדיוק על גבול המרווח — עוד אין תנועה', () => {
    expect(horizontalScrollDelta(caretAt(600 - CARET_MARGIN_PX), VIEW, CARET_MARGIN_PX)).toBe(0);
    expect(horizontalScrollDelta(caretAt(CARET_MARGIN_PX), VIEW, CARET_MARGIN_PX)).toBe(0);
  });

  /*
   * החיתוך לרבע מרוחב התצוגה. בלי אחד כזה, מאגס צר מ-‎2·48 היה מקבל `min`
   * גדול מ-`max`: כל מיקום סמן מפר את שני הגבולות, וכל תיקון של האחד מפר את
   * השני — כלומר גלילה שמתנדנדת ואינה נחה. עם החיתוך נשאר תמיד חצי מרוחב
   * התצוגה שבו הסמן „בסדר”, ולכן כל גלילה מגיעה למנוחה בצעד אחד.
   */
  it('מאגס צר: המרווח נחתך, והגבולות אינם מתהפכים', () => {
    const narrow = { left: 0, right: 80 };
    // pad נחתך ל-20, כלומר הטווח הבטוח הוא 20..60.
    expect(horizontalScrollDelta(caretAt(100), narrow, CARET_MARGIN_PX)).toBe(40);
    expect(horizontalScrollDelta(caretAt(40), narrow, CARET_MARGIN_PX)).toBe(0);
    expect(horizontalScrollDelta(caretAt(0), narrow, CARET_MARGIN_PX)).toBe(-20);
  });

  it('גלילה מביאה למנוחה: הפעלה שנייה על התוצאה מחזירה אפס', () => {
    const delta = horizontalScrollDelta(caretAt(698), VIEW, CARET_MARGIN_PX);
    // אחרי שהמיכל זז ב-delta, הסמן זז באותו שיעור אל תוך התצוגה.
    expect(horizontalScrollDelta(caretAt(698 - delta), VIEW, CARET_MARGIN_PX)).toBe(0);
  });

  /* מדידה פגומה אינה מזיזה את הדף: עדיף לא לגלול על פני לגלול לשום מקום. */
  it('מידות שאינן מספרים אינן גוררות תנועה', () => {
    expect(horizontalScrollDelta(caretAt(Number.NaN), VIEW, CARET_MARGIN_PX)).toBe(0);
    expect(horizontalScrollDelta(caretAt(698), { left: 0, right: 0 }, CARET_MARGIN_PX)).toBe(0);
    expect(horizontalScrollDelta(caretAt(698), { left: 600, right: 0 }, CARET_MARGIN_PX)).toBe(0);
  });
});
