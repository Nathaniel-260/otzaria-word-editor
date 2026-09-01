/**
 * סמן העכבר מעל אזור הטקסט — ה-I-beam של Word.
 *
 * ## מה הבעיה שהמודול הזה פותר
 *
 * הדפדפן מציג סמן-טקסט רק מעל גליפים שכבר הוקלדו: שאר העמוד הוא אלמנטים
 * ריקים, והסמן עליהם הוא חץ. ב-Word הסמן הוא I-beam על **כל** עמודת הטקסט —
 * בין השוליים — וחץ בשוליים עצמם. ההבדל מורגש מיד במסמך חדש: עמוד לבן שלם
 * שכולו „חץ" משדר שאי אפשר לכתוב בו.
 *
 * ## איך, בלי לגעת ב-DOM הפנימי של המנוע
 *
 * שני מקורות שכבר קיימים ומותרים: מלבני העמודים (`watchAllPageRects`,
 * engine/page-ruler.ts — העיגון המדוד היחיד) והשוליים מהמסמך
 * (`readPageMargins`, engine/page-setup.ts). מהם נגזר „פס הטקסט" של כל עמוד:
 * אופקית בין השוליים, אנכית בין השוליים ה**אפקטיביים** — מה שכותרת עליונה
 * כבר דוחקת — אותה הכרעה בדיוק כמו הסרגל ומספרי השורות.
 *
 * ההחלה: `mousemove` על ה-host (ה-div שלנו — `paintedHost` „נמדד כמחזיר את
 * ה-div שלנו עצמו", ראו page-ruler.ts), והשוואת המצביע לפסים כותבת
 * `style.cursor` על ה-host עצמו — `text` בפנים, ברירת המחדל בחוץ. `cursor`
 * על ההורה יורד בירושה לכל מה שהמנוע צייר עם `cursor: auto`, ולכן אין כאן
 * שום selector פנימי ושום כתיבה ל-DOM של המנוע.
 *
 * ## `left`/`right` בלי היפוך כיוון, ובכוונה
 *
 * השוליים מגיעים מ-`w:pgMar` דרך `sections.list()`, ושם `left`/`right` הם
 * צדדים **פיזיים** של הדף — לא „התחלה"/„סוף" לוגיים (ההיפוך הלוגי קיים רק
 * ב-`w:ind` של פסקאות; ראו ההערה ב-page-ruler.ts). לכן ההשוואה לפיקסלים היא
 * ישרה, ואותה נוסחה משרתת מסמך עברי ולועזי.
 */
import {
  watchAllPageRects,
  type IndexedPageRect,
  type PageRectWatch,
  type ViewportSource,
} from './page-ruler';
import type { PageMarginsState } from './page-setup';

/** מה שנצרך מ-`PageMarginsState` לחישוב הפסים — טוויפס בלבד, בלי DOM. */
export type TextBandGeometry = Pick<
  PageMarginsState,
  | 'pageWidthTwips'
  | 'pageHeightTwips'
  | 'leftTwips'
  | 'rightTwips'
  | 'effectiveTopTwips'
  | 'effectiveBottomTwips'
>;

/**
 * האם הנקודה (ביחס לאותו ייחוס שהמלבנים נמדדו בו) בתוך פס הטקסט של אחד
 * העמודים. גיאומטריה טהורה — נבדקת ב-tests/unit/text-cursor.test.ts.
 *
 * היחס טוויפס→פיקסלים נגזר מכל עמוד בנפרד (מלבנו המצויר כבר כולל זום),
 * ולכן אין כאן צורך לדעת את הזום עצמו.
 */
export function pointInTextArea(
  xPx: number,
  yPx: number,
  pages: readonly IndexedPageRect[],
  geometry: TextBandGeometry,
): boolean {
  if (!(geometry.pageWidthTwips > 0) || !(geometry.pageHeightTwips > 0)) return false;

  for (const page of pages) {
    const leftPx = page.leftPx + (geometry.leftTwips / geometry.pageWidthTwips) * page.widthPx;
    const rightPx =
      page.leftPx + page.widthPx - (geometry.rightTwips / geometry.pageWidthTwips) * page.widthPx;
    const topPx =
      page.topPx + (geometry.effectiveTopTwips / geometry.pageHeightTwips) * page.heightPx;
    const bottomPx =
      page.topPx +
      page.heightPx -
      (geometry.effectiveBottomTwips / geometry.pageHeightTwips) * page.heightPx;

    if (xPx >= leftPx && xPx <= rightPx && yPx >= topPx && yPx <= bottomPx) return true;
  }
  return false;
}

