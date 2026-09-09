/**
 * שני כפתורי הצעד שליד בורר מרווח השורות, והאייקונים של קבוצת „פיסקה”.
 *
 * מה שנבדק כאן ואינו נבדק בבורר עצמו (ribbon-payloads, picker-state): הצעד
 * הוא **מהערך שמוצג**, ולא מהערך שהמנוע דיווח — והמנוע אינו מדווח ערך
 * ל-`line-height` כלל (ראו `parseLineHeight` ב-engine/payloads.ts). כלומר
 * לחיצה שנייה נשענת על מה שהלחיצה הראשונה הותירה על המסך, וזה בדיוק המסלול
 * שבו „הגדל גופן” נשבר פעם: שלוש לחיצות שלחו את אותם שני ערכים.
 *
 * החישוב וההגבלה נבדקים ב-tests/unit/payloads.test.ts. כאן נבדק מה שמחבר
 * אותם לכפתור.
 */
import { describe, expect, it } from 'vitest';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import {
  autoUnmount,
  buttonByTip,
  createCommandDouble,
  mountUi,
  pickerValue,
  settle,
  tipOf,
} from './harness';

autoUnmount();

const GROW = 'הגדל מרווח שורות';
const SHRINK = 'הקטן מרווח שורות';
const PICKER = 'מרווח בין שורות';

describe('צעד במרווח השורות', () => {
  it('„הגדל” שולח 0.1 מעל מה שמוצג, ולא את האפשרות הבאה בבורר', async () => {
    const harness = mountUi(HomeTab);
    await settle();
    // 1.5 הוא DEFAULT_LINE_HEIGHT, ומה שהבורר מציג כשאין דיווח מהמנוע.
    expect(pickerValue(harness.wrapper, PICKER)).toBe('1.5');

    await buttonByTip(harness.wrapper, GROW).trigger('click');
    await settle();

    // 2.0 היא האפשרות הבאה ברשימה; מי שלוחץ „הגדל” מבקש 1.6.
    expect(harness.adapter.payloads('line-height')).toEqual([{ lineHeight: 1.6 }]);
    expect(harness.adapter.rejected).toEqual([]);
    expect(pickerValue(harness.wrapper, PICKER)).toBe('1.6');
  });

  it('„הקטן” יורד בצעד אחד', async () => {
    const harness = mountUi(HomeTab);
    await settle();

    await buttonByTip(harness.wrapper, SHRINK).trigger('click');
    await settle();

    expect(harness.adapter.payloads('line-height')).toEqual([{ lineHeight: 1.4 }]);
    expect(pickerValue(harness.wrapper, PICKER)).toBe('1.4');
  });

  it('שלוש לחיצות צועדות שלושה צעדים, ולא שולחות את אותו ערך שוב', async () => {
    const harness = mountUi(HomeTab);
    await settle();

    for (let click = 0; click < 3; click += 1) {
      await buttonByTip(harness.wrapper, GROW).trigger('click');
      await settle();
    }

    expect(harness.adapter.payloads('line-height')).toEqual([
      { lineHeight: 1.6 },
      { lineHeight: 1.7 },
      { lineHeight: 1.8 },
    ]);
  });

  it('ערך שנוצר בלחיצה נכנס לבורר במקומו לפי הסדר', async () => {
    const harness = mountUi(HomeTab);
    await settle();

    await buttonByTip(harness.wrapper, GROW).trigger('click');
    await settle();

    // בראש הרשימה הוא היה נותן „1.6, 1.0, 1.15…” — סולם שאי אפשר לאמוד בו מרחק.
    const values = harness.wrapper
      .findAll(`select[data-tip-title="${PICKER}"] option`)
      .map((option) => option.attributes('value'));
    expect(values).toEqual(['1.0', '1.15', '1.5', '1.6', '2.0', '2.5', '3.0']);
  });

  it('בקצות הסולם הכפתור כבוי, והכרטיס אומר למה ולאן להמשיך', async () => {
    // 10 הוא הגבול ש-`parseLineHeight` מפריד בו בין מכפיל ל-240ths: מכפיל
    // גדול ממנו היה חוזר מהמנוע כמספר אחר לגמרי.
    const ceiling = mountUi(HomeTab, {
      adapter: createCommandDouble({ states: { 'line-height': { value: 10 } } }),
    });
    await settle();

    const grow = buttonByTip(ceiling.wrapper, GROW);
    expect(grow.attributes('disabled')).toBeDefined();
    expect(tipOf(grow).description).toBe('10 הוא המרווח הגדול ביותר כאן. מעליו — „תפריט פסקה”');
    // הכפתור ההפוך דווקא פעיל שם, אחרת הקצה הוא מלכודת.
    expect(buttonByTip(ceiling.wrapper, SHRINK).attributes('disabled')).toBeUndefined();

    const floor = mountUi(HomeTab, {
      adapter: createCommandDouble({ states: { 'line-height': { value: 0.1 } } }),
    });
    await settle();

    const shrink = buttonByTip(floor.wrapper, SHRINK);
    expect(shrink.attributes('disabled')).toBeDefined();
    expect(tipOf(shrink).description).toBe('0.1 הוא המרווח הקטן ביותר כאן. מתחתיו — „תפריט פסקה”');
  });

  it('הכפתורים כבויים כשהפקודה אינה זמינה, כמו הבורר שלצדם', async () => {
    const harness = mountUi(HomeTab, {
      adapter: createCommandDouble({ states: { 'line-height': { enabled: false } } }),
    });
    await settle();

    expect(buttonByTip(harness.wrapper, GROW).attributes('disabled')).toBeDefined();
    expect(buttonByTip(harness.wrapper, SHRINK).attributes('disabled')).toBeDefined();
  });

  it('אין שני פקדים בקבוצת „פיסקה” שמצוירים אותו דבר', async () => {
    /*
     * זה הבאג שהיה כאן: „תפריט פסקה” ו„הצג/הסתר סימני עיצוב” חלקו את
     * `pilcrow`. שני כפתורים שכנים עם אותו ציור אינם שני כפתורים — הם אחד
     * שנראה שבור, וההבדל ביניהם נמצא רק במי שמרחף על שניהם.
     *
     * חצי המשולש של הכפתורים המפוצלים (`word-split__arrow`) מוחרג בכוונה:
     * הוא **אמור** להיות זהה בשניהם, מפני שהוא אינו הפקודה אלא „יש כאן
     * תפריט”.
     */
    const harness = mountUi(HomeTab);
    await settle();

    const group = harness.wrapper
      .findAll('.word-ribbon-group')
      .find((candidate) => candidate.find('.word-group-title').text() === 'פיסקה');
    if (!group) throw new Error('לא נמצאה קבוצת „פיסקה”');

    const drawings = new Map<string, string[]>();
    for (const button of group.findAll('button')) {
      if (button.element.closest('.word-split__arrow')) continue;
      const svg = button.find('svg');
      if (!svg.exists()) continue;
      const key = svg.element.innerHTML;
      drawings.set(key, [...(drawings.get(key) ?? []), tipOf(button).title]);
    }

    expect([...drawings.values()].filter((names) => names.length > 1)).toEqual([]);
    // ושהמדידה ראתה את הקבוצה כולה: שמונה פקדים בשורה העליונה, שישה בתחתונה.
    expect(drawings.size).toBe(14);
  });
});
