/**
 * הצמדת לחיצה לשורה הקרובה — לחיצה מחוץ לגליפים נוחתת במקום הקרוב, כמו ב-Word.
 *
 * ## מה נמדד, ולמה זה כאן
 *
 * המנוע ממפה לחיצה למיקום במסמך דרך `elementsFromPoint` (clickToPositionDom):
 * הוא מחפש את הפרגמנט ואת השורה שמתחת לנקודה, ואז ממיר את ה-x להיסט בתוך
 * השורה. שני מקרים נופלים שם, ושניהם נמדדו ב-Chrome על ה-dist הארוז
 * (scripts/qa/click-snap-qa.mjs):
 *
 *   - **x מחוץ לגליפים של השורה** — לחיצה משמאל לסוף שורה עברית, או מימין
 *     לסוף שורה אנגלית — מחזירה היסט 0, כלומר הסמן קופץ ל**תחילת** השורה.
 *     ב-Word הוא נוחת בסופה: המקום הקרוב ביותר ללחיצה.
 *   - **הנקודה מחוץ לכל פרגמנט** — מתחת לשורה האחרונה, בשוליים הצדדיים —
 *     המנוע נופל ל**פרגמנט הראשון של העמוד**, היסט 0: תחילת המסמך. ב-Word
 *     הסמן נוחת בשורה הקרובה, בנקודה הקרובה. אותו נפילה היא גם מה שמאפס
 *     גרירה שיורדת מתחת לשורה האחרונה (docs/engine-gaps.md, „גרירה שיורדת
 *     מתחת לשורה האחרונה”).
 *
 * ## איך, בלי לגעת במנוע
 *
 * המנוע קורא `clientX`/`clientY` מהאירוע. המאזין כאן יושב על `window`
 * ב-capture — לפני כל מאזין של המנוע, כי הוא נרשם **לפני** בניית המופע
 * (create-editor.ts) — ומחליף על האירוע עצמו את הקואורדינטות בנקודה המוצמדת:
 * מאפיין עצמי על העצם מאפיל על ה-getter של `MouseEvent.prototype`, ולכן כל
 * מי שקורא אחרינו — המנוע, וגם word-selection.ts ו-format-painter.ts —
 * רואה את אותה נקודה. אין אירוע מסונתז, אין `stopPropagation`, ספירת
 * הלחיצות (`detail`) ו-`isTrusted` נשמרים.
 *
 * הגיאומטריה — מלבני הגליפים של השורות — נקראת ב-engine/page-ruler.ts
 * (`measurePageGlyphs`), המקום היחיד שמותר לו לגעת בעיגון של העמוד המצויר.
 *
 * ## הכללים, והם כללי Word
 *
 *   - **שורה**: הראשונה שתחתיתה מתחת לנקודה (רווח בין שורות שייך לשורה
 *     שמתחתיו — כך גם Word עם „רווח לפני”), ומתחת לשורה האחרונה — האחרונה.
 *   - **x**: אם הנקודה בתוך קופסת גליפים — אינה זזה. אחרת — הקופסה הקרובה
 *     אופקית, והנקודה נצמדת לקצה שלה, מעט פנימה (`SNAP_INSET_PX`), כדי
 *     שהמנוע יראה גליף ולא רווח ריק.
 *   - **y**: מוחלף במרכז השורה רק כשהוא מחוץ לה.
 *   - **היקף**: לחיצה על שורה מוצמדת לגליפים של אותה שורה; לחיצה על תא
 *     בטבלה — לגליפים של אותו תא; לחיצה ברצועה המתה של העמוד — לשורות
 *     הגוף של העמוד (לא כותרת עליונה/תחתונה). לחיצה על תמונה או על ידית
 *     אינה מוצמדת כלל — היא לא בחירת טקסט.
 *   - **גרירה**: בזמן שהכפתור לחוץ, כל תנועה מוצמדת לשורות הגוף של העמוד
 *     שמתחתיה — כך גרירה מתחת לטקסט מרחיבה עד סופו, כמו ב-Word, במקום לאפס.
 *     מחוץ לכל עמוד — כלום לא משתנה (המנוע כבר עוצר שם על הערך האחרון).
 *   - **לחיצה = לחיצה ושחרור באותה נקודה**: השחרור וה-`click` שאחריו מקבלים
 *     בדיוק את הנקודה של הלחיצה, כדי שהמנוע (שקובע את המיקום בשחרור) ומונה
 *     הלחיצות של word-selection.ts יראו לחיצה אחת ולא גרירה של פיקסל.
 */
