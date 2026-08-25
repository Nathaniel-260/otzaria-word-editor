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
}

export function createShellActionRunner(deps: ShellActionDeps): (action: ShellAction) => void {
  return (action) => {
    switch (action) {
      case 'save':
      case 'save-as':
        // בזמן שמירה לא מריצים שנייה. הבליעה כבר נעשתה במנתב.
        if (deps.isSaving()) return;
        deps.save(action === 'save-as');
        return;
      case 'print':
        deps.print();
        return;
      case 'find':
      case 'replace':
        deps.openFind(action);
        return;
      case 'escape':
        deps.closeTopmost();
        return;
      case 'new-document':
        deps.newDocument();
        return;
      case 'open-document':
        deps.openDocument();
        return;
      case 'select-all':
        deps.selectAll();
        return;
      case 'page-break':
        deps.pageBreak();
        return;
    }
  };
}
