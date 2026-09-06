/**
 * דיאלוג „גופן מתקדם", וההגעה אליו מלשונית „בית".
 *
 * למה קובץ ייעודי: הסורק הגנרי לא בודק את תוכן ה-payload. מה שנבדק כאן:
 * רק שדות שמולאו יוצאים למנוע („ללא שינוי" = לא נשלח), אזהרת ה-vanish
 * מופיעה בזמן, והכשל של המנוע מדווח בעברית. הדיאלוג נבדק דרך ה-DOM —
 * Teleport לגוף הדף, כמו BookmarkDialog.
 */
import { describe, expect, it } from 'vitest';
import { DOMWrapper } from '@vue/test-utils';
import FontAdvancedDialog from '../../src/ui/panels/FontAdvancedDialog.vue';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import { autoUnmount, createSuperdocDouble, mountUi, settle, tipSelector } from './harness';

autoUnmount();

function teleported(selector: string): DOMWrapper<Element> {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`לא נמצא ${selector} בגוף הדף`);
  return new DOMWrapper(element);
}

function footerButton(label: string): DOMWrapper<Element> {
  const buttons = [...document.querySelectorAll('.fontadv-dialog .fa-footer .fa-btn')];
  const found = buttons.find((button) => button.textContent?.trim() === label);
  if (!found) throw new Error(`לא נמצא הכפתור „${label}" בדיאלוג`);
  return new DOMWrapper(found);
}

/** כפתור אפקט לפי התווית שעליו — הפקד שהחליף את בוררי „ללא שינוי/כן/לא". */
function toggle(label: string): DOMWrapper<Element> {
  const buttons = [...document.querySelectorAll('.fontadv-dialog .tri-toggle')];
  const found = buttons.find((button) => button.querySelector('.tri-label')?.textContent?.trim() === label);
  if (!found) throw new Error(`לא נמצא כפתור האפקט „${label}" בדיאלוג`);
  return new DOMWrapper(found);
}

/** מחזור: לחיצה אחת = „דלוק", שתיים = „כבוי", שלוש = חזרה ל„ללא שינוי". */
async function clickToggle(label: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await toggle(label).trigger('click');
  await settle();
}

const ADVANCED_BUTTON = tipSelector('מתקדם');

