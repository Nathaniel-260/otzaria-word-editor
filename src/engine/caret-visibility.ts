/**
 * „מקלידים ולא רואים” — הדף שאינו זז מצד לצד בחלון צר.
 *
 * ## הדיווח
 *
 * „יש בעיה בהקלדה כשהחלון קטן — לא מזיזה את הדף מצד לצד.”
 *
 * ## מה נמדד (CDP על ה-dist הארוז, superdoc 2.14.0-next.5, מסמך עברי)
 *
 * הגרסה היא זו שהייתה **מותקנת** בזמן המדידה, ולא זו ש-package.json מכריז
 * עליה (2.15.0) — `node_modules` פיגר אחריה, וכל מה שנמדד כאן רץ על המותקן.
 *
 * עמוד A4 הוא 794px, ומיכל הגלילה שלנו (`.editor-stack__host`) צר ממנו ברגע
 * שהחלון יורד מתחת ל-‎~800px. המיכל הוא `direction: ltr` — הצהרה על צד פס
 * הגלילה, ראו styles/shell.css — ולכן הוא **נח על `scrollLeft = 0`, שהוא
 * הקצה השמאלי**. במסמך עברי הקצה השמאלי הוא *סוף* השורה, וכל צד תחילת-השורה
 * נשאר מחוץ לתצוגה.
 *
 * בחלון של 600px מיכל הגלילה מדווח `clientWidth` 585 — פס הגלילה האנכי
 * גורע את ההפרש — מול `scrollWidth` 794, כלומר 209px של גלילה זמינה:
 *
 * | מה נעשה | `scrollLeft` | x של הסמן | תצוגה נגמרת ב- |
 * |---|---|---|---|
 * | הבחירה הועברה לתחילת השורה | 0 | 698 | 585 — **מחוץ למסך** |
 * | `ui.viewport.scrollIntoView`, שלושת ה-`block` | **0** | 698 | לא זז |
 * | הוקלדו 3 תווים | **0** | 672 | נכנסו ל-OOXML, לא נראים |
 * | בקרה: `scrollLeft = max` ביד | 209 | 463 | גלוי |
 *
 * שתי השורות האמצעיות הן הפער עצמו: הטקסט **כן** נכנס למסמך (ההיסט עלה
 * מ-0 ל-3 וה-OOXML מאשר), והסמן פשוט מצויר במקום שאי אפשר לראות. שורת
 * הבקרה היא שמוכיחה שאין כאן מניעה — הגלילה זמינה, ואיש אינו מבצע אותה.
 *
 * ## למה לא `ui.viewport.scrollIntoView`
 *
 * מפני שהוא **מחזיר `{ success: true }` ואינו מזיז את הציר האופקי** — נמדד
 * על שלושת ערכי ה-`block` (`nearest`, `center`, `start`), עם הסמן מחוץ
 * לתצוגה, `scrollLeft` 0 לפני ו-0 אחרי. הציר האנכי שלו תקין ואינו נוגע כאן.
 * זה גם מה שמונע „סתם לקרוא ל-API של המנוע”: קריאה כזאת עוברת בהצלחה
 * מדווחת ואינה עושה דבר, כלומר היא תיקון שנראה כתוב ואינו קיים.
 *
 * ## מה כן, ולמה זה לגיטימי
 *
 * מיכל הגלילה הוא **שלנו** (`sessions/editor-swap.ts` יוצר אותו, ו-shell.css
 * מגדיר אותו), ולכן גלילה שלו אינה נגיעה בפנימיות המנוע. אותו שיקול בדיוק
 * כמו ב-engine/rtl-line-end.ts.
 *
 * ## האות: `ui.selection.subscribe`, ולא ה-DOM
 *
 * נמדד שאלמנט הסמן (`.sd-v2-local-selection-caret`) **נהרס ונוצר מחדש בכל
 * הקשה** — המזהה שהוצמד לו משתנה, ואין עליו מוטציית `style` להאזין לה —
 * והוא חוזר למקומו רק ‎~200ms אחרי ההקשה (נמדד בדגימה פר-פריים: הסמן נעלם
 * ב-68ms וחוזר ב-201ms). כלומר `keydown` ועוד `requestAnimationFrame` הוא
 * תזמון שנשען על מזל.
 *
 * `ui.selection.subscribe` הוא API ציבורי, והוא יורה בדיוק כשהבחירה זזה.
 * לצדו `ui.selection.getAnchorRect()` מחזיר את מלבן הסמן **בקואורדינטות
 * חלון** — נמדד `left: 777.47` מול `777` שה-DOM דיווח על אותו סמן, ובחלון
 * הצר `615` מול `615`. הוא גם מקדים את ה-DOM: באירוע השני של הקשה הוא כבר
 * מחזיר מלבן בעוד `document.querySelector` על הסמן מחזיר `null`. כלומר
 * הגלילה יוצאת לדרך יחד עם ציור התו, ולא אחריו.
 *
 * ## מה מכוון בכוונה
 *
 * **הציר האופקי בלבד.** הציר האנכי של המנוע נמדד תקין, ומי שיגלול גם אותו
 * רק ייכנס איתו להתגוששות.
 *
 * **בלי אנימציה.** הגלילה היא המשך של ההקלדה, לא ניווט שהמשתמש ביקש; אנימציה
 * בכל תו היא בדיוק התחושה שהמודול נועד להסיר. אותו שיקול כמו ב-`scrollTo`
 * של engine/caret-anchor.ts.
 *
 * **שינוי גודל חלון אינו מפעיל כאן דבר.** גרירת החלון אינה בקשה לזוז — אותה
 * הכרעה שכבר נשמרה ב-`refresh` של engine/zoom-center.ts — והקלדה ראשונה
 * ממילא מחזירה את הסמן לתצוגה.
 */

