/**
 * מה שהמנוע צייר, כמקור מידע: עמודים, פסקאות, שורות, והתיבה של כל תו.
 *
 * המנוע מצייר את המסמך ל-DOM אמיתי ותולה על כל אלמנט את טווח ה-pm שלו, ולכן
 * אפשר לקרוא מכאן **איפה כל דבר נמצא** בלי לדעת דבר על המודל הפנימי שלו. זו
 * התשתית של כל עקיפת סמן בריפו: היא חייבת להחליט **בתוך** ה-keydown לאן הסמן
 * צריך לזוז, וכל מקור מידע א-סינכרוני של המנוע מגיע מאוחר מדי.
 *
 * ## מה כאן ומה לא
 *
 * כאן — **עובדות** על מה שצויר: איזה fragment, איזו שורה, מי השכן, מה טווח
 * ה-pm של כל אחד, איפה מצוירת כל גרפמה, ובאיזה כיוון. שם — ב-`rtl-caret.ts`
 * וב-`rtl-vertical-caret.ts` — **מדיניות**: מה מקש מסוים צריך לעשות עם
 * העובדות האלה, ומתי לוותר ולמסור למנוע.
 *
 * הגבול הזה אינו קוסמטי. הכללים כאן נמדדו אחד-אחד מול המנוע — פסקה שנחצית בין
 * עמודים, פסקה ריקה שתופסת pm נוסף, טבלה בלי מזהה מקור, עמוד שלא צויר, תפר
 * דו-כיווני שיש לו שני בתים, אשכול גרפמה שאסור להיכנס לתוכו — וכל צרכן שמנחש
 * אותם מחדש מגלה אותם שוב דרך באג. ההסברים והמדידות נשארו צמודים לכל פונקציה,
 * כפי שנכתבו כשנמדדו.
 *
 * ## למה לא הכול
 *
 * ‏`rtl-line-end.ts` (מקש `End`) קדם לשני האחרים ומחזיק קורא משלו, מצומצם
 * יותר. הוא **לא** הוסב לכאן בכוונה: הוא יציב, מגודר בשער משלו, ואין בו באג —
 * והסבה היא סיכון בלי תמורה. אם יתווסף לו פער, זה המקום להסב אליו.
 */

/** תו מצויר אחד: ההיסט שלו (ב-pm של המנוע) והתיבה שלו על המסך. */
export interface PaintedChar {
  pm: number;
  left: number;
  right: number;
  /** אשכול הגרפמה עצמו — אות ואיתה הניקוד והטעמים שלה. חסר בטאב, שאין לו טקסט. */
  ch?: string;
  /**
   * כמה יחידות UTF-16 האשכול תופס. חסר = 1; ‏3 ב-„שָׁ”, 2 באימוג'י —
   * ההסבר ב-`readLineChars`.
   */
  units?: number;
}

/** יחידות ה-UTF-16 של התו. ראו `PaintedChar.units`. */
const unitsOf = (c: PaintedChar): number => c.units ?? 1;

/** מקום חוקי לסמן: ההיסט וה-x שבו הוא מצויר. */
export interface CaretSlot {
  pm: number;
  x: number;
}

/**
 * שתי תיבות נחשבות נוגעות עד לסף הזה. הן נמדדו נוגעות **בדיוק** (הפרש 0),
 * והסף קיים רק בשביל עיגול של תת-פיקסל.
 */
const TOUCH = 0.6;

/**
 * מערכות כתב שנקראות מימין לשמאל. אות שלהן היא R או AL ב-UBA.
 */
const RTL_SCRIPT =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;

/** ספרה — EN או AN ב-UBA, ובשני המקרים נקראת משמאל לימין גם בשורה עברית. */
const DIGIT = /\p{Nd}/u;

/** אות — כולל סימני ניקוד שמצטרפים לאות (Other_Alphabetic). */
const LETTER = /\p{Alphabetic}/u;

/**
 * האם הדפדפן מסדר את התו הזה משמאל לימין גם בתוך שורה עברית.
 *
 * ספרה, או אות שאינה ממערכת כתב ימנית — כן. סימן — לא: ב-UBA הוא ניטרלי (ON),
 * הדפדפן מצייר אותו בכיוון הפסקה, ושני התפרים שלו נמצאים ב-x שונה — זו
 * אינה הנקודה העיוורת שלמטה, וקיפול שלהם מוחק מקום נגיש. נמדד: ב-„שלוש × ארבע” ההיסטים
 * 5 ו-6 מצוירים ב-1008.5 ו-999.4, וסיווג של × כלועזי הקפיץ את החץ מ-4 ישר ל-7.
 */
