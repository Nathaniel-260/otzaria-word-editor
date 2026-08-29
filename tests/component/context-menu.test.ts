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
import { autoUnmount, mountUi, type Harness } from './harness';

autoUnmount();

function sections(over: Partial<ContextMenuSnapshot> = {}): readonly ContextMenuSection[] {
  return contextMenuModel({
    hasDocument: true,
    hasRange: true,
    storyType: 'body',
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
    expect(harness.wrapper.findAll('[role="group"]')).toHaveLength(5);
    expect(harness.wrapper.findAll('[role="separator"]')).toHaveLength(4);
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
   * „קישור…”. `TooltipLayer` מרים כרטיס לכל פקד עם `title`, ולכן ההימנעות היא
   * מה-`title` עצמו ולא מהשכבה.
   */
  it('לשורת כתיבה אין title — התווית כבר על המסך', () => {
    expect(buttonById(harness, 'link').attributes('title')).toBeUndefined();
    expect(buttonById(harness, 'bold').attributes('title')).toBe('מודגש (Ctrl+B)');
  });

  it('תווית הקיצור מוצגת ב-LTR', () => {
    const shortcut = buttonById(harness, 'link').find('.ctx-btn__shortcut');

    expect(shortcut.attributes('dir')).toBe('ltr');
    expect(shortcut.text()).toBe('Ctrl+K');
  });
});
