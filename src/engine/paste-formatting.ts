/**
 * אפשרויות ההדבקה של Word: „שמור על עיצוב המקור”, „מזג עיצוב” ו„שמור טקסט
 * בלבד”.
 *
 * ## מה המנוע נותן, ולמה זה לא מספיק
 *
 * `clipboard.insert` מקבל `formattingMode: 'match-destination'`, והחוזה מתאר
 * אותו כ„paste-and-match-style”. נמדד מול המנוע האמיתי (Chrome על ה-dist
 * הארוז, superdoc 2.20), עם HTML שנושא
 * Arial 20 אדום, מודגש, נטוי, קו תחתון, סימון, יישור למרכז וכותרת:
 *
 * | מצב | מה נכתב ל-OOXML |
 * |---|---|
 * | `preserve-source` | הכול: `rFonts`, `sz`, `color`, `b`/`i`/`u`, `highlight`, `jc`, `Heading1` |
 * | `match-destination` | **שום** `rPr` — גם `b`, `i` ו-`u` נמחקו |
 *
 * כלומר `match-destination` הוא „שמור טקסט בלבד”, ולא „מזג עיצוב”: ב-Word
 * המיזוג מוותר על רוב העיצוב הישיר של המקור, אבל **שומר את ההדגשות** —
 * מודגש, נטוי, קו תחתון — כשהן חלות רק על חלק מהטקסט.
 *
 * ויש פער שני, בשני המצבים: היעד היה ריצה ב-David 18 כחול, והטקסט שהודבק
 * לידה יצא **בלי עיצוב בכלל** — כלומר בסגנון הפסקה, ולא כמו הטקסט שסביבו.
 * ב-Word גם „מזג” וגם „טקסט בלבד” מאמצים את עיצוב נקודת ההדבקה — בדיוק כמו
 * הקלדה. בעורך עברי זה המקרה הנפוץ: מסמך שבו המשתמש סימן הכול וקבע David 14
 * הוא מסמך שכל עיצובו ישיר.
 *
 * ## מה המודול עושה במקום
 *
 * את שני השלבים בעצמו, על ה-fragment שה-`parse` של המנוע כבר בנה, ואז מוסר
 * אותו ל-`insert` במצב `preserve-source` — המצב שנמדד ככותב בדיוק את מה
 * שב-fragment:
 *
 * 1. **ניקוי המקור** (`mergeFragment`, `textOnlyFragment`). נמדד שפסקה
 *    שהוסרו ממנה `styleRef`/`paragraphProps`/`pPrXml` יורשת את סגנון פסקת
 *    היעד — שם הסמן היה — כמו ב-Word.
 * 2. **עיצוב היעד** (`destinationMarks`) נכתב על כל ריצה, וההדגשות של המקור
 *    מעליו.
 *
 * ## למה עיצוב היעד נקרא מהפקודות, ולמה מושווה לברירות המחדל
 *
 * שלושה משטחים נבדקו כמקור ל„עיצוב שבסמן”, ושניים נפסלו במדידה:
 *
 * - `getNodeById` / `find` עם `includeResolved` — ה-`run` חוזר בלי `props`
 *   בכלל, ואף מאחד ריצה מודגשת ולא-מודגשת לריצה אחת.
 * - `query.match` בתוך הבלוק — `items: []` גם על טקסט שקיים בו.
 * - **`ui.commands`** — עונה, ומיד: `font-family`, `font-size`, `text-color`
 *   ו-`highlight-color` כערכים, ו-`bold`/`italic`/`underline`/`strikethrough`
 *   כ-`active`. זה גם מה שהרצועה מציגה למשתמש, ולכן „עיצוב היעד” כאן הוא
 *   בדיוק מה שהוא רואה בבורר הגופן ובבורר הגודל.
 *
 * אבל הערכים שם **אפקטיביים** ולא ישירים: על טקסט שלא עוצב כלל נמדד
 * `Arial`, `12`, `#000000`. לכתוב אותם כעיצוב ישיר היה עיוור לעברית — המנוע
 * כותב משפחת גופן גם ל-`w:rFonts@cs`, ומסמך שבו הכתב המורכב מוגדר בגופן אחר
 * (David לעברית ו-Times לאנגלית, צירוף שכיח במסמכי Word) היה מקבל טקסט עברי
 * בגופן הלטיני. לכן גופן וגודל נכתבים רק כשהם **שונים מברירת המחדל של
 * המסמך** (`docDefaults`, ר' `readDocRunDefaults` ב-doc-style-defaults.ts), וצבע רק כשאינו
 * שחור. מה שנשאר הוא בדיוק מה שנקבע במסמך במפורש — ומה שאינו נכתב יורש את
 * אותו ערך ממילא.
 */

