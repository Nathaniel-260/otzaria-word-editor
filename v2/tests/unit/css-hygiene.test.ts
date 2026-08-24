/**
 * שער היגיינה על מקור ה-CSS.
 *
 * למה בדיקה ולא עין: הקוד המת כאן נצבר פעמיים בלי שאיש שם לב. b2f0635 החליף
 * צרכנים של טוקנים ב---color-* ישירים והשאיר חמישה טוקני --word-* בלי צרכן,
 * וכפתור ה-launcher שהועבר להערה ב-RibbonGroup.vue השאיר אחריו שני בלוקים
 * ב-ribbon.css שסלקטור שלהם לא מתאים לשום אלמנט. שני הדברים אינם נראים
 * בדפדפן — הם נראים רק בספירה.
 *
 * מה נמדד:
 *   1. כל custom property שמוגדר במקור, ואינו חלק מה-palette של ה-SDK, יש לו
 *      לפחות צרכן אחד.
 *   2. כל מחלקה שמופיעה בסלקטור בגלובלים (src/styles/*.css) קיימת באמת
 *      בקומפוננטה או בקוד.
 *   3. כל var(--word-*) שנצרך אכן מוגדר — טוקן שלא הוגדר פשוט לא צובע כלום.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** vitest רץ מ-v2/, ולכן src/ נמצא ביחס ל-cwd. */
const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const ALL_FILES = walk(SRC);
const STYLE_SHEETS = ALL_FILES.filter((f) => f.endsWith('.css'));
const CODE_FILES = ALL_FILES.filter((f) => f.endsWith('.vue') || f.endsWith('.ts'));

/** קובץ → תוכן, פעם אחת: הבדיקות למטה סורקות את אותם קבצים. */
const CONTENT = new Map(ALL_FILES.map((f) => [f, readFileSync(f, 'utf8')]));
const ALL_SOURCE = [...CONTENT.values()].join('\n');

function short(path: string): string {
  return path.slice(SRC.length - 3);
}

/**
 * ההגדרות בלבד: `--x:` בתחילת שורה. העיגון לתחילת השורה הוא מה שמפריד הגדרה
 * מאזכור בתוך var(--x, fallback) ומקריאת setProperty ב-TypeScript.
 */
function definitions(source: string): string[] {
  return [...source.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
}

function references(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
}

describe('טוקני CSS', () => {
  it('לכל טוקן שהמצאנו יש צרכן', () => {
    // --color-* יוצאים מהכלל: הם ה-palette המתועד של ה-SDK, host/theme.ts כותב
    // אותם, והם החוזה מול אוצריא — גם תפקיד שאיננו צובעים בו כלום כרגע נשאר.
    const used = new Set(references(ALL_SOURCE));
    const orphans: string[] = [];

    for (const file of ALL_FILES) {
      for (const token of definitions(CONTENT.get(file) ?? '')) {
        if (token.startsWith('--color-')) continue;
        if (!used.has(token)) orphans.push(`${token} (${short(file)})`);
      }
    }

    expect(orphans).toEqual([]);
  });

  it('כל טוקן --word-* שנצרך גם מוגדר', () => {
    const defined = new Set(definitions(ALL_SOURCE));
    const undeclared = [
      ...new Set(references(ALL_SOURCE).filter((t) => t.startsWith('--word-'))),
    ].filter((token) => !defined.has(token));

    expect(undeclared).toEqual([]);
  });
});

describe('סלקטורים בגלובלים', () => {
  /**
   * שם מחלקה שנבנה בזמן ריצה מתבנית — `btn-${variant}` ב-RibbonButton.vue —
   * אינו מופיע במקור כמחרוזת שלמה. מחפשים את התחילית שלפני החלק הדינמי.
   */
  function isComposed(name: string): boolean {
    const parts = name.split('-');
    for (let i = parts.length - 1; i > 0; i -= 1) {
      if (ALL_SOURCE.includes(`\`${parts.slice(0, i).join('-')}-\${`)) return true;
    }
    return false;
  }

  /**
   * מחלקות שה-DOM שלהן שייך למנוע ולא לנו. `.superdoc` הוא ה-wrapper שהמנוע
   * מרנדר, והכלל היחיד שנוגע בו — מרכוז העמוד ב-shell.css — מתועד שם במלואו.
   * ההחרגה מפורשת ולא „עוברת בטעות” מפני ש-'superdoc' מופיע גם כשם החבילה
   * ב-import: בלעדיה הבדיקה הייתה מאשרת אותו מסיבה לא נכונה.
   */
  const ENGINE_OWNED = new Set(['superdoc']);

  it('כל מחלקה בסלקטור קיימת בקומפוננטה או בקוד', () => {
    // רק הגלובלים: סגנונות scoped בתוך .vue הם של הקומפוננטה עצמה, ושם
    // הסלקטור והתבנית יושבים באותו קובץ ומתוחזקים יחד.
    const componentSource = CODE_FILES.map((f) => CONTENT.get(f) ?? '').join('\n');
    const dead: string[] = [];

    for (const sheet of STYLE_SHEETS) {
      // הערות מוסרות תחילה: הן יושבות לפני '{' ולכן נקראות כחלק מהסלקטור.
      // הערה שמזכירה מחלקה של המנוע (`superdoc__layers`) דיווחה עליה כמחלקה
      // מדומה, וזו הייתה בדיקה שנכשלת על תיעוד.
      const css = (CONTENT.get(sheet) ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ');
      for (const block of css.matchAll(/(?:^|\})([^{}]*)\{/g)) {
        for (const cls of block[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
          const name = cls[1];
          if (ENGINE_OWNED.has(name) || isComposed(name)) continue;
          if (componentSource.includes(name)) continue;
          dead.push(`${name} (${short(sheet)})`);
        }
      }
    }

    expect([...new Set(dead)]).toEqual([]);
  });
});