function isLtrIntrinsic(ch: string): boolean {
  if (ch === '') return false;
  return DIGIT.test(ch) || (LETTER.test(ch) && !RTL_SCRIPT.test(ch));
}

/**
 * הכיוון של כל תו.
 *
 * `true` = התו שייך לקטע ימין-לשמאל. הכיוון נגזר מהגאומטריה: שני תווים עוקבים
 * שהתיבות שלהם נוגעות שייכים לאותו קטע, והצד שבו הן נוגעות הוא הכיוון. תו
 * שאין לו שכן צמוד משני צדדיו — למשל רווח שמפריד בין עברית לאי לטיני, או
 * טאב — נופל לכיוון השורה.
 *
 * ## אי של תו אחד
 *
 * לגאומטריה יש נקודה עיוורת אחת: ספרה או אות לטינית **בודדת** בין שני תווים
 * עבריים („סעיף 3 בחוק”, „אות a אחת”) נוגעת בשכניה בדיוק כמו תו עברי, כי אין
 * לה שכן לטיני שיגלה את הכיוון שלה. היא סווגה כעברית, שני התפרים שלה נשארו
 * יעדים, והמנוע מצייר את שניהם באותו x — ולכן כל הקשה החזירה את הסמן לתפר
 * השני ולא עברה את התו (נמדד: „3” ב-[1005, 1013], והיסטים 5 ו-6 מצוירים שניהם
 * ב-1005; „a” ב-[1012.1, 1019.2], ו-4 ו-5 שניהם ב-1019.2). כשהגאומטריה אינה
 * מראה צמידות לטינית, התו עצמו מכריע.
 */
export function charDirections(chars: readonly PaintedChar[], lineRtl: boolean): boolean[] {
  const dirs: (boolean | null)[] = new Array(chars.length).fill(null);

  for (let i = 0; i + 1 < chars.length; i += 1) {
    const a = chars[i]!;
    const b = chars[i + 1]!;
    let rtl: boolean | null = null;
    if (Math.abs(b.left - a.right) < TOUCH) rtl = false;
    else if (Math.abs(a.left - b.right) < TOUCH) rtl = true;
    if (rtl === null) continue;
    if (dirs[i] === null) dirs[i] = rtl;
    dirs[i + 1] = rtl;
  }

  return dirs.map((value, i) => {
    if (value !== false && isLtrIntrinsic(chars[i]!.ch ?? '')) return false;
    return value ?? lineRtl;
  });
}

/**
 * כל המקומות שהסמן רשאי לעצור בהם בשורה, בלי אלה שיושבים על תפר.
 *
 * הסמן בהיסט o יושב על ה**קצה המוביל** של התו שבהיסט o — שמאל לתו לטיני,
 * ימין לתו עברי — ובסוף השורה על הקצה הנגרר של האחרון. היסט שהכיוון משתנה
 * בו מושמט; ההסבר בהערת הפתיחה.
 *
 * ## ושני קצות השורה **אינם** תפר — נמדד
 *
 * הדילוג חל על היסט שיש לו שני בתים, ולכאורה גם קצה של שורה שמתחילה או
 * נגמרת באי לועזי הוא כזה: מעבר לתו הראשון ולאחרון עומדת הפסקה, שכיוונה
 * הפוך. נמדד בשער (`check:arrows`, 17.9.2026) שזה **לא** המצב — המנוע מצייר
 * שם את הבית של **התו**, בדיוק מה שמחושב כאן:
 *
 *   • „ABC מילה כאן” (פסקה `w:bidi`, האי בקצה הימני ‏[1010.5 … 1043.3]):
 *     היסט 0 מצויר ב-**1010.5**, כלומר בקצה השמאלי של `A` — ולא בתחילת
 *     הפסקה שמימין. ההליכה שלמה: ‏…4@1006.4 → 0@1010.5 → 1@1022, וההפוכה
 *     ‏3@1043.3 → 2@1032.7 → 1@1022 → 0@1010.5 → 4@1006.4.
 *   • „לפני הטבלה 4” (הספרה בקצה השמאלי, ‏[967 … 975.4]): היסט הסיום 12
 *     מצויר ב-**975.4**, הקצה הימני של הספרה — ולא בקצה השמאלי של השורה.
 *     ‏12@975.4 → 10@979.4 → 9@986.9, בלי צעד לכיוון ההפוך.
 *
 * דילוג על החריצים האלה היה **מוחק** מקום נגיש שהמנוע מצייר נכון: לפי אותן
 * תיבות שנמדדו, בלי החריץ 0@1010.5 ההקשה מ-4@1006.4 הייתה נוחתת על 1@1022 —
 * כלומר מעל „A” כולו (גזירה מהמדידה, לא ריצה נוספת). לכן התו הראשון אינו
 * נבדק מול קודמו, וחריץ הסיום נפלט תמיד.
 */
