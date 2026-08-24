/**
 * השער שאם היה קיים, גל התיקונים הזה לא היה נדרש: **כל** כפתור בכל לשונית
 * מורכב, נלחץ, ונמדד — או שהוא מנוטרל, או שהלחיצה עליו עשתה משהו נצפה.
 * „משהו נצפה” הוא אחד מארבעה: פקודה לאדפטר, קריאה ל-Document API, event
 * שנפלט, או שינוי ב-DOM (פופאובר שנפתח). כפתור שנלחץ ואף אחד מהם לא קרה הוא
 * כפתור מת, וזה כשל.
 *
 * למה זה תופס מה שסריקת המקור אינה תופסת: `tests/unit/tab-controls.test.ts`
 * שואל „האם יש `@click`”, וזה כל מה שהוא יכול לשאול. `doCut(){}`,
 * `insertPageBreak(){}` ו-`doSelectAll` שסימן את ממשק האפליקציה במקום את
 * המסמך — כולם עברו את השאלה ההיא בהצלחה מלאה.
 *
 * כל כפתור נמדד בהרכבה **טרייה**: פופאובר שנפתח בלחיצה קודמת היה משנה את מה
 * שהלחיצה הבאה פוגשת, וכשל כזה היה תלוי בסדר.
 *
 * ה-events נספרים דרך `emittedCount` של ה-harness, שמדלג על `click`: VTU רושם
 * ב-`emitted()` גם אירועי DOM שעברו דרך השורש, ולכן `click` מופיע שם גם על
 * כפתור מת. „בדיקת הבקרה” שבסוף הקובץ היא מה שמקבע את ההבחנה הזאת.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { DOMWrapper } from '@vue/test-utils';
import { defineComponent, h, type Component } from 'vue';
import RibbonButton from '../../src/ui/ribbon/common/RibbonButton.vue';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import FileTab from '../../src/ui/ribbon/tabs/FileTab.vue';
import InsertTab from '../../src/ui/ribbon/tabs/InsertTab.vue';
import LayoutTab from '../../src/ui/ribbon/tabs/LayoutTab.vue';
import ReferencesTab from '../../src/ui/ribbon/tabs/ReferencesTab.vue';
import ReviewTab from '../../src/ui/ribbon/tabs/ReviewTab.vue';
import ViewTab from '../../src/ui/ribbon/tabs/ViewTab.vue';
import OtzariaTab from '../../src/ui/ribbon/tabs/OtzariaTab.vue';
import {
  autoUnmount,
  createSuperdocDouble,
  emittedCount,
  installSystemClipboard,
  mountUi,
  settle,
} from './harness';

autoUnmount();

/** מסמך עם בחירה חיה: בלעדיה פעולות הלוח נכשלות לפני שהן נוגעות במנוע. */
const withSelection = () =>
  createSuperdocDouble({ selection: { hasRange: true, text: 'טקסט נבחר' } });

const TABS: ReadonlyArray<{ name: string; component: Component }> = [
  { name: 'קובץ', component: FileTab },
  { name: 'בית', component: HomeTab },
  { name: 'הוספה', component: InsertTab },
  { name: 'פריסה', component: LayoutTab },
  { name: 'הפניות', component: ReferencesTab },
  { name: 'סקירה', component: ReviewTab },
  { name: 'תצוגה', component: ViewTab },
];

/** מה שמזהה כפתור בהודעת כשל — כדי שאפשר יהיה למצוא אותו בקובץ. */
function nameOf(button: DOMWrapper<Element>): string {
  return (
    button.attributes('title') ||
    button.attributes('aria-label') ||
    button.text().trim() ||
    button.html().slice(0, 70)
  );
}

interface Probe {
  name: string;
  disabled: boolean;
  /** מה שקרה בלחיצה, ריק = כלום. */
  effects: string[];
}

/**
 * מרכיבה את הלשונית, לוחצת על הכפתור ה-index, ומחזירה מה קרה.
 *
 * `count` מוחזר בהרכבה הראשונה כדי שהסוקר ידע כמה כפתורים יש; אין דרך לדעת
 * את זה בלי להרכיב, וספירה קשיחה כאן הייתה מתיישנת בכל פקד שנוסף.
 */
async function probe(component: Component, index: number): Promise<Probe & { count: number }> {
  const harness = mountUi(component, { superdoc: withSelection() });
  await settle();

  const buttons = harness.wrapper.findAll('button');
  const button = buttons[index];
  const name = nameOf(button);
  const disabled = button.attributes('disabled') !== undefined;

  const before = {
    commands: harness.adapter.calls.length,
    doc: harness.superdoc.calls.length,
    reports: harness.reports.length,
    emitted: emittedCount(harness.wrapper),
    html: harness.wrapper.html(),
  };

  await button.trigger('click');
  await settle();

  const effects: string[] = [];
  if (harness.adapter.calls.length > before.commands) effects.push('פקודה');
  if (harness.superdoc.calls.length > before.doc) effects.push('Document API');
  if (emittedCount(harness.wrapper) > before.emitted) effects.push('event');
  if (harness.reports.length > before.reports) effects.push('דיווח');
  if (harness.wrapper.html() !== before.html) effects.push('DOM');

  return { name, disabled, effects, count: buttons.length };
}

/** סוקרת את כל הכפתורים בלשונית, כל אחד בהרכבה נפרדת. */
async function probeAll(component: Component): Promise<Probe[]> {
  const first = await probe(component, 0);
  const probes: Probe[] = [first];
  for (let index = 1; index < first.count; index += 1) {
    probes.push(await probe(component, index));
  }
  return probes;
}

