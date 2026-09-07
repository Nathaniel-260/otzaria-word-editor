/**
 * החיווט: בחירת גופן בבורר מפעילה את שליפת הבייטים.
 *
 * למה קובץ נפרד עם `vi.mock`, ולא בדיקה ב-ribbon-payloads: `ensureFamilyDrawable`
 * האמיתית שואלת קודם את `isFamilyAvailable`, וזו מחזירה `true` בלי canvas
 * („בלי מדידה אין לנו מה לומר”). כלומר ב-jsdom המסלול נגמר בשורה הראשונה,
 * ובדיקה שתסמוך עליו תעבור ירוק גם אם הקריאה תוסר מ-`setFamily` לגמרי.
 *
 * מה שנמדד כאן הוא לכן החיווט בלבד — שהבחירה מגיעה לשליפה, ועם השם שנבחר.
 * ההתנהגות עצמה נמדדת ב-tests/unit/picker-fonts.test.ts, שם ה-deps מוזרקים.
 */
import { describe, expect, it, vi } from 'vitest';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import { autoUnmount, mountUi, setPicker, settle } from './harness';

const ensureFamilyDrawable = vi.fn(async (_name: string) => true);
vi.mock('../../src/engine/picker-fonts', () => ({
  ensureFamilyDrawable: (name: string) => ensureFamilyDrawable(name),
  onPickerFontsChanged: () => () => {},
  PICKER_FONT_STYLE_ID: 'otzaria-picker-font-faces',
  resetPickerFonts: () => {},
}));

autoUnmount();

describe('בחירת גופן שולפת את הבייטים', () => {
  it('הבחירה מגיעה לשליפה, עם השם שנבחר', async () => {
    ensureFamilyDrawable.mockClear();
    const harness = mountUi(HomeTab);
    await settle();

    await setPicker(harness.wrapper, 'גופן', 'TaameyDavidCLM');
    await settle();

    expect(ensureFamilyDrawable).toHaveBeenCalledWith('TaameyDavidCLM');
  });

  it('ההחלה אינה מחכה לשליפה — הפקודה נשלחת בכל מקרה', async () => {
    // השליפה יוצאת לרשת של המארח, וההחלה היא מה שהמשתמש ביקש. שליפה שנתקעת
    // או נכשלת אינה אמורה לעכב או לבטל את בחירת הגופן.
    ensureFamilyDrawable.mockClear();
    ensureFamilyDrawable.mockImplementationOnce(() => new Promise(() => {}) as Promise<boolean>);
    const harness = mountUi(HomeTab);
    await settle();

    await setPicker(harness.wrapper, 'גופן', 'Rubik');
    await settle();

    expect(harness.adapter.payloads('font-family')).toEqual(['Rubik']);
    expect(harness.adapter.rejected).toEqual([]);
  });
});
