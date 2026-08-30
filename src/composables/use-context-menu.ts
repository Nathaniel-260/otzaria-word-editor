/**
 * מי פותח את תפריט ההקשר, מתי, ועל מה הוא פועל.
 *
 * ## הבעיה שהמודול הזה קיים בשבילה
 *
 * במנוע הזה לחיצה ימנית **אינה מזיזה את הסמן**. זה נמדד
 * (`scripts/context-menu-probe.mjs`, שער ש3ב): לחיצה ימנית על פסקה אחרת
 * השאירה את הבחירה בפסקה הקודמת, בעוד לחיצה שמאלית באותה נקודה בדיוק כן הזיזה
 * אותה. תפריט הקשר שנפתח כך היה משקר: הוא נראה כאילו הוא מדבר על מה שנלחץ,
 * ופועל על מה שנבחר קודם.
 *
 * שני ממצאים נוספים מאותה מדידה הם מה שמאפשר לתקן את זה בלי לגעת במנוע:
 *
 *   ש8  ל-`ui.selection` יש `getRects` — המלבנים שהבחירה **מצוירת** בהם.
 *       כלומר אפשר לשאול „האם הנקודה שנלחצה בתוך הבחירה” בלי שום hit-test על
 *       ה-DOM של המנוע, שממילא אסור (tests/unit/engine-boundaries.test.ts).
 *   ש9  לחיצה שמאלית **מסונתזת** כן מזיזה את הסמן.
 *
 * מכאן ההתנהגות, שהיא בדיוק זו של Word: לחיצה ימנית בתוך הבחירה משאירה אותה;
 * מחוצה לה מזיזה את הסמן לנקודה, ואז נפתח התפריט.
 *
 * ## למה התצלום נלקח לפני שהכרטיס נפרס
 *
 * „האם יש בחירה” ו„מה המנוע תומך בו” הן שתי קריאות א-סינכרוניות (~8ms יחד).
 * פתיחה לפניהן פירושה פריים אחד שבו „גזור” פעיל בלי בחירה — כלומר בדיוק
 * ההבטחה השקרית שכל התוסף הזה בנוי לא לתת. לכן: קוראים, ואז פותחים.
 */
import { ref, type Ref } from 'vue';
import type { SuperDoc } from 'superdoc';
import { readDocSelection, type DocSelectionSnapshot } from '../engine/doc-selection';
import { readDocCapabilities, type DocCapabilityQuestion } from '../engine/doc-capabilities';
import { copySelection, cutSelection, pasteFromClipboard } from '../engine/clipboard';
import { focusDocument } from '../engine/focus';
import { markSyntheticPointer } from '../engine/word-selection';
import { isTextEntryTarget } from '../ui/shortcuts/dispatch';
import type { ShellAction } from '../ui/shortcuts/registry';
import {
  contextMenuModel,
  type ContextMenuEntry,
  type ContextMenuSection,
} from '../ui/menu/context-menu-model';
import type { MenuPoint } from '../ui/menu/menu-placement';
import type { CommandReporter } from './keys';

/** המשטח שהלחיצה נחתה בו, ומה מגיע לו. */
type Surface =
  /** אזור המסמך — התפריט שלנו, והסמן זז ללחיצה. */
  | 'document'
  /**
   * התפריט נפתח, אבל **הסמן אינו זז**: הרצועה המוסתרת במצב מיקוד. שם אין
   * טקסט למקם בו סמן, ולחיצה מסונתזת הייתה נוחתת על כפתור של הרצועה ומפעילה
   * אותו — „מסמך חדש” שרץ מלחיצה ימנית הוא מסמך פתוח שנעלם.
   */
  | 'menu-only'
  /**
   * שדה טקסט של הממשק שלנו. שם דווקא **ברירת המחדל של WebView2** היא הנכונה:
   * „הדבק” הנייטיבי שלה עובד בלי הרשאת `clipboard.read`, שהיא של המאכסן
   * ואינה בידינו (engine/clipboard.ts). תפריט משלנו שם היה גורע יכולת.
   */
  | 'native'
  /** רצועה, שורת מצב — אין תפריט, וגם לא של המאכסן. */
  | 'blocked';

