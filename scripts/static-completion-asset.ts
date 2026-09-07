/**
 * בניית נכס רשימות ההשלמה הסטטיות — צד Node בלבד (vite.config.ts והבדיקות).
 * ההיגיון שצורך אותו ב-src/engine/static-completion.ts.
 *
 * `build` מאמת את מה ש-`buildStaticIndex` מניח ואיש אינו בודק: רשומה שהיא
 * מחרוזת לא-ריקה, שיש בה לפחות מילה אחת, ושאין בה יותר מ-31 מילים (תקרת
 * אריזת המיקומים שם). נתונים שנערכים ביד הם בדיוק המקום שבו שורה ריקה או
 * כפילות נכנסות בלי שדבר ייכשל.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATIC_COMPLETION_GLOBAL } from '../src/engine/static-completion-constants';

/** מ-`cwd` ולא מ-`import.meta.url`: תחת jsdom הכתובת אינה file://. */
const SOURCES = {
  phrases: resolve('src/data/talmudic-phrases.json'),
  authors: resolve('src/data/authors.json'),
} as const;

/** התקרה של `WORD_BITS` ב-static-completion.ts. */
const MAX_WORDS_PER_ENTRY = 31;

function readList(name: string, path: string): string[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${name}: הקובץ אינו מערך.`);

  const seen = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(`${name}: יש רשומה שאינה מחרוזת לא-ריקה (${JSON.stringify(entry)}).`);
    }
    const words = entry.trim().split(/\s+/).length;
    if (words > MAX_WORDS_PER_ENTRY) {
      throw new Error(`${name}: לרשומה "${entry}" יש ${words} מילים, מעל ${MAX_WORDS_PER_ENTRY}.`);
    }
    if (seen.has(entry)) throw new Error(`${name}: הרשומה "${entry}" מופיעה יותר מפעם אחת.`);
    seen.add(entry);
  }

  return parsed as string[];
}

export function readStaticCompletionSource(): { phrases: string[]; authors: string[] } {
  return {
    phrases: readList('talmudic-phrases.json', SOURCES.phrases),
    authors: readList('authors.json', SOURCES.authors),
  };
}

/** תוכן `assets/static-completion.js`: השמה יחידה של ליטרל אובייקט ל-`window`. */
export function buildStaticCompletionAsset(): string {
  return `window.${STATIC_COMPLETION_GLOBAL} = ${JSON.stringify(readStaticCompletionSource())};\n`;
}
