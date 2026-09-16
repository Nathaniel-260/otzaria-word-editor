/**
 * חצים אופקיים בשורה עברית — „לוחץ ימין והסמן הולך שמאלה”.
 *
 * ## מה שבור במנוע
 *
 * המנוע בוחר מודל כיוון **לכל פסקה בנפרד**: בפסקה עברית נקייה החצים חזותיים
 * (ימין=ימינה, כמו Word), ואילו בפריט רשימה, בפסקה עם טאב, ובכל שורה שיש בה
 * ספרות או לטינית הם לוגיים — כלומר ימין מזיז את הסמן שמאלה על המסך. אותו
 * מקש, שתי התנהגויות הפוכות, באותו מסמך. ‏`Shift+חץ` יורש את הסתירה, ובגבול
 * בין פסקה „חזותית” ל„לוגית” הסמן מקפץ בין השתיים ואינו חולף.
 *
 * ‏**`Shift+חץ` נשאר למנוע** — לא כי הוא תקין, אלא כי נמדד שאי אפשר לכתוב
 * בחירה דרך ה-API בלי שתיעלם מהעין. הפירוט ב-`isHorizontalArrow`.
 *
 * מדוד ומתועד ב-`docs/engine-gaps.md` („חצים אופקיים בעברית”), ודווח למעלה
 * כ-[#3996](https://github.com/superdoc/docx-editor/issues/3996). הקוד שמזיז
 * את הסמן אינו בחלקים הפתוחים של SuperDoc, ולכן אין PR — רק יירוט.
 *
 * ## למה אפשר לתקן את זה מבחוץ, אף שנכתב כאן קודם שאי אפשר
 *
 * הטענה הקודמת הייתה ש„היעד הנכון תלוי במודל הדו-כיווני שהמנוע מחזיק ואיננו
 * רואים”. זה לא נכון, ונמדד כלא נכון: הטקסט מצויר ב-DOM אמיתי, ולכן **המיקום
 * המצויר של כל תו ניתן למדידה מכאן**. אין צורך במודל של המנוע — צריך רק לדעת
 * מי התו שמצויר מימין לסמן, וזו שאלה על מלבנים.
 *
 * הגשש `scripts/qa/rtl-caret-visual-feasibility.mjs` הוכיח את זה מול האמת:
 * לכל היסט בשורה נכתבה בחירה, נמדד ה-x שהמנוע צייר בו את הסמן, והושווה למה
 * שהחישוב כאן גוזר מה-DOM. התוצאה (superdoc 2.15.0, Chrome, ה-dist הארוז):
 *
 *   | השורה                        | התאמה     |
 *   |------------------------------|-----------|
 *   | עברית נקייה                  | **20/20** |
 *   | פריט ברשימה ממוספרת          | **18/18** |
 *   | עברית עם ספרות               | **12/12** |
 *   | בקרה: שורה לטינית            | **17/17** |
 *   | עברית עם מילה באנגלית        | 12/14     |
 *
 * זהה עד עשירית פיקסל. המחיר נמדד באותה ריצה, 40 חזרות לכל שורה: חציון
 * 0.1–0.5ms, והגרוע ביותר 4.8ms על שורה מלאה ברוחב A4 (88 תווים). פריים הוא
 * 16ms, והחישוב רץ **רק בהקשת חץ**; הקלדה אינה נוגעת בו.
 *
 * (אותה מדידה רצה קודם, בטעות, על superdoc 2.14.0-next.5 שנשאר ב-
 * `node_modules` של העץ הראשי, ונתנה את אותן התאמות ואת אותם ערכי x בדיוק.)
 *
 * ## שלושה דברים שהמדידה מצאה, והם מה שמעצב את הקוד כאן
 *
 * 1. **כיוון הוא תכונה של מה שמצויר, לא של מה שהוצהר.** „פרק 12 בספר” הוא
 *    ריצת OOXML **אחת** שבתוכה אי לטיני; חלוקה לפי אלמנטים או לפי `w:rtl`
 *    מחמיצה אותו. לכן הכיוון כאן נגזר מ**צמידות**: שני תווים עוקבים שהתיבות
 *    שלהם נוגעות זו בזו שייכים לאותו קטע, והצד שבו הן נוגעות הוא הכיוון.
 *    ראו `bidi-declaration-is-not-direction` בהיסטוריה.
 *
 * 2. **לתפר יש שני בתים, ואין ידית לבחור ביניהם.** בגבול בין עברית ללטינית
 *    להיסט לוגי אחד יש **שני** מיקומים חוקיים על המסך, והמנוע בוחר לפי איך
 *    הגעת. נמדד ב„מילה ABC מילה”: היסט 56 מצויר ב-980 אחרי לחיצה בעכבר,
 *    וב-1012.9 אחרי כתיבה דרך `setSelectionTarget` — שמקבל מספר בלי צד.
 *    נמדדו חמש צורות כתיבה — עוגן מכל צד, `collapse` לשני הכיוונים — וכולן
 *    החזירו את **אותו** x בדיוק. אין ידית.
 *
 *    ומכאן ההכרעה: **היסט שיושב על תפר אינו יעד.** אילו כיוונו אליו, המנוע
 *    היה מצייר אותו בבית שהוא בחר — ובאי לטיני זה הבית שבצד השני, כלומר
 *    „שמאלה” היה מזיז ימינה. זו בדיוק התקלה שבאנו לתקן. המחיר הוא עצירה אחת
 *    בכל קצה של אי לועזי (עדיין נגישה בלחיצת עכבר), והתמורה היא
 *    **מונוטוניות**: ימין לעולם אינו מזיז שמאלה.
 *
 * 3. **כל אלמנט מצויר נושא את טווח ה-pm שלו.** ‏`SPAN.superdoc-text-run` וגם
 *    `SPAN.superdoc-tab` — והטאב הוא יחידת pm אחת בלי טקסט (נמדד:
 *    `pm=5..6`, רוחב 24, אפס תווים). לכן ההיסט של כל תו נקרא מהאלמנט שלו
 *    ואינו נספר באינדקסים, וסמן המספור של פריט רשימה — שאינו נושא טווח —
 *    נופל מעצמו.
 *
 * ## קצוות
 *
 * בקצה השורה אין חריץ בכיוון המבוקש, ואז היעד הוא **השכן הלוגי** בשורה או
 * בפסקה הסמוכה: ימין בשורה עברית הוא אחורה לוגית, ולכן הוא מוביל לסוף השורה
 * שמעליה — שהוא קצה שמאל שלה. בלי זה ההקשה הייתה חוזרת למנוע, והוא מזיז שם
 * קדימה לוגית, כלומר **שמאלה על המסך** — נמדד בשער.
 *
 * מה שנשאר למנוע: תחילת המסמך וסופו, פסקה שכנה שאינה באותו מכל ציור (כותרת
 * עליונה, תא טבלה), שורה שאינה מוכרזת `dir="rtl"` — שם הוא נמדד תקין —
 * ושורה שטווחי ה-pm המצוירים בה אינם רציפים. בכל אלה ההקשה עוברת אליו כפי
 * שהיא. שער: `npm run check:arrows`.
 */