export function caretSlots(chars: readonly PaintedChar[], lineRtl: boolean): CaretSlot[] {
  if (!chars.length) return [];
  const dirs = charDirections(chars, lineRtl);
  const slots: CaretSlot[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    if (i > 0 && dirs[i] !== dirs[i - 1]) continue;
    const c = chars[i]!;
    slots.push({ pm: c.pm, x: dirs[i] ? c.right : c.left });
  }

  const last = chars[chars.length - 1]!;
  slots.push({
    pm: last.pm + unitsOf(last),
    x: dirs[chars.length - 1] ? last.left : last.right,
  });

  return slots;
}

/** הסמן המצויר של המנוע. */
export const CARET_SELECTOR = '.sd-v2-local-selection-caret';

/** ה-fragment של פסקה. */
const FRAGMENT_SELECTOR = '[data-source-node-id][data-pm-start]';

/** עמוד בגוף המסמך. ה-fragments של הגוף הם ילדיו הישירים (נמדד). */
const PAGE_CLASS = 'superdoc-page';

/** ה-fragment הוא המשך של פסקה שהתחילה בעמוד קודם. */
const CONTINUES_FROM_PREV = 'data-continues-from-prev';
const CONTINUES_ON_NEXT = 'data-continues-on-next';

/**
 * מה שנושא היסטים בתוך שורה. סמן המספור של פריט רשימה אינו אחד מאלה — הוא
 * מצויר בשורה ואינו נושא טווח pm, ולכן נופל מעצמו (נמדד).
 */
export const PM_CARRIER_SELECTOR = '.superdoc-text-run, .superdoc-tab';

/**
 * טווח pm מתכונה, או `NaN` כשאין תכונה.
 *
 * ‏`Number(null)` הוא **0**, ולא NaN — ולכן `Number(el.getAttribute(…))` לבדו
 * הופך אלמנט בלי טווח לאלמנט שטווחו 0..0. נמדד: טאב-הסיומת של סמן רשימה
 * (`SPAN.superdoc-tab.superdoc-marker-suffix-tab`) נושא רווח אחד ואין לו
 * טווח, וכך הוא פסל את כל השורה — כלומר החזיר את הבאג לכל פריטי הרשימה.
 */
export const attr = (el: Element, name: string): number => {
  const raw = el.getAttribute(name);
  return raw === null ? Number.NaN : Number(raw);
};

/**
 * מה שנצרך מ-`Intl.Segmenter`. הוא אינו בטיפוסי `ES2020` שב-`tsconfig`
 * (נוסף ב-`es2022.intl`), והצורה מוצהרת כאן ולא כהרחבה גלובלית — כדי שלא
 * תתנגש בהצהרה של מודול אחר.
 */
interface GraphemeSegmenter {
  segment(input: string): Iterable<{ index: number; segment: string }>;
}

/**
 * החלוקה לאשכולות גרפמה, פעם אחת למודול — ההסבר ב-`readLineChars`.
 *
 * בלי locale: כללי האשכול ב-UAX-29 אינם תלויים בשפה, והברירה נמדדה נותנת
 * את אותם גבולות בדיוק ל-`he` ולברירת המחדל על שש השורות בגשש.
 */
const GRAPHEMES: GraphemeSegmenter = new (
  Intl as unknown as {
    Segmenter: new (
      locales: undefined,
      options: { granularity: 'grapheme' },
    ) => GraphemeSegmenter;
  }
).Segmenter(undefined, { granularity: 'grapheme' });

