/**
 * תיקון אוטומטי בהקלדה, כמו ב-Word: ההחלטה **מה** לתקן — טהורה ונבדקת ביחידה.
 * החיווט למנוע (קריאת הסמן, ההחלה, הביטול) ב-`autocorrect-install.ts`.
 *
 * ## הקלט: הטקסט שלפני הסמן, והסמן בסופו
 *
 * `planAutoCorrect` מקבלת את הטקסט מתחילת חלון ועד **הסמן עצמו**, ומחזירה
 * רשימת תיקונים בהיסטים יחסיים אליו. היא אינה יודעת דבר על המנוע, על בלוקים או
 * על היסטים במסמך — וזה מה שמאפשר לבדוק כל חוק על מחרוזת ולא על DOM.
 *
 * ## „מילה שהושלמה”: ההבדל בין חוק סמל לחוק מילה
 *
 * Word מתקן מילה רק כשהמשתמש **סיים** אותה — הקליד אחריה רווח או פיסוק. מילה
 * שהסמן עדיין נוגע בה אינה מתוקנת: `teh` באמצע ההקלדה היה הופך ל-`the` לפני
 * שנכתבה ה-`n` של `tehran`. לכן:
 *
 * - **חוק מילה** (דפוס שמתחיל או מסתיים באות או ספרה: `teh`, `1/2`, `c++`) —
 *   רק על מילה שאחריה רווח, או שאחרי ליבתה הוקלד סימן פיסוק (`teh,`).
 * - **חוק סמל** (דפוס שהתו הראשון **והאחרון** שלו אינם אות או ספרה: `(c)`,
 *   `...`, `-->`) — מיד כשהוא שלם. אין בו „המשך מילה” שעלול לשנות את משמעותו,
 *   וב-Word `(c)` הופך ל-© ברגע שנסגר. האות שבתוך `(c)` אינה הופכת אותו למילה:
 *   הסוגריים סוגרים אותו משני צדיו.
 *
 * ## חוקים שמסתכלים קדימה דורשים תו אחד אחריהם
 *
 * `א--ב` ו-`"` בין שתי אותיות עבריות נקבעים לפי **שני** הצדדים, ולכן אינם
 * מתקנים עד שהתו שאחריהם הוקלד. תו הגרש בסוף מילה (`ר'`) זקוק לתו שאחריו מאותה
 * סיבה: בלעדיו אי אפשר לדעת אם זו מילה שהסתיימה או הקלדה באמצע.
 *
 * ## למה אין כאן דבר על ביטול
 *
 * ‏Ctrl+Z מחזיר את הטקסט המקורי, ואז הסריקה הבאה הייתה מתקנת אותו שוב. מי שזוכר
 * מה בוטל הוא המתקין (`autocorrect-install.ts`), כי רק הוא יודע היסטים אבסולוטיים.
 * כאן כל קריאה היא מחדש.
 */

/** צמד „החלף” → „ב”. */
export interface AutoCorrectEntry {
  readonly from: string;
  readonly to: string;
}

export interface AutoCorrectOptions {
  /** המתג הראשי. כבוי = דבר אינו מתוקן. */
  readonly enabled: boolean;
  /** טבלת „החלף טקסט תוך כדי הקלדה”. */
  readonly replaceAsYouType: boolean;
  /** `--` ← `—`, ו-` -- ` ← ` – `. */
  readonly dashes: boolean;
  /** ` - ` בין שתי מילים ← ` – `. כבוי כברירת מחדל: מקף עם רווחים נפוץ בעברית. */
  readonly spacedHyphen: boolean;
  /** `"` בין שתי אותיות ← ״, ו-`'` אחרי אות ← ׳. */
  readonly gershayim: boolean;
  /** כ ← ך בסוף מילה, ו-ך ← כ באמצעה. */
  readonly finalLetters: boolean;
  /** `TWo` ← `Two`. */
  readonly twoInitialCaps: boolean;
  /** אות ראשונה גדולה בתחילת משפט לטיני. */
  readonly capitalizeSentences: boolean;
  /** `monday` ← `Monday`. */
  readonly capitalizeDays: boolean;
  readonly replacements: readonly AutoCorrectEntry[];
}