export interface ContextMenuDeps {
  superdoc: Ref<SuperDoc | null>;
  /** האם היעד בתוך אזור המסמך. אותה פונקציה שהקיצורים משתמשים בה. */
  isDocumentSurface: (target: EventTarget | null) => boolean;
  /** שורש המעטפת — נדרש למצב מיקוד, ראו `surfaceOf`. */
  shell: Ref<HTMLElement | null>;
  isFocusMode: Ref<boolean>;
  isModalOpen: () => boolean;
  runAction: (action: ShellAction) => boolean;
  report: CommandReporter;
}

export interface ContextMenuController {
  isOpen: Ref<boolean>;
  point: Ref<MenuPoint | null>;
  sections: Ref<readonly ContextMenuSection[]>;
  /** מטפל באירוע `contextmenu`. מוחזר כדי שהמעטפת תקשור אותו איפה שהיא רוצה. */
  handleContextMenu: (event: MouseEvent) => void;
  /** פתיחה מהמקלדת — על מלבן הסמן. `false` = אין עוגן, ולכן לא נפתח. */
  openAtCaret: () => boolean;
  close: () => void;
  run: (entry: ContextMenuEntry) => void;
}

interface ViewportRectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SelectionHandleLike {
  getRects?: (input?: { relativeTo?: HTMLElement }) => readonly ViewportRectLike[];
  getAnchorRect?: (input?: { placement?: 'start' | 'end' | 'center' }) => ViewportRectLike | null;
}

/** `superdoc.ui.selection`, בקריאה מגוננת: גרסת מנוע אחרת עשויה לא לחשוף אותו. */
function selectionHandle(superdoc: SuperDoc | null): SelectionHandleLike | null {
  const handle = (superdoc as unknown as { ui?: { selection?: SelectionHandleLike } } | null)?.ui
    ?.selection;
  return handle ?? null;
}

function rectsOf(superdoc: SuperDoc | null): readonly ViewportRectLike[] {
  const handle = selectionHandle(superdoc);
  if (typeof handle?.getRects !== 'function') return [];
  try {
    return handle.getRects() ?? [];
  } catch {
    // גיאומטריה שאינה זמינה אינה סיבה לא לפתוח תפריט.
    return [];
  }
}

function pointInRects(point: MenuPoint, rects: readonly ViewportRectLike[]): boolean {
  return rects.some(
    (rect) =>
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom,
  );
}

/**
 * מזיזה את הסמן לנקודה בלחיצה שמאלית מסונתזת (ש9).
 *
 * הרצף המלא ולא `click` בלבד: המנוע פותר את המיקום ב-`pointerdown`, ובלי
 * `pointerup`/`mouseup` הוא נשאר במצב גרירה — כלומר הבחירה הבאה של המשתמש
 * מתחילה משם.
 *
 * ## מה שהיעד חייב לעבור לפני שמשגרים אליו
 *
 * הלחיצה הזאת היא לחיצה לכל דבר: מה שיושב תחת הנקודה **יופעל**. ואזור המסמך
 * אינו רק טקסט — המנוע מצייר בתוכו פקדים חיים (כפתורי „אפשרויות” ו„×” של
 * עריכת כותרת, ראו engine/hf-chrome.ts), והתפריט שלנו עצמו יכול להיות פתוח
 * מעליו. בלי הסינון כאן, לחיצה ימנית על ה„×” של הכותרת הייתה **יוצאת מעריכת
 * הכותרת**, ולחיצה ימנית על פריט בתפריט הפתוח הייתה מריצה אותו.
 *
 * הכלל: משגרים רק כשמתחת לנקודה יש משטח מסמך שאינו פקד, ואינו התפריט שלנו.
 */