/**
 * התיבה של כל אשכול גרפמה בשורה, עם ההיסט שלו.
 *
 * מחזירה `null` כשהטווחים המצוירים אינם מכסים את השורה ברצף — אז אין מיפוי
 * מהימן, וההקשה נמסרת למנוע.
 *
 * ## אשכול גרפמה, לא נקודת קוד ולא יחידת UTF-16
 *
 * ‏`pm` נספר ביחידות UTF-16, אבל היחידה שיש לה מקום על המסך היא **אשכול
 * הגרפמה**: „שָׁ” הוא שלוש נקודות קוד (ש, קמץ, שין-ימנית) ותיבה אחת, ואין
 * מקום סמן בין אות לניקוד שלה. הכלל של הדפדפן נמדד ב-Chrome אמיתי
 * (`node scripts/qa/rtl-caret-cluster-probe.mjs`, 17.9.2026) — הוא מחזיר
 * ל-`Range` שחותך באמצע אשכול את **תיבת האשכול המלאה**:
 *
 *   | האשכול                       | יחידות | רוחב התיבה | כל יחידה בנפרד |
 *   |------------------------------|--------|------------|----------------|
 *   | `😀` — זוג תחליף              |   2    |   22.0     | אותה תיבה      |
 *   | `שָׁ` ב-„מילה abcשָׁלום”        |   3    |    9.8     | אותה תיבה      |
 *   | `e`+U+0301 ב-„מילה éa מילה”  |   2    |    7.1     | אותה תיבה      |
 *
 * (ה-x המוחלט תלוי ברוחב החלון ולכן אינו רשום כאן; מה שקבוע הוא השוויון,
 * וזה מה שהגשש מוודא.)
 *
 * כלומר איטרציה לפי נקודת קוד אינה מספיקה: היא הייתה יוצרת ל-„שָׁ” שלושה
 * חריצים באותו x, ו**שניים מהם הם היסט בין האות לניקוד שלה**. נמדד מקצה
 * לקצה על המודול הזה עם התיבות שהגשש החזיר: ב-„מילה abcשָׁלום” שרדו החריצים
 * ‏`9` ו-`10` באותו x (הבסיס `8` נפל כתפר), וההליכה — לשני הכיוונים — נחתה
 * על `9`, כלומר בין ש לקמץ שלה. הקשה שם הייתה מכניסה תו בין האות לניקודה.
 * (‏„12שָׁלום” ו-„בְּ1948 שְנָה” יצאו שלמים במקרה בלבד: חריץ עם pm נמוך יותר
 * יושב באותו x ומנצח בשוויון של `<`/`>` ב-`visualTarget`.)
 *
 * החלוקה לאשכולות גם **מוזילה** את המסלול על הטקסט שהעורך הזה נועד לו: אותה
 * מדידה על שורה מנוקדת (89 יחידות UTF-16) — 54 קריאות `getBoundingClientRect`
 * במקום 89, חציון 0.3ms במקום 0.7ms; ועל שורה בלי ניקוד (269 יחידות) 269
 * קריאות בשני המסלולים, 1.8ms מול 1.9ms.
 */
export function readLineChars(line: Element): PaintedChar[] | null {
  const chars: PaintedChar[] = [];
  const range = document.createRange();

  for (const el of Array.from(line.querySelectorAll(PM_CARRIER_SELECTOR))) {
    const pmStart = attr(el, 'data-pm-start');
    const pmEnd = attr(el, 'data-pm-end');
    if (!Number.isFinite(pmStart) || !Number.isFinite(pmEnd)) continue;

    const text = el.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) {
      // טאב: יחידת pm אחת בלי טקסט, והתיבה היא של האלמנט עצמו.
      if (pmEnd - pmStart !== 1) return null;
      const rect = el.getBoundingClientRect();
      chars.push({ pm: pmStart, left: rect.left, right: rect.right });
      continue;
    }

    const data = (text as Text).data;
    if (data.length !== pmEnd - pmStart) return null;
    for (const { index, segment } of GRAPHEMES.segment(data)) {
      range.setStart(text, index);
      range.setEnd(text, index + segment.length);
      const rect = range.getBoundingClientRect();
      chars.push({
        pm: pmStart + index,
        left: rect.left,
        right: rect.right,
        ch: segment,
        ...(segment.length > 1 ? { units: segment.length } : {}),
      });
    }
  }

  if (!chars.length) return null;
  chars.sort((a, b) => a.pm - b.pm);
  if (chars[0]!.pm !== attr(line, 'data-pm-start')) return null;
  const last = chars[chars.length - 1]!;
  if (last.pm + unitsOf(last) !== attr(line, 'data-pm-end')) return null;
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i]!.pm !== chars[i - 1]!.pm + unitsOf(chars[i - 1]!)) return null;
  }

  return chars;
}