/** השקטה בין קריאת שוליים לקריאה — אותו ערך וטעם כמו PAGE_BORDERS_DEBOUNCE_MS. */
export const TEXT_CURSOR_DEBOUNCE_MS = 300;

export interface TextCursorWatchOptions {
  /** ה-div שלנו שהמנוע מצייר לתוכו. מגיע מ-`paintedHost`. */
  host: HTMLElement | null;
  /** ה-controller, בשביל `viewport.observe` — כמו כל שכבות הציור. */
  ui?: ViewportSource | null;
  /** קריאת השוליים — `readPageMargins(superdoc)` אצל הקורא. */
  readMargins: () => Promise<PageMarginsState | null>;
}

export interface TextCursorWatch {
  /** קריאה מיידית + מדידה — אחרי פתיחת מסמך. */
  refreshNow(): void;
  /** קריאה מושהית — אחרי שינוי במסמך (שוליים משתנים דרך `onUpdate`). */
  noteDocumentChanged(): void;
  dispose(): void;
}

/**
 * מרכיבה את המעקב: שוליים (מודל עם השקטה, אותה תבנית כמו `createPageBorderModel`)
 * ומלבני עמודים (`watchAllPageRects` — גלילה, שינוי גודל, `viewport.observe`),
 * ומאזין `mousemove` שמחליט על הסמן. `host === null` מחזיר עצם דומם — אותה
 * התנהגות כמו כל השכבות כשאין מסמך.
 */
export function createTextCursorWatch(options: TextCursorWatchOptions): TextCursorWatch {
  const { host, ui, readMargins } = options;

  let margins: PageMarginsState | null = null;
  let rects: readonly IndexedPageRect[] = [];
  let lastPoint: { xPx: number; yPx: number } | null = null;
  let showing = false;
  let disposed = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * גם על שינוי גיאומטריה, לא רק על תזוזת עכבר: גלילה מתחת למצביע נייח
   * מזיזה את העמוד בלי אירוע עכבר, והסמן חייב להתעדכן איתה.
   */
  function apply(): void {
    if (!host || disposed) return;
    const inside =
      lastPoint !== null &&
      margins !== null &&
      pointInTextArea(lastPoint.xPx, lastPoint.yPx, rects, margins);
    if (inside === showing) return;
    showing = inside;
    host.style.cursor = inside ? 'text' : '';
  }

  function onMove(event: MouseEvent): void {
    if (!host) return;
    // המרה לאותו ייחוס שהמלבנים נמדדו בו (reference === host).
    const box = host.getBoundingClientRect();
    lastPoint = { xPx: event.clientX - box.left, yPx: event.clientY - box.top };
    apply();
  }

  function onLeave(): void {
    lastPoint = null;
    apply();
  }

  host?.addEventListener('mousemove', onMove, { passive: true });
  host?.addEventListener('mouseleave', onLeave, { passive: true });

  const watcher: PageRectWatch | null = host
    ? watchAllPageRects({
        host,
        reference: host,
        ui,
        onChange: (next) => {
          rects = next;
          apply();
        },
      })
    : null;

  async function read(): Promise<void> {
    const mine = ++generation;
    let next: PageMarginsState | null;
    try {
      next = await readMargins();
    } catch {
      next = null;
    }
    if (disposed || mine !== generation) return;
    margins = next;
    apply();
  }

  return {
    refreshNow() {
      void read();
      watcher?.measure();
    },
    noteDocumentChanged() {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(() => void read(), TEXT_CURSOR_DEBOUNCE_MS);
    },
    dispose() {
      disposed = true;
      generation += 1;
      clearTimeout(timer);
      watcher?.dispose();
      host?.removeEventListener('mousemove', onMove);
      host?.removeEventListener('mouseleave', onLeave);
      // הסמן אינו נשאר „טקסט" על host שהמסמך שלו כבר נסגר.
      if (host && showing) host.style.cursor = '';
    },
  };
}