function moveCaretTo(point: MenuPoint, isDocumentSurface: (target: EventTarget | null) => boolean): void {
  // `elementFromPoint` הוא של הדפדפן ולא של המנוע, וסביבה שאין בה אותו (jsdom)
  // פשוט אינה מזיזה סמן. נפילה כאן הייתה מפילה את כל הטיפול בלחיצה הימנית.
  if (typeof document.elementFromPoint !== 'function') return;

  const target = document.elementFromPoint(point.x, point.y);
  if (!target) return;
  if (!isDocumentSurface(target)) return;
  if (target.closest('[data-context-menu]')) return;
  // פקד שהמנוע צייר בתוך אזור המסמך. `button` ו-`[role=button]` ולא שאילתה על
  // מחלקות המנוע — זה גם מה ש-tests/unit/engine-boundaries.test.ts מתיר.
  if (target.closest('button, a, [role="button"], input, select, textarea')) return;

  // בלי `view`: הוא אינו נדרש למה שהמנוע קורא (קואורדינטות וכפתור), והוא
  // דווקא מה שנופל כשהאירוע נבנה מול חלון שאינו אותו realm.
  const shared = {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
  };
  const pointer = { ...shared, pointerId: 1, isPrimary: true, pointerType: 'mouse' };

  /**
   * `PointerEvent` אינו קיים בכל סביבה (jsdom אינו מממש אותו), ובלי הנפילה
   * לאחור כאן כל הטיפול בלחיצה הימנית היה זורק שם. ב-WebView2, שהוא Chromium,
   * זה תמיד המסלול הראשון.
   */
  const Pointer = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  const send = (event: Event): void => {
    target.dispatchEvent(markSyntheticPointer(event));
  };

  // כל אירוע מסומן כשלנו: `installWordSelection` סופר לחיצות לזיהוי לחיצה
  // כפולה, ולחיצה שאנחנו שיגרנו אינה אמורה להיספר שם.
  send(new Pointer('pointerdown', { ...pointer, buttons: 1 }));
  send(new MouseEvent('mousedown', { ...shared, buttons: 1 }));
  send(new Pointer('pointerup', { ...pointer, buttons: 0 }));
  send(new MouseEvent('mouseup', { ...shared, buttons: 0 }));
  send(new MouseEvent('click', { ...shared, buttons: 0, detail: 1 }));
}

/** `{kind:'story', storyType:'body'}` — כפי שנמדד. כל צורה אחרת היא „לא ידוע”. */
function storyTypeOf(story: unknown): string | null {
  if (!story || typeof story !== 'object') return null;
  const value = (story as { storyType?: unknown }).storyType;
  return typeof value === 'string' ? value : null;
}

