/**
 * חוזה סמן כתיבה מהבהב מול המנוע וגיליונות העיצוב.
 *
 * ## מה הבעיה שהחוזה מאמת
 *
 * סמן העריכה של SuperDoc מרונדר כ-`div` הנושא את המחלקה `sd-v2-local-selection-caret`.
 * באריזת המנוע קיימת הגדרת הבהוב (`sd-v2-local-caret-blink`), אולם המנוע מכבה אותה
 * תחת `@media (prefers-reduced-motion: reduce)`. בסביבות Windows רבות (ובפרט במחשבים
 * שבהם אפקטי הנפשה כבויים בהגדרות הנגישות או ביצועי המערכת), הגדרה זו מופעלת כברירת מחדל,
 * והסמן במסמך נשאר קפוא ולא מהבהב.
 *
 * ב-Word (ובכל מעבד תמלילים אמיתי), סמן העריכה תמיד מהבהב כאינדיקטור מיקום והקלדה חיוני.
 * הכלל ב-styles/shell.css כופה את האנימציה עם `!important` ומגדיר את ה-keyframes,
 * ו-styles/print.css מסתיר את הסמן בהדפסה.
 *
 * ## והצד השני: כשאין מיקוד אין סמן
 *
 * ‏„תמיד מהבהב” הוא כל עוד ההקלדה באמת נכנסת למסמך. כשהחלון עבר לחלון אחר, או
 * כשפקד של הממשק לקח את המיקוד, סמן מהבהב מבטיח דבר שאינו נכון — וב-Word הוא
 * נעלם. ההכרעה ב-`ui/shell/caret-focus.ts`, ההחלה היא `[data-caret-idle]`
 * שהמעטפת נושאת, והכלל שמכבה יושב באותו קובץ CSS.
 *
 * הכלל וקושרו נבדקים יחד ובכוונה: כלל CSS שאיש אינו מדליק, או תכונה שאיש אינו
 * מקשיב לה, שניהם „עוברים” בשקט וכל אחד מהם לבדו מחזיר את הסמן להבהב תמיד.
 *
 * מה שנמדד:
 *   1. המחלקה `sd-v2-local-selection-caret` עדיין קיימת באריזת המנוע.
 *   2. שם האנימציה `sd-v2-local-caret-blink` עדיין קיים באריזת המנוע.
 *   3. הכלל ב-shell.css מחיל את האנימציה עם `!important` ומגדיר את ה-keyframes.
 *   4. print.css מסתיר את הסמן ואת שכבת הבחירה במדיית print.
 *   5. shell.css מכבה את הסמן תחת `[data-caret-idle]` — גם את האנימציה וגם את
 *      הנראות, ובעדיפות גבוהה מהכלל שמדליק.
 *   6. ‏App.vue מקשר את התכונה הזאת לשורש המעטפת.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENGINE = join(process.cwd(), 'node_modules/@superdoc/docx-engine/dist/docx-engine.es.js');
const SHELL_CSS = join(process.cwd(), 'src/styles/shell.css');
const PRINT_CSS = join(process.cwd(), 'src/styles/print.css');
const APP = join(process.cwd(), 'src/App.vue');

const engineBundle = readFileSync(ENGINE, 'utf8');
const shellCss = readFileSync(SHELL_CSS, 'utf8');
const printCss = readFileSync(PRINT_CSS, 'utf8');
const app = readFileSync(APP, 'utf8');

export const CARET_CLASS = 'sd-v2-local-selection-caret';
export const CARET_BLINK_ANIMATION = 'sd-v2-local-caret-blink';
export const CARET_IDLE_ATTRIBUTE = 'data-caret-idle';

describe('חוזה סמן כתיבה מהבהב', () => {
  it('המחלקות ושמות האנימציה של המנוע עדיין קיימים באריזה', () => {
    expect(engineBundle).toContain(CARET_CLASS);
    expect(engineBundle).toContain(CARET_BLINK_ANIMATION);
  });

  it('shell.css מחיל אנימציית הבהוב על סמן הכתיבה עם !important', () => {
    expect(shellCss).toContain(`.${CARET_CLASS}`);
    expect(shellCss).toMatch(new RegExp(`animation:[^;]*${CARET_BLINK_ANIMATION}[^;]*!important`));
    expect(shellCss).toContain(`@keyframes ${CARET_BLINK_ANIMATION}`);
  });

  it('print.css מסתיר את סמן העריכה בהדפסה', () => {
    expect(printCss).toContain(`.${CARET_CLASS}`);
    expect(printCss).toMatch(new RegExp(`\\.${CARET_CLASS}[^{]*{[^}]*display:\\s*none\\s*!important`));
  });
});

describe('חוזה „אין מיקוד — אין סמן”', () => {
  /** הכלל המכבה בלבד: זה שהבורר שלו נושא את התכונה. */
  const idleRule = shellCss.match(
    new RegExp(`\\n([^\\n@}][^{]*\\[${CARET_IDLE_ATTRIBUTE}[^{]*)\\{([^}]*)\\}`),
  );

  it('shell.css מכבה את הסמן כשהמעטפת מסומנת „ללא מיקוד”', () => {
    expect(idleRule, `אין ב-shell.css כלל תחת [${CARET_IDLE_ATTRIBUTE}]`).not.toBeNull();
    expect(idleRule?.[1]).toContain(`.${CARET_CLASS}`);
  });

  it('הכיבוי עוצר את האנימציה **וגם** מסתיר', () => {
    // רק `animation: none` היה מקפיא את הסמן במה שהיה בפריים האחרון — כלומר
    // משאיר אותו גלוי בחצי מהמקרים. שתי ההצהרות הן ההתנהגות שנבחרה.
    const body = idleRule?.[2] ?? '';
    expect(body).toMatch(/animation:\s*none\s*!important/);
    expect(body).toMatch(/opacity:\s*0\s*!important/);
  });

  it('הכיבוי גובר על הכלל שמדליק', () => {
    // שניהם `!important`, ולכן מה שמכריע הוא הסגוליות: הבורר המכבה נושא
    // מחלקה נוספת ותכונה, והמדליק מחלקה אחת בלבד.
    const selector = idleRule?.[1] ?? '';
    expect(selector).toMatch(/\.[a-z-]+\[data-caret-idle/);
  });

  it('App.vue מקשר את התכונה לשורש המעטפת', () => {
    expect(app).toMatch(new RegExp(`:${CARET_IDLE_ATTRIBUTE}=`));
    expect(app).toContain('watchCaretFocus');
  });
});
