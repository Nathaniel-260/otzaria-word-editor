/**
 * בדיקת איות תורנית — הצד שאינו תלוי במנוע ואינו נוגע ב-DOM.
 *
 * ## למה מילון ייעודי ולא ה-`spellcheck` של הדפדפן
 *
 * הדפדפן מסמן כשגיאה כל ראשי תיבות תורניים — רש״י, אאמו״ר, ע״פ, זצ״ל — וזה
 * רוב אוצר המילים של מי שכותב חידושים. התוצאה היא מסמך מלא קווים אדומים
 * שאין בהם מידע. המילון כאן (`src/data/torah-dictionary.txt`, 102,465 ערכים)
 * נתרם ב-issue #25 ונבנה מטקסט תורני; המנגנון סביבו — נרמול, תחיליות
 * והתאמה — נלקח משם באותם שלושה כללים שנמדדו שם, וההצגה למטה.
 *
 * ## הייצוג: מחרוזת אחת ממוינת, וחיפוש בינארי בתוכה
 *
 * **לא `Set<string>`.** שני הייצוגים נמדדו על אותם 102,465 הערכים (Node 26,
 * `--expose-gc`, מדידת `heapUsed` לפני ואחרי):
 *
 * | ייצוג | RAM | בנייה | 21,000 שאילתות |
 * |---|---|---|---|
 * | `new Set(text.split('\n'))` | 5.66MB **בנוסף** למחרוזת | 15.6ms | 0.8ms |
 * | מחרוזת ממוינת + חיפוש בינארי | 1.43MB (המחרוזת עצמה) | 0ms | 6.5ms |
 *
 * כלומר: רבע מהזיכרון, בלי שלב בנייה בכלל — ובתמורה 0.3µs לשאילתה במקום
 * 0.04µs. השאילתה היא לא הצוואר כאן (המדידה של הסימון בעורך גדולה ממנה בשני
 * סדרי גודל, ראו `measureAllPageTextSegments` ב-engine/page-ruler.ts), ובעורך
 * שכבר פורס 16MB בעלייה רבע מהזיכרון הוא ההפרש שכן נראה.
 *
 * אין כאן מערך היסטים (`Int32Array`, עוד 410KB): כל צעד בחיפוש קופץ לאמצע
 * המחרוזת וחוזר אחורה ל-`\n` הקודם — לכל היותר 12 תווים, האורך המרבי בקובץ.
 *
 * המיון חייב להיות **לפי יחידות UTF-16** (`Array.prototype.sort` ללא
 * comparator), כי זו ההשוואה ש-`compareLine` למטה עושה. מיון לפי locale היה
 * שובר את החיפוש בשקט — הוא היה פשוט לא מוצא חלק מהערכים.
 *
 * ## מה **אינו** כאן
 *
 * הסימון בעורך. המימוש המקורי שממנו נלקח המנגנון החליף צמתים ב-DOM (עטיפת
 * מילים ב-`<mark>`), וזה בדיוק מה שאסור: ProseMirror מנהל את אותם צמתים,
 * והחלפה תחתיו נלחמת בו ומזיזה את הסמן תוך כדי הקלדה. `findMisspellings`
 * מחזירה **טווחים** בקואורדינטות הטקסט שנמסר, והציור הוא שכבה נפרדת מעל
 * המסמך (ui/shell/SpellingOverlay.vue) — אותה תבנית בדיוק כמו „גבולות
 * עמוד”, „מספרי שורות” ו„סימני עיצוב”.
 */

/** מפריד הערכים במחרוזת הארוזה. */
export const PACKED_SEPARATOR = '\n';

/**
 * תחיליות דקדוקיות. **זו לא אופטימיזציה — בלעדיה הבדיקה חסרת ערך.**
 *
 * שני הכיוונים נדרשים, ומדידה על טקסט תורני (issue #25) מראה כמה:
 *
 * - **הוספה** — המילון נבנה בהדבקת התחיליות על שורשים, והשורש החשוף לא תמיד
 *   נכנס כערך בפני עצמו. „שבת” נמצא רק דרך „ושבת”.
 * - **הסרה** — וההפך: „ועיין”, „שכתב”, „ותירצו” אינן ערכים, אבל „עיין”,
 *   „כתב” ו„תירצו” כן.
 *
 * הוספה בלבד נותנת 71.9% כיסוי על פסקאות תורניות לדוגמה; עם ההסרה — 94.7%.
 */
const PREFIXES = ['ד', 'ו', 'ב', 'כ', 'ל', 'מ', 'ה', 'ש'] as const;

