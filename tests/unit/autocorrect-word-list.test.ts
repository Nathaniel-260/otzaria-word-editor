/**
 * הרשימה שיוצאה מ-Word, כפי שהיא בקובץ שנשלח עם המוצר.
 *
 * כל שורה בקובץ צריכה להיכנס לטבלה. שורה שנזרקת בשקט — בלי טאב, פגומה, או כפולה —
 * היא רשומה שהמשתמש חשב שיש לו ואין, ולכן הבדיקה נכשלת עליה ואומרת איזו. אותו
 * רעיון כמו `acronyms.test.ts`: החלפת נתונים שמזיזה מספרים צריכה להיראות, לא
 * לעבור בשקט.
 */
import { describe, expect, it } from 'vitest';
import wordListRaw from '../../src/data/autocorrect-word.tsv?raw';
import { DEFAULT_REPLACEMENTS, parseWordList } from '../../src/engine/autocorrect';

describe('src/data/autocorrect-word.tsv', () => {
  const { entries, skipped } = parseWordList(wordListRaw);

  it('כל שורה בקובץ נכנסת לטבלה — אין שורות פגומות או כפולות', () => {
    const rejected = wordListRaw
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.startsWith('#'))
      .filter((line) => {
        const tab = line.indexOf('\t');
        return tab < 0 || parseWordList(line).entries.length === 0;
      });

    expect(rejected, `שורות שנדחו: ${JSON.stringify(rejected.slice(0, 5))}`).toEqual([]);
    expect(skipped).toBe(0);
  });

  it('כל רשומה בקובץ נמצאת בברירת המחדל ומחליפה את המקור', () => {
    const byFrom = new Map(DEFAULT_REPLACEMENTS.map((entry) => [entry.from, entry.to]));

    for (const entry of entries) expect(byFrom.get(entry.from), entry.from).toBe(entry.to);
  });
});
