/**
 * המנתב של קיצורי המקלדת: אירוע אחד נכנס, רשומה אחת מהרג'יסטרי רצה.
 *
 * הוא מחזיק את שלוש ההכרעות שקודם היו פזורות ב-`App.vue`, ולכן לא היו נבדקות:
 * מה קורה כשהפוקוס בשדה טקסט, מה קורה כשדיאלוג פתוח, ומתי מותר לבלוע את
 * ההתנהגות של הדפדפן.
 */
import type { CommandId } from '../../engine/capabilities';
import { matchAny } from './match';
import { SHORTCUTS, type ShellAction, type Shortcut } from './registry';

/**
 * האם הפוקוס בשדה טקסט של הממשק **שלנו** — שם המסמך, שדות החיפוש, בוררים.
 * שם `Ctrl+F` הוא הקיצור של השדה, ואסור לנו לדרוס אותו.
 *
 * אזור המסמך של המנוע אינו נכלל כאן בכוונה: הוא אזור עריכה של הדפדפן, ודווקא
 * בו קיצורי המסמך חייבים לעבוד. הבדיקה היא על `tagName` ועל `role` ולא על
 * מאפיין העריכה, גם מפני ששאילתה כזאת על ה-DOM הפנימי של SuperDoc אסורה
 * (tests/unit/engine-boundaries.test.ts).
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return element?.getAttribute?.('role') === 'textbox';
}

export interface ShortcutDispatcherDeps {
  /** מריצה פקודת מנוע. אותו מסלול בדיוק של לחיצת כפתור ברצועה. */
  runCommand: (id: CommandId, payload?: unknown) => void;
  /** מריצה פעולת מעטפת ומחזירה האם טופלה. */
  runAction: (action: ShellAction) => boolean;
  /** האם דיאלוג מודאלי פתוח כרגע. */
  isModalOpen?: () => boolean;
  /** הרשומות. ברירת המחדל היא הרג'יסטרי; הבדיקות מזריקות רשימה משלהן. */
  shortcuts?: readonly Shortcut[];
  /** היעד שאליו נרשם המאזין. ברירת מחדל `window`. */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

export interface ShortcutDispatcher {
  /** מטפל באירוע. `true` פירושו „הקיצור רץ, וההתנהגות של הדפדפן נבלעה”. */
  handle: (event: KeyboardEvent) => boolean;
  /** מנתק את המאזין. אידמפוטנטי. */
  dispose: () => void;
}

export function createShortcutDispatcher(deps: ShortcutDispatcherDeps): ShortcutDispatcher {
  const shortcuts = deps.shortcuts ?? SHORTCUTS;
  const isModalOpen = deps.isModalOpen ?? (() => false);

  function handle(event: KeyboardEvent): boolean {
    // מישהו כבר טיפל. המאזין שלנו יושב על `window` בשלב ה-bubble, כלומר
    // **אחרי** ה-keymap של מנוע העריכה שיושב על אזור המסמך; בלי הבדיקה הזאת
    // צירוף שהמנוע קושר בעצמו (Ctrl+B, למשל) היה מופעל פעמיים — הדגשה
    // וביטולה — והמשתמש היה רואה „הקיצור לא עובד” בלי שום שגיאה.
    if (event.defaultPrevented) return false;

    const shortcut = matchAny(event, shortcuts);
    if (!shortcut) return false;

    // כיווניות פסקה מזוהה בשחרור ה-Shift, ב-`direction.ts`. כאן היא הייתה
    // נורית ברגע שהמשתמש לוחץ Shift — כלומר גם באמצע `Ctrl+Shift+X`.
    if (shortcut.onKeyUp) return false;

    // צירוף שהדפדפן מטפל בו מתועד אצלנו כדי שהתווית תהיה אמיתית, אבל אסור
    // לגעת בו: `preventDefault` על Ctrl+V היה מבטל את ההדבקה עצמה.
    if (shortcut.native) return false;

    if (isModalOpen() && !shortcut.inModal) return false;
    if (!shortcut.inTextEntry && isTextEntryTarget(event.target)) return false;

    // פקודת מנוע נחשבת מטופלת תמיד: גם סירוב של ה-controller הוא תשובה,
    // והיא מגיעה למשתמש כהודעה בעברית. פעולת מעטפת מדווחת בעצמה — `Escape`
    // שלא היה לו מה לסגור אינו „מטופל”, ואסור לבלוע אותו.
    let handled = false;
    if (shortcut.command) {
      deps.runCommand(shortcut.command, shortcut.payload);
      handled = true;
    } else if (shortcut.action) {
      handled = deps.runAction(shortcut.action);
    }

    // הבליעה אחרי ההרצה, ובכוונה: `Ctrl+S` שאינו מריץ שמירה (כי שמירה כבר
    // רצה) עדיין נחשב מטופל, וחייב למנוע מה-WebView לפתוח את דיאלוג „שמירת
    // דף” שלו.
    if (handled) event.preventDefault();
    return handled;
  }

  const target = deps.target ?? (typeof window === 'undefined' ? undefined : window);
  const listener = (event: Event) => {
    handle(event as KeyboardEvent);
  };
  target?.addEventListener('keydown', listener);

  let disposed = false;
  return {
    handle,
    dispose() {
      if (disposed) return;
      disposed = true;
      target?.removeEventListener('keydown', listener);
    },
  };
}