export function useContextMenu(deps: ContextMenuDeps): ContextMenuController {
  const isOpen = ref(false);
  const point = ref<MenuPoint | null>(null);
  const sections = ref<readonly ContextMenuSection[]>([]);

  /**
   * הסדר כאן אינו קוסמטי: משטח ההקלדה של המנוע הוא `<textarea>` **בתוך** אזור
   * המסמך (ui/shortcuts/dispatch.ts), ולכן שאלת „שדה טקסט” לפני שאלת „אזור
   * המסמך” הייתה מוסרת את המסמך עצמו לתפריט של WebView2.
   */
  function surfaceOf(target: EventTarget | null): Surface {
    if (deps.isDocumentSurface(target)) return 'document';
    if (isTextEntryTarget(target)) return 'native';

    // במצב מיקוד הפסים מוסתרים (`opacity:0; pointer-events:none`) אך שומרים על
    // הפריסה, ולכן הרצועה העליונה נקראת למשתמש כמסמך. התפריט כן נפתח שם — אבל
    // `menu-only`, כלומר בלי להזיז את הסמן: מתחת לנקודה יושבת הרצועה, ולא
    // טקסט. הרצועה גם חוזרת ל-`pointer-events: auto` ברגע שהיא נחשפת בריחוף.
    if (deps.isFocusMode.value) {
      const shell = deps.shell.value;
      if (shell && target instanceof Node && shell.contains(target)) return 'menu-only';
    }
    return 'blocked';
  }

  /**
   * מונה הבקשות. כל פתיחה וכל סגירה מקדמות אותו, ותצלום שחוזר עם מונה ישן
   * נזרק.
   *
   * בלעדיו שתי תקלות אמיתיות: גלגלת (או Escape) בין הלחיצה לבין שובן של שתי
   * הקריאות הייתה **מחזירה את התפריט אחרי שנסגר**, מעוגן לנקודה שהתוכן כבר
   * גלל ממנה; ושתי לחיצות ימניות מהירות בשתי נקודות היו נותנות את הדגם של
   * הראשונה על הסמן של השנייה — מי שחזר אחרון ניצח, ולא מי שנלחץ אחרון.
   */
  let request = 0;

  /**
   * חלון מודאלי פתוח — ואז אין תפריט הקשר, גם לא מהמקלדת.
   *
   * `deps.isModalOpen` מכיר שלושה חלונות שהמעטפת מחזיקה בעצמה, אבל
   * `aria-modal` מוצהר ב-17 פאנלים שחיים בתוך לשוניות הרצועה עם מצב מקומי —
   * „פסקה…”, „גופן…”, „הערה…” וכל השאר. תפריט שנפתח מתחת לאחד מהם (הוא
   * ב-z-index נמוך יותר) גונב את המיקוד ממלכודת המיקוד של הדיאלוג, ואז
   * `Escape` סוגר תפריט בלתי נראה במקום את הדיאלוג. השאלה על ה-DOM היא
   * היחידה שיודעת את כולם.
   */
  function isBlockedByModal(): boolean {
    if (deps.isModalOpen()) return true;
    return document.querySelector('[aria-modal="true"]') !== null;
  }

  function close(): void {
    request += 1;
    isOpen.value = false;
    point.value = null;
    sections.value = [];
  }

  /**
   * האם מותר להזיז את הסמן לנקודה שנלחצה.
   *
   * ## למה זה לא נשען על הגיאומטריה, אף שהיא נראתה כמו התשובה
   *
   * הרעיון המקורי היה `getRects()`: „הנקודה בתוך מלבני הבחירה — אל תיגע”.
   * המדידה (שער ש10/ש11) הראתה שהמלבנים **ריקים תמיד** בהרכבה הזאת, וגם
   * `ui.selection.getSnapshot().empty` מדווח `true` בזמן ש-`doc.selection.current()`
   * מחזיר טווח בן 61 תווים. כלומר התנאי ענה „מחוץ לבחירה” תמיד, וכל לחיצה
   * ימנית הזיזה את הסמן — מה שדווח מהשטח כ„מדגיש קטע, לוחץ ימני, וההדגשה
   * נעלמת”.
   *
   * הכלל שהחליף אותו אינו זקוק לגיאומטריה בכלל: **בחירה קיימת לא נהרסת.**
   * כשיש טווח, התפריט מדבר עליו; כשיש סמן בלבד אין מה לאבד, ולכן הוא זז
   * ללחיצה — וזה גם המצב הנפוץ, „לחצתי ימני על מילה”.
   *
   * המלבנים נשארו כשכלול: ביום שהם יחזרו, נקודה שנופלת **בתוכם** תעצור את
   * ההזזה גם בלעדיהם. הם לעולם אינם מתירים הזזה שהכלל אוסר.
   *
   * ## למה `selection.empty` ולא `hasRange || text`
   *
   * `hasRange` נגזר מ„קטע שאפשר לעטוף בקישור” (doc-selection.ts) — וזה
   * משאיר מחוץ להגנה בחירת **אובייקט** (תא בטבלה, תמונה, שורה שלמה): שם
   * `target` הוא `null` וגם `hasRange` וגם `text` יוצאים `false`, למרות
   * שהבחירה קיימת וממשית. `SelectionInfo.empty` של המנוע מוגדר "True when
   * the selection is empty (cursor only, no range)" — בדיוק השאלה שנשאלת
   * כאן, ולא רק על טווח טקסט שאפשר לעטוף.
   */
  function mayMoveCaret(at: MenuPoint, selection: DocSelectionSnapshot, host: SuperDoc): boolean {
    if (!selection.empty) return false;
    return !pointInRects(at, rectsOf(host));
  }

  /**
   * התצלום: בחירה, יכולות ו-story — ואחרי הזזת הסמן, לא לפניה. לחיצה ימנית
   * בכותרת עליונה מזיזה את הסמן לתוך ה-story שלה, ותצלום שנלקח קודם היה מציע
   * שם „הערת שוליים”.
   */
  async function openAt(at: MenuPoint, surface: Surface = 'document'): Promise<void> {
    const host = deps.superdoc.value;
    if (!host) return;

    request += 1;
    const token = request;

    if (surface === 'document') {
      const before = await readDocSelection(host, { includeText: true });
      if (token !== request || deps.superdoc.value !== host) return;
      if (mayMoveCaret(at, before, host)) moveCaretTo(at, deps.isDocumentSurface);
    }

    const [selection, capabilities] = await Promise.all([
      readDocSelection(host, { includeText: true }),
      readDocCapabilities(host),
    ]);

    // המסמך יכול היה להתחלף באמצע — ואז התצלום מתאר מסמך שכבר אינו על המסך.
    // ומודאל יכול היה להיפתח באמצע — ואז „תפריט פתוח מעל מודאל”, המצב ש-
    // isBlockedByModal קיים כדי למנוע (ראו ההערה שם), נוצר דרך הפער הזה במקום.
    if (token !== request || deps.superdoc.value !== host || isBlockedByModal()) return;

    const built = contextMenuModel({
      // `available` ולא `true`: כשה-Document API אינו מוכן כל היכולות שקריות
      // וכל הפקדים אפורים, וכרטיס מלא בפקדים מתים הוא בדיוק מה שהמודל אמור
      // למנוע בענף „אין מסמך”.
      hasDocument: capabilities.available,
      hasRange: selection.hasRange,
      storyType: storyTypeOf(selection.story),
      can: (question: DocCapabilityQuestion) => capabilities.can(question),
    });
    // מקטעים ריקים (למשל המסמך עדיין נטען) הם „אין מה להציג”, לא „תפריט פתוח
    // בלי תוכן”: ContextMenu.vue ממילא לא מרנדר (`sections.length > 0`), ובלי
    // התנאי הזה isOpen נשאר true על תפריט בלתי-נראה — ו-Escape הבא נבלע על
    // ידי closeTopmost's contextMenu.isOpen branch בלי אפקט.
    if (built.length === 0) return;

    sections.value = built;
    point.value = at;
    isOpen.value = true;
  }

  function handleContextMenu(event: MouseEvent): void {
    const surface = surfaceOf(event.target);
    if (surface === 'native') return;

    // מכאן והלאה התפריט של WebView2 לא ייפתח, גם כשאנחנו לא פותחים משלנו:
    // הוא חושף פריטים של המאכסן בתוך דף של תוסף.
    event.preventDefault();
    if (surface === 'blocked' || isBlockedByModal() || !deps.superdoc.value) return;

    /**
     * `contextmenu` שנולד מהמקלדת אינו לחיצה. הדפדפן משגר אותו כפעולת ברירת
     * המחדל של `Shift+F10` ומקש התפריט, עם `button: 0` ו-`detail: 0`,
     * ובקואורדינטות שהוא בחר — ומי שמתייחס אליו כאל לחיצה מזיז את הסמן לנקודה
     * שרירותית ופותח שם. העוגן הנכון במקרה הזה הוא הסמן עצמו.
     */
    if (event.button !== 2 && event.detail === 0) {
      openAtCaret();
      return;
    }

    void openAt({ x: event.clientX, y: event.clientY }, surface);
  }

  /**
   * `Shift+F10` ומקש התפריט. העוגן הוא מלבן הסמן המצויר
   * (`ui.selection.getAnchorRect`) — כלומר התפריט נפתח היכן שהמשתמש עומד, ולא
   * בפינה שרירותית.
   */
  function openAtCaret(): boolean {
    const host = deps.superdoc.value;
    if (!host || isBlockedByModal()) return false;

    const handle = selectionHandle(host);
    let rect: ViewportRectLike | null = null;
    try {
      rect = handle?.getAnchorRect?.({ placement: 'end' }) ?? null;
    } catch {
      rect = null;
    }
    if (!rect) return false;

    // מהמקלדת אין נקודה שנלחצה, ולכן אין מה להזיז: `menu-only`.
    void openAt({ x: rect.right, y: rect.bottom }, 'menu-only');
    return true;
  }

  /**
   * הרצה. פקודות מנוע כבר רצו בפקד עצמו (ContextMenuButton), ולכן כאן נשארו
   * שני הסוגים האחרים. `focusDocument` לפניהם: הוא קורא
   * `focus({restoreSelection:true})`, וזה מה שמחזיר את המסמך למצב שבו הפעולה
   * מתייחסת לבחירה שהתפריט נפתח עליה.
   */
  function run(entry: ContextMenuEntry): void {
    const host = deps.superdoc.value;
    focusDocument(host);

    if (entry.run.kind === 'action') {
      deps.runAction(entry.run.action);
      return;
    }

    if (entry.run.kind === 'clipboard') {
      const op = entry.run.op;
      void (async () => {
        if (op === 'copy') deps.report(await copySelection(host), 'clipboard-copy');
        else if (op === 'cut') deps.report(await cutSelection(host), 'clipboard-cut');
        else deps.report(await pasteFromClipboard(host), 'clipboard-paste');
      })();
    }
  }

  return { isOpen, point, sections, handleContextMenu, openAtCaret, close, run };
}