import { measurePageGlyphs, type PageGlyphMeasure, type RawTextRect } from './page-ruler';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

/** שורה: הטווח האנכי המאוחד, וקופסאות הגליפים שעליה, ממוינות משמאל לימין. */
export interface SnapLine {
  top: number;
  bottom: number;
  boxes: readonly Box[];
}

/**
 * כמה פנימה מקצה הקופסה נוחתת הנקודה. חצי פיקסל: נמדד שהמנוע מחזיר את סוף
 * השורה כבר מפיקסל אחד פנימה, ושעל הקצה עצמו התשובה תלויה בעיגול.
 */
export const SNAP_INSET_PX = 0.5;

/**
 * כמה מותר לשחרור לסטות מהלחיצה ועדיין להיחשב אותה לחיצה. אותו סף כמו
 * `CLICK_SEQUENCE_SLOP_PX` של word-selection.ts, ומאותה סיבה.
 */
export const SNAP_CLICK_SLOP_PX = 3;

/**
 * קיבוץ קופסאות גליפים לשורות. שתי קופסאות על אותה שורה אם החפיפה האנכית
 * ביניהן היא לפחות חצי מהנמוכה שבהן: גליף קטן (מעריך) בתוך שורה גדולה
 * חופף לה כולו, ושתי שורות צפופות (ריווח „בדיוק” קטן מהגופן) חופפות רק
 * בקצוות — חפיפה מלאה הייתה שרשרת אותן לשורה אחת ענקית.
 */
export function groupBoxesIntoLines(boxes: readonly Box[]): SnapLine[] {
  const sorted = boxes
    .filter((box) => box.right > box.left && box.bottom > box.top)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: Array<{ top: number; bottom: number; boxes: Box[] }> = [];
  for (const box of sorted) {
    const current = lines[lines.length - 1];
    if (current) {
      const overlap = Math.min(current.bottom, box.bottom) - Math.max(current.top, box.top);
      const shorter = Math.min(current.bottom - current.top, box.bottom - box.top);
      if (overlap >= shorter / 2) {
        current.top = Math.min(current.top, box.top);
        current.bottom = Math.max(current.bottom, box.bottom);
        current.boxes.push(box);
        continue;
      }
    }
    lines.push({ top: box.top, bottom: box.bottom, boxes: [box] });
  }
  for (const line of lines) line.boxes.sort((a, b) => a.left - b.left);
  return lines;
}

/**
 * הנקודה המוצמדת, או `null` כשאין מה לשנות — הנקודה כבר על גליף, או שאין
 * שורות בכלל. גיאומטריה טהורה; נבדקת ב-tests/unit/pointer-snap.test.ts.
 */
export function snapToLines(x: number, y: number, lines: readonly SnapLine[]): Point | null {
  if (lines.length === 0) return null;
  const line = lines.find((candidate) => y < candidate.bottom) ?? lines[lines.length - 1]!;
  if (line.boxes.length === 0) return null;

  const snappedY = y < line.top || y > line.bottom ? (line.top + line.bottom) / 2 : y;

  let snappedX = x;
  const inside = line.boxes.find((box) => x >= box.left && x <= box.right);
  if (!inside) {
    let nearest = line.boxes[0]!;
    let distance = Number.POSITIVE_INFINITY;
    for (const box of line.boxes) {
      const gap = x < box.left ? box.left - x : x - box.right;
      if (gap < distance) {
        distance = gap;
        nearest = box;
      }
    }
    const width = nearest.right - nearest.left;
    if (width <= SNAP_INSET_PX * 2) snappedX = (nearest.left + nearest.right) / 2;
    else snappedX = Math.min(Math.max(x, nearest.left + SNAP_INSET_PX), nearest.right - SNAP_INSET_PX);
  }

  if (snappedX === x && snappedY === y) return null;
  return { x: snappedX, y: snappedY };
}