/** תו מצויר אחד: ההיסט שלו (ב-pm של המנוע) והתיבה שלו על המסך. */
export interface PaintedChar {
  pm: number;
  left: number;
  right: number;
}

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
 * הכיוון של כל תו, מהגאומטריה בלבד.
 *
 * `true` = התו שייך לקטע ימין-לשמאל. תו שאין לו שכן צמוד משני צדדיו — למשל
 * רווח שמפריד בין עברית לאי לטיני, או טאב — נופל לכיוון השורה.
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

  return dirs.map((value) => value ?? lineRtl);
}

/**
 * כל המקומות שהסמן רשאי לעצור בהם בשורה, בלי אלה שיושבים על תפר.
 *
 * הסמן בהיסט o יושב על ה**קצה המוביל** של התו שבהיסט o — שמאל לתו לטיני,
 * ימין לתו עברי — ובסוף השורה על הקצה הנגרר של האחרון. היסט שהכיוון משתנה
 * בו מושמט; ההסבר בהערת הפתיחה.
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
  slots.push({ pm: last.pm + 1, x: dirs[chars.length - 1] ? last.left : last.right });

  return slots;
}

/**
 * החריץ הקרוב ביותר בכיוון המבוקש **על המסך**, או `null` כשאין כזה בשורה.
 *
 * נקודת המוצא היא ה-x שהסמן **מצויר** בו ולא החריץ של ההיסט שלו: בתפר השניים
 * אינם זהים, וה-x המצויר הוא האמת. כך טעות בצעד אחד אינה נצברת — כל הקשה
 * מודדת מחדש מאיפה שהסמן באמת נמצא.
 */
