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
export type ShellAction = 'save' | 'save-as' | 'find' | 'replace' | 'print' | 'escape';

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
   */
  code?: string;
  /**
   * מקש לפי התו, לסימני פיסוק בלבד (`]`, `[`, `=`). שם דווקא ה-`code` הוא
   * שנודד בין פריסות פיזיות, ולכן ההשוואה הפוכה.
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
}

/**
 * הרשומות. הסדר כאן הוא הסדר שבו הן מוצגות בדיאלוג העזרה.
 *
 * `as const` אינו קישוט: ממנו נגזר `ShortcutId`, ולכן `shortcut-id` שגוי
 * ברצועה נופל ב-`npm run typecheck` ולא מגיע למשתמש כ-tooltip חסר.
 */
export const SHORTCUTS = [
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
    id: 'escape',
    label: 'Esc',
    description: 'סגירת החלון הפתוח',
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