/** אותן תחיליות כקבוצה — כולן בנות תו אחד, ולכן די בבדיקת התו הראשון. */
const PREFIX_CHARS: ReadonlySet<string> = new Set(PREFIXES);

/**
 * כמה תחיליות רצופות מותר להסיר. שתיים מכסות את „שה…” ו„וב…”; שלוש היו
 * מכשירות כמעט כל מחרוזת.
 */
const MAX_STRIPPED_PREFIXES = 2;

/**
 * מילה בת שתי אותיות אינה מפורקת: מה שנשאר ממנה הוא אות בודדת, וכל אות
 * בודדת שהיא ערך הייתה מכשירה הכול.
 */
const MIN_STEM_LENGTH = 3;

/** ניקוד וטעמים. מוסרים לפני ההשוואה — המילון אינו מנוקד. */
const DIACRITICS = /[֑-ׇ]/g;

/**
 * מילה עברית: אות עברית ואחריה אותיות, ניקוד, גרשיים וגרש.
 *
 * הגרשיים הם חלק מהמילה ולא גבול שלה — „רש״י” היא מילה אחת, וביטוי שמפצל
 * עליה היה מסמן שתי שגיאות במקום ערך מוכר אחד.
 */
const HEBREW_WORD = /[א-ת][א-ת֑-ׇ'"׳״‍]*/g;

/** מה ש-`normalizeWord` צריכה לגעת בו. מבחן זול שחוסך שתי החלפות על הרוב. */
const NEEDS_NORMALIZING = /[֑-ׇ׳״]/;

/** טווח של מילה שלא נמצאה במילון, ביחס לתחילת הטקסט שנמסר. */
export interface Misspelling {
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

export interface Dictionary {
  /** המילה כפי שהיא בטקסט — הנרמול והמטמון בפנים. */
  has(word: string): boolean;
  /**
   * הוספה למילון המשתמש. `false` = המילה כבר מוכרת (ישירות או דרך תחילית),
   * ואין מה לשמור.
   */
  addUserWord(word: string): boolean;
  /** מילון המשתמש בלבד, מנורמל וממוין — זה מה שנשמר ב-`storage`. */
  userWords(): readonly string[];
  /** מספר הערכים ברשימה הקבועה. לבדיקות ולדיווח. */
  readonly size: number;
}

/**
 * מנרמלת מילה לצורה שהמילון מחזיק: בלי ניקוד, ועם גרשיים ישרים.
 *
 * הגרשיים הטיפוגרפיים (״ ו-׳) הם מה שמקלדת עברית מייצרת, והמילון נכתב
 * בישרים. בלי האיחוד הזה כל ראשי התיבות היו מסומנים כשגיאה — כלומר בדיוק
 * המקרה שהמילון הזה קיים בשבילו.
 */
export function normalizeWord(word: string): string {
  if (!NEEDS_NORMALIZING.test(word)) return word;
  return word.replace(DIACRITICS, '').replace(/״/g, '"').replace(/׳/g, "'");
}

/**
 * אורזת רשימת מילים לצורה שה-`createDictionary` מצפה לה: ייחודיות, מיון לפי
 * יחידות UTF-16, וחיבור ב-`\n`. משמשת את תוסף הבנייה (vite.config.ts) ואת
 * הבדיקות — כדי ששתיהן יבנו את אותו דבר בדיוק.
 */
export function packWords(words: Iterable<string>): string {
  return [...new Set(words)].filter((word) => word.length > 0).sort().join(PACKED_SEPARATOR);
}

/**
 * השוואת השורה `[start, end)` שבמחרוזת הארוזה מול מילה, לפי יחידות UTF-16 —
 * בלי לחתוך מחרוזת משנה, כי זו הפעולה שרצה ~17 פעם לכל שאילתה.
 */
function compareLine(packed: string, start: number, end: number, word: string): number {
  const lineLength = end - start;
  const shared = lineLength < word.length ? lineLength : word.length;
  for (let i = 0; i < shared; i++) {
    const diff = packed.charCodeAt(start + i) - word.charCodeAt(i);
    if (diff !== 0) return diff;
  }
  return lineLength - word.length;
}

/** חיפוש בינארי על המחרוזת הארוזה. ראו הערת הראש — אין מערך היסטים. */
function packedHas(packed: string, word: string): boolean {
  let lo = 0;
  let hi = packed.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // תחילת השורה שבתוכה נפל `mid`. `lo` הוא תמיד תחילת שורה, ולכן קפיצה
    // אחורה שחצתה אותו פשוט נעצרת בו.
    let start = packed.lastIndexOf(PACKED_SEPARATOR, mid) + 1;
    if (start < lo) start = lo;
    let end = packed.indexOf(PACKED_SEPARATOR, start);
    if (end < 0) end = packed.length;

    const cmp = compareLine(packed, start, end, word);
    if (cmp === 0) return true;
    // כל צעד מזיז ממש אחד מהגבולות: `end + 1 > lo` ו-`start < hi` תמיד.
    if (cmp < 0) lo = end + 1;
    else hi = start;
  }
  return false;
}

/** כמה ערכים במחרוזת הארוזה — ספירת מפרידים, בלי להקצות את הערכים עצמם. */
function countWords(packed: string): number {
  if (packed.length === 0) return 0;
  let count = 1;
  for (let at = packed.indexOf(PACKED_SEPARATOR); at >= 0; at = packed.indexOf(PACKED_SEPARATOR, at + 1)) {
    count += 1;
  }
  return count;
}

/**
 * גודל מטמון התשובות. מילון קבוע ומסמך קבוע מחזירים את אותה תשובה, והסימון
 * נמדד מחדש בכל גלילה — בלי המטמון אותן ~500 מילים גלויות היו עוברות שוב את
 * כל 27 החיפושים בכל פריים. המכסה מגינה על שיחה ארוכה עם הרבה מסמכים; מסמך
 * שלם מכיל הרבה פחות מילים ייחודיות מזה.
 */
const CACHE_LIMIT = 20_000;

/**
 * בונה מילון מהמחרוזת הארוזה ומרשימת המשתמש.
 *
 * `user` נפרד מהרשימה הקבועה כדי שהוספה של המשתמש תישמר לבד ב-`storage`, בלי
 * להעתיק 102,465 ערכים.
 */
export function createDictionary(packed: string, user: Iterable<string> = []): Dictionary {
  const userSet = new Set<string>();
  for (const word of user) {
    const normalized = normalizeWord(word);
    if (normalized.length > 0) userSet.add(normalized);
  }

  const cache = new Map<string, boolean>();

  /** המילה כפי שהיא, או צורה שלה עם תחילית מודבקת. */
  const known = (word: string): boolean => {
    if (userSet.has(word) || packedHas(packed, word)) return true;
    for (const prefix of PREFIXES) {
      if (packedHas(packed, prefix + word)) return true;
    }
    return false;
  };

  const resolve = (word: string): boolean => {
    if (known(word)) return true;

    // והכיוון ההפוך: הסרת תחילית שכבר על המילה.
    let stem = word;
    for (let depth = 0; depth < MAX_STRIPPED_PREFIXES; depth++) {
      if (stem.length < MIN_STEM_LENGTH || !PREFIX_CHARS.has(stem[0]!)) break;
      stem = stem.slice(1);
      if (known(stem)) return true;
    }
    return false;
  };

  return {
    // ספירה ולא `split`: פיצול היה מקצה כאן 102,465 מחרוזות — בדיוק מה
    // שהייצוג הזה קיים כדי להימנע ממנו.
    size: countWords(packed),

    has(word) {
      const cached = cache.get(word);
      if (cached !== undefined) return cached;
      const result = resolve(normalizeWord(word));
      if (cache.size >= CACHE_LIMIT) cache.clear();
      cache.set(word, result);
      return result;
    },

    addUserWord(word) {
      const normalized = normalizeWord(word);
      // `resolve` ולא `userSet.has`: מילה שכבר מוכרת — גם דרך תחילית, וגם
      // מהרשימה הקבועה — אינה מסומנת ממילא, ורישום שלה היה מנפח את מה
      // שנשמר ב-`storage` בלי לשנות ולו סימון אחד.
      if (normalized.length === 0 || resolve(normalized)) return false;
      userSet.add(normalized);
      // התשובה „שגיאה” על המילה הזאת — ועל כל צורה מוטה שלה — כבר במטמון.
      cache.clear();
      return true;
    },

    userWords: () => [...userSet].sort(),
  };
}

/**
 * המילים בטקסט שאינן מוכרות למילון, עם המיקום שלהן.
 *
 * מחזירה טווחים ולא טקסט מסומן — ראו הערת הראש, „מה אינו כאן”.
 */
export function findMisspellings(text: string, dictionary: Dictionary): Misspelling[] {
  const found: Misspelling[] = [];
  HEBREW_WORD.lastIndex = 0;

  for (let match = HEBREW_WORD.exec(text); match !== null; match = HEBREW_WORD.exec(text)) {
    const word = match[0];
    if (dictionary.has(word)) continue;
    found.push({ word, start: match.index, end: match.index + word.length });
  }
  return found;
}
