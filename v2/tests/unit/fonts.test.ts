import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SEGOE_UI_FACES, bundledFontFaceCss, installBundledFonts } from '../../src/styles/fonts';

/** vitest רץ מ-v2/, ולכן public/ נמצא ביחס ל-cwd. */
const FONT_DIR = join(process.cwd(), 'public', 'fonts');

describe('bundledFontFaceCss', () => {
  it('מצהיר על כל פנים גופן פעם אחת, עם משקל, סגנון ופורמט', () => {
    const css = bundledFontFaceCss();
    expect(css.match(/@font-face/g)).toHaveLength(SEGOE_UI_FACES.length);

    for (const face of SEGOE_UI_FACES) {
      expect(css).toContain(`url('${face.url}') format('truetype')`);
    }
    // המשקלים והסגנונות שהמסמך יבקש בפועל.
    expect(css).toContain('font-weight:400');
    expect(css).toContain('font-weight:600');
    expect(css).toContain('font-weight:700');
    expect(css).toContain('font-style:italic');
    // 3.3MB של גופן לא יעכבו את הצגת המסמך.
    expect(css).toContain('font-display:swap');
  });

  it('שם המשפחה זהה בכל הפנים — אחרת המסמך לא ימצא אותה', () => {
    expect(new Set(SEGOE_UI_FACES.map((face) => face.family))).toEqual(new Set(['Segoe UI']));
  });

  it('כל הנתיבים יחסיים ל-document', () => {
    // נתיב מוחלט (`/fonts/...`) נפתר ל-שורש הדיסק ב-file://, ואוצריא טוענת
    // תוסף ארוז בדיוק משם.
    for (const face of SEGOE_UI_FACES) {
      expect(face.url.startsWith('./fonts/')).toBe(true);
    }
  });

  it('אין הצהרה כפולה לאותו משקל-וסגנון', () => {
    const keys = SEGOE_UI_FACES.map((face) => `${face.weight}/${face.style}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('installBundledFonts', () => {
  it('מזריק style אחד ל-head', () => {
    const doc = document.implementation.createHTMLDocument('t');
    installBundledFonts(doc);

    const styles = doc.head.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain("font-family:'Segoe UI'");
  });

  it('אידמפוטנטי — קריאה שנייה אינה מכפילה את ההצהרות', () => {
    const doc = document.implementation.createHTMLDocument('t');
    installBundledFonts(doc);
    installBundledFonts(doc);

    expect(doc.head.querySelectorAll('style')).toHaveLength(1);
  });
});

describe('הקבצים שנארזים', () => {
  it('כל פנים שמוצהרת קיימת בפועל ואינה ריקה', () => {
    for (const face of SEGOE_UI_FACES) {
      const path = join(FONT_DIR, face.url.replace('./fonts/', ''));
      expect(existsSync(path), `חסר ${face.url}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100_000);
    }
  });

  it('אין בתיקייה קובץ גופן שאינו מוצהר', () => {
    // 3.3MB זה מה שהמשתמש מוריד. קובץ שנשאר שם בלי הצהרה הוא מגה-בייט מבוזבז
    // בחבילה — וזה בדיוק מה שקרה בתוסף שממנו הגופן הועתק.
    const declared = new Set(SEGOE_UI_FACES.map((face) => face.url.replace('./fonts/', '')));
    const onDisk = readdirSync(FONT_DIR).filter((name) => name.endsWith('.ttf'));

    expect(onDisk.sort()).toEqual([...declared].sort());
  });
});