describe('FontAdvancedDialog (בדיד)', () => {
  it('סגור אינו מרונדר בכלל', () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: false, busy: false } });
    expect(document.querySelector('.fontadv-dialog')).toBeNull();
  });

  it('פתיחה ממקדת את שורש הדיאלוג', async () => {
    const harness = mountUi(FontAdvancedDialog, { props: { isOpen: false, busy: false } });
    await harness.wrapper.setProps({ isOpen: true });
    await settle();

    expect(document.activeElement).toBe(document.querySelector('.fontadv-dialog'));
  });

  it('Escape סוגר', async () => {
    const harness = mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    await teleported('.fontadv-dialog').trigger('keydown.esc');
    expect(harness.wrapper.emitted('close')).toHaveLength(1);
  });

  it('busy מנטרל „אישור" ומשאיר „ביטול" חי', () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: true } });

    expect(footerButton('אישור').attributes('disabled')).toBeDefined();
    expect(footerButton('ביטול').attributes('disabled')).toBeUndefined();
  });

  it('שדות לא-ממולאים אינם נשלחים — רק מה שהמשתמש מילא', async () => {
    const harness = mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    await teleported('#fa-scale').setValue('150');
    await clickToggle('קו חוצה כפול');
    await settle();
    await footerButton('אישור').trigger('click');
    await settle();

    const emissions = harness.wrapper.emitted('submit');
    expect(emissions).toHaveLength(1);
    expect(emissions?.[0]?.[0]).toEqual({ charScale: 150, dstrike: true });
  });

  /**
   * שלושת המצבים הם ההבטחה המרכזית של הפקד: „כבוי" חייב להיות **נבדל**
   * מ„לא נגעתי", אחרת אישור על דיאלוג שנפתח ונסגר היה מסיר אפקטים מהטקסט
   * המסומן. ההנמקה ב-ui/panels/common/TriToggle.vue.
   */
  it('הכפתור מחזורי: דלוק, כבוי, ואז אינו נשלח כלל', async () => {
    const harness = mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    await clickToggle('צל');
    expect(toggle('צל').attributes('aria-pressed')).toBe('true');
    await footerButton('אישור').trigger('click');
    await settle();
    expect(harness.wrapper.emitted('submit')?.[0]?.[0]).toEqual({ shadow: true });

    await clickToggle('צל');
    expect(toggle('צל').attributes('aria-pressed')).toBe('false');
    await footerButton('אישור').trigger('click');
    await settle();
    expect(harness.wrapper.emitted('submit')?.[1]?.[0]).toEqual({ shadow: false });

    // הסיבוב השלישי מחזיר ל„ללא שינוי": אין מה לשלוח, ולכן גם אין מה ללחוץ.
    await clickToggle('צל');
    expect(toggle('צל').attributes('aria-pressed')).toBe('mixed');
    expect(footerButton('אישור').attributes('disabled')).toBeDefined();
    expect(harness.wrapper.emitted('submit')).toHaveLength(2);
  });

  /**
   * „אישור" על דיאלוג שאין בו מה להחיל היה נלחץ, סוגר, ולא עושה דבר — אותה
   * תקלה בדיוק שתוקנה ב„ברירות מחדל למסמך".
   */
  it('„אישור" נעול עד שיש מה להחיל, והמונה אומר כמה', async () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    expect(footerButton('אישור').attributes('disabled')).toBeDefined();
    expect(teleported('.fa-count').text()).toBe('אין מה להחיל');

    await teleported('#fa-scale').setValue('120');
    await settle();
    expect(footerButton('אישור').attributes('disabled')).toBeUndefined();
    expect(teleported('.fa-count').text()).toBe('שינוי אחד יוחל');

    await clickToggle('צל');
    expect(teleported('.fa-count').text()).toBe('2 שינויים יוחלו');
  });

  it('„נקה הכל" מחזיר כל שדה ל„ללא שינוי"', async () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    await teleported('#fa-scale').setValue('120');
    await clickToggle('חרוט');
    await teleported('#fa-lang').setValue('he-IL');
    await settle();
    expect(teleported('.fa-count').text()).toBe('3 שינויים יוחלו');

    await footerButton('נקה הכל').trigger('click');
    await settle();

    expect(teleported('.fa-count').text()).toBe('אין מה להחיל');
    expect(toggle('חרוט').attributes('aria-pressed')).toBe('mixed');
    expect((teleported('#fa-scale').element as HTMLInputElement).value).toBe('');
    expect(footerButton('אישור').attributes('disabled')).toBeDefined();
  });

  /**
   * הגופן המורכב היה תיבת טקסט חופשי. הבדיקה כאן היא שהבורר באמת מחובר
   * לרשימה של הרצועה — הרשימה שהמעטפת מזריקה — ולא לרשימה מקומית.
   */
  it('בורר הגופן שואב מרשימת הגופנים, והבחירה יוצאת ב-patch', async () => {
    const harness = mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    const input = document.querySelector<HTMLInputElement>('.fontadv-dialog .fa-combo input');
    if (!input) throw new Error('אין בורר גופן בדיאלוג');
    expect(input.placeholder).toBe('ללא שינוי');

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    const rows = [...document.querySelectorAll('.fontadv-dialog .ribbon-combo-option')];
    const labels = rows.map((row) => row.textContent?.trim());
    expect(labels).toContain('ללא שינוי');
    expect(labels).toContain('Assistant');

    const assistant = rows.find((row) => row.getAttribute('data-value') === 'Assistant');
    if (!assistant) throw new Error('אין שורה ל-Assistant ברשימה');
    // `pointerdown` ולא `click`: זה מה שהרשימה מאזינה לו — ראו RibbonCombo.
    await new DOMWrapper(assistant).trigger('pointerdown');
    await settle();

    await footerButton('אישור').trigger('click');
    await settle();
    expect(harness.wrapper.emitted('submit')?.[0]?.[0]).toEqual({ complexFontName: 'Assistant' });
  });

  it('פס התצוגה המקדימה מצייר את הטקסט המסומן', async () => {
    const harness = mountUi(FontAdvancedDialog, {
      props: { isOpen: false, busy: false },
      superdoc: createSuperdocDouble({ selection: { hasRange: true, text: 'טקסט נבחר' } }),
    });
    await harness.wrapper.setProps({ isOpen: true });
    await settle();

    expect(teleported('.fa-preview-strip').text()).toBe('טקסט נבחר');

    // מה שנבחר בדיאלוג מצויר על אותו טקסט — בלי לגעת במסמך.
    await teleported('#fa-spacing').setValue('3');
    await settle();
    const style = teleported('.fa-preview-text').attributes('style') ?? '';
    expect(style).toContain('letter-spacing: 3pt');
    expect(harness.superdoc.inputs('format.apply')).toEqual([]);
  });

  /**
   * `transform` פועל **אחרי** הפריסה, ולכן מתיחה אופקית מציירת מעבר לתיבה
   * שנמדדה — ומכיוון שהפס ממורכז, החריגה יוצאת לשני הצדדים וה-`overflow`
   * חותך את שניהם. נמדד בכרום ב-140%: מצויר 686..1234 מול מסגרת 693..1227,
   * כלומר גם ההתחלה וגם הסוף נעלמו. התקרה ההפוכה היא מה שמחזיר אותו פנימה.
   */
  it('„מתיחה אופקית" מקבלת תקרת רוחב הפוכה, אחרת הפס נחתך משני הצדדים', async () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    await teleported('#fa-scale').setValue('140');
    await settle();

    const style = teleported('.fa-preview-text').attributes('style') ?? '';
    expect(style).toContain('scaleX(1.4)');
    // 10000/140: התיבה **אחרי** המתיחה שווה בדיוק לרוחב המסגרת.
    expect(style).toContain('max-width: 71.43%');
  });

  it('„טקסט מוסתר = כן" מציג אזהרה גלויה', async () => {
    mountUi(FontAdvancedDialog, { props: { isOpen: true, busy: false } });
    await settle();

    expect(document.querySelector('.fa-warning')).toBeNull();
    await clickToggle('טקסט מוסתר');

    expect(teleported('.fa-warning').text()).toContain('יוסתר');
  });
});