const flag = (el: Element, name: string): boolean => el.getAttribute(name) === 'true';

/**
 * פסקה או שורה בלי תוכן: טווח באורך אפס.
 *
 * נמדד (17.9.2026, superdoc 2.15.0): פסקה ריקה מצוירת כ-fragment עם
 * `data-pm-start` **שווה** ל-`data-pm-end` (14..14), ובתוכו
 * `DIV.superdoc-line` באותו טווח, עם `dir="rtl"` ובלי אף נושא היסט. יש לה
 * בדיוק מקום סמן אחד, וזה ההיסט הזה עצמו.
 */
export function isEmptyRange(el: Element): boolean {
  const from = attr(el, 'data-pm-start');
  return Number.isFinite(from) && from === attr(el, 'data-pm-end');
}

/**
 * החריץ היחיד של שורה ריקה, או `null` כשאינה ריקה.
 *
 * ה-x נלקח ממלבן השורה, והוא אינו נקרא במסלול שמשתמש בחריץ הזה (בקצה נקרא
 * ה-pm בלבד) — אבל חריץ בלי מיקום היה שקר בטיפוס.
 */
export function emptyLineSlot(line: Element, rtl: boolean): CaretSlot | null {
  if (!isEmptyRange(line)) return null;
  const rect = line.getBoundingClientRect();
  return { pm: attr(line, 'data-pm-start'), x: rtl ? rect.right : rect.left };
}

/**
 * ה-pm של תחילת הבלוק: ה-fragment הראשון שלו, זה שאינו המשך — או, לפסקה
 * בתוך תא שאין לה טווח משלה, השורה הראשונה שלה. `NaN` כשהבלוק אינו מצויר —
 * ואז אין מיפוי מהיסט ל-pm.
 */
export function blockStart(host: HTMLElement, blockId: string): number {
  let bare: Element | null = null;
  for (const el of Array.from(host.querySelectorAll('[data-source-node-id]'))) {
    if (el.getAttribute('data-source-node-id') !== blockId) continue;
    if (!Number.isFinite(attr(el, 'data-pm-start'))) {
      bare ??= el;
      continue;
    }
    if (flag(el, CONTINUES_FROM_PREV)) continue;
    return attr(el, 'data-pm-start');
  }
  const first = bare ? linesOf(bare)[0] : undefined;
  return first ? attr(first, 'data-pm-start') : Number.NaN;
}

/** המרחק האנכי מ-y לשורה הקרובה ביותר ב-fragment שמכילה את ה-pm. */
function lineDistance(fragment: Element, pm: number, y: number): number {
  let best = Infinity;
  for (const line of linesOf(fragment)) {
    if (pm < attr(line, 'data-pm-start') || pm > attr(line, 'data-pm-end')) continue;
    const rect = line.getBoundingClientRect();
    best = Math.min(best, Math.abs((rect.top + rect.bottom) / 2 - y));
  }
  return best;
}

export interface CaretHome {
  fragment: HTMLElement;
  caretPm: number;
}

/**
 * ה-fragment שהסמן בו, וה-pm שלו. פסקה שנחצית בין עמודים היא כמה fragments
 * עם אותו מזהה, ובגבול ביניהם ה-pm שייך לשניים — ה-y של הסמן מכריע.
 */
export function findFragment(host: HTMLElement, blockId: string, caretOffset: number, caretY: number): CaretHome | null {
  const start = blockStart(host, blockId);
  if (!Number.isFinite(start)) return null;
  const caretPm = start + caretOffset;

  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const fragment of Array.from(host.querySelectorAll<HTMLElement>(FRAGMENT_SELECTOR))) {
    if (fragment.getAttribute('data-source-node-id') !== blockId) continue;
    const from = attr(fragment, 'data-pm-start');
    const to = attr(fragment, 'data-pm-end');
    if (!Number.isFinite(from) || caretPm < from || (Number.isFinite(to) && caretPm > to)) continue;
    const distance = lineDistance(fragment, caretPm, caretY);
    if (!best || distance < bestDistance) {
      best = fragment;
      bestDistance = distance;
    }
  }
  return best ? { fragment: best, caretPm } : null;
}

