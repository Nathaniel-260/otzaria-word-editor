/**
 * בורר הגופן עם החיפוש (`RibbonCombo`).
 *
 * ההכרעות הטהורות נבדקות ב-`tests/unit/font-search.test.ts`. מה שנבדק **כאן**
 * הוא מה שרק הרכבה יכולה לתפוס: שהמקלדת באמת מחוברת, שהבחירה באמת נפלטת,
 * ושיציאה מהשדה **אינה** מחילה גופן — שלושתם „HTML תקין לחלוטין” בכל סריקת
 * מקור, ושלושתם היו שוברים את הפקד בשקט.
 *
 * ובנוסף רגרסיה אחת שנצפתה בפועל: הרשימה נחתכה בגובה הרצועה. `position` נבדק
 * ולא המראה — jsdom אינו מודד פריסה, אבל הוא כן אומר איזה `position` הוחל,
 * וזו ההבחנה בין „נמדד ב-fixed” לבין „absolute שנחתך”.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, shallowRef } from 'vue';
import type { SuperDoc } from 'superdoc';
import { ACTIVE_SUPERDOC } from '../../src/engine/document-api';
import RibbonCombo from '../../src/ui/ribbon/common/RibbonCombo.vue';
import type { ComboOption } from '../../src/ui/ribbon/font-search';

const OPTIONS: readonly ComboOption[] = [
  { value: 'Assistant', label: 'Assistant', group: '' },
  { value: 'TaameyDavidCLM', label: 'David (TaameyDavidCLM)', group: '' },
  { value: 'Arial', label: 'Arial', group: '' },
  { value: 'David', label: 'David', group: 'עברית' },
  { value: 'Narkisim', label: 'Narkisim', group: 'עברית' },
  { value: 'Arial Black', label: 'Arial Black', group: 'כל הגופנים' },
];

let combo: VueWrapper;

function open(): Promise<void> {
  return combo.find('input').trigger('focus').then(() => nextTick());
}

async function type(text: string): Promise<void> {
  const input = combo.find('input');
  (input.element as HTMLInputElement).value = text;
  await input.trigger('input');
  await nextTick();
}

const key = (name: string) => combo.find('input').trigger('keydown', { key: name });

const optionValues = () =>
  combo.findAll('[role="option"]').map((el) => el.attributes('data-value'));

const emitted = () => combo.emitted('update:modelValue') as string[][] | undefined;

beforeEach(() => {
  combo = mount(RibbonCombo, {
    props: { modelValue: 'Arial', options: OPTIONS, title: 'גופן' },
  });
});

describe('פתיחה', () => {
  it('הרשימה אינה ב-DOM עד שפותחים — 294 שורות אינן נבנות בכל רינדור', async () => {
    expect(combo.find('[role="listbox"]').exists()).toBe(false);
    await open();
    expect(combo.find('[role="listbox"]').exists()).toBe(true);
  });

  it('התיבה מציגה את הגופן הנוכחי, לא ריקה', () => {
    expect((combo.find('input').element as HTMLInputElement).value).toBe('Arial');
  });

  it('נפתחת על הגופן הנוכחי ולא על ראש הרשימה', async () => {
    // כך „פתח, חץ אחד” מגיע לשכן — ולא קופץ ל-Assistant מכל מקום.
    await open();
    expect(combo.find('[role="option"].active').attributes('data-value')).toBe('Arial');
  });

  it('הקבוצות מוצגות ככותרות ולא כאפשרויות', async () => {
    await open();
    const headings = combo.findAll('.ribbon-combo-group').map((el) => el.text());
    expect(headings).toEqual(['עברית', 'כל הגופנים']);
    expect(optionValues()).toHaveLength(OPTIONS.length);
  });
});

describe('חיפוש', () => {
  it('הקלדה מסננת', async () => {
    await open();
    await type('ari');
    expect(optionValues()).toEqual(['Arial', 'Arial Black']);
  });

  it('שאילתה בלי התאמות מציגה הודעה ולא רשימה ריקה בשקט', async () => {
    await open();
    await type('zzzz');
    expect(optionValues()).toEqual([]);
    expect(combo.find('.ribbon-combo-empty').exists()).toBe(true);
  });

  it('אחרי הקלדה הסימון על ההתאמה הראשונה — Enter בלי חץ נוסף', async () => {
    await open();
    await type('nar');
    await key('Enter');
    expect(emitted()?.[0]).toEqual(['Narkisim']);
  });
});

describe('מקלדת', () => {
  it('חץ למטה מזיז את הסימון, ו-Enter מחיל', async () => {
    await open();
    await key('ArrowDown');
    await key('Enter');
    expect(emitted()?.[0]).toEqual(['David']);
  });

  it('Escape סוגר בלי להחיל, והתיבה חוזרת לגופן שהיה', async () => {
    await open();
    await type('nar');
    await key('Escape');
    await nextTick();
    expect(emitted()).toBeUndefined();
    expect(combo.find('[role="listbox"]').exists()).toBe(false);
    expect((combo.find('input').element as HTMLInputElement).value).toBe('Arial');
  });

  it('בחירה בגופן שכבר נבחר אינה פולטת אירוע', async () => {
    // אחרת כל פתיחה-וסגירה הייתה מסמנת את המסמך כמלוכלך.
    await open();
    await key('Enter');
    expect(emitted()).toBeUndefined();
  });
});

describe('עכבר ופוקוס', () => {
  it('לחיצה על שורה מחילה אותה', async () => {
    await open();
    await combo.findAll('[role="option"]')[4].trigger('mousedown');
    expect(emitted()?.[0]).toEqual(['Narkisim']);
  });

  it('בחירת גופן מחזירה פוקוס למסמך דרך ACTIVE_SUPERDOC', async () => {
    const focusSpy = vi.fn();
    const fakeSuperdoc = shallowRef({ focus: focusSpy } as unknown as SuperDoc);
    const wrapper = mount(RibbonCombo, {
      props: { modelValue: 'Arial', options: OPTIONS, title: 'גופן' },
      global: {
        provide: {
          [ACTIVE_SUPERDOC as symbol]: fakeSuperdoc,
        },
      },
    });

    await wrapper.find('input').trigger('focus');
    await nextTick();
    await wrapper.findAll('[role="option"]')[4].trigger('pointerdown');
    expect(focusSpy).toHaveBeenCalledWith({ restoreSelection: true });
  });

  it('יציאה מהשדה סוגרת ואינה מחילה', async () => {
    // הקלדה בלי אישור אינה בחירה — עדיף על להחיל גופן בטעות על טקסט מסומן.
    await open();
    await type('nar');
    await combo.find('input').trigger('blur');
    await nextTick();
    expect(emitted()).toBeUndefined();
    expect(combo.find('[role="listbox"]').exists()).toBe(false);
  });
});

describe('רגרסיה: הרשימה נחתכה בגובה הרצועה', () => {
  it('הרשימה ממוקמת ב-fixed ולא ב-absolute', async () => {
    // `.word-ribbon-body` הוא `overflow-y: hidden`, ולכן `absolute` נחתך —
    // מה שנצפה כרשימה של שלוש שורות עם פס גלילה.
    // ראו composables/popover-position.ts.
    await open();
    expect(combo.find('[role="listbox"]').attributes('style')).toContain('position: fixed');
  });
});

describe('נגישות', () => {
  it('התיבה מכריזה על עצמה כ-combobox ומצביעה על הרשימה', async () => {
    const input = combo.find('input');
    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-expanded')).toBe('false');

    await open();
    expect(combo.find('input').attributes('aria-expanded')).toBe('true');
    expect(combo.find('input').attributes('aria-controls')).toBe(
      combo.find('[role="listbox"]').attributes('id'),
    );
  });

  it('כפתור החץ נפתח גם בהפעלה שאינה מעכבר', async () => {
    // `mousedown` לבדו נראה נכון עד שמפעילים אחרת: `click()` תכנותי, והפעלה
    // במקלדת, אינם מייצרים `mousedown` כלל — כלומר כפתור מת. `detail === 0`
    // הוא מה שמפריד ביניהם ללחיצת עכבר, שכבר טופלה.
    // `element.click()` ולא `trigger`: זו בדיוק ההפעלה שאינה מעכבר — היא
    // מייצרת `detail === 0`, ו-`trigger` אינו יכול לקבוע את השדה הזה.
    (combo.find('.ribbon-combo-arrow').element as HTMLElement).click();
    await nextTick();
    expect(combo.find('[role="listbox"]').exists()).toBe(true);
  });

  it('לחיצת עכבר על החץ אינה נסגרת מיד אחרי שנפתחה', async () => {
    // הרצף האמיתי הוא `mousedown` ואז `click`. בלי ההבחנה השני היה מבטל את
    // הראשון, והרשימה הייתה מהבהבת במקום להיפתח.
    const arrow = combo.find('.ribbon-combo-arrow').element;
    await combo.find('.ribbon-combo-arrow').trigger('mousedown');
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await nextTick();
    expect(combo.find('[role="listbox"]').exists()).toBe(true);
  });

  it('התיבה נושאת `data-tip-title` — טולטיפ הרצועה, ולפיו גם שערי ה-QA מאתרים אותה', () => {
    // `data-tip-title` ולא `title` נייטיב: זו המערכת שכל שאר פקדי הרצועה
    // משתמשים בה (ui/tooltip), ו-`nameOf` ב-`scripts/qa/qa-api.js` קורא אותה
    // ראשונה. פקד בלי אף אחד מהם הוא פקד שאף שער לא יוכל ללחוץ עליו.
    expect(combo.find('input').attributes('data-tip-title')).toBe('גופן');
    expect(combo.find('input').attributes('aria-label')).toBe('גופן');
  });

  it('`aria-activedescendant` מצביע על השורה המסומנת', async () => {
    await open();
    await key('ArrowDown');
    await nextTick();
    expect(combo.find('input').attributes('aria-activedescendant')).toBe(
      combo.find('[role="option"].active').attributes('id'),
    );
  });

  it('הגופן הנבחר מסומן `aria-selected`, ורק הוא', async () => {
    await open();
    const selected = combo
      .findAll('[role="option"]')
      .filter((el) => el.attributes('aria-selected') === 'true')
      .map((el) => el.attributes('data-value'));
    expect(selected).toEqual(['Arial']);
  });
});
