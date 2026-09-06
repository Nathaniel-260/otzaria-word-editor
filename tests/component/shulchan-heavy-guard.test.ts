/**
 * לשונית „שולחן העורך” היא הרצועה, והרצועה **עוקפת** את רישום הכלים על ה-kit:
 * `runTool` המקומי מייבא את הפונקציות ישירות, ויש בו שמונה-עשר אתרי קריאה.
 * לכן העטיפה של רישום הכלים אינה מכסה אותה, וצריך את שתיהן.
 *
 * מה שנמדד כאן הוא בדיוק זה: פעולה של הלשונית עוברת בשומר שהמעטפת מזריקה.
 */
import { describe, expect, it } from 'vitest';
import ShulchanTab from '../../src/ui/ribbon/tabs/ShulchanTab.vue';
import { createSuperdocDouble, mountUi, settle } from './harness';

/** מסמך עם בחירה חיה — בלעדיה חלק מהכלים אינם פעילים. */
const withSelection = () => createSuperdocDouble({ selection: { hasRange: true, text: 'טקסט נבחר' } });

describe('שולחן העורך — כל כלי עובר בשומר של הפעולה הכבדה', () => {
  it('לחיצה על כלי מריצה אותו בתוך השומר, ולא במקומו', async () => {
    const order: string[] = [];
    const harness = mountUi(ShulchanTab, {
      superdoc: withSelection(),
      heavyActionGuard: async (action) => {
        order.push('enter');
        const result = await action();
        order.push('exit');
        return result;
      },
    });
    await settle();

    // „תיקון העתקה” ולא הכפתור הראשון שנמצא: חלק מהפקדים פותחים דיאלוג
    // ואינם מריצים כלי, ובדיקה שנופלת על אחד מהם עוברת מהסיבה הלא נכונה.
    const button = harness.wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('תיקון העתקה'));
    expect(button, 'הכפתור „תיקון העתקה” חייב להיות בלשונית').toBeDefined();

    await button!.trigger('click');
    await settle(6);

    // „enter” לפני „exit”, ושניהם קרו: פעולה שרצה **מחוץ** לשומר הייתה
    // משאירה מערך ריק, ופעולה שהשומר בלע הייתה משאירה רק „enter”.
    expect(order).toEqual(['enter', 'exit']);
  });

  it('בלי מעטפת — הלשונית עדיין עובדת', async () => {
    // ברירת המחדל של ה-inject קיימת בשביל בדיקות שמרכיבות לשונית לבדה.
    const harness = mountUi(ShulchanTab, { superdoc: withSelection() });
    await settle();

    const button = harness.wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('תיקון העתקה'));
    await button!.trigger('click');
    await settle(6);

    expect(harness.wrapper.exists()).toBe(true);
  });
});
