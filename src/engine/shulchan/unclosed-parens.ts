/**
 * „סוגריים לא סגורים” — סריקת הגהה: איתור סוגריים עגולים/מרובעים שאינם
 * מאוזנים. נויד מ-UnclosedParentheses.bas של שולחן העורך — אותו אלגוריתם
 * מחסנית, אותם שלושה סוגי כשל — אבל במקום „הבא/הבא” עיוור, הסריקה מחזירה
 * את כל הממצאים בבת אחת והדיאלוג מציג רשימה שלחיצה עליה קופצת למקום.
 *
 * לוגיקה טהורה: הסריקה מקבלת בלוקים שכבר נקראו ואינה נוגעת במנוע — בדיוק
 * כמו text-search.ts, ומאותו טעם.
 */
import type { SearchableBlock } from '../text-search';

export type ParenFindingKind = 'open-without-close' | 'close-without-open' | 'mismatched-close';

export const PAREN_FINDING_LABELS: Readonly<Record<ParenFindingKind, string>> = {
  'open-without-close': 'פותח ללא סוגר',
  'close-without-open': 'סוגר ללא פותח',
  'mismatched-close': 'סוגר לא תואם',
};

export interface ParenFinding {
  blockId: string;
  /** טווח להצגה/בחירה, בקואורדינטות-הטקסט של הבלוק. */
  start: number;
  end: number;
  kind: ParenFindingKind;
  /** קטע טקסט קצר סביב הממצא, לרשימה בדיאלוג. */
  excerpt: string;
}

const OPENERS = new Set(['(', '[']);
const CLOSERS: Readonly<Record<string, string>> = { ')': '(', ']': '[' };

/** חלון של עד 40 תווים סביב הממצא, עם אליפסות בקצוות חתוכים. */
function excerptAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 15);
  const to = Math.min(text.length, end + 25);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return `${prefix}${text.slice(from, to)}${suffix}`;
}

/**
 * סורקת בלוק אחד: מחסנית של פותחים; סוגר תואם מוריד, סוגר על מחסנית ריקה
 * הוא „סוגר ללא פותח”, סוגר מסוג אחר הוא „סוגר לא תואם”, ומה שנשאר פתוח
 * בסוף הפסקה — „פותח ללא סוגר”.
 */
export function scanBlockForUnclosed(block: SearchableBlock): ParenFinding[] {
  const findings: ParenFinding[] = [];
  const stack: { char: string; offset: number }[] = [];
  const text = block.text;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (OPENERS.has(char)) {
      stack.push({ char, offset: i });
      continue;
    }
    const expectedOpener = CLOSERS[char];
    if (!expectedOpener) continue;

    const top = stack[stack.length - 1];
    if (!top) {
      findings.push({ blockId: block.blockId, start: i, end: i + 1, kind: 'close-without-open', excerpt: excerptAround(text, i, i + 1) });
      continue;
    }
    if (top.char === expectedOpener) {
      stack.pop();
      continue;
    }
    findings.push({ blockId: block.blockId, start: i, end: i + 1, kind: 'mismatched-close', excerpt: excerptAround(text, i, i + 1) });
    // כמו במקור: הסוגר הלא-תואם אינו מרוקן את המחסנית — הפותח ממתין לסוגר שלו.
  }

  for (const open of stack) {
    findings.push({
      blockId: block.blockId,
      start: open.offset,
      end: open.offset + 1,
      kind: 'open-without-close',
      excerpt: excerptAround(text, open.offset, open.offset + 1),
    });
  }

  findings.sort((a, b) => a.start - b.start);
  return findings;
}

/** סורקת את כל הבלוקים, פסקה-פסקה, בסדר המסמך. */
export function scanForUnclosed(blocks: readonly SearchableBlock[]): ParenFinding[] {
  const findings: ParenFinding[] = [];
  for (const block of blocks) findings.push(...scanBlockForUnclosed(block));
  return findings;
}