let restoreClipboard: () => void;

beforeEach(() => {
  restoreClipboard = installSystemClipboard();
});

afterEach(() => {
  restoreClipboard();
});

describe('אין כפתור מת באף לשונית', () => {
  for (const tab of TABS) {
    it(`„${tab.name}”: כל כפתור מנוטרל, או שלחיצה עליו עושה משהו`, async () => {
      const probes = await probeAll(tab.component);

      expect(probes.length, 'נמצאו כפתורים לבדוק').toBeGreaterThan(0);

      const dead = probes
        .filter((item) => !item.disabled && item.effects.length === 0)
        .map((item) => item.name);
      expect(dead, `כפתורים שנלחצו ולא קרה כלום ב„${tab.name}”`).toEqual([]);
    });
  }
});

describe('הפקדים שמנוטרלים בכוונה', () => {
  /**
   * מנוע עם כל היכולות, בחירה חיה ולוח מערכת: כל מה שנשאר מנוטרל כאן מנוטרל
   * **בכוונה**, ולא מפני שהיכולת חסרה. הרשימה היא לכן חוזה: פקד שנעלם ממנה
   * הוא פקד שהופעל, ופקד שנוסף אליה הוא פקד שהושתק — ובשני המקרים זו החלטה
   * שצריכה להיראות בבדיקה.
   */
  const EXPECTED_DISABLED: Record<string, readonly string[]> = {
    בית: ['כתב תחתי (אינו נתמך במנוע הנוכחי)', 'כתב עליון (אינו נתמך במנוע הנוכחי)'],
    סקירה: [
      'בדיקת איות בעברית — תתווסף עם המילון התורני, בשלב נפרד',
      'הוספת תגובה — תתווסף בשלב הבא, יחד עם זהות המחבר ופאנל התגובות',
    ],
    קובץ: [],
    הוספה: [],
    פריסה: [],
    הפניות: [],
    תצוגה: [],
  };

  for (const tab of TABS) {
    it(`„${tab.name}”: רק הפקדים שאין להם API נשארים מנוטרלים`, async () => {
      const probes = await probeAll(tab.component);
      const disabled = probes.filter((item) => item.disabled).map((item) => item.name);
      expect(disabled).toEqual(EXPECTED_DISABLED[tab.name]);
    });
  }
});

describe('„אוצריא”', () => {
  /**
   * שלושת הפקדים תלויים ב-SDK, וההרכבה שלה בלעדיו מודדת רק את הכיבוי. לכן
   * ה-SDK מותקן — כפיל שמחזיר כשל על כל קריאה, כי מה שנמדד כאן הוא שהפקד
   * **מגיע** אליו.
   */
  beforeEach(() => {
    Reflect.set(window, 'Otzaria', {
      call: async () => ({ success: false, error: { message: 'לא זמין בבדיקה' } }),
      on: () => {},
      off: () => {},
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'Otzaria');
  });

  it('בתוך אוצריא: שלושת הפקדים חיים, ושלושת הסגנונות התורניים מנוטרלים', async () => {
    const probes = await probeAll(OtzariaTab);

    const dead = probes
      .filter((item) => !item.disabled && item.effects.length === 0)
      .map((item) => item.name);
    expect(dead).toEqual([]);

    // התוויות של „סגנון תורני” הן ה-title, כלומר ההסבר למה הם מנוטרלים.
    const disabled = probes.filter((item) => item.disabled);
    expect(disabled).toHaveLength(3);
    for (const item of disabled) {
      expect(item.name).toContain('סגנונות תורניים יתווספו בשלב הבא');
    }
  });

  it('מחוץ לאוצריא: שלושת הפקדים מנוטרלים ואינם מבטיחים כלום', async () => {
    Reflect.deleteProperty(window, 'Otzaria');
    const harness = mountUi(OtzariaTab, { superdoc: withSelection() });
    await settle();

    const live = harness.wrapper
      .findAll('button')
      .filter((button) => button.attributes('disabled') === undefined);
    expect(live).toEqual([]);
  });
});

describe('בדיקת הבקרה של השער', () => {
  /**
   * לשונית מלאכותית עם שני כפתורים: אחד שהלחיצה עליו נשמעת, ואחד בלי מטפל
   * בכלל — בדיוק שלוש-עשרה הכפתורים שהגל הזה תיקן. אם השער אינו מסמן את השני
   * כמת ואת הראשון כחי, הוא אינו מודד כלום, וכל הבדיקות שלמעלה עוברות מהסיבה
   * הלא נכונה.
   */
  const TabWithDeadButton = defineComponent({
    name: 'TabWithDeadButton',
    emits: ['acted'],
    setup(_props, { emit }) {
      return () =>
        h('div', [
          h(RibbonButton, { label: 'חי', icon: 'bold', onClick: () => emit('acted') }),
          h(RibbonButton, { label: 'מת', icon: 'italic' }),
        ]);
    },
  });

  it('כפתור בלי מטפל מסומן כמת, וכפתור שנשמע אינו', async () => {
    const probes = await probeAll(TabWithDeadButton);
    expect(probes).toHaveLength(2);

    expect(probes[0].effects, 'הכפתור שהלחיצה עליו נשמעת').toContain('event');
    expect(probes[1].effects, 'הכפתור שאין לו מטפל').toEqual([]);
    expect(probes[1].disabled, 'והוא אינו מנוטרל — כלומר נראה עובד').toBe(false);
  });
});
