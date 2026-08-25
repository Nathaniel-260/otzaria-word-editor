/**
 * החוזה של הרג'יסטרי. הוא קיים כדי שהמצב שהיה כאן לא יחזור: שתים-עשרה תוויות
 * ברצועה הבטיחו למשתמש קיצור שאין לו מאזין, ואיש לא ידע — כי שום בדיקה לא
 * הצליבה בין שתי הרשימות.
 *
 * הבדיקות שסורקות את המקור עצמו יושבות כאן מאותו טעם כמו
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

/** הנתיב תמיד עם `/`, כדי שהבדיקות לא ייפרדו בין Windows לשאר. */
const sources = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).split('\\').join('/'),
  text: stripComments(readFileSync(path, 'utf8')),
}));

function hits(pattern: RegExp, skip?: (path: string) => boolean): string[] {
  const found: string[] = [];
  for (const { path, text } of sources) {
    if (skip?.(path)) continue;
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) found.push(`${path}:${index + 1}`);
    });
  }
  return found;
}

const REGISTRY = 'ui/shortcuts/registry.ts';

/**
 * הרשומות כטיפוס הרחב. `SHORTCUTS` הוא `as const` כדי לגזור ממנו `ShortcutId`,
 * ולכן כל רשומה היא טיפוס ליטרלי משלה — מה שהופך כל בדיקה גנרית עליהן לצרה
 * של narrowing. הבדיקה כאן היא על החוזה, לא על הליטרלים.
 */
const ENTRIES: readonly Shortcut[] = SHORTCUTS;

/** הצירופים של רשומה. רשומה עם כמה מקשים פיזיים מחזירה אחד לכל מקש. */
function combos(shortcut: Shortcut): string[] {
  const keys =
    shortcut.code === undefined
      ? [`key:${shortcut.key ?? ''}`]
      : typeof shortcut.code === 'string'
        ? [shortcut.code]
        : [...shortcut.code];

  return keys.map((key) =>
    [
      shortcut.ctrl === true ? 'Ctrl' : '',
      shortcut.shift === true ? 'Shift' : '',
      shortcut.alt === true ? 'Alt' : '',
      key,
    ]
      .filter(Boolean)
      .join('+'),
  );
}

describe('חוזה הרשימה', () => {
  it('יש רשומות לבדוק', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it('אין שתי רשומות עם אותו מזהה', () => {
    const ids = ENTRIES.map((shortcut) => shortcut.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('אין שתי רשומות עם אותו צירוף', () => {
    // גם חפיפה חלקית: רשומה עם שני מקשים פיזיים אינה רשאית לחלוק אף אחד מהם.
    const owners = new Map<string, string>();
    const clashes: string[] = [];

    for (const shortcut of ENTRIES) {
      for (const key of combos(shortcut)) {
        const owner = owners.get(key);
        if (owner) clashes.push(`${key}: ${owner} / ${shortcut.id}`);
        else owners.set(key, shortcut.id);
      }
    }

    expect(clashes).toEqual([]);
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

  it('payload של סגנון נבנה בצורה שהמנוע מקבל', () => {
    // הרשומות בונות `{ style }` דרך `stylePayload`, ולא ביד. הבדיקה שומרת על
    // המפתח ועל צורת המזהה — „Heading 1” עם רווח אינו מה שהמנוע מכיר.
    const styles = ENTRIES.filter((shortcut) => shortcut.command === 'linked-style').map(
      (shortcut) => shortcut.payload,
    );

    expect(styles.length).toBeGreaterThan(0);
    for (const payload of styles) {
      const style = (payload as { style?: unknown } | null)?.style;
      expect(typeof style, JSON.stringify(payload)).toBe('string');
      expect(style as string).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
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
    //
    // הרשת רחבה בכוונה. גרסתה הראשונה תפסה רק `.key === 'x'` — מרכאות כפולות,
    // `toUpperCase` והשוואה הפוכה היו עוברות דרכה, וזו ההגנה היחידה מפני
    // חזרת הבאג המרכזי.
    const letter = `['"][a-zA-Z]['"]`;

    expect(
      hits(new RegExp(`\\.key\\s*(?:\\.to(?:Lower|Upper)Case\\(\\))?\\s*===\\s*${letter}`)),
      'השוואה ישירה',
    ).toEqual([]);
    expect(hits(new RegExp(`${letter}\\s*===\\s*\\w+\\.key\\b`)), 'השוואה הפוכה').toEqual([]);
  });

  it('אין תווית קיצור כתובה ביד באף פקד', () => {
    // הליקוי שנמצא ב-QA: `title="בטל Ctrl+Z"` בסרגל הגישה המהירה. הוא לא עבר
    // דרך `RibbonButton`, ולכן בדיקת ה-`shortcut=` לא ראתה אותו — ובמשך שני
    // שלבים הייתה שם תווית שאיש לא הצליב מול הרשימה.
    //
    // מה שנבדק הוא **תווית של פקד** בלבד. הודעה למשתמש שמזכירה צירוף („יש
    // להדביק עם Ctrl+V — המנוע מטפל בו”) היא הוראה ולא הבטחה על binding
    // שלנו, ולכן היא מותרת; engine/clipboard.ts מלא בהן בכוונה.
    const labelWithCombo = /(?::?(?:title|tooltip|aria-label)=)[^\n]*(?:Ctrl|Alt|Shift)\s*\+\s*[A-Za-z0-9[\]]/i;

    expect(hits(labelWithCombo, (path) => path === REGISTRY)).toEqual([]);
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