/** תיקון אחד, בהיסטים יחסיים לטקסט שנמסר. */
export interface AutoCorrectFix {
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly replacement: string;
  /** מזהה החוק — לבדיקות ולדיווח. */
  readonly rule: AutoCorrectRule;
}

export type AutoCorrectRule =
  | 'table'
  | 'dashes'
  | 'spaced-hyphen'
  | 'gershayim'
  | 'final-letters'
  | 'two-initial-caps'
  | 'capitalize-sentence'
  | 'capitalize-day';

/** מה שמגיע עם הטקסט ואינו ממנו. */
export interface AutoCorrectContext {
  /** הטקסט מתחיל בתחילת הבלוק — מילה ראשונה בו פותחת משפט. */
  readonly atBlockStart?: boolean;
}

export const DEFAULT_REPLACEMENTS: readonly AutoCorrectEntry[] = [
  { from: '(c)', to: '©' },
  { from: '(r)', to: '®' },
  { from: '(tm)', to: '™' },
  { from: '...', to: '…' },
  { from: '-->', to: '→' },
  { from: '<--', to: '←' },
  { from: '==>', to: '⇒' },
  { from: '<==', to: '⇐' },
  { from: '1/2', to: '½' },
  { from: '1/4', to: '¼' },
  { from: '3/4', to: '¾' },
];

/**
 * ברירות המחדל. כבויים בכוונה: האותיות הסופיות, הגרשיים והמקף עם רווחים — כולם
 * משנים טקסט עברי תקין לפי הנחה על הכוונה, ומי שכותב ר״ת או תעתיק יפגע מהם.
 * `capitalizeSentences` כבוי אף שב-Word הוא דלוק: מסמך עברי עם ציטוטים לטיניים
 * מלאי קיצורים (`vol.`, `p.`, `ibid.`) היה מקבל אות גדולה באמצע הפניה.
 */
export const DEFAULT_AUTOCORRECT: AutoCorrectOptions = {
  enabled: true,
  replaceAsYouType: true,
  dashes: true,
  spacedHyphen: false,
  gershayim: false,
  finalLetters: false,
  twoInitialCaps: true,
  capitalizeSentences: false,
  capitalizeDays: true,
  replacements: DEFAULT_REPLACEMENTS,
};

/* ------------------------------------------------------------------ */
/* נרמול ממה שנשמר                                                      */
/* ------------------------------------------------------------------ */

const MAX_ENTRIES = 500;
const MAX_FROM = 64;
const MAX_TO = 255;

/**
 * הגדרות מהאחסון → הגדרות תקינות.
 *
 * ערך פגום אינו סיבה להיכשל: הצורה שנשמרה נקראת כשדה-שדה, ושדה שאינו תקין נופל
 * לברירת המחדל שלו. רשומה שגויה בטבלה נזרקת **לבדה** ואינה מפילה את האחרות.
 */
export function normalizeAutoCorrect(raw: unknown): AutoCorrectOptions {
  if (raw === null || typeof raw !== 'object') return DEFAULT_AUTOCORRECT;
  const source = raw as Record<string, unknown>;

  const flag = (key: Exclude<keyof AutoCorrectOptions, 'replacements'>): boolean =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : DEFAULT_AUTOCORRECT[key];

  return {
    enabled: flag('enabled'),
    replaceAsYouType: flag('replaceAsYouType'),
    dashes: flag('dashes'),
    spacedHyphen: flag('spacedHyphen'),
    gershayim: flag('gershayim'),
    finalLetters: flag('finalLetters'),
    twoInitialCaps: flag('twoInitialCaps'),
    capitalizeSentences: flag('capitalizeSentences'),
    capitalizeDays: flag('capitalizeDays'),
    replacements: Array.isArray(source.replacements)
      ? normalizeEntries(source.replacements)
      : DEFAULT_REPLACEMENTS,
  };
}