describe('„גופן מתקדם" בלשונית „בית"', () => {
  it('הלחיצה פותחת את הדיאלוג', async () => {
    const harness = mountUi(HomeTab, { superdoc: createSuperdocDouble() });
    await settle();

    await harness.wrapper.find(ADVANCED_BUTTON).trigger('click');
    await settle();

    expect(document.querySelector('.fontadv-dialog')).not.toBeNull();
  });

  it('„אישור" מגיע ל-format.apply פעם אחת, עם ה-inline שנבנה', async () => {
    const harness = mountUi(HomeTab, {
      superdoc: createSuperdocDouble({ selection: { hasRange: true } }),
    });
    await settle();
    await harness.wrapper.find(ADVANCED_BUTTON).trigger('click');
    await settle();

    await teleported('#fa-scale').setValue('125');
    await teleported('#fa-position').setValue('3');
    await settle();
    await footerButton('אישור').trigger('click');
    await settle();

    const inputs = harness.superdoc.inputs('format.apply') as { inline: Record<string, unknown> }[];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.inline).toEqual({ charScale: 125, position: 3 });
    expect(harness.failures()).toEqual([]);
  });

  it('כשל של המנוע מדווח בעברית ואינו מפיל את הלשונית', async () => {
    const superdoc = createSuperdocDouble({
      failures: { 'format.apply': { code: 'PRECONDITION_FAILED' } },
      selection: { hasRange: true },
    });
    const harness = mountUi(HomeTab, { superdoc });
    await settle();
    await harness.wrapper.find(ADVANCED_BUTTON).trigger('click');
    await settle();

    await teleported('#fa-scale').setValue('200');
    await settle();
    await footerButton('אישור').trigger('click');
    await settle();

    const failures = harness.failures();
    expect(failures).toHaveLength(1);
    expect(failures[0]!.commandId).toBe('font-advanced');
    expect(failures[0]!.outcome.ok === false && failures[0]!.outcome.message).toContain(
      'החלת עיצוב הגופן נכשלה',
    );
    // הלשונית חיה: פתיחה חוזרת עובדת.
    await harness.wrapper.find(ADVANCED_BUTTON).trigger('click');
    await settle();
    expect(document.querySelector('.fontadv-dialog')).not.toBeNull();
  });
});
