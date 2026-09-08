/**
 * ההחלטה מי מתכווץ ברצועה צרה (ui/ribbon/overflow.ts).
 *
 * המדידה עצמה היא DOM, אבל ההחלטה אינה: היא פונקציה מרשימת רוחבים ורוחב פנוי
 * לרשימת דגלים. זה מה שנבדק כאן — jsdom מחזיר אפס מכל `offsetWidth`, ולכן
 * ההתנהגות בדפדפן אמיתי נמדדת בשער (scripts/qa/ribbon-collapse-qa.mjs).
 */
import { describe, expect, it } from 'vitest';
import { planCollapse, type GroupWidth } from '../../src/ui/ribbon/overflow';

/** קבוצות רגילות: כל אחת רחבה מהצ'יפ שיחליף אותה. */
function groups(...naturals: number[]): GroupWidth[] {
  return naturals.map((natural) => ({ natural, chip: 70 }));
}

describe('planCollapse', () => {
  it('רצועה שנכנסת אינה מכווצת דבר', () => {
    expect(planCollapse(groups(200, 200, 200), 700)).toEqual([false, false, false]);
  });

  it('מכווצת מהסוף להתחלה, וכמה שצריך בלבד', () => {
    // 600 טבעי מול 500 פנוי: כיווץ אחד (‎-130) מספיק.
    expect(planCollapse(groups(200, 200, 200), 500)).toEqual([false, false, true]);
    // 340 פנוי: גם השני חייב ליפול.
    expect(planCollapse(groups(200, 200, 200), 340)).toEqual([false, true, true]);
  });

  it('בקצה מכווצת את כולן, ולא נכנסת ללולאה', () => {
    expect(planCollapse(groups(200, 200, 200), 100)).toEqual([true, true, true]);
  });

  it('מדלגת על קבוצה שאינה רחבה מהצ׳יפ שלה', () => {
    // האמצעית היא קבוצה בת פקד אחד: כיווצה רק היה מרחיב אותה.
    const mixed: GroupWidth[] = [
      { natural: 300, chip: 70 },
      { natural: 50, chip: 70 },
      { natural: 300, chip: 70 },
    ];
    expect(planCollapse(mixed, 400)).toEqual([true, false, true]);
  });

  it('גלישה שאי אפשר לרפא משאירה את הצרות פרושות', () => {
    // שלוש קבוצות של 50 ברוחב 100: אין מה לכווץ, והגלישה נשארת (פס גלילה).
    const narrow: GroupWidth[] = [
      { natural: 50, chip: 70 },
      { natural: 50, chip: 70 },
      { natural: 50, chip: 70 },
    ];
    expect(planCollapse(narrow, 100)).toEqual([false, false, false]);
  });

  it('רוחב שאינו ידוע עדיין אינו מכווץ כלום', () => {
    // `clientWidth` אפס — רצועה מכווצת או שטרם נפרסה.
    expect(planCollapse(groups(200, 200), 0)).toEqual([false, false]);
    expect(planCollapse([], 500)).toEqual([]);
  });

  it('אותו רוחב מחזיר תמיד את אותה תוכנית', () => {
    // אין כאן זיכרון של המצב הקודם, ולכן אין הבהוב בין שתי תוכניות.
    const widths = groups(180, 180, 180, 180);
    for (let available = 200; available <= 800; available += 37) {
      expect(planCollapse(widths, available)).toEqual(planCollapse(widths, available));
    }
  });
});
