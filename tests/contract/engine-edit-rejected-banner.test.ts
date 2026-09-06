/**
 * חוזה ההסתרה של באנר „edit-rejected" של המנוע.
 *
 * superdoc מצייר הודעת מצב אנגלית מעל בד המסמך גם תחת `ui: false` (issue
 * #3957 במעלה הזרם; נמדד ב-2.11.0, ועדיין קיים ב-2.12.0). ההגנה שלנו היא כלל CSS יחיד ב-engine-chrome.css,
 * והוא נשען על מבנה DOM שאינו חוזה מתועד: תכונה, מחלקת עוטף, ומחרוזת.
 *
 * בלי הבדיקה הזאת שדרוג מנוע יכול לשמוט את שלושתם בשקט, ואז יש שתי אפשרויות
 * ושתיהן שקטות: או שהאנגלית חוזרת למסך, או שנשאר כלל שמסתיר DOM שאינו קיים.
 * מה שנמדד:
 *
 *   1. התכונה `data-superdoc-v2-edit-rejected` ומחלקת העוטף
 *      `superdoc__mutation-status` עדיין קיימות באריזה.
 *   2. ההודעה עדיין אנגלית — כלומר ההסתרה עוד נחוצה. אם SuperDoc יוסיף
 *      הגדרת טקסטים או יכבד `ui: false`, זה הסימן למחוק את הכלל.
 *   3. הכלל אכן קיים בגיליון, ומגודר בשער השפה — למשתמש אנגלי ההודעה
 *      האנגלית של המנוע היא בדיוק מה שצריך, בדיוק כמו בשאר הגיליון.
 *
 * הקריאה היא של מחרוזות תצוגה מהאריזה, לצורך התאמת ממשק בלבד.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_LOCALE_ATTRIBUTE } from '../../src/ui/ribbon/i18n';

/** הבאנר הוא של חבילת `superdoc`, לא של אריזת מנוע ה-DOCX. */
const SHELL = join(process.cwd(), 'node_modules/superdoc/dist/superdoc.es.js');
const STYLE_SHEET = join(process.cwd(), 'src/styles/engine-chrome.css');

const shell = readFileSync(SHELL, 'utf8');
const sheet = readFileSync(STYLE_SHEET, 'utf8');

/** העוגן שהכלל תולה עליו את עצמו. */
export const EDIT_REJECTED_HOOK = 'data-superdoc-v2-edit-rejected';
/** העוטף שמוסתר בפועל — הוא נושא את ה-`position: sticky`. */
export const MUTATION_STATUS_CLASS = 'superdoc__mutation-status';

describe('חוזה באנר edit-rejected', () => {
  it('העוגנים שהכלל נשען עליהם עדיין קיימים באריזת superdoc', () => {
    expect(shell).toContain(EDIT_REJECTED_HOOK);
    expect(shell).toContain(MUTATION_STATUS_CLASS);
  });

  it('ההודעה עדיין אנגלית — כלומר ההסתרה עוד נחוצה', () => {
    // המקף הוא U+2019 באריזה, לא אפוסטרוף ASCII.
    expect(shell).toContain('This edit couldn’t be completed.');
  });

  /** שורת הסלקטור של הכלל — בלי הערות, שגם הן מזכירות את שני העוגנים. */
  const ruleLine = sheet
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .find((line) => line.includes(MUTATION_STATUS_CLASS) && line.includes(EDIT_REJECTED_HOOK));

  it('הכלל קיים בגיליון ומגודר בשער השפה', () => {
    expect(ruleLine, 'אין בגיליון כלל שמסתיר את הבאנר').toBeTruthy();
    expect(ruleLine).toContain(`:root:not([${MENU_LOCALE_ATTRIBUTE}='en'])`);
  });

  it('הכלל מסתיר את ה-<p> כילד ישיר של העוטף, ובלי :has()', () => {
    // `:has()` שעוגנו בתוך `.superdoc` הוא מה שגרם לחישוב סגנון של כל המסמך
    // על כל הקשה (ראו הערת הפתיחה, סעיף 4). הבדיקה נועלת את הצורה שנמדדה.
    expect(ruleLine).not.toContain(':has(');
    expect(ruleLine).toContain(`.${MUTATION_STATUS_CLASS} > [${EDIT_REJECTED_HOOK}]`);
    // ובאריזה: ה-<p> אכן ילד ישיר של העוטף — אחרת `>` היה מסתיר כלום. ברינדור
    // המקומפל של Vue העוטף וה-<p> נוצרים ברצף, בלי createElementVNode שלישי
    // ביניהם.
    const wrapper = shell.indexOf(MUTATION_STATUS_CLASS);
    const hook = shell.indexOf(EDIT_REJECTED_HOOK, wrapper);
    expect(wrapper, 'העוטף לא נמצא באריזה').toBeGreaterThan(-1);
    expect(hook, 'התכונה אינה מופיעה אחרי העוטף').toBeGreaterThan(wrapper);
    const between = shell.slice(wrapper, hook);
    expect((between.match(/createElementVNode\(|createBaseVNode\(|createVNode\(/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});
