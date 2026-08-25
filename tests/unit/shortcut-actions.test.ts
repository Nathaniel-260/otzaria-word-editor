/**
 * פעולות המעטפת. ההכרעה היחידה שיש כאן היא זו שהייתה פעם `saveShortcut`:
 * בזמן שמירה אין להריץ שמירה שנייה. הבדיקה עברה לכאן יחד עם ההכרעה, כדי
 * שהיא לא תיעלם עם המודול שנמחק.
 */
import { describe, it, expect, vi } from 'vitest';
import { createShellActionRunner, type ShellActionDeps } from '../../src/ui/shortcuts/actions';

function setup(over: Partial<ShellActionDeps> = {}) {
  const deps = {
    isSaving: () => false,
    save: vi.fn(),
    print: vi.fn(),
    openFind: vi.fn(),
    closeTopmost: vi.fn(() => true),
    newDocument: vi.fn(),
    openDocument: vi.fn(),
    selectAll: vi.fn(),
    pageBreak: vi.fn(),
    openLink: vi.fn(),
    growFont: vi.fn(),
    shrinkFont: vi.fn(),
    vertAlign: vi.fn(),
    insertNote: vi.fn(),
    toggleTrackChanges: vi.fn(),
    toggleFocusMode: vi.fn(),
    findAgain: vi.fn(() => true),
    insertCitation: vi.fn(),
    searchOtzaria: vi.fn(),
    openLibrary: vi.fn(),
    toggleShortcutsHelp: vi.fn(() => true),
    moveFocusRegion: vi.fn(() => true),
    ...over,
  };
  return { deps, run: createShellActionRunner(deps) };
}

describe('createShellActionRunner', () => {
  it('shortcuts-help מחליף את מצב רשימת הקיצורים', () => {
    const { deps, run } = setup();

    expect(run('shortcuts-help')).toBe(true);
    expect(deps.toggleShortcutsHelp).toHaveBeenCalledOnce();
  });

  it('shortcuts-help מעל דיאלוג אחר אינו נבלע', () => {
    // המעטפת מסרבת לפתוח חלון שני, והצירוף חייב להמשיך הלאה.
    const { run } = setup({ toggleShortcutsHelp: () => false });

    expect(run('shortcuts-help')).toBe(false);
  });

  it('F6 מעביר אזור, ומדווח שטופל', () => {
    const { deps, run } = setup();

    expect(run('focus-next-region')).toBe(true);
    expect(run('focus-prev-region')).toBe(true);
    expect(deps.moveFocusRegion).toHaveBeenNthCalledWith(1, 'next');
    expect(deps.moveFocusRegion).toHaveBeenNthCalledWith(2, 'prev');
  });

  it('F6 שלא היה לו לאן לעבור אינו נבלע', () => {
    // אחרת היינו לוקחים מהמשתמש את מקש הניווט של הדפדפן בלי לתת לו דבר.
    const { run } = setup({ moveFocusRegion: () => false });

    expect(run('focus-next-region')).toBe(false);
  });

  it('save שומר, save-as פותח „שמור בשם”', () => {
    const { deps, run } = setup();

    run('save');
    run('save-as');

    expect(deps.save).toHaveBeenNthCalledWith(1, false);
    expect(deps.save).toHaveBeenNthCalledWith(2, true);
  });

  it('בזמן שמירה אין שמירה שנייה', () => {
    // הרגרסיה: saveNow היה מצטרף לסבב שכבר רץ, ולכן Ctrl+Shift+S נראה כאילו
    // פתח „שמור בשם” ובפועל לא נפתח שום דיאלוג.
    const { deps, run } = setup({ isSaving: () => true });

    run('save');
    run('save-as');

    expect(deps.save).not.toHaveBeenCalled();
  });

  it('print מדפיס', () => {
    const { deps, run } = setup();
    run('print');
    expect(deps.print).toHaveBeenCalledTimes(1);
  });

  it('find ו-replace פותחים את הדיאלוג במצב הנכון', () => {
    const { deps, run } = setup();

    run('find');
    run('replace');

    expect(deps.openFind).toHaveBeenNthCalledWith(1, 'find');
    expect(deps.openFind).toHaveBeenNthCalledWith(2, 'replace');
  });

  it('escape סוגר את החלון הפתוח', () => {
    const { deps, run } = setup();
    run('escape');
    expect(deps.closeTopmost).toHaveBeenCalledTimes(1);
  });

  it('escape בלי חלון פתוח אינו נופל', () => {
    const { run } = setup({ closeTopmost: vi.fn(() => false) });
    expect(() => run('escape')).not.toThrow();
  });

  it('כל פעולה מגיעה ליעד שלה בלבד', () => {
    const { deps, run } = setup();

    run('new-document');
    run('open-document');
    run('select-all');
    run('page-break');
    run('link');
    run('font-grow');
    run('font-shrink');
    run('superscript');
    run('subscript');

    expect(deps.openLink).toHaveBeenCalledTimes(1);
    expect(deps.growFont).toHaveBeenCalledTimes(1);
    expect(deps.shrinkFont).toHaveBeenCalledTimes(1);
    expect(deps.vertAlign).toHaveBeenNthCalledWith(1, 'superscript');
    expect(deps.vertAlign).toHaveBeenNthCalledWith(2, 'subscript');

    run('footnote');
    run('endnote');
    run('track-changes');
    run('focus-mode');
    run('find-next');
    run('find-prev');

    expect(deps.insertNote).toHaveBeenNthCalledWith(1, 'footnote');
    expect(deps.insertNote).toHaveBeenNthCalledWith(2, 'endnote');
    expect(deps.toggleTrackChanges).toHaveBeenCalledTimes(1);
    expect(deps.toggleFocusMode).toHaveBeenCalledTimes(1);
    expect(deps.findAgain).toHaveBeenNthCalledWith(1, 'next');
    expect(deps.findAgain).toHaveBeenNthCalledWith(2, 'prev');

    run('insert-citation');
    run('search-otzaria');
    run('open-library');

    expect(deps.insertCitation).toHaveBeenCalledTimes(1);
    expect(deps.searchOtzaria).toHaveBeenCalledTimes(1);
    expect(deps.openLibrary).toHaveBeenCalledTimes(1);
    expect(deps.newDocument).toHaveBeenCalledTimes(1);
    expect(deps.openDocument).toHaveBeenCalledTimes(1);
    expect(deps.selectAll).toHaveBeenCalledTimes(1);
    expect(deps.pageBreak).toHaveBeenCalledTimes(1);
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('הדפסה ושמירה אינן מתערבבות', () => {
    const { deps, run } = setup({ isSaving: () => true });

    run('print');

    // שמירה שרצה חוסמת שמירה בלבד, לא כל פעולה אחרת.
    expect(deps.print).toHaveBeenCalledTimes(1);
  });
});