/** רשומות תקינות בלבד, בלי כפילויות לפי „החלף”, ובתקרה. */
export function normalizeEntries(list: readonly unknown[]): AutoCorrectEntry[] {
  const seen = new Set<string>();
  const out: AutoCorrectEntry[] = [];
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue;
    const { from, to } = item as { from?: unknown; to?: unknown };
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    if (from.length === 0 || from.length > MAX_FROM || to.length > MAX_TO) continue;
    if (/[\r\n]/.test(from) || /[\r\n]/.test(to)) continue;
    // דפוס עם רווח בקצה לעולם אינו מתאים: מילה מוגדרת בין רווחים.
    if (from !== from.trim()) continue;
    if (seen.has(from)) continue;
    seen.add(from);
    out.push({ from, to });
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* עזרים                                                                */
/* ------------------------------------------------------------------ */

/** אות או ספרה. */
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * דפוס „סמל”: התו הראשון **והאחרון** שלו אינם אות או ספרה. `(c)` ו-`...` כן;
 * `teh`, `1/2` ו-`c++` לא (הם מתחילים באות או בספרה).
 *
 * הבדיקה על הקצוות ולא על כל התווים: בדיקה על כל הדפוס סיווגה את `(c)` כחוק
 * מילה בגלל האות שבתוכו, והוא חיכה לרווח שאחריו — בניגוד ל-Word, ש-`(c)` שלו
 * הופך ברגע שהסוגר נסגר (נתפס בבדיקת היחידה).
 */
function isSymbolPattern(pattern: string): boolean {
  const chars = [...pattern];
  return !HAS_WORD_CHAR.test(chars[0] ?? '') && !HAS_WORD_CHAR.test(chars[chars.length - 1] ?? '');
}

const LEADING_PUNCT = /^[("'[{“‘«<]+/u;
const TRAILING_PUNCT = /[.,;:!?)"'\]}”’»…>׃]+$/u;

interface Token {
  /** ההיסט של תחילת הטוקן (רצף של תווים שאינם רווח). */
  readonly start: number;
  /** תחילת הליבה, אחרי פיסוק פותח. */
  readonly coreStart: number;
  readonly coreEnd: number;
  readonly core: string;
  /** הליבה נסגרה: אחריה רווח או פיסוק. */
  readonly completed: boolean;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/\S+/gu)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const lead = raw.match(LEADING_PUNCT)?.[0].length ?? 0;
    const tail = raw.slice(lead).match(TRAILING_PUNCT)?.[0].length ?? 0;
    const core = raw.slice(lead, raw.length - tail);
    if (core.length === 0) continue;

    const tokenEnd = start + raw.length;
    tokens.push({
      start,
      coreStart: start + lead,
      coreEnd: start + lead + core.length,
      core,
      // רווח אחריה, או פיסוק שהוקלד אחרי הליבה. טוקן שהסמן נוגע בו — לא.
      completed: tokenEnd < text.length || tail > 0,
    });
  }
  return tokens;
}

/** אותיות גדולות/קטנות מהמקור עוברות להחלפה: `Teh` ← `The`, `TEH` ← `THE`. */
export function transferCase(original: string, pattern: string, replacement: string): string {
  if (original === pattern) return replacement;
  const letters = [...original].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return replacement;

  const upper = (char: string): boolean => char !== char.toLowerCase();
  if (letters.length > 1 && letters.every(upper)) return replacement.toUpperCase();
  if (upper(letters[0])) {
    const first = [...replacement][0] ?? '';
    return first.toUpperCase() + replacement.slice(first.length);
  }
  return replacement;
}

const HEBREW_LETTER = /[\u05D0-\u05EA]/u;
const NON_FINAL_TO_FINAL: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
const FINAL_TO_NON_FINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

const ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'ibid.', 'op.', 'cit.', 'mr.', 'mrs.', 'ms.', 'dr.',
  'prof.', 'no.', 'vol.', 'p.', 'pp.', 'ch.', 'fig.', 'st.', 'jr.', 'sr.',
]);

const DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

/* ------------------------------------------------------------------ */
/* החוקים                                                               */
/* ------------------------------------------------------------------ */

