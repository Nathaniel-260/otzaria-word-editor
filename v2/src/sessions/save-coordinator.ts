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
 * 3. **סבב שייך למסמך שפתח אותו.** `reset` (מעבר מסמך) מעלה epoch, וסבב עם
 *    epoch ישן נעצר לפני ה-commit ומחזיר `stale`. שני דברים תלויים בזה, וכל
 *    אחד מהם לבד הוא אובדן נתונים:
 *    - **הכתיבה לדיסק.** ה-commit קורא את היעד; אחרי מעבר מסמך היעד הוא של
 *      המסמך החדש, כלומר הבייטים של הישן היו נכתבים לקובץ של החדש ודורסים
 *      אותו. לכן היעד מצולם בתחילת הסבב, ובנוסף הסבב נעצר לפני ה-commit.
 *    - **המצב.** בלי זה סבב של א' שמסתיים היה מאמץ מחדש את ה-token של א',
 *      והשמירה הבאה של ב' הייתה נכתבת לקובץ של א'.
 */

export type SaveState = 'idle' | 'exporting' | 'uploading' | 'committing' | 'error';

export type SaveOutcome =
  /** נשמר, וה-token הוא היעד לשמירה הבאה. */
  | { status: 'saved'; token: string; name: string }
  /** אין מה לשמור. */
  | { status: 'clean' }
  /** המשתמש סגר את „שמור בשם”. המסמך נשאר כפי שהיה. */
  | { status: 'cancelled' }
  /**
   * הסבב הסתיים אחרי שהמסמך שהוא שייך אליו הוחלף. התוצאה נזרקת ואינה נוגעת
   * במצב — ראו [createSaveCoordinator].
   */
  | { status: 'stale' }
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
  /**
   * משחרר העלאה שלא תגיע ל-commit. חייב להיות: בלעדיו כל סבב שנעצר אחרי
   * ההעלאה משאיר קובץ זמני וסלוט במכסה תפוסים עד שה-token פג.
   */
  abort: (writeToken: string) => Promise<void>;
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
  /** שמירה בתהליך. מעבר מסמך בזמן הזה אסור. */
  isSaving: boolean;
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
  /** ה-epoch שאליו שייך הסבב שרץ. */
  let inFlightEpoch = -1;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  /** מזהה המסמך הנוכחי. כל reset מעלה אותו. */
  let epoch = 0;

  function snapshot(): SaveSnapshot {
    return {
      state,
      isDirty: dirtyRevision !== savedRevision,
      targetToken,
      name,
      lastError,
      isSaving: inFlight !== null,
    };
  }

  function publish(): void {
    // אחרי dispose אין למי לדווח, וסבב שנשאר באוויר לא יעדכן ממשק שכבר פורק.
    if (disposed) return;
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

  /**
   * משחרר העלאה שלא תגיע ל-commit. ניקוי, ולכן כשל שלו אינו הופך לכשל שמירה —
   * הגרוע ביותר שיקרה הוא שהיא תפוג מעצמה תוך שתי דקות.
   */
  async function release(ticket: SaveTicket | undefined): Promise<void> {
    if (!ticket) return;
    try {
      await deps.abort(ticket.writeToken);
    } catch (error) {
      console.warn('[otzaria-word] שחרור ההעלאה נכשל', error);
    }
  }

  function fail(error: unknown, fallback: string): SaveOutcome {
    lastError = error instanceof Error && error.message ? error.message : fallback;
    setState('error');
    return { status: 'failed', message: `${fallback}: ${lastError}` };
  }

  /** סבב שמירה אחד: ייצוא → העלאה → commit. */
  async function runOnce(
    mine: number,
    forceSaveAs: boolean,
    suggestedName?: string,
  ): Promise<SaveOutcome> {
    // מצולם לפני הייצוא: מה שהמשתמש יקליד מכאן והלאה אינו בקובץ הזה.
    const exportedRevision = dirtyRevision;
    // וגם היעד מצולם. קריאה שלו בזמן ה-commit הייתה נותנת את היעד של המסמך
    // שנפתח בינתיים — כלומר הבייטים של המסמך הזה היו נכתבים לקובץ של האחר.
    const target = targetToken;
    lastError = null;

    /**
     * מצב מתפרסם רק כל עוד הסבב שייך למסמך הפתוח. אחרת „שומר…” של המסמך
     * הקודם היה נדבק לחדש, ואחרי שהסבב הישן ייגמר המצב היה נשאר תקוע.
     */
    const stage = (next: SaveState): void => {
      if (mine === epoch) setState(next);
    };

    let blob: Blob;
    try {
      stage('exporting');
      blob = await deps.exportDocument();
    } catch (error) {
      if (mine !== epoch) return { status: 'stale' };
      return fail(error, 'ייצוא המסמך נכשל');
    }

    let ticket: SaveTicket | undefined;
    try {
      stage('uploading');
      ticket = await deps.beginWrite(blob.size);
      await deps.upload(ticket.uploadUrl, blob);
    } catch (error) {
      // ההעלאה נפתחה ולא תגיע ל-commit — לשחרר אותה עכשיו ולא לחכות לפקיעה.
      await release(ticket);
      if (mine !== epoch) return { status: 'stale' };
      return fail(error, 'העלאת המסמך נכשלה');
    }

    // הבדיקה כאן, לפני ה-commit, היא הנקודה הקריטית: ה-commit הוא הפעולה
    // ההרסנית — הוא כותב לדיסק. אחרי מעבר מסמך אין לו למי לכתוב: היעד של
    // המסמך הזה אינו רלוונטי יותר, והבייטים האלה בטח לא שייכים לקובץ של המסמך
    // שנפתח. הייצוא וההעלאה שכבר נעשו הם בזבוז, לא נזק.
    if (mine !== epoch) {
      await release(ticket);
      return { status: 'stale' };
    }

    let result: SaveCommitOutput;
    try {
      stage('committing');
      result = await deps.commit({
        writeToken: ticket.writeToken,
        // בלי יעד — או כשביקשו „שמור בשם” במפורש — ה-commit פותח דיאלוג.
        ...(forceSaveAs || !target ? {} : { targetToken: target }),
        ...(suggestedName ? { suggestedName } : {}),
      });
    } catch (error) {
      if (mine !== epoch) return { status: 'stale' };
      return fail(error, 'שמירת המסמך נכשלה');
    }

    // ה-commit הסתיים אחרי שהמסמך הוחלף. הכתיבה עצמה לגיטימית — היא נעשתה
    // ליעד שצולם — אבל אסור לגעת במצב של המסמך שפתוח עכשיו.
    if (mine !== epoch) return { status: 'stale' };

    if (result.cancelled) {
      // ביטול אינו כשל ואינו מסמן שגיאה — אבל גם אינו שמירה, ולכן dirty נשאר.
      stage('idle');
      return { status: 'cancelled' };
    }
    if (!result.token) {
      return fail(new Error('אוצריא לא החזירה מזהה קובץ'), 'שמירת המסמך נכשלה');
    }

    targetToken = result.token;
    name = result.name ?? name;
    // רק המהדורה שיוצאה נחשבת שמורה.
    if (exportedRevision > savedRevision) savedRevision = exportedRevision;
    stage('idle');
    return { status: 'saved', token: result.token, name: name ?? '' };
  }

  async function saveLoop(
    mine: number,
    forceSaveAs: boolean,
    suggestedName?: string,
  ): Promise<SaveOutcome> {
    let outcome = await runOnce(mine, forceSaveAs, suggestedName);

    // שינוי שקרה בזמן הסבב אינו בקובץ. סבב נוסף — הפעם ליעד שכבר קיים, ולכן
    // בלי דיאלוג.
    //
    // אין כאן בדיקת epoch, בכוונה: הלופ ממשיך רק על `saved`, ו-`saved` אפשרי
    // רק כשה-epoch תאם (הסבב נעצר לפני ה-commit אחרת). בדיקה נוספת כאן הייתה
    // קוד שאין דרך להגיע אליו, ולכן גם אין דרך לבדוק אותו.
    while (outcome.status === 'saved' && dirtyRevision !== savedRevision && !disposed) {
      outcome = await runOnce(mine, false, suggestedName);
    }

    return outcome;
  }

  function saveNow(
    options: { forceSaveAs?: boolean; suggestedName?: string } = {},
  ): Promise<SaveOutcome> {
    if (disposed) return Promise.resolve({ status: 'clean' });
    cancelAutosave();

    // שמירה שרצה **על אותו מסמך** — מצטרפים אליה. הלופ שלה כבר יטפל בשינוי
    // שנעשה בינתיים, וכך אין שני סבבים שכותבים לאותו יעד בסדר סיום שאינו
    // מובטח.
    if (inFlight && inFlightEpoch === epoch) return inFlight;

    // סבב שרץ ושייך למסמך קודם: אין להצטרף אליו — התוצאה שלו תהיה `stale`,
    // והמשתמש היה מקבל „לחצתי שמור וכלום לא קרה”. ממתינים לו וממשיכים.
    const previous = inFlight;
    if (previous) {
      const mineAfterWait = epoch;
      const chained = previous
        .catch(() => undefined)
        .then(() => runChain(mineAfterWait, options));
      inFlight = chained;
      inFlightEpoch = epoch;
      publish();
      return chained;
    }

    const isClean = dirtyRevision === savedRevision;
    // „שמור בשם” על מסמך נקי הוא בקשה לגיטימית להעתק, והוא מייצא בלי לשנות
    // revision: הגדלה מלאכותית שרדה ביטול של הדיאלוג וסימנה מסמך נקי כמלוכלך.
    if (isClean && !options.forceSaveAs) {
      return Promise.resolve({ status: 'clean' });
    }

    const run = runChain(epoch, options);
    inFlight = run;
    inFlightEpoch = epoch;
    publish();
    return run;
  }

  /**
   * מריץ סבב ומשחרר את ה-single-flight בסופו. מופרד כדי ששרשור אחרי סבב של
   * מסמך קודם יעבור באותו מסלול בדיוק.
   */
  function runChain(
    mine: number,
    options: { forceSaveAs?: boolean; suggestedName?: string },
  ): Promise<SaveOutcome> {
    return saveLoop(mine, options.forceSaveAs ?? false, options.suggestedName).finally(() => {
      // אם בינתיים נרשם סבב חדש יותר, לא לדרוך עליו.
      if (inFlightEpoch === mine) {
        inFlight = null;
        inFlightEpoch = -1;
      }
      publish();
    });
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
      // כל סבב שבאוויר שייך למסמך הקודם, ומכאן והלאה התוצאה שלו נזרקת.
      epoch += 1;
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
      // כמו מעבר מסמך: כל סבב שבאוויר הופך ל-stale, ולכן לא יעשה commit ולא
      // יאמץ יעד אחרי הפירוק.
      epoch += 1;
      cancelAutosave();
    },
  };
}
