/**
 * תפריט ההקשר, מורכב.
 *
 * מה שנמדד כאן הוא מה שסריקת מקור אינה יכולה לתפוס: שהלחיצה **מגיעה למנוע**
 * דרך אותו אדפטר של הרצועה, שפריט מנוטרל אינו רץ, ושהחצים מזיזים מיקוד. הכפיל
 * מריץ את ה-payload דרך הוולידטורים האמיתיים של superdoc, ולכן פקודה שהמנוע
 * היה דוחה נופלת כאן ולא אצל המשתמש.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import ContextMenu from '../../src/ui/menu/ContextMenu.vue';
import {
  contextMenuModel,
  type ContextMenuSection,
  type ContextMenuSnapshot,
} from '../../src/ui/menu/context-menu-model';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import { createFontMemory } from '../../src/composables/use-font-controls';
import {
  autoUnmount,
  createCommandDouble,
  mountUi,
  pickerValue,
  setPicker,
  settle,
  type Harness,
} from './harness';

autoUnmount();

function sections(over: Partial<ContextMenuSnapshot> = {}): readonly ContextMenuSection[] {
  return contextMenuModel({
    hasDocument: true,
    hasRange: true,
    storyType: 'body',
    misspelledWord: null,
    can: () => true,
    ...over,
  });
}

function open(
  list: readonly ContextMenuSection[] = sections(),
  options: Parameters<typeof mountUi>[1] = {},
): Harness {
  return mountUi(ContextMenu, {
    ...options,
    props: { open: true, point: { x: 400, y: 300 }, sections: list, ...(options.props ?? {}) },
  });
}

/**
 * לפי `data-entry-id` ולא לפי אינדקס. הגרסה הראשונה כאן מיפתה מזהה למקום
 * ברשימה של הדגם **הראשוני** — כלומר הייתה שקטה ושגויה ברגע שהקשר מסתיר פריט
 * (בכותרת עליונה נופלים „הערת שוליים” ו„ציטוט”, וכל האינדקסים שאחריהם זזים).
 */
function buttonById(harness: Harness, id: string) {
  const button = harness.wrapper.find(`[data-entry-id="${id}"]`);
  if (!button.exists()) throw new Error(`אין פריט בתפריט עם המזהה "${id}"`);
  return button;
}