/* ------------------------------------------------------------------ */
/* ההחלה על האירועים                                                    */
/* ------------------------------------------------------------------ */

/**
 * מדידה אחת: קופסאות הגליפים ביחס לפינת העמוד ברגע המדידה, ופונקציה שמחזירה
 * את מלבן העמוד **עכשיו** — גלילה בזמן גרירה מזיזה את העמוד על המסך, והשורות
 * זזות איתו.
 */
export interface SnapMeasure {
  readonly lines: readonly SnapLine[];
  pageBox(): Box;
}

/** מודדת את השורות סביב נקודה. `target` — מטרת האירוע; `null` בגרירה. */
export type SnapMeasurer = (target: EventTarget | null, x: number, y: number) => SnapMeasure | null;

export interface PointerSnapOptions {
  /** ברירת המחדל: `measurePageGlyphs` של page-ruler.ts על ה-container. */
  readonly measure?: SnapMeasurer;
}

export interface PointerSnapHandle {
  dispose(): void;
}

/** הסימון שהאירוע כבר הוצמד — שני מופעים (טאבים) לא מצמידים פעמיים. */
const SNAPPED = '__otzariaSnapped';

function boxOf(rect: RawTextRect): Box {
  return { left: rect.leftPx, top: rect.topPx, right: rect.leftPx + rect.widthPx, bottom: rect.topPx + rect.heightPx };
}

function adapt(measured: PageGlyphMeasure | null): SnapMeasure | null {
  if (!measured) return null;
  return { lines: groupBoxesIntoLines(measured.rects.map(boxOf)), pageBox: () => boxOf(measured.pageBox()) };
}

function contains(box: Box, point: Point): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

/**
 * מחליפה את הקואורדינטות על האירוע. `configurable` — כדי שמאזין שני (למשל
 * בבדיקות) יוכל להחליף שוב; `enumerable` — כמו המקור.
 */
function applyPoint(event: MouseEvent, to: Point | null): void {
  if (!to) return;
  const bag = event as unknown as Record<string, unknown>;
  if (bag[SNAPPED] === true) return;
  const pageDx = event.pageX - event.clientX;
  const pageDy = event.pageY - event.clientY;
  const define = (key: string, value: number): void => {
    Object.defineProperty(event, key, { value, configurable: true, enumerable: true });
  };
  define('clientX', to.x);
  define('clientY', to.y);
  define('x', to.x);
  define('y', to.y);
  define('pageX', to.x + pageDx);
  define('pageY', to.y + pageDy);
  // אירועי המצביע המאוחדים/החזויים של הדפדפן נושאים את הקואורדינטות
  // **המקוריות**, ומי שקורא אותם היה רואה נקודה אחרת מזו שעל האירוע. רשימה
  // ריקה היא תשובה חוקית לפי המפרט (כך מוחזר גם לאירוע לא-אמין), וכל קורא
  // חייב ליפול ממנה לאירוע עצמו.
  for (const key of ['getCoalescedEvents', 'getPredictedEvents']) {
    if (typeof bag[key] === 'function') {
      Object.defineProperty(event, key, { value: () => [], configurable: true });
    }
  }
  Object.defineProperty(event, SNAPPED, { value: true });
}

/**
 * מתקינה את ההצמדה על ה-container של המנוע. חובה לקרוא **לפני** בניית
 * המופע — ראו הערת הפתיחה — ולשחרר בפירוקו.
 */
