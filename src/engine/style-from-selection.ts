/**
 * העיצוב של הבחירה בצורת `StyleFormat` — בשביל „צור סגנון” ו„עדכן את הסגנון
 * כך שיתאים לבחירה”.
 *
 * שני מקורות, ושניהם כבר משרתים את הרצועה: מצב הפקודות (גופן, גודל, הדגשה,
 * נטייה, קו תחתון, צבע, יישור) ו-`readParagraphFormat` (ריווח והזחות, אותה
 * קריאה של דיאלוג „פסקה”). אין כאן מסלול שלישי למנוע.
 *
 * ערך שהמנוע אינו מדווח (בחירה מעורבת) נשאר חסר, ולכן **אינו** נכתב לסגנון —
 * עדיף סגנון שיורש גודל מבסיסו על סגנון שנועל גודל שאיננו יודעים.
 */
import type { CommandAdapter } from './command-adapter';
import type { ParagraphFormatSnapshot } from './paragraph-format';
import type { StyleAlignment, StyleFormat } from './docx-style-edit';
import { parseColor, parseFontFamily, parseFontSizePt } from './payloads';

export type SelectionStateSource = Pick<CommandAdapter, 'has' | 'getState'>;

const TWIPS_PER_PT = 20;
const TWIPS_PER_CM = 1440 / 2.54;
const ALIGNMENTS: readonly StyleAlignment[] = ['right', 'center', 'left', 'justify'];

const cm = (twips: number): number => Math.round((twips / TWIPS_PER_CM) * 100) / 100;

export function selectionStyleFormat(
  adapter: SelectionStateSource | null,
  paragraph: ParagraphFormatSnapshot | null,
): StyleFormat {
  const format: StyleFormat = {};

  if (adapter) {
    const state = (id: string) => (adapter.has(id) ? adapter.getState(id) : null);

    const family = parseFontFamily(state('font-family')?.value);
    if (family) format.fontFamily = family;
    const size = parseFontSizePt(state('font-size')?.value);
    if (size) format.fontSizePt = size;
    for (const [key, id] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline']] as const) {
      const active = state(id)?.active;
      if (typeof active === 'boolean') format[key] = active;
    }
    const color = parseColor(state('text-color')?.value);
    if (color) format.color = color.replace(/^#/, '').toUpperCase();
    const align = state('text-align')?.value;
    if (typeof align === 'string' && (ALIGNMENTS as readonly string[]).includes(align)) {
      format.alignment = align as StyleAlignment;
    }
  }

  if (paragraph) {
    format.spaceBeforePt = paragraph.spacing.beforeTwips / TWIPS_PER_PT;
    format.spaceAfterPt = paragraph.spacing.afterTwips / TWIPS_PER_PT;
    if (paragraph.spacing.rule === 'auto' && paragraph.spacing.lineTwips > 0) {
      format.lineSpacing = Math.round((paragraph.spacing.lineTwips / 240) * 100) / 100;
    }
    format.indentStartCm = cm(paragraph.indentation.leftTwips);
    format.indentEndCm = cm(paragraph.indentation.rightTwips);
    format.firstLineCm = paragraph.indentation.hangingTwips > 0
      ? -cm(paragraph.indentation.hangingTwips)
      : cm(paragraph.indentation.firstLineTwips);
  }

  return format;
}

/** ערכים שווים לצורך „האם השתנה” — מספרים בסבילות של עיגול היחידות. */
function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.011;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/** ערך שאינו מוצהר בשום רמה נקרא כברירת המחדל של Word לאותו שדה. */
const IMPLICIT: StyleFormat = {
  bold: false,
  italic: false,
  underline: false,
  spaceBeforePt: 0,
  spaceAfterPt: 0,
  lineSpacing: 1,
  indentStartCm: 0,
  indentEndCm: 0,
  firstLineCm: 0,
};

/**
 * רק מה שבאמת שונה מ-`baseline` — הטלאי שנכתב לסגנון. שדה ששווה לירושה אינו
 * נכתב, וכך סגנון שנוצר מהבחירה ממשיך לרשת מבסיסו כל מה שלא שונה בו.
 */
export function formatPatch(wanted: StyleFormat, baseline: StyleFormat): StyleFormat {
  const patch: StyleFormat = {};
  for (const key of Object.keys(wanted) as (keyof StyleFormat)[]) {
    const value = wanted[key];
    if (value === undefined) continue;
    const base = baseline[key] ?? IMPLICIT[key];
    if (!same(value, base)) (patch as Record<string, unknown>)[key] = value;
  }
  return patch;
}
