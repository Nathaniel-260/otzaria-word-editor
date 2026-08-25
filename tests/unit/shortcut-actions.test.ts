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
    ...over,
  };
  return { deps, run: createShellActionRunner(deps) };
}

describe('createShellActionRunner', () => {
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

    expect(deps.openLink).toHaveBeenCalledTimes(1);
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