/** מלבן בקואורדינטות חלון, בחלק שנצרך כאן. */
export interface EdgeSpan {
  left: number;
  right: number;
}

/**
 * המרווח שמעבר לסמן, בפיקסלי CSS.
 *
 * סמן שמוצמד בדיוק לקצה התצוגה נראה כאילו הוא עומד ליפול ממנה, ובעברית הוא
 * גם מסתיר את מה שנכתב לפניו. 48px הוא בערך רוחב מילה, כלומר „רואים לאן
 * ממשיכים” — וגם מה שמונע גלילה מחדש בכל תו בודד.
 */
export const CARET_MARGIN_PX = 48;

/**
 * כמה להוסיף ל-`scrollLeft` כדי שהסמן ייכנס לתצוגה, או 0 כשאין מה לעשות.
 *
 * המיכל הוא `ltr`, ולכן `scrollLeft` חיובי בטווח `[0, max]` ודלתא חיובית
 * חושפת ימינה. זה נכון גם למסמך עברי: הכיווניות משפיעה על **היכן** הסמן
 * נמצא, לא על מודל הגלילה של המיכל שמחזיק אותו.
 *
 * המרווח נחתך לרבע מרוחב התצוגה. בלי החיתוך, מאגס צר מ-‎192px היה מקבל שני
 * גבולות מוחלפים (`min > max`) — כלומר כל מיקום סמן מפר את שניהם, וכל תיקון
 * של האחד מפר את השני. עם החיתוך נשאר תמיד חצי מרוחב התצוגה בין הגבולות.
 */
export function horizontalScrollDelta(caret: EdgeSpan, view: EdgeSpan, margin: number): number {
  const width = view.right - view.left;
  if (!Number.isFinite(width) || width <= 0) return 0;
  if (!Number.isFinite(caret.left) || !Number.isFinite(caret.right)) return 0;

  const pad = Math.max(0, Math.min(margin, width / 4));
  const min = view.left + pad;
  const max = view.right - pad;

  // הקצה הימני קודם: בעברית שם מתחילה השורה, ולכן שם הסמן נמצא אחרי כל
  // `Enter` — המקרה השכיח, ולא הקצה.
  if (caret.right > max) return caret.right - max;
  if (caret.left < min) return caret.left - min;
  return 0;
}