/* ------------------------------------------------------------------ */
/* צורת ה-fragment כפי שהמודול צורך אותה                               */
/* ------------------------------------------------------------------ */

/**
 * הטיפוסים מוגדרים כאן ולא מיובאים: הם יושבים תחת
 * `superdoc/dist/document-api/...`, ו-import מנתיב פנימי אסור
 * (tests/unit/engine-boundaries). רק השדות שהמודול נוגע בהם מוצהרים; כל השאר
 * עובר הלאה כמות שהוא, ב-spread.
 */
export interface PasteRunMarks {
  bold?: boolean;
  boldCs?: boolean;
  italic?: boolean;
  italicCs?: boolean;
  underline?: boolean;
  strike?: boolean;
  caps?: boolean;
  smallCaps?: boolean;
  color?: string;
  highlight?: string;
  fontSizePt?: number;
  fontSizeCsPt?: number;
  fontFamily?: string;
  verticalAlign?: 'baseline' | 'superscript' | 'subscript';
}

interface PasteText {
  text: string;
  marks?: PasteRunMarks;
  [key: string]: unknown;
}

type PasteInline =
  | ({ kind: 'text' } & PasteText)
  | { kind: 'hyperlink'; inlines: readonly PasteInline[]; [key: string]: unknown }
  | { kind: string; [key: string]: unknown };

export interface PasteParagraph {
  kind: 'paragraph' | 'heading';
  runs: readonly PasteText[];
  inlines?: readonly PasteInline[];
  [key: string]: unknown;
}

interface PasteTableCell {
  blocks: readonly PasteParagraph[];
  [key: string]: unknown;
}

interface PasteTable {
  kind: 'table';
  rows: readonly { cells: readonly PasteTableCell[]; [key: string]: unknown }[];
  [key: string]: unknown;
}

export type PasteBlock = PasteParagraph | PasteTable | { kind: string; [key: string]: unknown };

export interface PasteFragment {
  blocks: readonly PasteBlock[];
  [key: string]: unknown;
}

/** שלוש האפשרויות, בשמות של Word. */
export type PasteMode = 'keep-source' | 'merge' | 'text-only';

export const PASTE_MODES: readonly PasteMode[] = ['keep-source', 'merge', 'text-only'];

