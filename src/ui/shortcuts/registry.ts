/**
 * הרג'יסטרי של קיצורי המקלדת — מקור האמת היחיד.
 *
 * למה מודול הצהרתי אחד ולא `if` בכל אתר קריאה: עד עכשיו הקיצורים היו שרשרת
 * `else if` ב-`App.vue`, והתוויות ברצועה היו מחרוזות חופשיות בתוך ה-tooltip.
 * שתי הרשימות לא נפגשו מעולם, ולכן שתים-עשרה תוויות הבטיחו למשתמש קיצור שאין
 * לו שום מאזין — „Ctrl+B” הופיע על כפתור „מודגש” בלי שאיש קשר את הצירוף.
 * כאן התווית והצירוף הם אותה רשומה, ולכן אי אפשר להוסיף אחד בלי השני.
 *
 * מה שמריץ את הקיצור הוא **תמיד** אותו מסלול של לחיצת כפתור: `command` עובר
 * דרך `CommandAdapter`, ו-`action` דרך מפעיל הפעולות של המעטפת. אין כאן מסלול
 * עוקף למנוע — קיצור שנכשל מדבר עברית בשורת המצב בדיוק כמו כפתור שנכשל.
 */
import type { CommandId } from '../../engine/capabilities';
import { alignmentPayload, lineHeightPayload, stylePayload } from '../../engine/payloads';

/** החלוקה שלפיה דיאלוג „קיצורי מקלדת” מקבץ את הרשומות. */
export type ShortcutGroup =
  | 'file'
  | 'clipboard'
  | 'edit'
  | 'font'
  | 'paragraph'
  | 'direction'
  | 'insert'
  | 'review'
  | 'view'
  | 'otzaria'
  | 'app';

export const SHORTCUT_GROUP_TITLES: Record<ShortcutGroup, string> = {
  file: 'קבצים',
  clipboard: 'לוח',
  edit: 'עריכה',
  font: 'עיצוב תו',
  paragraph: 'פסקה',
  direction: 'כיווניות',
  insert: 'הוספה',
  review: 'סקירה',
  view: 'תצוגה',
  otzaria: 'אוצריא',
  app: 'ניווט בממשק',
};

/**
 * פעולות המעטפת שקיצור יכול להריץ. אלה אינן פקודות מנוע: הן חיות ב-`App.vue`
 * (שמירה, הדפסה, דיאלוגים), ולכן הן מזוהות בשם ומופעלות דרך `actions.ts`.
 */
export type ShellAction =
  | 'save'
  | 'save-as'
  | 'find'
  | 'replace'
  | 'print'
  | 'escape'
  | 'new-document'
  | 'open-document'
  | 'select-all'
  | 'page-break'
  | 'link'
  | 'font-grow'
  | 'font-shrink'
  | 'superscript'
  | 'subscript'
  | 'footnote'
  | 'endnote'
  | 'track-changes'
  | 'focus-mode'
  | 'find-next'
  | 'find-prev'
  | 'insert-citation'
  | 'search-otzaria'
  | 'open-library'
  | 'shortcuts-help'
  | 'context-menu'
  | 'focus-next-region'
  | 'focus-prev-region';

export interface Shortcut {
  /** מזהה יציב. משמש את הרצועה, את הבדיקות ואת דיאלוג העזרה. */
  id: string;
  /** התווית המוצגת למשתמש. */
  label: string;
  /** מה הקיצור עושה, בעברית. */
  description: string;
  group: ShortcutGroup;

