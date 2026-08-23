/**
 * „שמור” ו„שמור בשם”.
 *
 * הכלל היחיד שקובע כל החלטה בקובץ הזה: **מסמך שלא נשמר בוודאות נשאר מסומן
 * כמלוכלך.** כל מסלול כשל — ייצוא, העלאה, commit, ביטול דיאלוג — משאיר את
 * המסמך dirty ואינו מציג „נשמר”. עדיף שהמשתמש ינסה שוב מאשר שיסגור לשונית
 * בהנחה שהעבודה על הדיסק.
 *
 * מכאן נובעות שתי דקויות שקל לפספס:
 *
 * 1. **ה-revision מצולם לפני הייצוא.** אם המשתמש הקליד בזמן שהשמירה רצה,
 *    ה-Blob שנשמר אינו מכיל את ההקלדה הזאת — ולכן `savedRevision` מתקדם רק
 *    למה שיוצא בפועל, והמסמך נשאר dirty ומריץ סבב נוסף.
 * 2. **אין שתי שמירות במקביל.** שתיהן היו מייצאות, מעלות ועושות commit לאותו
 *    יעד, וסדר הסיום אינו מובטח — כלומר גרסה ישנה יכולה לדרוס חדשה.
 */

export type SaveState = 'idle' | 'exporting' | 'uploading' | 'committing' | 'error';

export type SaveOutcome =
  /** נשמר, וה-token הוא היעד לשמירה הבאה. */
  | { status: 'saved'; token: string; name: string }
  /** אין מה לשמור. */
  | { status: 'clean' }
  /** המשתמש סגר את „שמור בשם”. המסמך נשאר כפי שהיה. */
  | { status: 'cancelled' }
  /** כשל. המסמך נשאר מלוכלך. */
  | { status: 'failed'; message: string };

export interface SaveTicket {
  writeToken: string;
  uploadUrl: string;
}

export interface SaveCommitInput {
  writeToken: string;
  targetToken?: string;
  suggestedName?: string;
}

export interface SaveCommitOutput {
  cancelled: boolean;
  token?: string;
  name?: string;
}

export interface SaveCoordinatorDeps {
  /** מייצא את המסמך הפעיל. */
  exportDocument: () => Promise<Blob>;
  beginWrite: (expectedSize: number) => Promise<SaveTicket>;
  upload: (uploadUrl: string, blob: Blob) => Promise<void>;
  commit: (input: SaveCommitInput) => Promise<SaveCommitOutput>;
  /** נקרא על כל שינוי מצב, כדי שהממשק יציג dirty/שומר/שגיאה. */
  onStateChange?: (snapshot: SaveSnapshot) => void;
}

export interface SaveSnapshot {
  state: SaveState;
  isDirty: boolean;
  /** יעד הכתיבה הנוכחי, או null אם „שמור” עוד יפתח „שמור בשם”. */
  targetToken: string | null;
  name: string | null;
  lastError: string | null;
}

/** debounce של autosave. ערך התכנית (§9.3). */
export const AUTOSAVE_DELAY_MS = 2500;

export interface SaveCoordinator {
  readonly snapshot: SaveSnapshot;
  /** אחרי עריכה. מתחיל autosave רק אם יש יעד כתיבה. */
  markDirty(): void;
  /** מגדיר את היעד — למשל אחרי פתיחת קובץ עם access: 'readwrite'. */
  adoptTarget(target: { token: string; name: string } | null): void;
  /** מאפס לספירה נקייה — לשימוש בפתיחת מסמך אחר. */
  reset(target?: { token: string; name: string } | null): void;
  saveNow(options?: { forceSaveAs?: boolean; suggestedName?: string }): Promise<SaveOutcome>;
  dispose(): void;
}