export function visualTarget(
  slots: readonly CaretSlot[],
  caretX: number,
  toRight: boolean,
): CaretSlot | null {
  let best: CaretSlot | null = null;
  for (const slot of slots) {
    if (toRight ? slot.x <= caretX + 0.5 : slot.x >= caretX - 0.5) continue;
    if (!best || (toRight ? slot.x < best.x : slot.x > best.x)) best = slot;
  }
  return best;
}

/**
 * הכניסה לשורה או לפסקה הסמוכה: הקצה הלוגי שלה מהצד שממנו באים.
 *
 * `caretPm` מוחרג מפני שגבול בין שתי שורות גולשות הוא **היסט אחד** ששייך
 * לשתיהן — בלי ההחרגה הצעד היה מחזיר את הסמן לעצמו.
 */
export function edgeSlot(
  slots: readonly CaretSlot[],
  forward: boolean,
  caretPm: number,
): CaretSlot | null {
  let best: CaretSlot | null = null;
  for (const slot of slots) {
    if (slot.pm === caretPm) continue;
    if (!best || (forward ? slot.pm < best.pm : slot.pm > best.pm)) best = slot;
  }
  return best;
}

/**
 * האם התנועה המבוקשת היא **קדימה לוגית**.
 *
 * בשורה עברית „ימינה על המסך” הוא אחורה בטקסט, ובשורה לטינית להפך. זה כל מה
 * שצריך כדי לדעת לאיזו שורה או פסקה לעבור בקצה.
 */
export function movesForward(toRight: boolean, lineRtl: boolean): boolean {
  return toRight ? !lineRtl : lineRtl;
}

/**
 * האם ההקשה היא חץ אופקי „נקי” — בלי Ctrl/Meta/Alt, **ובלי Shift**.
 *
 * ‏`Shift+חץ` אינו שלנו, ולא מפני שהוא תקין: הוא יורש בדיוק את אותה סתירה
 * (בפסקה הבחירה מתרחבת אחורה, ברשימה קדימה). הוא אינו שלנו מפני שנמדד
 * שאי אפשר לכתוב אותו בלי להזיק —
 *
 *   • בחירה שאינה מכווצת **אינה מצוירת כלל** אחרי כתיבה דרך
 *     `authoring.setSelectionTarget`: ‏`doc.selection.current()` מדווח
 *     `{empty:false, range:{start:2,end:6}}`, ובמסך אין ולו מלבן אחד.
 *   • ‏`readLiveSelectionSyncSnapshot()` מחזיר `selectionTarget: null` לכל
 *     בחירה שאינה מכווצת, ולכן אין מאיפה לקרוא את ראש הבחירה בהקשה הבאה.
 *   • המנוע מנרמל `start`/`end` לסדר המסמך, ולכן גם כיוון הבחירה אובד.
 *
 * כלומר יירוט של `Shift+חץ` היה מחליף באג נראה בבחירה בלתי-נראית. נמדד ב-
 * `scripts/qa/shift-arrow-probe.mjs`.
 */