/** המלבן שהמנוע מדווח. שאר השדות (`pageIndex`, `top`, ...) אינם נצרכים כאן. */
interface AnchorRectLike {
  left?: unknown;
  right?: unknown;
}

/**
 * מה שנצרך מ-`superdoc.ui`. מוגדר כאן ולא מיובא — ההסבר ב-document-api.ts.
 * גרסת מנוע בלי ההידיות האלה מקבלת ידית ריקה, ולא שגיאה.
 */
export interface CaretVisibilityUi {
  selection?: {
    subscribe?: (listener: () => void) => unknown;
    getAnchorRect?: () => AnchorRectLike | null | undefined;
  } | null;
}

export interface CaretVisibilityHandle {
  /** מביאה את הסמן לתצוגה עכשיו. מוחזרת כדי שהשער יוכל למדוד קריאה יזומה. */
  follow(): void;
  dispose(): void;
}

export interface CaretVisibilityOptions {
  /** מיכל הגלילה שהמנוע מצייר בתוכו — `paintedHost(editor.ui)`. */
  host: HTMLElement | null;
  /** ה-`ui` של אותו מסמך. */
  ui: CaretVisibilityUi | null | undefined;
  /** דריסה לבדיקות; בפועל תמיד `CARET_MARGIN_PX`. */
  margin?: number;
}

/** מספר, או `null` כשהמנוע דיווח משהו שאינו מספר. */
function edge(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * מחברת את מעקב הסמן למסמך אחד.
 *
 * הביטול מגיע מ-`subscribe` עצמו: נמדד שהוא מחזיר פונקציה. ערך אחר פירושו
 * גרסת מנוע שאיננו יודעים לפרק ממנה, והידית מוותרת על הביטול במקום לנחש.
 */
export function installCaretVisibility({ host, ui, margin = CARET_MARGIN_PX }: CaretVisibilityOptions): CaretVisibilityHandle {
  const subscribe = ui?.selection?.subscribe;
  const getAnchorRect = ui?.selection?.getAnchorRect;

  const follow = (): void => {
    if (!host || typeof getAnchorRect !== 'function') return;

    // אין גלישה — אין מה לגלול, וזו גם היציאה הזולה של הרוב המכריע של
    // הקריאות: בחלון רגיל העמוד נכנס במלואו.
    const overflow = host.scrollWidth - host.clientWidth;
    if (overflow <= 0) return;

    let rect: AnchorRectLike | null | undefined;
    try {
      rect = getAnchorRect.call(ui!.selection);
    } catch {
      return;
    }
    // נמדד: באירוע הראשון של כל הקשה המנוע עדיין מחזיר `null`, ורק באירוע
    // שאחריו יש מלבן. יציאה שקטה, והאירוע הבא הוא זה שיגלול.
    const left = edge(rect?.left);
    const right = edge(rect?.right);
    if (left === null || right === null) return;

    // תיבת התוכן, ולא קופסת הגבול: פס הגלילה האנכי גורע 15px מהקצה הימני
    // (המיכל `ltr`), וסמן שיושב מתחתיו אינו נראה. `clientWidth` מכיר בו,
    // `getBoundingClientRect().width` אינו.
    const box = host.getBoundingClientRect();
    const viewLeft = box.left + host.clientLeft;
    const delta = horizontalScrollDelta({ left, right }, { left: viewLeft, right: viewLeft + host.clientWidth }, margin);
    if (delta === 0) return;

    host.scrollLeft = Math.min(Math.max(host.scrollLeft + delta, 0), overflow);
  };

  let unsubscribe: (() => void) | null = null;
  if (typeof subscribe === 'function') {
    const result = subscribe.call(ui!.selection, follow);
    if (typeof result === 'function') unsubscribe = result as () => void;
  }

  return {
    follow,
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
