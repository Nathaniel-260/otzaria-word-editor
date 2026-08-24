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
 * ההיקף הוא שלוש הלשוניות שהתקלה הייתה בהן. הרחבה לכל הלשוניות היא הצעד הבא,
 * והיא צריכה לקרות ביחד עם מי שמחזיק אותן — שער אדום שאינו בבעלות מי שמתקן
 * אותו סתם חוסם.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** vitest רץ מ-v2/, ולכן src/ נמצא ביחס ל-cwd. */
const TABS = join(process.cwd(), 'src/ui/ribbon/tabs');

const FILES = ['LayoutTab.vue', 'ReferencesTab.vue', 'ReviewTab.vue'] as const;

const SOURCES = new Map(FILES.map((file) => [file, readFileSync(join(TABS, file), 'utf8')]));

/** כל תג פקד בקובץ, כולל התכונות שלו. כל הפקדים בלשוניות האלה נסגרים ב-`/>`. */
function controls(source: string): string[] {
  return [...source.matchAll(/<Ribbon(?:Button|MenuButton)\b[\s\S]*?\/>/g)].map((m) => m[0]);
}

/** שורת הזיהוי של פקד בכשל: התווית שלו, כדי שאפשר יהיה למצוא אותו. */
function labelOf(control: string): string {
  return control.match(/label="([^"]*)"/)?.[1] ?? control.slice(0, 60);
}

describe('פקדי הלשוניות פריסה, הפניות וסקירה', () => {
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