export function isHorizontalArrow(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): boolean {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return false;
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/* ------------------------------------------------------------------ */
/* קריאת מה שמצויר                                                      */
/* ------------------------------------------------------------------ */

/** נקודת קצה של בחירה, כפי שהמנוע מחזיר אותה. */
interface TextPoint {
  kind?: string;
  blockId?: string;
  offset?: number;
  story?: unknown;
}

interface LiveSelectionSnapshot {
  selectionTarget?: {
    kind?: string;
    start?: TextPoint | null;
    end?: TextPoint | null;
    story?: unknown;
    coordinateSpace?: string;
  } | null;
}

/** מה שנצרך מ-`activeEditor`. מוגדר כאן ולא מיובא — ההסבר ב-document-api.ts. */
export interface RtlCaretEditor {
  host?: {
    readLiveSelectionSyncSnapshot?: () => LiveSelectionSnapshot | null | undefined;
  } | null;
  authoring?: {
    setSelectionTarget?: (input: {
      target: {
        kind: 'selection';
        start: TextPoint;
        end: TextPoint;
        story: unknown;
        coordinateSpace?: string;
      };
      focus?: boolean;
    }) => unknown;
  } | null;
}

export interface RtlCaretHost {
  activeEditor?: RtlCaretEditor | null;
}

export interface RtlCaretOptions {
  /** ה-div שהמנוע מצייר בתוכו — `paintedHost(editor.ui)`. */
  host: HTMLElement | null;
  /** ה-SuperDoc של אותו מסמך. */
  superdoc: RtlCaretHost | null | undefined;
}

export interface RtlCaretHandle {
  dispose(): void;
}

/** הסמן המצויר של המנוע. */
const CARET_SELECTOR = '.sd-v2-local-selection-caret';

/** ה-fragment של פסקה. */
const FRAGMENT_SELECTOR = '[data-source-node-id][data-pm-start]';

/**
 * מה שנושא היסטים בתוך שורה. סמן המספור של פריט רשימה אינו אחד מאלה — הוא
 * מצויר בשורה ואינו נושא טווח pm, ולכן נופל מעצמו (נמדד).
 */
const PM_CARRIER_SELECTOR = '.superdoc-text-run, .superdoc-tab';

/**
 * טווח pm מתכונה, או `NaN` כשאין תכונה.
 *
 * ‏`Number(null)` הוא **0**, ולא NaN — ולכן `Number(el.getAttribute(…))` לבדו
 * הופך אלמנט בלי טווח לאלמנט שטווחו 0..0. נמדד: טאב-הסיומת של סמן רשימה
 * (`SPAN.superdoc-tab.superdoc-marker-suffix-tab`) נושא רווח אחד ואין לו
 * טווח, וכך הוא פסל את כל השורה — כלומר החזיר את הבאג לכל פריטי הרשימה.
 */
const attr = (el: Element, name: string): number => {
  const raw = el.getAttribute(name);
  return raw === null ? Number.NaN : Number(raw);
};

/**
 * התיבה של כל תו בשורה, עם ההיסט שלו.
 *
 * מחזירה `null` כשהטווחים המצוירים אינם מכסים את השורה ברצף — אז אין מיפוי
 * מהימן, וההקשה נמסרת למנוע.
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
    for (let i = 0; i < data.length; i += 1) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getBoundingClientRect();
      chars.push({ pm: pmStart + i, left: rect.left, right: rect.right });
    }
  }

  if (!chars.length) return null;
  chars.sort((a, b) => a.pm - b.pm);
  if (chars[0]!.pm !== attr(line, 'data-pm-start')) return null;
  if (chars[chars.length - 1]!.pm + 1 !== attr(line, 'data-pm-end')) return null;
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i]!.pm !== chars[i - 1]!.pm + 1) return null;
  }

  return chars;
}

/** ה-fragment שהסמן בו, לפי מזהה הבלוק והיסט הסמן. */
function findFragment(host: HTMLElement, blockId: string, caretOffset: number): HTMLElement | null {
  for (const fragment of Array.from(host.querySelectorAll<HTMLElement>(FRAGMENT_SELECTOR))) {
    if (fragment.getAttribute('data-source-node-id') !== blockId) continue;
    const base = attr(fragment, 'data-pm-start');
    if (!Number.isFinite(base)) continue;
    // פסקה שנחצית בין עמודים מצוירת כשני fragment עם אותו מזהה; הסמן שייך
    // לזה שטווחו מכיל אותו.
    const end = attr(fragment, 'data-pm-end');
    const caretPm = base + caretOffset;
    if (Number.isFinite(end) && (caretPm < base || caretPm > end)) continue;
    return fragment;
  }
  return null;
}

/** השורות של ה-fragment — ילדיו הישירים שנושאים טווח pm. */
function linesOf(fragment: Element): Element[] {
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
function lineAt(lines: readonly Element[], caretPm: number, caretY: number): number {
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

/** היעד, וה-fragment שהוא יושב בו. */
interface Target {
  fragment: Element;
  slot: CaretSlot;
}

/**
 * השכן החזותי של הסמן: בתוך השורה, ואם אין — בשורה או בפסקה הסמוכה.
 *
 * `null` פירושו „לא שלנו”, וההקשה ממשיכה למנוע.
 */
export function findTarget(
  host: HTMLElement,
  fragment: Element,
  caretPm: number,
  caretX: number,
  caretY: number,
  toRight: boolean,
): Target | null {
  const lines = linesOf(fragment);
  const index = lineAt(lines, caretPm, caretY);
  if (index < 0) return null;

  const line = lines[index]!;
  // שורה לטינית — המנוע נמדד תקין בה (17/17), ואין מה לתקן.
  if (line.getAttribute('dir') !== 'rtl') return null;

  const chars = readLineChars(line);
  if (!chars) return null;

  const inside = visualTarget(caretSlots(chars, true), caretX, toRight);
  if (inside) return { fragment, slot: inside };

  /* קצה השורה. „ימינה” בשורה עברית הוא אחורה לוגית, ולכן הוא מוביל לשורה
     שמעליה — ואל **סופה**, שהוא קצה שמאל שלה. */
  const forward = movesForward(toRight, true);
  const neighbour = lines[index + (forward ? 1 : -1)];
  if (neighbour) {
    const nextChars = readLineChars(neighbour);
    if (!nextChars) return null;
    const rtl = neighbour.getAttribute('dir') === 'rtl';
    const slot = edgeSlot(caretSlots(nextChars, rtl), forward, caretPm);
    return slot ? { fragment, slot } : null;
  }

  /* קצה הפסקה. רק פסקה שכנה **באותו מכל ציור** — כותרת עליונה או תא טבלה
     שכנים ב-DOM אינם שכנים של הסמן. */
  const fragments = Array.from(host.querySelectorAll<HTMLElement>(FRAGMENT_SELECTOR));
  const at = fragments.indexOf(fragment as HTMLElement);
  const sibling = fragments[at + (forward ? 1 : -1)];
  if (!sibling || sibling.parentElement !== fragment.parentElement) return null;

  const siblingLines = linesOf(sibling);
  const edgeLine = forward ? siblingLines[0] : siblingLines[siblingLines.length - 1];
  if (!edgeLine) return null;
  const edgeChars = readLineChars(edgeLine);
  if (!edgeChars) return null;
  const rtl = edgeLine.getAttribute('dir') === 'rtl';
  const slot = edgeSlot(caretSlots(edgeChars, rtl), forward, caretPm);
  return slot ? { fragment: sibling, slot } : null;
}

/* ------------------------------------------------------------------ */
/* היירוט                                                               */
/* ------------------------------------------------------------------ */

/** מתקין את היירוט. אין לו מצב, והוא נפרק עם המסמך. */
export function installRtlVisualArrows({ host, superdoc }: RtlCaretOptions): RtlCaretHandle {
  if (!host) return { dispose() {} };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isHorizontalArrow(event)) return;

    const editor = superdoc?.activeEditor;
    const setSelectionTarget = editor?.authoring?.setSelectionTarget;
    const readSnapshot = editor?.host?.readLiveSelectionSyncSnapshot;
    if (typeof setSelectionTarget !== 'function' || typeof readSnapshot !== 'function') return;

    let snapshot: LiveSelectionSnapshot | null | undefined;
    try {
      snapshot = readSnapshot.call(editor?.host);
    } catch {
      return;
    }

    const selection = snapshot?.selectionTarget;
    const head = selection?.end;
    if (!head || head.kind !== 'text' || typeof head.blockId !== 'string') return;
    if (typeof head.offset !== 'number') return;

    const fragment = findFragment(host, head.blockId, head.offset);
    if (!fragment) return;

    const caretRect = host.querySelector(CARET_SELECTOR)?.getBoundingClientRect();
    if (!caretRect) return;

    const caretPm = attr(fragment, 'data-pm-start') + head.offset;
    const caretY = (caretRect.top + caretRect.bottom) / 2;
    const target = findTarget(
      host,
      fragment,
      caretPm,
      caretRect.left,
      caretY,
      event.key === 'ArrowRight',
    );
    if (!target) return;

    const blockId = target.fragment.getAttribute('data-source-node-id');
    if (!blockId) return;
    const offset = target.slot.pm - attr(target.fragment, 'data-pm-start');
    if (blockId === head.blockId && offset === head.offset) return;

    // מכאן ואילך זה שלנו: המנוע לא יראה את ההקשה.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const story = selection?.story ?? head.story ?? { kind: 'story', storyType: 'body' };
    const coordinateSpace = selection?.coordinateSpace;
    const point: TextPoint = { kind: 'text', blockId, offset, story };

    try {
      const written = setSelectionTarget.call(editor?.authoring, {
        target: {
          kind: 'selection',
          start: point,
          end: point,
          story,
          ...(typeof coordinateSpace === 'string' ? { coordinateSpace } : {}),
        },
        focus: true,
      });
      // הפעולה א-סינכרונית במנוע. כשל מאוחר (למשל אם המסמך התפרק בין
      // התצלום לכתיבה) אינו צריך לייצר rejection לא מטופלת.
      void Promise.resolve(written).catch(() => {});
    } catch {
      /* בחירה שלא נכתבה אינה סיבה להפיל הקלדה */
    }
  };

  host.addEventListener('keydown', onKeyDown, true);

  return {
    dispose() {
      host.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