export function createSaveCoordinator(deps: SaveCoordinatorDeps): SaveCoordinator {
  let dirtyRevision = 0;
  let savedRevision = 0;
  let state: SaveState = 'idle';
  let targetToken: string | null = null;
  let name: string | null = null;
  let lastError: string | null = null;

  let inFlight: Promise<SaveOutcome> | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function snapshot(): SaveSnapshot {
    return {
      state,
      isDirty: dirtyRevision !== savedRevision,
      targetToken,
      name,
      lastError,
    };
  }

  function publish(): void {
    deps.onStateChange?.(snapshot());
  }

  function setState(next: SaveState): void {
    state = next;
    publish();
  }

  function cancelAutosave(): void {
    if (autosaveTimer !== undefined) {
      clearTimeout(autosaveTimer);
      autosaveTimer = undefined;
    }
  }

  function fail(error: unknown, fallback: string): SaveOutcome {
    lastError = error instanceof Error && error.message ? error.message : fallback;
    setState('error');
    return { status: 'failed', message: `${fallback}: ${lastError}` };
  }

  /** סבב שמירה אחד: ייצוא → העלאה → commit. */
  async function runOnce(forceSaveAs: boolean, suggestedName?: string): Promise<SaveOutcome> {
    // מצולם לפני הייצוא: מה שהמשתמש יקליד מכאן והלאה אינו בקובץ הזה.
    const exportedRevision = dirtyRevision;
    lastError = null;

    let blob: Blob;
    try {
      setState('exporting');
      blob = await deps.exportDocument();
    } catch (error) {
      return fail(error, 'ייצוא המסמך נכשל');
    }

    let ticket: SaveTicket;
    try {
      setState('uploading');
      ticket = await deps.beginWrite(blob.size);
      await deps.upload(ticket.uploadUrl, blob);
    } catch (error) {
      return fail(error, 'העלאת המסמך נכשלה');
    }

    let result: SaveCommitOutput;
    try {
      setState('committing');
      result = await deps.commit({
        writeToken: ticket.writeToken,
        // בלי יעד — או כשביקשו „שמור בשם” במפורש — ה-commit פותח דיאלוג.
        ...(forceSaveAs || !targetToken ? {} : { targetToken }),
        ...(suggestedName ? { suggestedName } : {}),
      });
    } catch (error) {
      return fail(error, 'שמירת המסמך נכשלה');
    }

    if (result.cancelled) {
      // ביטול אינו כשל ואינו מסמן שגיאה — אבל גם אינו שמירה, ולכן dirty נשאר.
      setState('idle');
      return { status: 'cancelled' };
    }
    if (!result.token) {
      return fail(new Error('אוצריא לא החזירה מזהה קובץ'), 'שמירת המסמך נכשלה');
    }

    targetToken = result.token;
    name = result.name ?? name;
    // רק המהדורה שיוצאה נחשבת שמורה.
    if (exportedRevision > savedRevision) savedRevision = exportedRevision;
    setState('idle');
    return { status: 'saved', token: result.token, name: name ?? '' };
  }

  async function saveLoop(forceSaveAs: boolean, suggestedName?: string): Promise<SaveOutcome> {
    let outcome = await runOnce(forceSaveAs, suggestedName);

    // שינוי שקרה בזמן הסבב אינו בקובץ. סבב נוסף — הפעם ליעד שכבר קיים, ולכן
    // בלי דיאלוג.
    while (outcome.status === 'saved' && dirtyRevision !== savedRevision && !disposed) {
      outcome = await runOnce(false, suggestedName);
    }

    return outcome;
  }

  function saveNow(
    options: { forceSaveAs?: boolean; suggestedName?: string } = {},
  ): Promise<SaveOutcome> {
    if (disposed) return Promise.resolve({ status: 'clean' });
    cancelAutosave();

    // שמירה שרצה — מצטרפים אליה. הלופ שלה כבר יטפל בשינוי שנעשה בינתיים, וכך
    // אין שני סבבים שכותבים לאותו יעד בסדר סיום שאינו מובטח.
    if (inFlight) return inFlight;

    const isClean = dirtyRevision === savedRevision;
    if (isClean && !options.forceSaveAs) {
      return Promise.resolve({ status: 'clean' });
    }
    // „שמור בשם” על מסמך נקי הוא בקשה לגיטימית להעתק, ולכן מסמנים אותו
    // כמלוכלך כדי שהסבב יוציא בפועל.
    if (isClean) dirtyRevision += 1;

    const run = saveLoop(options.forceSaveAs ?? false, options.suggestedName).finally(() => {
      inFlight = null;
    });
    inFlight = run;
    return run;
  }

  return {
    get snapshot() {
      return snapshot();
    },

    markDirty() {
      dirtyRevision += 1;
      publish();

      // autosave רק ליעד קיים: בלי יעד כל סבב היה פותח „שמור בשם” מעצמו,
      // שתיים וחצי שניות אחרי שהמשתמש הפסיק להקליד.
      if (!targetToken || disposed) return;
      cancelAutosave();
      autosaveTimer = setTimeout(() => {
        autosaveTimer = undefined;
        void saveNow();
      }, AUTOSAVE_DELAY_MS);
    },

    adoptTarget(target) {
      targetToken = target?.token ?? null;
      name = target?.name ?? null;
      publish();
    },

    reset(target) {
      cancelAutosave();
      dirtyRevision = 0;
      savedRevision = 0;
      state = 'idle';
      lastError = null;
      targetToken = target?.token ?? null;
      name = target?.name ?? null;
      publish();
    },

    saveNow,

    dispose() {
      disposed = true;
      cancelAutosave();
    },
  };
}