function tableFixes(text: string, tokens: readonly Token[], entries: readonly AutoCorrectEntry[]): AutoCorrectFix[] {
  const fixes: AutoCorrectFix[] = [];

  // חוקי סמל: מופע שלם בכל מקום, הארוך ראשון — `-->` לפני `--`.
  const symbols = entries
    .filter((entry) => isSymbolPattern(entry.from))
    .sort((a, b) => b.from.length - a.from.length);
  for (let index = 0; index < text.length; ) {
    const hit = symbols.find((entry) => text.startsWith(entry.from, index));
    if (hit) {
      fixes.push({
        start: index,
        end: index + hit.from.length,
        original: hit.from,
        replacement: hit.to,
        rule: 'table',
      });
      index += hit.from.length;
    } else {
      index += 1;
    }
  }

  // חוקי מילה: ליבת הטוקן שווה לדפוס, רק אחרי שהושלמה.
  const words = entries.filter((entry) => !isSymbolPattern(entry.from));
  if (words.length > 0) {
    const exact = new Map(words.map((entry) => [entry.from, entry.to]));
    // דפוס שיש בו אות גדולה מותאם בדיוק; דפוס באותיות קטנות מותאם בלי רגישות לרישיות.
    const folded = new Map(
      words.filter((entry) => entry.from === entry.from.toLowerCase()).map((entry) => [entry.from, entry.to]),
    );
    for (const token of tokens) {
      if (!token.completed) continue;
      const direct = exact.get(token.core);
      const to = direct ?? folded.get(token.core.toLowerCase());
      if (to === undefined) continue;
      const replacement = direct === undefined ? transferCase(token.core, token.core.toLowerCase(), to) : to;
      if (replacement === token.core) continue;
      fixes.push({
        start: token.coreStart,
        end: token.coreEnd,
        original: token.core,
        replacement,
        rule: 'table',
      });
    }
  }

  return fixes;
}

function dashFixes(text: string, spacedHyphen: boolean): AutoCorrectFix[] {
  const fixes: AutoCorrectFix[] = [];
  const push = (index: number, length: number, replacement: string, rule: AutoCorrectRule): void => {
    fixes.push({ start: index, end: index + length, original: text.slice(index, index + length), replacement, rule });
  };

  // `א--ב` ← em dash. חוסמים `-->` בכך שמצפים לאות/ספרה אחרי.
  for (const match of text.matchAll(/(?<=[\p{L}\p{N}])--(?=[\p{L}\p{N}])/gu)) {
    push(match.index ?? 0, 2, '—', 'dashes');
  }
  // `א -- ב` ← en dash.
  for (const match of text.matchAll(/(?<=[\p{L}\p{N}]) -- (?=[\p{L}\p{N}])/gu)) {
    push((match.index ?? 0) + 1, 2, '–', 'dashes');
  }
  if (spacedHyphen) {
    for (const match of text.matchAll(/(?<=[\p{L}\p{N}]) - (?=[\p{L}\p{N}])/gu)) {
      push((match.index ?? 0) + 1, 1, '–', 'spaced-hyphen');
    }
  }
  return fixes;
}