export function isPasteMode(value: unknown): value is PasteMode {
  return typeof value === 'string' && (PASTE_MODES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* ההדגשות                                                            */
/* ------------------------------------------------------------------ */

/**
 * מה ש„מזג עיצוב” משאיר מהמקור.
 *
 * מודגש, נטוי וקו תחתון הם הרשימה ש-Word עצמו נוקב בה („formatting that is
 * considered emphasis”). `boldCs`/`italicCs` הם אותה הדגשה במחסנית הכתב
 * המורכב — ריצה עברית שהגיעה מ-Word מודגשת דרכם. כתב עילי ותחתי נשמרים כי
 * הם משמעות ולא מראה: `m²` שמאבד את ה-`²` הוא טקסט אחר.
 *
 * קו חוצה, אותיות רישיות, צבע, סימון, גופן וגודל — אינם. אלה המראה של המקור,
 * וזה בדיוק מה שהמשתמש ביקש להשאיר מאחור.
 */
const EMPHASIS = ['bold', 'boldCs', 'italic', 'italicCs', 'underline'] as const;
type Emphasis = (typeof EMPHASIS)[number];

function emphasisOf(marks: PasteRunMarks | undefined, dropped: ReadonlySet<Emphasis>): PasteRunMarks {
  const kept: PasteRunMarks = {};
  if (!marks) return kept;
  for (const key of EMPHASIS) {
    if (marks[key] === true && !dropped.has(key)) kept[key] = true;
  }
  if (marks.verticalAlign === 'superscript' || marks.verticalAlign === 'subscript') {
    kept.verticalAlign = marks.verticalAlign;
  }
  return kept;
}

/** כל ריצות הטקסט ב-fragment, כולל בתוך קישורים ותאי טבלה. */
function* textRuns(blocks: readonly PasteBlock[]): Generator<PasteText> {
  for (const block of blocks) {
    if (block.kind === 'table') {
      for (const row of (block as PasteTable).rows ?? []) {
        for (const cell of row.cells ?? []) yield* textRuns(cell.blocks ?? []);
      }
      continue;
    }
    if (block.kind !== 'paragraph' && block.kind !== 'heading') continue;
    const paragraph = block as PasteParagraph;
    // `inlines` הוא הייצוג המלא כשהוא קיים, ו-`runs` הוא השטוח שלו. שניהם
    // נושאים את אותו טקסט, ולכן נספרים מאחד מהם בלבד.
    if (Array.isArray(paragraph.inlines)) {
      for (const inline of paragraph.inlines) {
        if (inline.kind === 'text') yield inline as PasteText;
        else if (inline.kind === 'hyperlink') {
          for (const inner of (inline as { inlines: readonly PasteInline[] }).inlines ?? []) {
            if (inner.kind === 'text') yield inner as PasteText;
          }
        }
      }
    } else {
      yield* paragraph.runs ?? [];
    }
  }
}

/**
 * ההדגשות שחלות על **כל** הטקסט שהודבק, ולכן נזרקות.
 *
 * זו ההבחנה של Word: הדגשה נשמרת „when it is applied to only a portion of the
 * selection”. כותרת מודגשת שהועתקה כולה אינה הדגשה בתוך טקסט אלא המראה של
 * הפסקה במקור — וזה מה שהמיזוג מוותר עליו. מילה מודגשת בתוך משפט היא הדגשה,
 * והיא נשארת.
 *
 * ריצות של רווחים בלבד אינן מכריעות: רווח בין שתי מילים מודגשות אינו מודגש
 * לרוב, וזה לא הופך את המשפט ל„מודגש בחלקו”.
 */
function uniformEmphasis(blocks: readonly PasteBlock[]): Set<Emphasis> {
  const uniform = new Set<Emphasis>(EMPHASIS);
  let any = false;
  for (const run of textRuns(blocks)) {
    if (typeof run.text !== 'string' || run.text.trim() === '') continue;
    any = true;
    for (const key of EMPHASIS) {
      if (run.marks?.[key] !== true) uniform.delete(key);
    }
  }
  return any ? uniform : new Set();
}

/* ------------------------------------------------------------------ */
/* בניית ה-fragment                                                   */
/* ------------------------------------------------------------------ */

/** שדות של בלוק פסקה שהם עיצוב המקור, ולא תוכן. */
const PARAGRAPH_FORMATTING = ['styleRef', 'semanticStyleRole', 'paragraphProps', 'pPrXml'] as const;

/** שדות של רשימה. נשמרים במיזוג ונזרקים ב„טקסט בלבד”. */
const LIST_FIELDS = ['numbering', 'listIntent', 'listItemContinuationLevel'] as const;

interface Rewrite {
  marks: (source: PasteRunMarks | undefined) => PasteRunMarks;
  keepLists: boolean;
}

function withoutKeys<T extends Record<string, unknown>>(object: T, keys: readonly string[]): T {
  const copy: Record<string, unknown> = { ...object };
  for (const key of keys) delete copy[key];
  return copy as T;
}

function rewriteText<T extends PasteText>(run: T, rewrite: Rewrite): T {
  const marks = rewrite.marks(run.marks);
  const { marks: _source, ...rest } = run;
  return (Object.keys(marks).length > 0 ? { ...rest, marks } : rest) as T;
}

function rewriteInline(inline: PasteInline, rewrite: Rewrite): PasteInline {
  if (inline.kind === 'text') return rewriteText(inline as PasteText & { kind: 'text' }, rewrite);
  if (inline.kind === 'hyperlink') {
    const link = inline as { kind: 'hyperlink'; inlines: readonly PasteInline[] };
    return { ...link, inlines: (link.inlines ?? []).map((inner) => rewriteInline(inner, rewrite)) };
  }
  return inline;
}

/**
 * פסקה, בלי עיצוב המקור שלה.
 *
 * כותרת הופכת לפסקה: „כותרת 1” של המקור היא סגנון, והמיזוג מאמץ את סגנון
 * היעד. `level` נזרק יחד עם `kind` — הוא שדה של כותרת בלבד.
 */
function rewriteParagraph(block: PasteParagraph, rewrite: Rewrite): PasteParagraph {
  const dropped = [...PARAGRAPH_FORMATTING, ...(rewrite.keepLists ? [] : LIST_FIELDS), 'level'];
  const base = withoutKeys(block, dropped);
  return {
    ...base,
    kind: 'paragraph',
    runs: (block.runs ?? []).map((run) => rewriteText(run, rewrite)),
    ...(Array.isArray(block.inlines)
      ? { inlines: block.inlines.map((inline) => rewriteInline(inline, rewrite)) }
      : {}),
  };
}

/**
 * טבלה נשארת טבלה — המבנה הוא תוכן. מה שנזרק הוא עיצוב התאים (צבע מילוי,
 * ריפוד) ועיצוב הפסקאות שבתוכם; `gridSpan` הוא מבנה ונשאר.
 */
function rewriteTable(block: PasteTable, rewrite: Rewrite): PasteTable {
  return {
    ...block,
    rows: (block.rows ?? []).map((row) => ({
      ...row,
      cells: (row.cells ?? []).map((cell) => ({
        ...withoutKeys(cell, ['shadingColor', 'padding']),
        blocks: (cell.blocks ?? []).map((paragraph) => rewriteParagraph(paragraph, rewrite)),
      })),
    })),
  };
}

function rewriteFragment<T extends PasteFragment>(fragment: T, rewrite: Rewrite): T {
  const blocks = (fragment.blocks ?? []).map((block): PasteBlock => {
    if (block.kind === 'paragraph' || block.kind === 'heading') {
      return rewriteParagraph(block as PasteParagraph, rewrite);
    }
    if (block.kind === 'table') return rewriteTable(block as PasteTable, rewrite);
    // קו אופקי ושאר הבלוקים שאין בהם עיצוב תווים — כמות שהם.
    return block;
  });
  return { ...fragment, blocks };
}

/**
 * „מזג עיצוב”: עיצוב היעד, וההדגשות של המקור מעליו.
 *
 * הסדר הוא ההכרעה: הדגשה של המקור **מוסיפה** על היעד ואינה מוחקת ממנו. טקסט
 * רגיל שהודבק לתוך משפט מודגש יוצא מודגש — כמו הקלדה באותו מקום.
 */
export function mergeFragment<T extends PasteFragment>(fragment: T, destination: PasteRunMarks): T {
  const dropped = uniformEmphasis(fragment.blocks ?? []);
  return rewriteFragment(fragment, {
    marks: (source) => ({ ...destination, ...emphasisOf(source, dropped) }),
    keepLists: true,
  });
}

/**
 * „שמור טקסט בלבד”: עיצוב היעד בלבד. הרשימות נזרקות — ב-Word הן הופכות
 * לפסקאות רגילות.
 *
 * תמונות נזרקות כבר לפני כן, בבחירת הפריטים מהלוח (`textOnlyPayload` ב-
 * clipboard.ts), ולכן fragment שנבנה מ-`text/plain` אינו נושא אותן.
 */
export function textOnlyFragment<T extends PasteFragment>(fragment: T, destination: PasteRunMarks): T {
  return rewriteFragment(fragment, { marks: () => ({ ...destination }), keepLists: false });
}

/* ------------------------------------------------------------------ */
/* עיצוב היעד                                                         */
/* ------------------------------------------------------------------ */

/** מה שנקרא בסמן — הערכים שהרצועה מציגה. `undefined` = לא ידוע. */
export interface CaretFormat {
  fontFamily?: string | null;
  fontSizePt?: number | null;
  color?: string | null;
  highlight?: string | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/** ברירות המחדל של המסמך (`docDefaults`), לפי ערוץ. */
export interface DocumentRunDefaults {
  fontFamilies: readonly string[];
  fontSizesPt: readonly number[];
}

const AUTO_COLOR = '#000000';

/**
 * שש-עשרה צבעי הסימון של Word (`ST_HighlightColor`), לפי ה-hex שהרצועה מדווחת.
 *
 * נמדד: `highlight: 'yellow'` ב-fragment נכתב כ-`<w:highlight w:val="yellow"/>`,
 * ו-`'#FFFF00'` — כ-`<w:shd w:fill="FFFF00"/>`, כלומר **הצללה**. על המסך הם
 * זהים, אבל ב-Word „צבע סימון טקסט” אינו מזהה הצללה, ו„ללא צבע” אינו מסיר
 * אותה. לכן סימון שהוא אחד מהצבעים האלה נשלח בשמו — כמו שה-`parse` של המנוע
 * עצמו שולח אותו. צבע אחר נשאר hex: הצללה באותו צבע היא הקרוב ביותר שיש.
 */
const HIGHLIGHT_NAMES: Record<string, string> = {
  '#FFFF00': 'yellow',
  '#00FF00': 'green',
  '#00FFFF': 'cyan',
  '#FF00FF': 'magenta',
  '#0000FF': 'blue',
  '#FF0000': 'red',
  '#000080': 'darkBlue',
  '#008080': 'darkCyan',
  '#008000': 'darkGreen',
  '#800080': 'darkMagenta',
  '#800000': 'darkRed',
  '#808000': 'darkYellow',
  '#808080': 'darkGray',
  '#C0C0C0': 'lightGray',
  '#000000': 'black',
  '#FFFFFF': 'white',
};

function sameFamily(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * העיצוב שהטקסט המודבק מקבל מנקודת ההדבקה.
 *
 * ההנמקה המלאה בראש הקובץ; בקצרה — הערכים שהמנוע מדווח אפקטיביים, ולכן
 * נכתבים רק מה שאינו ברירת המחדל של המסמך. כשברירות המחדל אינן ידועות
 * (`defaults` חסר), גופן וגודל **אינם** נכתבים: עדיף טקסט שיורש מהפסקה על
 * פני גופן לטיני שנכפה על עברית.
 *
 * הגודל נכתב לשני הערוצים יחד. הטקסט שהרצועה מציגה כגודל הוא הגודל של מה
 * שהמשתמש רואה, ו-`szCs` שנשאר מאחור היה מציג ב-Word עברית בגודל אחר מזה
 * שבעורך.
 */
export function destinationMarks(
  caret: CaretFormat,
  defaults: DocumentRunDefaults | null,
): PasteRunMarks {
  const marks: PasteRunMarks = {};

  const family = caret.fontFamily?.trim();
  if (family && defaults && !defaults.fontFamilies.some((known) => sameFamily(known, family))) {
    marks.fontFamily = family;
  }

  const size = caret.fontSizePt;
  if (typeof size === 'number' && size > 0 && defaults && !defaults.fontSizesPt.includes(size)) {
    marks.fontSizePt = size;
    marks.fontSizeCsPt = size;
  }

  const color = caret.color?.toUpperCase();
  if (color && /^#[0-9A-F]{6}$/.test(color) && color !== AUTO_COLOR) marks.color = color;

  const highlight = caret.highlight?.toUpperCase();
  if (highlight && /^#[0-9A-F]{6}$/.test(highlight)) marks.highlight = HIGHLIGHT_NAMES[highlight] ?? highlight;

  if (caret.bold) marks.bold = true;
  if (caret.italic) marks.italic = true;
  if (caret.underline) marks.underline = true;
  if (caret.strikethrough) marks.strike = true;

  return marks;
}
