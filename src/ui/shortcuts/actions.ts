/**
 * מפעיל פעולות המעטפת — מה שקיצור מריץ כשאין לו פקודת מנוע.
 *
 * למה זה כאן ולא ב-`App.vue`: פעולה אחת מהן, השמירה, מחזיקה הכרעה אמיתית
 * שהייתה פעם `saveShortcut` ב-`sessions/open-flow.ts`. בזמן שמירה `saveNow`
 * מצטרף לסבב שכבר רץ, ולכן `Ctrl+Shift+S` נראה כאילו פתח „שמור בשם” בעוד
 * שבפועל רק המתין לשמירה הרגילה — ואז לא נפתח שום דיאלוג. ההכרעה נשמרת, ועברה
 * לכאן כדי שתישאר נבדקת אחרי שהרג'יסטרי בלע את `saveShortcut`.
 */
import type { ShellAction } from './registry';

export interface ShellActionDeps {
  /** האם שמירה כבר רצה. */
  isSaving: () => boolean;
  save: (saveAs: boolean) => void;
  print: () => void;
  openFind: (mode: 'find' | 'replace') => void;
  /** סוגר את החלון הפתוח. `false` פירושו „לא היה מה לסגור”. */
  closeTopmost: () => boolean;
  newDocument: () => void;
  openDocument: () => void;
  selectAll: () => void;
  pageBreak: () => void;
  openLink: () => void;
  /**
   * גודל הגופן תלוי במה שהמנוע מדווח על הבחירה הנוכחית, ולכן הוא פעולה ולא
   * רשומה עם payload קבוע: „הגדל” הוא הערך הבא בסולם של Word מעל מה שיש, לא
   * מספר שאפשר לכתוב מראש.
   */
  growFont: () => void;
  shrinkFont: () => void;
  /** כתב עילי/תחתי אינם פקודות ה-controller אלא Document API ישיר. */
  vertAlign: (kind: 'superscript' | 'subscript') => void;
  insertNote: (type: 'footnote' | 'endnote') => void;
  /** מחליף בין עריכה למעקב. המצב הנוכחי נקרא מהמנוע. */
  toggleTrackChanges: () => void;
  toggleFocusMode: () => void;
  /** מופע הבא/קודם בחיפוש. מחזיר האם היה מה לחפש. */
  findAgain: (direction: 'next' | 'prev') => boolean;
  insertCitation: () => void;
  searchOtzaria: () => void;
  openLibrary: () => void;
  /**
   * מתחיל או עוצר הקלטת מאקרו. מחזיר האם טופל: בלי מסמך פתוח אין מערכת
   * מאקרו, ובליעת הצירוף הייתה לוקחת אותו מהדפדפן בלי לתת דבר.
   */
  toggleMacroRecording: () => boolean;
  /** מנגן את המאקרו האחרון. מחזיר האם טופל — אותו כלל. */
  replayLastMacro: () => boolean;
  /** מתג דיאלוג ניהול המאקרו. מחזיר האם טופל — כמו `toggleShortcutsHelp`. */
  toggleMacrosDialog: () => boolean;
  /**
   * מתג רשימת הקיצורים. מחזיר האם טופל: מעל דיאלוג אחר הצירוף אינו פועל,
   * ואז אין לבלוע אותו.
   */
  toggleShortcutsHelp: () => boolean;
  /**
   * `Shift+F10` ומקש התפריט. מחזיר האם נפתח: העוגן הוא מלבן הסמן המצויר
   * (`ui.selection.getAnchorRect`), וכשאין אחד — אין תפריט.
   */
  openContextMenu: () => boolean;
  /** `F6` — מעביר את המיקוד לאזור הבא. מחזיר האם היה לאן. */
  moveFocusRegion: (direction: 'next' | 'prev') => boolean;
  /** `Alt+Q` — מיקוד תיבת החיפוש והפקודות (Tell Me). */
  openTellMe: () => void;
}

/**
 * מריצה פעולה, ומחזירה האם היא **טופלה**.
 *
 * ערך ההחזרה אינו קישוט: המנתב בולע את ההתנהגות של הדפדפן רק כשהוא טיפל.
 * `Escape` שלא היה לו מה לסגור חייב להמשיך הלאה — הוא `Escape` של המנוע או
 * של הדפדפן, ובליעתו הייתה שוברת אותם בשקט. שמירה בזמן שמירה היא ההפך:
 * היא כן „טופלה” (התעלמנו בכוונה), והבליעה נחוצה כדי שה-WebView לא יפתח את
 * דיאלוג „שמירת דף” שלו.
 */
export function createShellActionRunner(deps: ShellActionDeps): (action: ShellAction) => boolean {
  return (action) => {
    switch (action) {
      case 'save':
      case 'save-as':
        // בזמן שמירה לא מריצים שנייה — אבל כן בולעים.
        if (!deps.isSaving()) deps.save(action === 'save-as');
        return true;
      case 'print':
        deps.print();
        return true;
      case 'find':
      case 'replace':
        deps.openFind(action);
        return true;
      case 'escape':
        return deps.closeTopmost();
      case 'new-document':
        deps.newDocument();
        return true;
      case 'open-document':
        deps.openDocument();
        return true;
      case 'select-all':
        deps.selectAll();
        return true;
      case 'page-break':
        deps.pageBreak();
        return true;
      case 'link':
        deps.openLink();
        return true;
      case 'font-grow':
        deps.growFont();
        return true;
      case 'font-shrink':
        deps.shrinkFont();
        return true;
      case 'superscript':
      case 'subscript':
        deps.vertAlign(action);
        return true;
      case 'footnote':
      case 'endnote':
        deps.insertNote(action);
        return true;
      case 'track-changes':
        deps.toggleTrackChanges();
        return true;
      case 'focus-mode':
        deps.toggleFocusMode();
        return true;
      case 'find-next':
        return deps.findAgain('next');
      case 'find-prev':
        return deps.findAgain('prev');
      case 'insert-citation':
        deps.insertCitation();
        return true;
      case 'search-otzaria':
        deps.searchOtzaria();
        return true;
      case 'open-library':
        deps.openLibrary();
        return true;
      case 'macro-record':
        return deps.toggleMacroRecording();
      case 'macro-play':
        return deps.replayLastMacro();
      case 'macro-manage':
        return deps.toggleMacrosDialog();
      case 'shortcuts-help':
        return deps.toggleShortcutsHelp();
      // „אין עוגן” אינו „טופל”: בלי מלבן סמן אין איפה לפתוח את התפריט, ובליעת
      // הצירוף הייתה משאירה את המשתמש בלי תפריט ובלי הודעה.
      case 'context-menu':
        return deps.openContextMenu();
      // אזור שאין בו למה למקד אינו „מטופל”: בליעת F6 שלא הזיז דבר הייתה
      // לוקחת מהמשתמש את מקש הניווט של הדפדפן בלי לתת לו כלום בתמורה.
      case 'focus-next-region':
        return deps.moveFocusRegion('next');
      case 'focus-prev-region':
        return deps.moveFocusRegion('prev');
      case 'tell-me':
        deps.openTellMe();
        return true;
    }
  };
}
