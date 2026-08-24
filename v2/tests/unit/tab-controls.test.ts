/**
 * שער נגד הכפתור המת.
 *
 * זו לא בדיקת סגנון. שלוש לשוניות נבנו מראש עם תשעה כפתורים בלי `@click`
 * בכלל — לא disabled, לא שום סימן, נראים בדיוק כמו כפתור עובד. שניים מהם אף
 * הציגו קיצור מקלדת (`Alt+Ctrl+F`, `F7`) שלא נרשם בשום מקום. אף בדיקה לא
 * נכשלה, ואף typecheck לא התלונן: פקד שאינו עושה כלום הוא HTML תקין לחלוטין.
 *
 * לכן הכלל נבדק על המקור עצמו:
 *   1. לכל פקד יש מטפל, או שהוא מנוטרל במפורש. אין שביל שלישי.
 *   2. לכל פקד יש חיווט של `disabled` — כלומר מישהו החליט מתי הוא זמין.
 *   3. אין `shortcut` בלשוניות האלה, כל עוד אין קיצור רשום בפועל.
 *
 * ההיקף הוא הלשוניות שהתקלה הייתה בהן. הרחבה לכל הלשוניות היא הצעד הבא, והיא
 * צריכה לקרות ביחד עם מי שמחזיק אותן — שער אדום שאינו בבעלות מי שמתקן אותו
 * סתם חוסם. „אוצריא” נוספה כאן בגל שחיווט אותה, ובדיוק מהטעם הזה: ששת
 * הכפתורים שלה עברו את השער, וכך הוא מגן עליהם מכאן והלאה.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** vitest רץ מ-v2/, ולכן src/ נמצא ביחס ל-cwd. */
const TABS = join(process.cwd(), 'src/ui/ribbon/tabs');

const FILES = [
  'LayoutTab.vue',
  'ReferencesTab.vue',
  'ReviewTab.vue',
  'OtzariaTab.vue',
] as const;

const SOURCES = new Map(FILES.map((file) => [file, readFileSync(join(TABS, file), 'utf8')]));

/** כל תג פקד בקובץ, כולל התכונות שלו. כל הפקדים בלשוניות האלה נסגרים ב-`/>`. */
function controls(source: string): string[] {
  return [...source.matchAll(/<Ribbon(?:Button|MenuButton)\b[\s\S]*?\/>/g)].map((m) => m[0]);
}

/** שורת הזיהוי של פקד בכשל: התווית שלו, כדי שאפשר יהיה למצוא אותו. */
function labelOf(control: string): string {
  return control.match(/label="([^"]*)"/)?.[1] ?? control.slice(0, 60);
}

describe('פקדי הלשוניות פריסה, הפניות, סקירה ואוצריא', () => {
  it('נמצאו פקדים לבדוק בכל שלוש הלשוניות', () => {
    for (const file of FILES) {
      expect(controls(SOURCES.get(file)!).length, file).toBeGreaterThan(0);
    }
  });

  it('לכל פקד יש מטפל, או שהוא מנוטרל במפורש', () => {
    const dead: string[] = [];
    for (const file of FILES) {
      for (const control of controls(SOURCES.get(file)!)) {
        const hasHandler = /@click|@select/.test(control);
        const alwaysDisabled = /:disabled="true"/.test(control);
        if (!hasHandler && !alwaysDisabled) dead.push(`${file}: ${labelOf(control)}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it('לכל פקד יש חיווט של disabled', () => {
    const unguarded: string[] = [];
    for (const file of FILES) {
      for (const control of controls(SOURCES.get(file)!)) {
        if (!/:disabled=/.test(control)) unguarded.push(`${file}: ${labelOf(control)}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it('אין קיצור מקלדת מוצג, כי אין קיצור רשום', () => {
    // `Alt+Ctrl+F`, `Alt+Ctrl+D` ו-`F7` הוצגו כאן ולא היו קיימים.
    const fake: string[] = [];
    for (const file of FILES) {
      for (const control of controls(SOURCES.get(file)!)) {
        if (/shortcut=/.test(control)) fake.push(`${file}: ${labelOf(control)}`);
      }
    }
    expect(fake).toEqual([]);
  });

  it('שלושת פקדי „אוצריא” קוראים ל-SDK ולא מסתפקים בהודעת סטטוס', () => {
    // ההודעות שהיו כאן („פותח את ספריית אוצריא...”) תיארו פעולה שלא קרתה.
    const tab = SOURCES.get('OtzariaTab.vue')!;
    for (const event of ['insert-citation', 'search-otzaria', 'open-library']) {
      expect(tab, event).toContain(`$emit('${event}')`);
    }
    const app = readFileSync(join(process.cwd(), 'src/App.vue'), 'utf8');
    expect(app).toContain('insertCitation(');
    expect(app).toContain('openSearchTab(');
    expect(app).toContain('openLibrary()');
  });

  it('„סגנון תורני” מסומן „לא זמין” ואינו מבטיח פעולה שאין לה API', () => {
    // §12: „פקד שאין לו API ציבורי אמין מסומן „לא זמין בגרסה זו”; לא מממשים
    // אותו דרך XML ידני”. במנוע 2.8.0 אין פעולה שיוצרת סגנון פסקה בשם.
    const tab = SOURCES.get('OtzariaTab.vue')!;
    for (const label of ['חידוש', 'קושיא', 'תירוץ']) {
      const control = controls(tab).find((candidate) => labelOf(candidate) === label);
      expect(control, label).toBeDefined();
      expect(control!, label).toContain(':disabled="true"');
      expect(control!, label).toContain('TORAH_STYLE_UNAVAILABLE');
      // התיאור הישן („החלת סגנון פסקת קושיא”) הבטיח פעולה שלא קיימת.
      expect(control!, label).not.toContain('החלת סגנון');
    }
  });

  it('„סקירה” מציעה גם דחייה של כל השינויים, ולא רק קבלה', () => {
    // `rejectAllChanges` היה ב-registry מהיום הראשון, ולא היה לו פקד — כלומר
    // אפשר היה לקבל את כל השינויים ולא לדחות אותם.
    const review = SOURCES.get('ReviewTab.vue')!;
    expect(review).toContain("useCommand('rejectAllChanges')");
    expect(review).toContain('label="דחה את כל השינויים"');
  });

  it('„עקוב אחר שינויים” לוקח את המצב מהמנוע ולא מ-state מקומי', () => {
    // `document-mode` מדווח `active: false` תמיד; המצב הדלוק חייב לבוא
    // מ-`value`, אחרת הוא יוצא מסינכרון ברגע שהמצב משתנה ממקום אחר.
    const review = SOURCES.get('ReviewTab.vue')!;
    expect(review).toContain("useCommand('document-mode')");
    expect(review).toContain("modeCmd.value.value === 'suggesting'");
    expect(review).not.toMatch(/ref\(false\)/);
  });
});
