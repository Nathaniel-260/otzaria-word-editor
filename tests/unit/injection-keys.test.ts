/**
 * כל מפתח הזרקה ב-`composables/keys.ts` חייב שמישהו יספק אותו.
 *
 * הבדיקה הזאת נכתבה אחרי באג אמיתי: `PAGE_MARKING` ו-`DRAFT_OPENER` סופקו
 * ב-App.vue, וקומיט מאוחר יותר מחק את שתי השורות. שום דבר לא נשבר בהידור
 * ושום בדיקה לא האדימה — מפני ש-`inject` נקרא עם **ברירת מחדל**, וברירת
 * המחדל היא no-op תקין לחלוטין. התוצאה הייתה ש„סימון עמודים” נכשל בכל ריצה
 * עם „לא נמצאו עמודים לסימון”, ו„פירוק מסמך” לא פתח טאב — שתי תכונות
 * שנעלמו בשקט מוחלט.
 *
 * ברירת המחדל של `inject` נחוצה (היא מה שמאפשר לבדוק לשונית לבדה), ולכן
 * המחיר שלה משולם כאן: הבדיקה קוראת את המקור עצמו ומוודאת שלכל מפתח יש
 * `provide` אחד לפחות. מפתח שנולד בלי ספק ייכשל כאן ביום שהוא נולד.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest רץ משורש המאגר, ולכן cwd הוא השורש.
const SRC = join(process.cwd(), 'src');
const KEYS = join(SRC, 'composables', 'keys.ts');

function sourceFiles(dir = SRC): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

/**
 * הערות מוסרות: התיעוד של כל מפתח מזכיר במפורש מי מספק אותו ומי מזריק,
 * ואזכור בהערה אינו חיווט. השורות נשמרות כדי שמספרי השורות יישארו נכונים.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const sources = sourceFiles().map((path) => ({
  path: relative(SRC, path).replace(/\\/g, '/'),
  text: stripComments(readFileSync(path, 'utf8')),
}));

const keyNames = Array.from(
  stripComments(readFileSync(KEYS, 'utf8')).matchAll(/export const ([A-Z_][A-Z0-9_]*): InjectionKey</g),
  (match) => match[1]!,
);

/** הקבצים שבהם המפתח מופיע בקריאה כזאת — `inject<T>(KEY` נתפס גם הוא. */
function callers(verb: 'provide' | 'inject', key: string): string[] {
  const pattern = new RegExp(`\\b${verb}\\s*(?:<[^>]*>)?\\s*\\(\\s*${key}\\b`);
  return sources.filter(({ text }) => pattern.test(text)).map(({ path }) => path);
}

describe('מפתחות ההזרקה של המעטפת', () => {
  it('נקראו מהמקור', () => {
    // אם הרשימה התרוקנה, הבדיקה שמתחת עוברת על אפס מפתחות ואינה בודקת דבר.
    expect(keyNames.length).toBeGreaterThan(5);
    expect(keyNames).toContain('PAGE_MARKING');
    expect(keyNames).toContain('DRAFT_OPENER');
  });

  it('לכל מפתח יש מי שמספק אותו', () => {
    const orphans = keyNames.filter((key) => callers('provide', key).length === 0);
    expect(orphans).toEqual([]);
  });

  it('מי שמזריק מקבל ספק — גם כשיש ברירת מחדל', () => {
    const broken = keyNames
      .filter((key) => callers('inject', key).length > 0 && callers('provide', key).length === 0)
      .map((key) => `${key}: מוזרק ב-${callers('inject', key).join(', ')} ואינו מסופק`);
    expect(broken).toEqual([]);
  });
});
