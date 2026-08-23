import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUNDLED_FAMILIES,
  BUNDLED_FILES,
  UNICODE_RANGE,
  bundledFontFaceCss,
  installBundledFonts,
} from '../../src/styles/fonts';

/** vitest רץ מ-v2/, ולכן public/ נמצא ביחס ל-cwd. */
const FONT_DIR = join(process.cwd(), 'public', 'fonts');

describe('bundledFontFaceCss', () => {
  it('מצהיר על כל משקל בכל שם', () => {
    const css = bundledFontFaceCss();

    expect(css.match(/@font-face/g)).toHaveLength(
      BUNDLED_FILES.length * BUNDLED_FAMILIES.length,
    );
    for (const family of BUNDLED_FAMILIES) {
      for (const file of BUNDLED_FILES) {
        expect(css).toContain(`font-family:'${family}';font-style:normal;font-weight:${file.weight}`);
      }
    }
  });

  it('מצהיר על „Segoe UI” כשם התאמה — בלעדיו מסמך Word לא מקבל את המטריקות', () => {
    // זו כל הסיבה שהגופן נארז. הסרת השם הזה הופכת את האריזה לחסרת תועלת
    // למסמכים, ומשאירה רק את הטקסט הלטיני של הממשק.
    expect(BUNDLED_FAMILIES).toContain('Segoe UI');
    expect(BUNDLED_FAMILIES).toContain('Selawik');
  });

  it('אותו קובץ משרת את שני השמות', () => {
    const css = bundledFontFaceCss();

    for (const file of BUNDLED_FILES) {
      const uses = css.split(`url('${file.url}')`).length - 1;
      expect(uses).toBe(BUNDLED_FAMILIES.length);
    }
  });

  it('מבקש truetype ו-swap', () => {
    const css = bundledFontFaceCss();

    expect(css).toContain("format('truetype')");
    // הגופן לא יעכב את הצגת המסמך.
    expect(css).toContain('font-display:swap');
  });

  it('מצהיר unicode-range שאינו כולל את הבלוק העברי', () => {
    // בלי זה, השם „Segoe UI” נחטף גם לעברית — וב-Windows, שבו Segoe UI האמיתי
    // מותקן ויש בו עברית, טקסט עברי במסמך היה מפסיק לקבל אותו.
    const css = bundledFontFaceCss();
    expect(css).toContain(`unicode-range:${UNICODE_RANGE}`);

    const ranges = UNICODE_RANGE.split(',').map((part) => part.trim());
    const covers = (code: number) =>
      ranges.some((range) => {
        const [from, to] = range.replace('U+', '').split('-');
        return code >= parseInt(from!, 16) && code <= parseInt(to ?? from!, 16);
      });

    expect(covers(0x41)).toBe(true); // A
    expect(covers(0x5d0)).toBe(false); // א
    expect(covers(0x5b0)).toBe(false); // שווא
  });

  it('אינו מצהיר על נטוי — Selawik אינו מספק פנים כזאת', () => {
    // הצהרת italic שמצביעה על הפנים הרגילה הייתה מונעת מהדפדפן להטות אותה
    // סינתטית, כלומר טקסט נטוי היה נראה זקוף.
    expect(bundledFontFaceCss()).not.toContain('italic');
  });

  it('כל הנתיבים יחסיים ל-document', () => {
    // נתיב מוחלט (`/fonts/...`) נפתר ל-שורש הדיסק ב-file://, ואוצריא טוענת
    // תוסף ארוז בדיוק משם.
    for (const file of BUNDLED_FILES) {
      expect(file.url.startsWith('./fonts/')).toBe(true);
    }
  });

  it('אין הצהרה כפולה לאותו משקל', () => {
    const weights = BUNDLED_FILES.map((file) => file.weight);
    expect(new Set(weights).size).toBe(weights.length);
  });
});

describe('installBundledFonts', () => {
  it('מזריק style אחד ל-head', () => {
    const doc = document.implementation.createHTMLDocument('t');
    installBundledFonts(doc);

    const styles = doc.head.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain("font-family:'Selawik'");
  });

  it('אידמפוטנטי — קריאה שנייה אינה מכפילה את ההצהרות', () => {
    const doc = document.implementation.createHTMLDocument('t');
    installBundledFonts(doc);
    installBundledFonts(doc);

    expect(doc.head.querySelectorAll('style')).toHaveLength(1);
  });
});

describe('הקבצים שנארזים', () => {
  it('כל קובץ שמוצהר קיים בפועל ואינו ריק', () => {
    for (const file of BUNDLED_FILES) {
      const path = join(FONT_DIR, file.url.replace('./fonts/', ''));
      expect(existsSync(path), `חסר ${file.url}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(10_000);
    }
  });

  it('אין בתיקייה קובץ גופן שאינו מוצהר', () => {
    // קובץ שנשאר שם בלי הצהרה הוא נפח מבוזבז בחבילה — וזה בדיוק מה שקרה
    // בתוסף שממנו הגיע הגופן הקודם.
    const declared = new Set(BUNDLED_FILES.map((file) => file.url.replace('./fonts/', '')));
    const onDisk = readdirSync(FONT_DIR).filter((name) => name.endsWith('.ttf'));

    expect(onDisk.sort()).toEqual([...declared].sort());
  });

  it('נוסח ה-OFL נארז לצד הגופן', () => {
    // סעיף 2 ב-OFL: אין להפיץ את הגופן בלי נוסח הרישיון.
    expect(existsSync(join(process.cwd(), 'public/third-party/SELAWIK-LICENSE.txt'))).toBe(true);
  });
});