describe('ContextMenu', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = open();
  });

  it('מצייר את המקטעים כתפריט נגיש', () => {
    expect(harness.wrapper.attributes('role')).toBe('menu');
    // שישה: לוח, גופן, עיצוב, הוספה, אוצריא, עריכה.
    expect(harness.wrapper.findAll('[role="group"]')).toHaveLength(6);
    expect(harness.wrapper.findAll('[role="separator"]')).toHaveLength(5);
  });

  it('מתג מדווח menuitemcheckbox, ופעולה מדווחת menuitem', async () => {
    const bold = buttonById(harness, 'bold');
    const link = buttonById(harness, 'link');

    expect(bold.attributes('role')).toBe('menuitemcheckbox');
    expect(bold.attributes('aria-checked')).toBeDefined();
    expect(link.attributes('role')).toBe('menuitem');
    expect(link.attributes('aria-checked')).toBeUndefined();
  });

  it('לחיצה על אייקון של פקודה מגיעה למנוע', async () => {
    await buttonById(harness, 'bold').trigger('click');

    expect(harness.adapter.applied.map((call) => call.id)).toContain('bold');
    expect(harness.failures()).toEqual([]);
  });

  it('לחיצה על פריט לוח נמסרת למעלה ואינה רצה כפקודה', async () => {
    await buttonById(harness, 'copy').trigger('click');

    expect(harness.adapter.calls).toHaveLength(0);
    expect(harness.wrapper.emitted('run')?.[0]?.[0]).toMatchObject({ id: 'copy' });
  });

  it('לחיצה על שורת כתיבה נמסרת למעלה עם הפעולה', async () => {
    await buttonById(harness, 'link').trigger('click');

    expect(harness.wrapper.emitted('run')?.[0]?.[0]).toMatchObject({
      id: 'link',
      run: { kind: 'action', action: 'link' },
    });
  });

  it('כל לחיצה סוגרת את התפריט', async () => {
    await buttonById(harness, 'link').trigger('click');

    expect(harness.wrapper.emitted('close')).toHaveLength(1);
  });

  it('פריט מנוטרל אינו רץ ואינו סוגר', async () => {
    const disabled = open(sections({ hasRange: false }));
    await buttonById(disabled, 'copy').trigger('click');

    expect(disabled.wrapper.emitted('run')).toBeUndefined();
    expect(disabled.wrapper.emitted('close')).toBeUndefined();
  });

  it('פריט מנוטרל נשאר בר-מיקוד — aria-disabled ולא disabled', () => {
    const disabled = open(sections({ hasRange: false }));
    const copy = buttonById(disabled, 'copy');

    expect(copy.attributes('aria-disabled')).toBe('true');
    expect(copy.attributes('disabled')).toBeUndefined();
  });

  it('בפתיחה שום פריט אינו מסומן — המיקוד על הכרטיס עצמו, כמו ב-Word', async () => {
    await nextTick();

    expect(document.activeElement).toBe(harness.wrapper.element);
    expect(harness.wrapper.findAll('[tabindex="0"]')).toHaveLength(0);
  });

  /**
   * המיקוד עצמו נבדק ולא רק ה-tabindex: `registerButton` יכול היה להימחק כולו
   * וכל הבדיקות היו נשארות ירוקות — ה-attribute הוא החיווי, `document.activeElement`
   * הוא מה שהמשתמש מקבל.
   */
  it('חץ למטה מהפתיחה בוחר את הפריט הראשון, ומזיז מיקוד אמיתי', async () => {
    await harness.wrapper.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();

    expect(buttonById(harness, 'cut').attributes('tabindex')).toBe('0');
    expect(document.activeElement).toBe(buttonById(harness, 'cut').element);

    await harness.wrapper.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();

    expect(document.activeElement).toBe(buttonById(harness, 'copy').element);
    expect(buttonById(harness, 'cut').attributes('tabindex')).toBe('-1');
  });

  it('End קופץ לפריט האחרון, ומשם החץ מתגלגל להתחלה', async () => {
    await harness.wrapper.trigger('keydown', { key: 'End' });
    await nextTick();
    expect(document.activeElement).toBe(buttonById(harness, 'select-all').element);

    await harness.wrapper.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(document.activeElement).toBe(buttonById(harness, 'cut').element);
  });

  it('בכותרת עליונה הפריטים שאינם שייכים נעלמים, והשאר עדיין נגישים', async () => {
    const header = open(sections({ storyType: 'header' }));

    expect(header.wrapper.find('[data-entry-id="footnote"]').exists()).toBe(false);
    expect(header.wrapper.find('[data-entry-id="insert-citation"]').exists()).toBe(false);
    expect(buttonById(header, 'link').exists()).toBe(true);
  });

  it('פתיחה מחדש בנקודה אחרת מאפסת את המיקוד', async () => {
    await harness.wrapper.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(harness.wrapper.findAll('[tabindex="0"]')).toHaveLength(1);

    await harness.wrapper.setProps({ point: { x: 700, y: 500 } });
    await nextTick();

    expect(harness.wrapper.findAll('[tabindex="0"]')).toHaveLength(0);
    expect(document.activeElement).toBe(harness.wrapper.element);
  });

  it('Tab סוגר — התפריט אינו אזור בממשק', async () => {
    await harness.wrapper.trigger('keydown', { key: 'Tab' });

    expect(harness.wrapper.emitted('close')).toHaveLength(1);
  });

  it('בלי מקטעים אין כרטיס בכלל', () => {
    const empty = open([]);

    expect(empty.wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  /**
   * שורה שכתוב בה „קישור…” ולצדה „Ctrl+K” אינה צריכה כרטיס טולטיפ שאומר
   * „קישור…”, ולכן היא אינה מצהירה על `data-tip-*` כלל — מה שהופך פקד לעוגן.
   * `title` אינו נבדק כאן כי הוא אינו קיים באף אלמנט בתוכנה
   * (tests/unit/native-title.test.ts).
   */
  it('לשורת כתיבה אין טולטיפ — התווית כבר על המסך', () => {
    expect(buttonById(harness, 'link').attributes('data-tip-title')).toBeUndefined();
    expect(buttonById(harness, 'bold').attributes('data-tip-title')).toBe('מודגש');
    expect(buttonById(harness, 'bold').attributes('data-tip-shortcut')).toBe('Ctrl+B');
    expect(buttonById(harness, 'bold').attributes('aria-label')).toBe('מודגש (Ctrl+B)');
  });

  it('תווית הקיצור מוצגת ב-LTR', () => {
    const shortcut = buttonById(harness, 'link').find('.ctx-btn__shortcut');

    expect(shortcut.attributes('dir')).toBe('ltr');
    expect(shortcut.text()).toBe('Ctrl+K');
  });
});

/**
 * שורת הגופן.
 *
 * מה שנמדד כאן הוא הדבר שבגללו היא נבנתה כך ולא אחרת: הערך שהיא מציגה אינו
 * שלה. `FONT_MEMORY` מסופק מהמעטפת (App.vue) לרצועה ולתפריט גם יחד, ובדיקה
 * שמוסרת אותו זיכרון לשתי ההרכבות היא הבדיקה היחידה שיכולה לתפוס חזרה לעותק
 * פרטי — מצב שבו התפריט מציג „Assistant 12” בזמן שהרצועה מציגה את גופן המסמך.
 */
describe('שורת הגופן בתפריט ההקשר', () => {
  it('מציגה את מה שהמנוע מדווח על הבחירה', async () => {
    const adapter = createCommandDouble();
    adapter.setState('font-family', { value: 'TaameyDavidCLM' });
    adapter.setState('font-size', { value: 20 });

    const menu = open(sections(), { adapter });
    await settle();

    expect(pickerValue(menu.wrapper, 'גופן')).toBe('TaameyDavidCLM');
    expect(pickerValue(menu.wrapper, 'גודל גופן')).toBe('20');
  });

  it('בחירת גופן מגיעה למנוע עם payload שהוא מאשר, וסוגרת את הכרטיס', async () => {
    const menu = open();
    await settle();

    await setPicker(menu.wrapper, 'גופן', 'TaameyDavidCLM');
    await settle();

    expect(menu.adapter.payloads('font-family')).toEqual(['TaameyDavidCLM']);
    expect(menu.adapter.rejected).toEqual([]);
    expect(menu.wrapper.emitted('close')).toHaveLength(1);
  });

  /**
   * גודל שאינו בסולם של Word הוא הסיבה שהתיבה היא תיבת ערך ולא בורר סגור,
   * וההתנהגות הזאת חייבת להיות זהות לזו שברצועה — היא מגיעה מאותו `normalize`.
   */
  it('גודל שהוקלד ואינו ברשימה מוחל, ואינו נעלם לטובת ההתאמה הראשונה', async () => {
    const menu = open();
    await settle();

    await setPicker(menu.wrapper, 'גודל גופן', '13');
    await settle();

    expect(menu.adapter.payloads('font-size')).toEqual([13]);
  });

  it('מה שהרצועה מציגה הוא מה שהתפריט מציג — זיכרון אחד לשניהם', async () => {
    const fontMemory = createFontMemory();
    const adapter = createCommandDouble();

    const ribbon = mountUi(HomeTab, { adapter, fontMemory });
    await settle();
    await setPicker(ribbon.wrapper, 'גופן', 'TaameyDavidCLM');
    await settle();
    expect(pickerValue(ribbon.wrapper, 'גופן')).toBe('TaameyDavidCLM');

    // המנוע אינו מדווח ערך (כמו מיד אחרי שהתפריט הזיז את הסמן), ולכן זה בדיוק
    // המצב שבו עותק פרטי היה נופל לברירת המחדל.
    const menu = open(sections(), { adapter, fontMemory });
    await settle();

    expect(pickerValue(menu.wrapper, 'גופן')).toBe('TaameyDavidCLM');
  });

  it('גופן שהוחל מהתפריט מופיע ברצועה מיד', async () => {
    const fontMemory = createFontMemory();
    const adapter = createCommandDouble();

    const ribbon = mountUi(HomeTab, { adapter, fontMemory });
    const menu = open(sections(), { adapter, fontMemory });
    await settle();

    await setPicker(menu.wrapper, 'גופן', 'TaameyDavidCLM');
    await settle();

    expect(pickerValue(ribbon.wrapper, 'גופן')).toBe('TaameyDavidCLM');
  });
});

/**
 * כרטיס שנפתח למעלה.
 *
 * לחיצה בתחתית החלון — סוף הטקסט, כלומר המקום הנפוץ ביותר — אינה מותירה מקום
 * מתחתיה, והכרטיס מתהפך: הקצה **התחתון** שלו נוגע בסמן. בסדר הרגיל זה מרחיק
 * מהסמן בדיוק את מה שצמוד אליו בפתיחה למטה — שורת הלוח, שורת הגופן ושורת
 * העיצוב — ומחייב לחזור עם העכבר לאורך כל הכרטיס.
 */
describe('כרטיס שנפתח למעלה', () => {
  /** רק שמות המקטעים, בסדר שבו הם מצוירים. */
  function groups(harness: Harness): (string | undefined)[] {
    return harness.wrapper.findAll('[role="group"]').map((group) => group.attributes('aria-label'));
  }

  it('בפתיחה למטה הסדר הוא זה של הדגם', async () => {
    const down = open(sections(), { props: { point: { x: 400, y: 200 } } });
    await nextTick();

    expect(groups(down)[0]).toBe('לוח');
    expect(groups(down)[1]).toBe('גופן');
  });

  it('בפתיחה למעלה סדר המקטעים מתהפך, והאייקונים יורדים ליד הסמן', async () => {
    const up = open(sections(), { props: { point: { x: 400, y: window.innerHeight - 3 } } });
    await nextTick();

    const order = groups(up);
    expect(order[order.length - 1]).toBe('לוח');
    expect(order[order.length - 2]).toBe('גופן');
    expect(order[0]).toBe('עריכה');
  });

  /**
   * החץ למטה חייב להזיז מיקוד למה שנמצא למטה **על המסך**, ולא למה שהמודל בנה
   * אחריו — אחרת בכרטיס שהתהפך הוא מזיז אותו למעלה.
   */
  it('החצים עוברים בסדר שעל המסך, ולא בסדר הדגם', async () => {
    const up = open(sections(), { props: { point: { x: 400, y: window.innerHeight - 3 } } });
    // המדידה קובעת את הצד, והחץ אחריה: לפניה הכרטיס עדיין מצויר בסדר הרגיל.
    await nextTick();
    await up.wrapper.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();

    expect(document.activeElement).toBe(buttonById(up, 'find').element);
  });
});
