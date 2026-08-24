/**
 * החוזה של הרג'יסטרי. הוא קיים כדי שהמצב שהיה כאן לא יחזור: שתים-עשרה תוויות
 * ברצועה הבטיחו למשתמש קיצור שאין לו מאזין, ואיש לא ידע — כי שום בדיקה לא
 * הצליבה בין שתי הרשימות.
 *
 * שתי הבדיקות האחרונות סורקות את המקור עצמו, בדיוק כמו
 * tests/unit/engine-boundaries.test.ts: כלל שנשען על זכירה בזמן code review
 * אינו כלל.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  SHORTCUTS,
  SHORTCUT_GROUP_TITLES,
  shortcutsByGroup,
  type Shortcut,
} from '../../src/ui/shortcuts/registry';
import { COMMAND_IDS } from '../../src/engine/capabilities';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

/** הערות מוסרות: תיעוד שמסביר מה אסור אינו הפרה. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const sources = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  text: stripComments(readFileSync(path, 'utf8')),
}));

function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const { path, text } of sources) {
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) found.push(`${path}:${index + 1}`);
    });
  }
  return found;
}

/**
 * הרשומות כטיפוס הרחב. `SHORTCUTS` הוא `as const` כדי לגזור ממנו `ShortcutId`,
 * ולכן כל רשומה היא טיפוס ליטרלי משלה — מה שהופך כל בדיקה גנרית עליהן לצרה
 * של narrowing. הבדיקה כאן היא על החוזה, לא על הליטרלים.
 */
const ENTRIES: readonly Shortcut[] = SHORTCUTS;

/** הצירוף כמחרוזת, לזיהוי כפילויות. */
function combo(shortcut: Shortcut): string {
  const parts = [
    shortcut.ctrl === true ? 'Ctrl' : '',
    shortcut.shift === true ? 'Shift' : '',
    shortcut.alt === true ? 'Alt' : '',
    shortcut.code ?? `key:${shortcut.key ?? ''}`,
  ];
  return parts.filter(Boolean).join('+');
}

describe('חוזה הרג-יסטרי', () => {
  it('יש רשומות לבדוק', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it('אין שתי רשומות עם אותו מזהה', () => {
    const ids = ENTRIES.map((shortcut) => shortcut.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('אין שתי רשומות עם אותו צירוף', () => {
    const combos = ENTRIES.map(combo);
    const duplicates = combos.filter((value, index) => combos.indexOf(value) !== index);
    expect(duplicates).toEqual([]);
  });

  it('כל רשומה מריצה בדיוק דבר אחד', () => {
    const broken = ENTRIES.filter((shortcut) => {
      const targets = [shortcut.command, shortcut.action, shortcut.native].filter(Boolean);
      return targets.length !== 1;
    }).map((shortcut) => shortcut.id);

    expect(broken).toEqual([]);
  });

  it('כל פקודת מנוע ברשימה מוכרת ל-registry של היכולות', () => {
    // מזהה שאינו כאן הוא כפתור מת — רק בלי כפתור.
    const unknown = ENTRIES.filter(
      (shortcut) => shortcut.command !== undefined && !COMMAND_IDS.includes(shortcut.command),
    ).map((shortcut) => shortcut.id);

    expect(unknown).toEqual([]);
  });

  it('לכל רשומה מקש, תווית, תיאור וקבוצה מוכרת', () => {
    for (const shortcut of ENTRIES) {
      expect(shortcut.label.length, shortcut.id).toBeGreaterThan(0);
      expect(shortcut.description.length, shortcut.id).toBeGreaterThan(0);
      expect(Object.keys(SHORTCUT_GROUP_TITLES), shortcut.id).toContain(shortcut.group);
      expect(Boolean(shortcut.code ?? shortcut.key), shortcut.id).toBe(true);
    }
  });

  it('הקיבוץ מכסה את כל הרשומות', () => {
    const grouped = shortcutsByGroup().flatMap((entry) => entry.items);
    expect(grouped).toHaveLength(ENTRIES.length);
  });
});

describe('החוזה מול המקור', () => {
  it('יש קבצי מקור לבדוק', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('אין ברצועה תווית קיצור כתובה ביד', () => {
    // `shortcut="Ctrl+B"` היה tooltip בלי מאזין. התווית באה מהרשימה בלבד.
    expect(hits(/\sshortcut="/)).toEqual([]);
  });

  it('אין השוואת event.key לאות בודדת', () => {
    // הנסיגה שהתיקון הזה בא למנוע: בפריסה עברית key הוא תו הפריסה.
    expect(hits(/\.key(\.toLowerCase\(\))?\s*===\s*'[a-zA-Z]'/)).toEqual([]);
  });

  it('כל shortcut-id ברצועה קיים ברשימה', () => {
    const ids = new Set<string>(ENTRIES.map((shortcut) => shortcut.id));
    const used = new Set<string>();
    for (const { text } of sources) {
      for (const match of text.matchAll(/shortcut-id="([^"]+)"/g)) used.add(match[1]!);
    }

    expect([...used].filter((id) => !ids.has(id))).toEqual([]);
    // לפחות אחד — אחרת הבדיקה עוברת על ריק ואינה בודקת דבר.
    expect(used.size).toBeGreaterThan(0);
  });
});