const isPage = (el: Element | null): boolean => !!el && el.classList.contains(PAGE_CLASS);

/**
 * שני fragments באותו מכל ציור: אותו הורה, או שניהם בגוף — עמוד אחרי עמוד.
 * כותרת עליונה ותא טבלה אינם כאלה.
 */
export function sameFlow(a: Element, b: Element): boolean {
  if (a.parentElement === b.parentElement) return true;
  return isPage(a.parentElement) && isPage(b.parentElement);
}

const hasRange = (el: Element): boolean => Number.isFinite(attr(el, 'data-pm-start'));

/** הבלוקים של הגוף שבעמוד — פסקאות וטבלאות — לפי הסדר. */
function pageFragments(page: Element): Element[] {
  return Array.from(page.children).filter(hasRange);
}

/**
 * הבלוק הבא (או הקודם) בזרימה: האח הבא שיש לו טווח, ואם אין — הראשון בעמוד
 * הסמוך. עמוד סמוך שאין בו אף בלוק מצויר אינו „אין שכן” אלא „לא ידוע”, ולכן
 * `null` — והקצה של המסמך נבדק בנפרד.
 */
export function neighbourOf(host: HTMLElement, fragment: Element, forward: boolean): Element | null {
  let el = forward ? fragment.nextElementSibling : fragment.previousElementSibling;
  while (el && !hasRange(el)) el = forward ? el.nextElementSibling : el.previousElementSibling;
  if (el) return el;

  const page = fragment.parentElement;
  if (!page || !isPage(page)) return null;
  const pages = Array.from(host.getElementsByClassName(PAGE_CLASS));
  const next = pages[pages.indexOf(page) + (forward ? 1 : -1)];
  if (!next) return null;
  const items = pageFragments(next);
  return items[forward ? 0 : items.length - 1] ?? null;
}

/**
 * האם ה-fragment הוא הקצה של המסמך בכיוון הזה: הראשון בעמוד הראשון, או
 * האחרון בעמוד האחרון — ולא רק האחרון שמצויר.
 */
export function atDocumentEdge(host: HTMLElement, fragment: Element, forward: boolean): boolean {
  const page = fragment.parentElement;
  if (!page || !isPage(page)) return false;
  const pages = Array.from(host.getElementsByClassName(PAGE_CLASS));
  if (pages[forward ? pages.length - 1 : 0] !== page) return false;
  if (flag(fragment, forward ? CONTINUES_ON_NEXT : CONTINUES_FROM_PREV)) return false;
  const siblings = pageFragments(page);
  return siblings[forward ? siblings.length - 1 : 0] === fragment;
}

/** השורות של ה-fragment — ילדיו הישירים שנושאים טווח pm. */
export function linesOf(fragment: Element): Element[] {
  return Array.from(fragment.children).filter(
    (child) =>
      Number.isFinite(attr(child, 'data-pm-start')) && Number.isFinite(attr(child, 'data-pm-end')),
  );
}

/**
 * השורה שהסמן בה.
 *
 * ההיסט לבדו אינו מספיק: גבול בין שתי שורות גולשות הוא **היסט אחד** ששייך
 * לשתיהן, ושתי השורות נגמרות ומתחילות באותו x. מה שמבדיל ביניהן הוא ה-y
 * שהסמן מצויר בו, ולכן הוא זה שמכריע כששתי מועמדות.
 */
export function lineAt(lines: readonly Element[], caretPm: number, caretY: number): number {
  const candidates: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (caretPm >= attr(line, 'data-pm-start') && caretPm <= attr(line, 'data-pm-end')) {
      candidates.push(i);
    }
  }
  if (candidates.length <= 1) return candidates[0] ?? -1;

  let best = candidates[0]!;
  let bestGap = Infinity;
  for (const i of candidates) {
    const rect = lines[i]!.getBoundingClientRect();
    const gap = Math.abs((rect.top + rect.bottom) / 2 - caretY);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}