export function installPointerSnap(container: HTMLElement, options: PointerSnapOptions = {}): PointerSnapHandle {
  const measure: SnapMeasurer =
    options.measure ?? ((target, x, y) => adapt(measurePageGlyphs(container, target, x, y)));
  const view = container.ownerDocument?.defaultView ?? window;

  interface Press {
    readonly origin: Point;
    readonly mapped: Point | null;
    /** השחרור, ברגע שהגיע — כדי שה-`click` שאחריו יקבל אותה נקודה. */
    up: { origin: Point; mapped: Point | null } | null;
    /** `mouseup` כבר עבר: הלחיצה הבאה היא לחיצה חדשה, גם אם באותה נקודה. */
    ended: boolean;
  }
  let press: Press | null = null;
  /** מדידת העמוד לגרירה — פעם אחת ללחיצה, ומחדש רק כשהמצביע עובר לעמוד אחר. */
  let dragMeasure: SnapMeasure | null = null;

  const near = (a: Point, b: Point): boolean =>
    Math.abs(a.x - b.x) <= SNAP_CLICK_SLOP_PX && Math.abs(a.y - b.y) <= SNAP_CLICK_SLOP_PX;

  const snapWith = (measured: SnapMeasure | null, at: Point): Point | null => {
    if (!measured) return null;
    const page = measured.pageBox();
    const snapped = snapToLines(at.x - page.left, at.y - page.top, measured.lines);
    return snapped ? { x: snapped.x + page.left, y: snapped.y + page.top } : null;
  };

  const dragSnap = (at: Point): Point | null => {
    if (!dragMeasure || !contains(dragMeasure.pageBox(), at)) dragMeasure = measure(null, at.x, at.y);
    return snapWith(dragMeasure, at);
  };

  const onDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const at = { x: event.clientX, y: event.clientY };
    // `pointerdown` ואחריו `mousedown` — אותה לחיצה פעמיים; השני מקבל את
    // תשובת הראשון בלי למדוד שוב.
    if (press && !press.ended && near(at, press.origin)) {
      applyPoint(event, press.mapped);
      return;
    }
    const target = event.target;
    if (!(target instanceof Node) || !container.contains(target)) return;
    press = { origin: at, mapped: snapWith(measure(target, at.x, at.y), at), up: null, ended: false };
    dragMeasure = null;
    applyPoint(event, press.mapped);
  };

  const onMove = (event: MouseEvent): void => {
    if (!press || press.ended || (event.buttons & 1) === 0) return;
    applyPoint(event, dragSnap({ x: event.clientX, y: event.clientY }));
  };

  const onUp = (event: MouseEvent): void => {
    if (!press || event.button !== 0) return;
    const at = { x: event.clientX, y: event.clientY };
    if (!press.up || !near(at, press.up.origin)) {
      press.up = { origin: at, mapped: near(at, press.origin) ? press.mapped : dragSnap(at) };
    }
    applyPoint(event, press.up.mapped);
    if (event.type === 'mouseup') press.ended = true;
  };

  const onClick = (event: MouseEvent): void => {
    if (!press?.up || event.button !== 0) return;
    if (near({ x: event.clientX, y: event.clientY }, press.up.origin)) applyPoint(event, press.up.mapped);
  };

  const onCancel = (): void => {
    press = null;
    dragMeasure = null;
  };

  const listeners: Array<[string, EventListener]> = [
    ['pointerdown', onDown as EventListener],
    ['mousedown', onDown as EventListener],
    ['pointermove', onMove as EventListener],
    ['mousemove', onMove as EventListener],
    ['pointerup', onUp as EventListener],
    ['mouseup', onUp as EventListener],
    ['click', onClick as EventListener],
    ['pointercancel', onCancel],
  ];
  for (const [type, listener] of listeners) view.addEventListener(type, listener, true);

  return {
    dispose() {
      for (const [type, listener] of listeners) view.removeEventListener(type, listener, true);
      onCancel();
    },
  };
}