  /**
   * המקש הפיזי. **זה ברירת המחדל לכל אות.** `event.code` אינו תלוי בפריסת
   * המקלדת, ואילו `event.key` מחזיר את תו הפריסה — ב-Ctrl+S בפריסה עברית הוא
   * `ד`. זה היה הבאג: ששת הקיצורים שהיו כאן מתו ברגע שהמשתמש כתב עברית.
   *
   * רשימה = כמה מקשים פיזיים לאותה פעולה. `Enter` ו-`NumpadEnter` הם המקרה:
   * שניהם „Enter” למשתמש, ורק אחד מהם מדווח `code: 'Enter'`.
   */
  code?: string | readonly string[];
  /**
   * מקש לפי התו. **אין רשומה שמשתמשת בזה, ובכוונה.**
   *
   * ההנחה המקורית הייתה שסימני פיסוק יציבים יותר בתו מאשר במקש הפיזי. מדידה
   * מול שלוש פריסות (US, עברית ישנה, עברית סטנדרטית) הראתה את ההפך: הפריסה
   * העברית **ממשקפת** את הסוגריים — המקש הפיזי `BracketLeft` מפיק „]” —
   * ולכן התאמה לפי תו הייתה הופכת את „הגדל” ו„הקטן” בפריסה עברית. גרוע מזה,
   * `Ctrl+Shift+=` לא היה יורה לעולם, כי עם Shift התו הוא „+” ולא „=”.
   *
   * השדה נשאר כפתח מילוט מתועד; מי שמשתמש בו חייב למדוד קודם.
   */
  key?: string;

  /** Ctrl או Meta. `Meta` שקול ל-`Ctrl` כדי ש-macOS יקבל את אותם צירופים. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;

  /** פקודת מנוע. */
  command?: CommandId;
  /** payload לפקודה, כשהיא דורשת אחד. */
  payload?: unknown;
  /** פעולת מעטפת. */
  action?: ShellAction;
  /**
   * הצירוף מטופל בידי הדפדפן, ואנחנו רק מתעדים אותו. ללא מאזין וללא
   * `preventDefault` — הדבקה חייבת להישאר הדבקה של הדפדפן, כי רק לו יש
   * גישה ללוח בלי אישור נוסף.
   */
  native?: true;

  /** פועל גם כשהפוקוס בשדה טקסט של הממשק שלנו. */
  inTextEntry?: true;
  /** פועל גם כשדיאלוג מודאלי פתוח. */
  inModal?: true;
  /** החזקת המקש חוזרת על הפעולה. */
  repeatable?: true;
  /**
   * הצירוף מזוהה בשחרור מודיפייר, ולא בלחיצת מקש — כלומר `ui/shortcuts/
   * direction.ts` ולא המנתב הרגיל. הרשומה קיימת כאן כדי שהתווית והתיאור יבואו
   * מאותו מקום כמו כל השאר, והמנתב מדלג עליה.
   */
  onKeyUp?: true;
}

/**
 * הרשומות. הסדר כאן הוא הסדר שבו הן מוצגות בדיאלוג העזרה.
 *
 * `as const` אינו קישוט: ממנו נגזר `ShortcutId`, ולכן `shortcut-id` שגוי
 * ברצועה נופל ב-`npm run typecheck` ולא מגיע למשתמש כ-tooltip חסר.
 */