function gershayimFixes(text: string): AutoCorrectFix[] {
  const fixes: AutoCorrectFix[] = [];
  // גרשיים: בין שתי אותיות עבריות בלבד. מרכאות סוגרות אחרי רווח אינן נוגעות.
  for (const match of text.matchAll(/(?<=[\u05D0-\u05EA])"(?=[\u05D0-\u05EA])/gu)) {
    const index = match.index ?? 0;
    fixes.push({ start: index, end: index + 1, original: '"', replacement: '״', rule: 'gershayim' });
  }
  // גרש: אחרי אות עברית, כשיש תו אחריו (אות — ג'ירף, או כל דבר אחר — ר').
  for (const match of text.matchAll(/(?<=[\u05D0-\u05EA])'(?=[\s\S])/gu)) {
    const index = match.index ?? 0;
    fixes.push({ start: index, end: index + 1, original: "'", replacement: '׳', rule: 'gershayim' });
  }
  return fixes;
}

function finalLetterFixes(tokens: readonly Token[]): AutoCorrectFix[] {
  const fixes: AutoCorrectFix[] = [];
  for (const token of tokens) {
    if (!token.completed) continue;
    const letters = [...token.core];
    // רק מילה שכולה אותיות עבריות, ובאורך שתיים לפחות: אות בודדת היא קיצור.
    if (letters.length < 2 || !letters.every((letter) => HEBREW_LETTER.test(letter))) continue;

    letters.forEach((letter, index) => {
      const isLast = index === letters.length - 1;
      const target = isLast ? NON_FINAL_TO_FINAL[letter] : FINAL_TO_NON_FINAL[letter];
      if (!target) return;
      const at = token.coreStart + index;
      fixes.push({ start: at, end: at + 1, original: letter, replacement: target, rule: 'final-letters' });
    });
  }
  return fixes;
}

function capsFixes(
  text: string,
  tokens: readonly Token[],
  options: AutoCorrectOptions,
  context: AutoCorrectContext,
): AutoCorrectFix[] {
  const fixes: AutoCorrectFix[] = [];

  tokens.forEach((token, position) => {
    if (!token.completed) return;
    const { core } = token;
    const fix = (replacement: string, rule: AutoCorrectRule): void => {
      fixes.push({ start: token.coreStart, end: token.coreEnd, original: core, replacement, rule });
    };

    if (options.twoInitialCaps && /^[A-Z]{2}[a-z]+$/.test(core) && !/^[A-Z]{2}s$/.test(core)) {
      fix(core[0] + core.slice(1).toLowerCase(), 'two-initial-caps');
      return;
    }

    if (options.capitalizeDays && DAYS.has(core)) {
      fix(core[0].toUpperCase() + core.slice(1), 'capitalize-day');
      return;
    }

    if (options.capitalizeSentences && /^[a-z]/.test(core)) {
      const previous = tokens[position - 1];
      const opensSentence =
        previous === undefined
          ? context.atBlockStart === true && token.start === 0
          : startsSentenceAfter(text, previous);
      if (opensSentence) fix(core[0].toUpperCase() + core.slice(1), 'capitalize-sentence');
    }
  });

  return fixes;
}

/** האם הטוקן הקודם סיים משפט, ואינו קיצור או סימן רשימה. */
function startsSentenceAfter(text: string, previous: Token): boolean {
  // הסוף **בפועל** של הטוקן, כולל הפיסוק שאחרי הליבה.
  let end = previous.coreEnd;
  while (end < text.length && !/\s/u.test(text[end])) end += 1;
  const raw = text.slice(previous.start, end);
  if (!/[.!?]$/.test(raw)) return false;
  const lower = raw.toLowerCase();
  if (ABBREVIATIONS.has(lower)) return false;
  // „1.” ו-„a.” הם סימני רשימה, לא סוף משפט.
  if (/^[\p{N}]+[.)]$/u.test(raw) || /^[a-z][.)]$/i.test(raw)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* התכנון                                                               */
/* ------------------------------------------------------------------ */

/**
 * התיקונים לטקסט שלפני הסמן, ממוינים מההיסט הגבוה לנמוך — הסדר שבו מחילים אותם
 * כדי שהיסט שכבר חושב לא יזוז. תיקונים שחופפים: הראשון לפי עדיפות החוקים מנצח.
 */
export function planAutoCorrect(
  text: string,
  options: AutoCorrectOptions,
  context: AutoCorrectContext = {},
): AutoCorrectFix[] {
  if (!options.enabled || text.length === 0) return [];

  const tokens = tokenize(text);
  const candidates: AutoCorrectFix[] = [];

  if (options.replaceAsYouType) candidates.push(...tableFixes(text, tokens, options.replacements));
  if (options.dashes || options.spacedHyphen) {
    candidates.push(...dashFixes(text, options.spacedHyphen).filter((fix) => options.dashes || fix.rule === 'spaced-hyphen'));
  }
  if (options.gershayim) candidates.push(...gershayimFixes(text));
  if (options.finalLetters) candidates.push(...finalLetterFixes(tokens));
  if (options.twoInitialCaps || options.capitalizeDays || options.capitalizeSentences) {
    candidates.push(...capsFixes(text, tokens, options, context));
  }

  // בחירה לפי הסדר שבו החוקים נוספו (= עדיפות), ודילוג על כל מה שחופף.
  const chosen: AutoCorrectFix[] = [];
  for (const candidate of candidates) {
    if (candidate.original === candidate.replacement) continue;
    const overlaps = chosen.some((fix) => candidate.start < fix.end && fix.start < candidate.end);
    if (!overlaps) chosen.push(candidate);
  }

  return chosen.sort((a, b) => b.start - a.start);
}
