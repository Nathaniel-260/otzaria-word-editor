/**
 * בניית נכס ראשי-התיבות — צד Node בלבד (vite.config.ts והבדיקות). ההיגיון
 * שצורך אותו ב-src/engine/acronyms.ts.
 *
 * ## למה מפתחות מנורמלים
 *
 * `lookup` מנרמלת את המילה שהוקלדה (בלי ניקוד, גרשיים ישרים) כדי שמקלדת
 * עברית — שמייצרת ״ ולא " — תמצא את הערך. בלי נרמול סימטרי כאן, 44 מפתחות
 * מנוקדים בקובץ המקור היו בלתי נגישים לחלוטין.
 *
 * ## שלוש טענות על הנתונים
 *
 * `build` מאמת אותן במקום להניח: כל ערך הוא מערך לא-ריק של מחרוזות
 * (`createAcronymDictionary` מניח זאת), וכל מפתח עונה על `looksLikeAcronym`
 * (השער שלפני הטעינה — מפתח שאינו עונה עליו היה מילון שאיש לא יגיע אליו).
 * כשל בבנייה עדיף על תוסף שנפרס והשלמה שדולגת בשקט.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { looksLikeAcronym } from '../src/engine/acronyms';
import { normalizeWord } from '../src/engine/spellcheck';
import { ACRONYMS_GLOBAL } from '../src/engine/acronyms-constants';

/** מ-`cwd` ולא מ-`import.meta.url`: תחת jsdom הכתובת אינה file://, כמו ב-scripts/blank-docx.ts. */
const SOURCE = resolve('src/data/acronyms.json');

function packAcronyms(data: Record<string, unknown>): Record<string, string[]> {
  const packed: Record<string, string[]> = Object.create(null);
  /** מפתחות מנוקדים נדחים לסוף: הם כפילות של המנוקדים-לא, ואין להם להחליף אותם. */
  const pointed: [string, string[]][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item === '')) {
      throw new Error(`acronyms.json: ל-"${key}" אין מערך פירושים לא-ריק של מחרוזות.`);
    }
    if (!looksLikeAcronym(key)) {
      throw new Error(`acronyms.json: המפתח "${key}" אינו בצורת ר"ת, ולכן השער שלפני הטעינה לא יגיע אליו.`);
    }

    const normalized = normalizeWord(key);
    if (normalized === key) packed[key] = value as string[];
    else pointed.push([normalized, value as string[]]);
  }

  for (const [key, value] of pointed) {
    if (!(key in packed)) packed[key] = value;
  }

  return packed;
}

/** תוכן `assets/acronyms.js`: השמה יחידה של ליטרל אובייקט ל-`window`. */
export function buildAcronymsAsset(source: string = SOURCE): string {
  const data = JSON.parse(readFileSync(source, 'utf8')) as Record<string, unknown>;
  return `window.${ACRONYMS_GLOBAL} = ${JSON.stringify(packAcronyms(data))};\n`;
}
