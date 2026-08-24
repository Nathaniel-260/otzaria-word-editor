/**
 * הגבולות שהתכנית קובעת מול SuperDoc (§2, §4) הם החלטות ארכיטקטורה, ולא
 * העדפת סגנון: חריגה מהם מחזירה את התוסף הישן (עריכת DOM ידנית) או מפרה את
 * רישיון המנוע (import ישיר אליו). לכן הם נבדקים על המקור עצמו, בקובץ אחד
 * שנכשל ברור, ולא נסמכים על זכירה בזמן code review.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest רץ משורש המאגר, ולכן cwd הוא השורש.
const SRC = join(process.cwd(), 'src');

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
 * הערות מוסרות לפני הבדיקה: התיעוד בקוד מסביר במפורש מה אסור (למשל
 * "אין לקרוא ל-createSuperDocUI"), וההסבר הזה אינו הפרה. השורות נשמרות
 * כדי שמספרי השורות בכשל יישארו נכונים.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const sources = sourceFiles().map((path) => ({
  path: relative(SRC, path),
  text: stripComments(readFileSync(path, 'utf8')),
}));

/** התאמות בקובץ, בפורמט "נתיב:שורה" — כדי שכשל יצביע למקום ולא רק לכלל. */
function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const { path, text } of sources) {
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) found.push(`${path}:${index + 1}`);
    });
  }
  return found;
}

describe('גבולות מול SuperDoc', () => {
  it('יש קבצי מקור לבדוק', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('אין import ישיר למנוע ה-DOCX', () => {
    // רישיון המנוע מתיר אותו "solely as a dependency of SuperDoc".
    expect(hits(/from\s+['"]@superdoc\/docx-engine/)).toEqual([]);
  });

  it('אין import מנתיב פנימי של החבילה', () => {
    // רק ה-exports הציבוריים: superdoc, superdoc/ui, superdoc/style.css.
    expect(hits(/from\s+['"]superdoc\/(?!ui['"]|style\.css['"])/)).toEqual([]);
  });

  it('אין יצירת controller שני ל-UI', () => {
    // ה-controller יושב ב-superdoc.ui ובבעלות המופע. ראו create-editor.ts.
    expect(hits(/createSuperDocUI/)).toEqual([]);
  });

  it('אין עריכת מסמך דרך ה-DOM', () => {
    expect(hits(/execCommand|contentEditable|contenteditable/)).toEqual([]);
  });

  it('אין selector אל ה-DOM הפנימי של SuperDoc', () => {
    expect(hits(/(querySelector|querySelectorAll|closest)\s*\(\s*['"][^'"]*(\.sd-|superdoc)/i)).toEqual(
      [],
    );
  });
});
