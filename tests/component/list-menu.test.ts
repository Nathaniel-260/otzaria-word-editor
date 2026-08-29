/**
 * תפריט „רשימה" בלשונית „בית" — בדיקת רגרסיה נקודתית.
 *
 * הבאג: `HomeTab.vue` השתמש ב-`<RibbonMenuButton>` בתבנית, אבל הקומפוננטה
 * מעולם לא יובאה בסקריפט (הייבואים כללו רק RibbonGroup / RibbonButton /
 * RibbonSelect). Vue משאיר במקרה כזה אלמנט "לא-פתור" — הוא לא נופל, לא
 * זורק, ופשוט לא מרנדר שום `<button>`. `tests/unit/tab-controls.test.ts`
 * (סריקת מקור) וגם `vue-tsc` עוברים על זה בשקט: התבנית תקינה תחבירית,
 * וה-props שהועברו תואמים את ה-interface של הקומפוננטה שהוגדרה במקום אחר.
 * הבדיקה כאן מרכיבה בפועל ומוודאת שהתפריט **קיים ב-DOM** ופתיח, ושבחירה
 * בפריט שלו אכן מגיעה למסמך.
 */
import { describe, expect, it } from 'vitest';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import { autoUnmount, createSuperdocDouble, mountUi, settle } from './harness';

autoUnmount();

const withSelection = () =>
  createSuperdocDouble({ selection: { hasRange: true, text: 'טקסט נבחר' } });

describe('תפריט „רשימה" בלשונית „בית"', () => {
  it('הכפתור מורכב בפועל ב-DOM — לא אלמנט לא-פתור', async () => {
    const harness = mountUi(HomeTab, { superdoc: withSelection() });
    await settle();

    // `.ribbon-menu` הוא ה-root class של RibbonMenuButton. אם הקומפוננטה
    // אינה מיובאת, האלמנט הזה פשוט לא קיים — לא שגיאה, לא אזהרה שרואים
    // במבט ראשון, רק 0 תוצאות כאן.
    const menu = harness.wrapper.find('.ribbon-menu');
    expect(menu.exists(), '.ribbon-menu לא נמצא — RibbonMenuButton כנראה לא מיובא').toBe(true);
  });

  it('לחיצה פותחת פופאובר עם כל פעולות הרשימה: סגנונות מספור (כולל עברי), התחלה מחדש, המשך והמרה', async () => {
    const harness = mountUi(HomeTab, { superdoc: withSelection() });
    await settle();

    const button = harness.wrapper.find('.ribbon-menu button');
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    await settle();

    const labels = harness.wrapper.findAll('.ribbon-menu__item-label').map((n) => n.text());
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toContain('התחל מחדש מ-1');
    expect(labels).toContain('המשך מספור קודם');
    expect(labels.some((label) => label.includes('המר לטקסט'))).toBe(true);
    // שני סגנונות המספור העברי הם חלק מהרשימה — engine/lists.ts. התוויות
    // אינן נושאות את המילה „עברי”: הן נבדלות זו מזו בשיטה (גימטריה מול סדר
    // האלף-בית), וזה מה שהמשתמש צריך לבחור לפיו. האותיות עצמן כבר אומרות
    // שזה עברי.
    expect(labels.some((label) => label.includes('גימטריה'))).toBe(true);
    expect(labels.some((label) => label.includes('אלף־בית'))).toBe(true);
  });

  it('בחירת "התחל מחדש מ-1" מגיעה בפועל ל-Document API', async () => {
    const harness = mountUi(HomeTab, { superdoc: withSelection() });
    await settle();

    await harness.wrapper.find('.ribbon-menu button').trigger('click');
    await settle();

    const items = harness.wrapper.findAll('.ribbon-menu__item');
    const restartItem = items.find((item) =>
      item.find('.ribbon-menu__item-label').text() === 'התחל מחדש מ-1',
    );
    expect(restartItem?.exists()).toBe(true);

    const before = harness.superdoc.calls.length;
    await restartItem!.trigger('click');
    await settle();

    expect(harness.superdoc.calls.length).toBeGreaterThan(before);
  });
});
