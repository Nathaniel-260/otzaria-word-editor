/**
 * „טקסט מתחלף” — הדגשת דיבור-המתחיל: בכל פסקה מודגש הקטע שמתחילתה ועד תו
 * הסיום הראשון, ואחר כך כל קטע שאחרי תו ההתחלה ועד תו הסיום הבא. נויד
 * מ-TextAlternating.bas של שולחן העורך, כולל ברירות המחדל `:` ו-`.` ודילוג
 * על התו שאחרי תו ההתחלה (בדרך כלל הרווח).
 */
import type { CommandOutcome } from '../command-adapter';
import { applyInline, scopedBlocks, textTarget, type ShulchanTarget } from './shulchan-doc';

export interface AlternatingOptions {
  /** תו ההתחלה של קטע מודגש (ברירת מחדל `:`). תו יחיד. */
  startChar: string;
  /** תו הסיום של קטע מודגש (ברירת מחדל `.`). תו יחיד. */
  endChar: string;
}

export function defaultAlternatingOptions(): AlternatingOptions {
  return { startChar: ':', endChar: '.' };
}

/** הקטעים להדגשה בפסקה אחת — לוגיקה טהורה, נבדקת בלי מנוע. */
export function alternatingRanges(text: string, options: AlternatingOptions): { start: number; end: number }[] {
  const { startChar, endChar } = options;
  if (startChar.length !== 1 || endChar.length !== 1) return [];

  const ranges: { start: number; end: number }[] = [];
  const firstEnd = text.indexOf(endChar);
  if (firstEnd < 0) return [];
  if (firstEnd > 0) ranges.push({ start: 0, end: firstEnd + 1 });

  let position = firstEnd + 1;
  for (;;) {
    const start = text.indexOf(startChar, position);
    if (start < 0) break;
    // דילוג על תו ההתחלה ועל התו שאחריו — בדרך כלל רווח, כמו במקור.
    const from = start + 2;
    if (from >= text.length) break;
    const end = text.indexOf(endChar, from);
    if (end < 0) break;
    if (end > from) ranges.push({ start: from, end: end + 1 });
    position = end + 1;
  }
  return ranges;
}

const FAILED = 'עיצוב טקסט מתחלף נכשל';

export interface AlternatingResult {
  ok: boolean;
  message?: string;
  /** מספר הקטעים שהודגשו. */
  bolded: number;
}

/** מדגישה את הקטעים בפסקאות המסומנות. `bold` + `bCs` — עברית היא complex script. */
export async function runTextAlternating(
  host: ShulchanTarget,
  options: AlternatingOptions,
): Promise<AlternatingResult> {
  const scoped = await scopedBlocks(host, 'selection', FAILED);
  if (!scoped.ok) {
    const outcome: CommandOutcome = scoped.outcome;
    return { ok: false, message: outcome.ok ? undefined : outcome.message, bolded: 0 };
  }

  let bolded = 0;
  for (const block of scoped.result.blocks) {
    for (const range of alternatingRanges(block.text, options)) {
      const outcome = await applyInline(
        host,
        textTarget(block.blockId, range.start, range.end),
        { bold: true, bCs: true },
        FAILED,
      );
      if (!outcome.ok) return { ok: false, message: outcome.message, bolded };
      bolded += 1;
    }
  }
  return { ok: true, bolded };
}

export function alternatingSummaryText(result: AlternatingResult): string {
  if (result.bolded === 0) return 'לא נמצאו קטעים להדגשה';
  return result.bolded === 1 ? 'הודגש קטע אחד' : `הודגשו ${result.bolded} קטעים`;
}