export const SHORTCUTS = [
  {
    id: 'new-document',
    label: 'Ctrl+N',
    description: 'מסמך חדש',
    group: 'file',
    code: 'KeyN',
    ctrl: true,
    action: 'new-document',
  },
  {
    id: 'open-document',
    label: 'Ctrl+O',
    description: 'פתיחת קובץ Word',
    group: 'file',
    code: 'KeyO',
    ctrl: true,
    action: 'open-document',
  },
  {
    id: 'save',
    label: 'Ctrl+S',
    description: 'שמירת המסמך',
    group: 'file',
    code: 'KeyS',
    ctrl: true,
    action: 'save',
    inTextEntry: true,
  },
  {
    id: 'save-as',
    label: 'Ctrl+Shift+S',
    description: 'שמירה בשם',
    group: 'file',
    code: 'KeyS',
    ctrl: true,
    shift: true,
    action: 'save-as',
    inTextEntry: true,
  },
  {
    id: 'save-as-f12',
    label: 'F12',
    description: 'שמירה בשם',
    group: 'file',
    code: 'F12',
    action: 'save-as',
    inTextEntry: true,
  },
  {
    id: 'print',
    label: 'Ctrl+P',
    description: 'הדפסה',
    group: 'file',
    code: 'KeyP',
    ctrl: true,
    action: 'print',
  },
  {
    id: 'paste',
    label: 'Ctrl+V',
    description: 'הדבקה',
    group: 'clipboard',
    code: 'KeyV',
    ctrl: true,
    native: true,
  },
  {
    id: 'cut',
    label: 'Ctrl+X',
    description: 'גזירה',
    group: 'clipboard',
    code: 'KeyX',
    ctrl: true,
    native: true,
  },
  {
    id: 'copy',
    label: 'Ctrl+C',
    description: 'העתקה',
    group: 'clipboard',
    code: 'KeyC',
    ctrl: true,
    native: true,
  },
  {
    id: 'find',
    label: 'Ctrl+F',
    description: 'חיפוש במסמך',
    group: 'edit',
    code: 'KeyF',
    ctrl: true,
    action: 'find',
  },
  {
    id: 'replace',
    label: 'Ctrl+H',
    description: 'חיפוש והחלפה',
    group: 'edit',
    code: 'KeyH',
    ctrl: true,
    action: 'replace',
  },
  {
    id: 'undo',
    label: 'Ctrl+Z',
    description: 'ביטול הפעולה האחרונה',
    group: 'edit',
    code: 'KeyZ',
    ctrl: true,
    command: 'undo',
    repeatable: true,
  },
  {
    id: 'redo',
    label: 'Ctrl+Y',
    description: 'ביצוע חוזר',
    group: 'edit',
    code: 'KeyY',
    ctrl: true,
    command: 'redo',
    repeatable: true,
  },
  {
    id: 'redo-shift',
    label: 'Ctrl+Shift+Z',
    description: 'ביצוע חוזר',
    group: 'edit',
    code: 'KeyZ',
    ctrl: true,
    shift: true,
    command: 'redo',
    repeatable: true,
  },
  {
    id: 'select-all',
    label: 'Ctrl+A',
    description: 'בחירת כל הטקסט במסמך',
    group: 'edit',
    code: 'KeyA',
    ctrl: true,
    action: 'select-all',
  },
  {
    id: 'bold',
    label: 'Ctrl+B',
    description: 'מודגש',
    group: 'font',
    code: 'KeyB',
    ctrl: true,
    command: 'bold',
  },
  {
    id: 'italic',
    label: 'Ctrl+I',
    description: 'נטוי',
    group: 'font',
    code: 'KeyI',
    ctrl: true,
    command: 'italic',
  },
  {
    id: 'underline',
    label: 'Ctrl+U',
    description: 'קו תחתון',
    group: 'font',
    code: 'KeyU',
    ctrl: true,
    command: 'underline',
  },
  {
    id: 'font-grow',
    label: 'Ctrl+]',
    description: 'הגדלת הגופן',
    group: 'font',
    code: 'BracketRight',
    ctrl: true,
    action: 'font-grow',
    repeatable: true,
  },
  {
    id: 'font-shrink',
    label: 'Ctrl+[',
    description: 'הקטנת הגופן',
    group: 'font',
    code: 'BracketLeft',
    ctrl: true,
    action: 'font-shrink',
    repeatable: true,
  },
  {
    id: 'clear-formatting',
    label: 'Ctrl+Space',
    description: 'ניקוי עיצוב התו',
    group: 'font',
    code: 'Space',
    ctrl: true,
    command: 'clear-formatting',
  },
  {
    id: 'strikethrough',
    label: 'Ctrl+Shift+X',
    description: 'קו חוצה',
    group: 'font',
    code: 'KeyX',
    ctrl: true,
    shift: true,
    command: 'strikethrough',
  },
  {
    id: 'subscript',
    label: 'Ctrl+=',
    description: 'כתב תחתי',
    group: 'font',
    code: 'Equal',
    ctrl: true,
    action: 'subscript',
  },
  {
    id: 'superscript',
    label: 'Ctrl+Shift+=',
    description: 'כתב עילי',
    group: 'font',
    // `code` ולא `key`: עם Shift התו הוא „+”, ולכן התאמה לפי תו לא הייתה
    // יורה לעולם — בשום פריסה.
    code: 'Equal',
    ctrl: true,
    shift: true,
    action: 'superscript',
  },
  {
    id: 'format-painter',
    label: 'Ctrl+Shift+C',
    description: 'העתקת עיצוב',
    group: 'font',
    code: 'KeyC',
    ctrl: true,
    shift: true,
    command: 'copy-format',
  },
  {
    id: 'style-normal',
    label: 'Ctrl+Shift+N',
    description: 'סגנון רגיל',
    group: 'paragraph',
    code: 'KeyN',
    ctrl: true,
    shift: true,
    command: 'linked-style',
    payload: stylePayload('Normal'),
  },
  {
    id: 'align-right',
    label: 'Ctrl+R',
    description: 'יישור לימין',
    group: 'paragraph',
    code: 'KeyR',
    ctrl: true,
    command: 'text-align',
    payload: alignmentPayload('right'),
  },
  {
    id: 'align-center',
    label: 'Ctrl+E',
    description: 'מרכוז',
    group: 'paragraph',
    code: 'KeyE',
    ctrl: true,
    command: 'text-align',
    payload: alignmentPayload('center'),
  },
  {
    id: 'align-left',
    label: 'Ctrl+L',
    description: 'יישור לשמאל',
    group: 'paragraph',
    code: 'KeyL',
    ctrl: true,
    command: 'text-align',
    payload: alignmentPayload('left'),
  },
  {
    id: 'align-justify',
    label: 'Ctrl+J',
    description: 'יישור לשני הצדדים',
    group: 'paragraph',
    code: 'KeyJ',
    ctrl: true,
    command: 'text-align',
    payload: alignmentPayload('justify'),
  },
  {
    id: 'indent-increase',
    label: 'Ctrl+M',
    description: 'הגדלת הכניסה',
    group: 'paragraph',
    code: 'KeyM',
    ctrl: true,
    command: 'indent-increase',
    repeatable: true,
  },
  {
    id: 'indent-decrease',
    label: 'Ctrl+Shift+M',
    description: 'הקטנת הכניסה',
    group: 'paragraph',
    code: 'KeyM',
    ctrl: true,
    shift: true,
    command: 'indent-decrease',
    repeatable: true,
  },
  {
    id: 'line-height-1',
    label: 'Ctrl+1',
    description: 'ריווח שורות רגיל',
    group: 'paragraph',
    code: 'Digit1',
    ctrl: true,
    command: 'line-height',
    payload: lineHeightPayload(1),
  },
  {
    id: 'line-height-2',
    label: 'Ctrl+2',
    description: 'ריווח שורות כפול',
    group: 'paragraph',
    code: 'Digit2',
    ctrl: true,
    command: 'line-height',
    payload: lineHeightPayload(2),
  },
  {
    id: 'line-height-15',
    label: 'Ctrl+5',
    description: 'ריווח שורות וחצי',
    group: 'paragraph',
    code: 'Digit5',
    ctrl: true,
    command: 'line-height',
    payload: lineHeightPayload(1.5),
  },
  {
    id: 'heading-1',
    label: 'Ctrl+Alt+1',
    description: 'סגנון כותרת 1',
    group: 'paragraph',
    code: 'Digit1',
    ctrl: true,
    alt: true,
    command: 'linked-style',
    // הבנאי הקנוני, ולא אובייקט כתוב ביד: `unwrapScalar` של המנוע מכיר את
    // המפתח `style`, ורק ב-payloads.ts כתוב מה הוא.
    payload: stylePayload('Heading1'),
  },
  {
    id: 'heading-2',
    label: 'Ctrl+Alt+2',
    description: 'סגנון כותרת 2',
    group: 'paragraph',
    code: 'Digit2',
    ctrl: true,
    alt: true,
    command: 'linked-style',
    // הבנאי הקנוני, ולא אובייקט כתוב ביד: `unwrapScalar` של המנוע מכיר את
    // המפתח `style`, ורק ב-payloads.ts כתוב מה הוא.
    payload: stylePayload('Heading2'),
  },
  {
    id: 'heading-3',
    label: 'Ctrl+Alt+3',
    description: 'סגנון כותרת 3',
    group: 'paragraph',
    code: 'Digit3',
    ctrl: true,
    alt: true,
    command: 'linked-style',
    // הבנאי הקנוני, ולא אובייקט כתוב ביד: `unwrapScalar` של המנוע מכיר את
    // המפתח `style`, ורק ב-payloads.ts כתוב מה הוא.
    payload: stylePayload('Heading3'),
  },
  {
    id: 'link',
    label: 'Ctrl+K',
    description: 'הוספת קישור',
    group: 'insert',
    code: 'KeyK',
    ctrl: true,
    action: 'link',
  },
  {
    id: 'page-break',
    label: 'Ctrl+Enter',
    description: 'התחלת פסקה בעמוד חדש',
    group: 'insert',
    code: ['Enter', 'NumpadEnter'],
    ctrl: true,
    action: 'page-break',
  },
  {
    id: 'footnote',
    label: 'Ctrl+Alt+F',
    description: 'הוספת הערת שוליים',
    group: 'insert',
    code: 'KeyF',
    ctrl: true,
    alt: true,
    action: 'footnote',
  },
  {
    id: 'endnote',
    label: 'Ctrl+Alt+D',
    description: 'הוספת הערת סיום',
    group: 'insert',
    code: 'KeyD',
    ctrl: true,
    alt: true,
    action: 'endnote',
  },
  {
    id: 'track-changes',
    label: 'Ctrl+Shift+E',
    description: 'מעקב אחר שינויים',
    group: 'review',
    code: 'KeyE',
    ctrl: true,
    shift: true,
    action: 'track-changes',
  },
  {
    id: 'find-next',
    label: 'F3',
    description: 'המופע הבא',
    group: 'edit',
    code: 'F3',
    action: 'find-next',
    inTextEntry: true,
  },
  {
    id: 'find-prev',
    label: 'Shift+F3',
    description: 'המופע הקודם',
    group: 'edit',
    code: 'F3',
    shift: true,
    action: 'find-prev',
    inTextEntry: true,
  },
  {
    id: 'focus-mode',
    label: 'F11',
    description: 'מצב מיקוד',
    group: 'view',
    code: 'F11',
    action: 'focus-mode',
  },
  {
    id: 'formatting-marks',
    label: 'Ctrl+Shift+8',
    description: 'הצגת סימני עיצוב',
    group: 'view',
    code: 'Digit8',
    ctrl: true,
    shift: true,
    command: 'formatting-marks',
  },
  {
    id: 'insert-citation',
    label: 'Ctrl+Shift+Q',
    description: 'ציטוט מהקורא של אוצריא',
    group: 'otzaria',
    code: 'KeyQ',
    ctrl: true,
    shift: true,
    action: 'insert-citation',
  },
  {
    id: 'search-otzaria',
    label: 'Ctrl+Shift+G',
    description: 'חיפוש הטקסט המסומן בספרייה',
    group: 'otzaria',
    // **לא** `Ctrl+Shift+F`: זה הצירוף של אוצריא עצמה ל„חיפוש חדש בכל
    // הספרים” (`lib/shortcuts/shortcut_validator.dart`). שתי פעולות חיפוש
    // כמעט זהות על אותו צירוף הן בדיוק סוג ההבטחה שאי אפשר לקיים — ומי
    // שמפסיד הוא הצירוף שלנו, שאין לו שום סיכוי מול מאזין ברמת האפליקציה.
    //
    // `G` נבחר מפני שהוא פנוי גם באוצריא וגם ב-Word: כל שאר האפשרויות
    // הפנויות באוצריא (`A`,`B`,`C`,`E`,`F`,`L`,`N`,`P`,`T`,`W` תפוסים אצלה)
    // מתנגשות בצירוף Word אמיתי.
    code: 'KeyG',
    ctrl: true,
    shift: true,
    action: 'search-otzaria',
  },
  {
    id: 'open-library',
    label: 'Ctrl+Shift+O',
    description: 'פתיחת הספרייה',
    group: 'otzaria',
    code: 'KeyO',
    ctrl: true,
    shift: true,
    action: 'open-library',
  },
  {
    id: 'direction-rtl',
    label: 'Ctrl + Shift ימני',
    description: 'פסקה מימין לשמאל',
    group: 'direction',
    code: 'ShiftRight',
    ctrl: true,
    command: 'direction-rtl',
    onKeyUp: true,
  },
  {
    id: 'direction-ltr',
    label: 'Ctrl + Shift שמאלי',
    description: 'פסקה משמאל לימין',
    group: 'direction',
    code: 'ShiftLeft',
    ctrl: true,
    command: 'direction-ltr',
    onKeyUp: true,
  },
  {
    id: 'shortcuts-help',
    label: 'Ctrl+/',
    description: 'רשימת כל קיצורי המקלדת',
    group: 'app',
    // המקש הפיזי, כרגיל: בפריסה העברית אותו מקש מפיק „.” ולא „/”.
    //
    // גם הלוכסן של הספרון, מאותו טעם ש-`Ctrl+Enter` מקבל גם `NumpadEnter`:
    // למשתמש זה „אותו מקש”, ורק הדפדפן יודע שאלה שני `code` שונים.
    code: ['Slash', 'NumpadDivide'],
    ctrl: true,
    action: 'shortcuts-help',
    // מתג: אותו צירוף שפותח גם סוגר. בלי `inModal` הרשומה הייתה נחסמת ברגע
    // שהדיאלוג נפתח — כלומר הצירוף היה פותח בלבד, בניגוד למה שמשתמש מצפה
    // ממקש שהוא זה עתה לחץ. מעל דיאלוג **אחר** הוא אינו פועל; ההכרעה הזאת
    // ב-`App.vue`, מפני שרק שם ידוע איזה חלון פתוח.
    inModal: true,
  },
  {
    id: 'focus-next-region',
    label: 'F6',
    description: 'מעבר בין הרצועה, המסמך ושורת המצב',
    group: 'app',
    code: 'F6',
    action: 'focus-next-region',
  },
  {
    id: 'focus-prev-region',
    label: 'Shift+F6',
    description: 'מעבר לאזור הקודם',
    group: 'app',
    code: 'F6',
    shift: true,
    action: 'focus-prev-region',
  },
  /**
   * שתי רשומות ולא אחת עם שני `code`: `match.ts` דורש התאמת מקשים **מדויקת**,
   * ורשומה משותפת עם `shift: true` הייתה הופכת את מקש התפריט הבודד למקש שאינו
   * מתאים לעולם. שני הצירופים הם „אותו דבר” רק אצל המשתמש.
   */
  {
    id: 'context-menu',
    label: 'Shift+F10',
    description: 'פתיחת תפריט ההקשר על הסמן',
    group: 'app',
    code: 'F10',
    shift: true,
    action: 'context-menu',
  },
  {
    id: 'context-menu-key',
    label: 'מקש התפריט',
    description: 'פתיחת תפריט ההקשר על הסמן',
    group: 'app',
    code: 'ContextMenu',
    action: 'context-menu',
  },
  {
    id: 'escape',
    label: 'Esc',
    description: 'סגירת החלון הפתוח, או חזרה למסמך',
    group: 'app',
    code: 'Escape',
    action: 'escape',
    inTextEntry: true,
    inModal: true,
  },
] as const satisfies readonly Shortcut[];

/** מזהי הרשומות, כטיפוס. `shortcut-id` שאינו כאן נופל בבנייה. */
export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

const BY_ID = new Map<string, Shortcut>(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export function findShortcut(id: string): Shortcut | undefined {
  return BY_ID.get(id);
}

/** התווית המוצגת. הרצועה קוראת רק לכאן, ולכן אינה יכולה להמציא תווית. */
export function shortcutLabel(id: ShortcutId): string {
  return BY_ID.get(id)?.label ?? '';
}

/** הרשומות מקובצות לפי תחום, בסדר של `SHORTCUT_GROUP_TITLES`. */
export function shortcutsByGroup(): { group: ShortcutGroup; title: string; items: Shortcut[] }[] {
  const groups = Object.keys(SHORTCUT_GROUP_TITLES) as ShortcutGroup[];
  return groups
    .map((group) => ({
      group,
      title: SHORTCUT_GROUP_TITLES[group],
      items: SHORTCUTS.filter((shortcut) => shortcut.group === group) as unknown as Shortcut[],
    }))
    .filter((entry) => entry.items.length > 0);
}
