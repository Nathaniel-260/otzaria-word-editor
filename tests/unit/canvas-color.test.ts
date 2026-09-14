/**
 * צבע הבד — המשטח שסביב הדף.
 *
 * שתי החלטות נמדדות כאן, ושתיהן היו יכולות להיכשל בשקט:
 *
 * 1. **מה נחשב צבע.** הערך מגיע מ-`storage` של אוצריא, כלומר JSON שנכתב
 *    בהפעלה קודמת. צבע פגום שמגיע עד `setProperty` אינו זורק ואינו מדווח —
 *    הדפדפן פשוט מתעלם מההצהרה, והמשתמש מקבל בד בלי רקע כלל.
 *
 * 2. **„אין העדפה” הוא היעדר ההצהרה, ולא צבע שני.** זה מה שמחזיק את המעקב
 *    אחרי ערכת הנושא: `removeProperty` מחזיר את הבד לרשת של tokens.css, ומשם
 *    לצבע שאוצריא כותבת בכל שינוי ערכה ובכל מעבר בהיר/כהה. אילו „ברירת מחדל”
 *    הייתה נכתבת כאפור קבוע, הבד היה נשאר בהיר במצב כהה — וזה בדיוק סוג הבאג
 *    שאיש אינו רואה עד שהוא מחליף ערכה.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANVAS_COLOR_VAR,
  THEME_CANVAS_VAR,
  applyCanvasColor,
  canvasColor,
  normalizeCanvasColor,
} from '../../src/composables/canvas-color';

function source(...parts: string[]): string {
  return readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');
}

/** ההצהרה על שורש המסמך, כפי שהדפדפן היה קורא אותה. */
function declared(): string {
  return document.documentElement.style.getPropertyValue(CANVAS_COLOR_VAR);
}

beforeEach(() => {
  applyCanvasColor(null);
});

describe('normalizeCanvasColor', () => {
  it('צבע מהפלטה ומהדו-שיח עובר כמו שהוא', () => {
    // שני המקורות היחידים: הפלטה של ColorPickerPopover כתובה באותיות קטנות,
    // ו-`input[type=color]` מחזיר „simple color” — שבעה תווים.
    expect(normalizeCanvasColor('#edebe9')).toBe('#edebe9');
    expect(normalizeCanvasColor('#000000')).toBe('#000000');
  });

  it('אותיות גדולות ורווחים מסביב מיושרים לצורה אחת', () => {
    // ההשוואה בפלטה („איזו משבצת מסומנת”) היא על מחרוזת, ולכן #FFFF00 ו-
    // #ffff00 שנשמרים כשניים היו מציגים משבצת לא מסומנת על צבע שנבחר.
    expect(normalizeCanvasColor('#EDEBE9')).toBe('#edebe9');
    expect(normalizeCanvasColor('  #EdEbE9\n')).toBe('#edebe9');
  });

  it('כל מה שאינו #rrggbb נדחה', () => {
    // המסלול האמיתי: ערך שנכתב בגרסה קודמת, ערך שנקטע, או קריאה שהחזירה
    // צורה אחרת. `null` ו-`undefined` הם גם „אין ערך במפתח”.
    for (const raw of [
      null,
      undefined,
      '',
      '   ',
      'red',
      '#fff',
      '#edebe',
      '#edebe99',
      'edebe9',
      '#gggggg',
      'rgb(237, 235, 233)',
      237,
      { hex: '#edebe9' },
      ['#edebe9'],
    ]) {
      expect(normalizeCanvasColor(raw)).toBeNull();
    }
  });
});

describe('applyCanvasColor', () => {
  it('צבע נכתב כהצהרה על שורש המסמך', () => {
    // inline על :root הוא מה שמנצח את הכלל שב-tokens.css — אותו מנגנון
    // שבו host/theme.ts כותב את צבעי אוצריא.
    applyCanvasColor('#123456');

    expect(declared()).toBe('#123456');
    expect(canvasColor.value).toBe('#123456');
  });

  it('`null` מסיר את ההצהרה ואינו כותב צבע אחר', () => {
    // הלב של „ברירת מחדל”: הבד חייב לחזור **לעקוב** אחרי ערכת הנושא, ולכן
    // אסור שיישאר כאן ערך כלשהו — גם לא האפור שהיה שם רגע קודם.
    applyCanvasColor('#123456');
    applyCanvasColor(null);

    expect(declared()).toBe('');
    expect(canvasColor.value).toBeNull();
  });

  it('החלפת צבע דורסת ואינה מצטברת', () => {
    applyCanvasColor('#123456');
    applyCanvasColor('#abcdef');

    expect(declared()).toBe('#abcdef');
    expect(canvasColor.value).toBe('#abcdef');
  });
});

/**
 * שני קצוות שאין ביניהם קשר שהמהדר רואה: שם הטוקן כמחרוזת ב-TypeScript, ואותו
 * שם בגיליון הסגנון. שינוי צד אחד בלבד אינו נופל בשום שער — הכתיבה מצליחה,
 * הכלל ממשיך לקרוא את הטוקן הישן, והבד פשוט מפסיק להיצבע. נמדד: שינוי השם
 * ב-TS בלבד השאיר את כל שאר הבדיקות בקובץ הזה ירוקות.
 */
describe('הטוקן שב-TypeScript הוא הטוקן שב-CSS', () => {
  it('הכלל של הבד צורך בדיוק את `CANVAS_COLOR_VAR`', () => {
    // שני הכללים: ה-`scoped` ב-App.vue (המנצח) והגלובלי ב-shell.css.
    expect(source('App.vue')).toContain(`background: var(${CANVAS_COLOR_VAR});`);
    expect(source('styles', 'shell.css')).toContain(`background: var(${CANVAS_COLOR_VAR});`);
  });

  it('ברירת המחדל של הטוקן היא צבע ערכת הנושא שהבורר קורא', () => {
    // זה מה שמחזיק את „ברירת מחדל”: הפס בבורר מראה את `THEME_CANVAS_VAR`,
    // והבד — בלי העדפה — נצבע ממנו. שני טוקנים שונים כאן פירושם פס שמבטיח
    // צבע אחד ובד שמצויר באחר.
    expect(source('styles', 'tokens.css')).toContain(
      `${CANVAS_COLOR_VAR}: var(${THEME_CANVAS_VAR});`,
    );
  });
});
