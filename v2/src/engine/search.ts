/**
 * שכבת החיפוש. „חיפוש והחלפה” עובר דרך כאן ולא קורא ל-`ui.search` ישירות,
 * מאותה סיבה שבגללה קיים command-adapter: כשל צריך להגיע למשתמש בעברית, ולא
 * להיעלם.
 *
 * למה המודול הזה נכתב: הקוד שקדם לו קרא ל-`ui.search.find(query)` — מתודה
 * שאינה קיימת בחוזה — מתוך `as any` ובתוך `catch` ריק. ה-`as any` העלים את זה
 * מה-typecheck, ה-`catch` העלים את זה מהמשתמש, והחיפוש לא רץ מעולם. `replace`
 * נקראה שם עם שני ארגומנטים, בעוד החוזה מקבל אחד (`replace(replacement)`),
 * כלומר מחרוזת החיפוש נכתבה למסמך בתור טקסט ההחלפה.
 *
 * הטיפוסים נגזרים מ-`BorrowedSuperDocUI['search']` ואינם מיובאים: הפאסדה
 * `superdoc/ui` היא named exports בלבד ואינה מייצאת את `SearchHandle`/
 * `SearchSlice`, ו-import מנתיב פנימי של החבילה אסור (tests/unit/engine-boundaries).
 * הגזירה מהמשטח הציבורי נותנת בדיוק את החוזה, ונשברת ב-typecheck אם הוא ישתנה.
 *
 * המודול אינו מציג הודעות ואינו מרנדר דבר: הוא מחזיר תוצאה, וההצגה — שורת
 * המצב, מונה התוצאות, הסתרת פקדי ההחלפה — היא של שכבת ה-UI. זה גם מה שמאפשר
 * לבדוק את הלוגיקה בלי להרים קומפוננטה.
 */
import type { BorrowedSuperDocUI } from 'superdoc';
import { reasonText } from './command-adapter';

/** ה-handle של המנוע, כפי שהוא מוצהר על `SuperDocUI.search`. */
type SearchHandle = BorrowedSuperDocUI['search'];

/** ה-slice שהמנוע מחזיר. נגזר מה-handle כדי שלא תהיה כאן העתקה של החוזה. */
export type SearchSlice = ReturnType<SearchHandle['getSnapshot']>;

/** מה שנדרש מה-controller. `Pick` ולא הטיפוס המלא — כדי שבדיקה תוכל לכפול רק אותו. */
export type SearchHost = Pick<BorrowedSuperDocUI, 'search'>;

/**
 * מרווח ההשקטה לחיפוש-בזמן-הקלדה. חיפוש בכל הקשה מריץ סריקת מסמך שלמה על
 * שאילתה שהמשתמש עוד באמצע כתיבתה; 250 מילישניות הן ההפרש שבו אדם מפסיק
 * להקליד, ולא עיכוב שמורגש בתוצאה.
 */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * ההסבר שהדיאלוג מציג במקום פקדי ההחלפה.
 *
 * **היה** `REASON_TEXT['replace-unsupported']` — „החלפת טקסט אינה נתמכת בגרסה
 * הזאת של המנוע”. זה נמדד כשקר: במסמך ריק, חיפוש מילה שאינה בו החזיר אפס
 * התאמות, הנוסח הזה הופיע ולשונית „החלף” נעלמה; באותו build עם מסמך שבו חמש
 * התאמות שתי הלשוניות היו שם וכל הכפתורים פעילים. כלומר ההודעה תלתה במנוע
 * מצב של **המסמך**.
 *
 * הנוסח החדש אינו טוען דבר על הגרסה, והוא נכון בשני המצבים שבהם הפקדים
 * מוסתרים (ראו `replaceControlsVisible`): מסמך שאין בו חיפוש בכלל, ומסמך שיש
 * בו התאמות והמנוע מדווח שאינו יכול להחליף אותן.
 *
 * השם נשאר — הדיאלוג מייבא אותו בשמו הזה — והוא עדיין מדויק: זו ההודעה
 * שמוצגת כשהחלפה אינה זמינה.
 */
export const REPLACE_UNAVAILABLE_TEXT = 'החלפה אינה זמינה במסמך הזה כרגע';

/** מה שמוצג כשיש שאילתה ואין לה התאמות. תשובה, לא שגיאה. */
export const NO_MATCHES_TEXT = 'אין התאמות להחלפה';

/** מה שמוצג כשמבקשים החלפה בלי שאילתת חיפוש. */
export const NO_QUERY_TEXT = 'יש להזין טקסט לחיפוש לפני החלפה';

/** המצב הקריא של החיפוש. כולו נגזר מ-`getSnapshot()` של המנוע, ולא מ-state משלנו. */
export interface SearchState {
  query: string;
  /** מספר ההתאמות לשאילתה הנוכחית. */
  total: number;
  /** ההתאמה הפעילה, מאופס. `-1` כשאין. */
  activeIndex: number;
  /** האם session חיפוש פתוח. */
  open: boolean;
  /** האם המנוע חושף חיפוש במסמך הזה. */
  available: boolean;
  /**
   * מה שהמנוע מדווח על ההחלפה **בקבוצת ההתאמות הנוכחית**. תלוי-מצב ולא
   * תלוי-גרסה: נמדד ש-`canReplaceText` במנוע הוא
   * `shouldReplaceText && Boolean(target) && typeof replace === 'function'`,
   * ולכן הוא `false` גם כשאין התאמות בכלל.
   *
   * **אינו** השאלה „האם להציג את פקדי ההחלפה” — זו `replaceControlsVisible`,
   * ולהפרדה הזאת יש היסטוריה: הדגל הזה שימש כתשובה לשתי השאלות, ולכן שאילתה
   * בלי תוצאות הודיעה למשתמש שהמנוע אינו תומך בהחלפה.
   */
  canReplace: boolean;
  /**
   * החלפה שנשלחה למנוע וטרם הסתיימה. session מבוסס worker מחזיר Promise,
   * והחוזה מורה להחזיק את מצב ה-UI עד שהוא נפתר.
   */
  isReplacing: boolean;
}

/**
 * תוצאת פעולה. `snapshot` הוא המצב אחרי הפעולה, כדי שהקורא לא יצטרך לשאול
 * שוב; `message` תמיד בעברית ומוכן להצגה.
 */
export type SearchOutcome =
  | { ok: true; snapshot: SearchState }
  | { ok: false; message: string; reason?: string };

/** המצב לפני שיש מסמך פתוח. לא קבוע משותף — כדי שקורא לא ישנה אותו לכולם. */
export function idleSearchState(): SearchState {
  return {
    query: '',
    total: 0,
    activeIndex: -1,
    open: false,
    available: false,
    canReplace: false,
    isReplacing: false,
  };
}

/**
 * מונה התוצאות שמוצג ליד שדה החיפוש. כאן ולא בקומפוננטה, כי זו הנגזרת של
 * `total`/`activeIndex` — בדיוק המידע שהמנוע מספק ושהדיאלוג הקודם לא הציג.
 */
export function searchCounterText(state: SearchState): string {
  if (!state.query) return '';
  if (state.total === 0) return 'אין תוצאות';
  // התאמות נמצאו אך אין פעילה (למשל מיד אחרי `clear` של הסמן) — המספר לבדו
  // עדיף על „1 מתוך 12” שאינו נכון.
  if (state.activeIndex < 0) return `${state.total} תוצאות`;
  return `${state.activeIndex + 1} מתוך ${state.total}`;
}

/**
 * האם להציג את פקדי ההחלפה בדיאלוג.
 *
 * שלושת המצבים שהופרדו כאן היו מצב אחד, ומכאן הבאג: `canReplace` של המנוע
 * שימש גם כ„הגרסה תומכת”, גם כ„המסמך מרשה” וגם כ„יש מה להחליף”.
 *
 *   1. אין חיפוש במסמך הזה → אין גם החלפה, והפקדים מוסתרים עם ההסבר.
 *   2. יש חיפוש ואין התאמות → הפקדים **נשארים**. שאילתה בלי תוצאות אינה סיבה
 *      להעלים את שדה ההחלפה מתחת לאצבע של מי שמקליד בו, וההודעה על „אין
 *      התאמות” מגיעה כשלוחצים.
 *   3. יש התאמות → זה בדיוק המצב שבו `canReplace` של המנוע הוא תשובה
 *      אמיתית, ולכן הוא מכריע.
 */
export function replaceControlsVisible(state: SearchState): boolean {
  if (!state.available) return false;
  if (state.total === 0) return true;
  return state.canReplace;
}

export interface SearchAdapter {
  /** המצב הנוכחי, מהמנוע. */
  getState(): SearchState;
  /** מאזינה לשינויי מצב. מחזירה פונקציית ביטול. */
  subscribe(listener: (state: SearchState) => void): () => void;
  /** פותחת session חיפוש. נקראת כשהדיאלוג נפתח. */
  open(): SearchOutcome;
  /** סוגרת את ה-session ומנקה את ההדגשות במסמך. */
  close(): void;
  /** מנקה שאילתה והתאמות בלי לסגור את ה-session. */
  clear(): void;
  /** חיפוש מפורש (Enter, „מצא הבא”, „מצא קודם”), כולל ניווט לפי הכיוון. */
  find(query: string, direction: 'next' | 'prev'): SearchOutcome;
  /** חיפוש-בזמן-הקלדה. הקשות רצופות מתלכדות לקריאת `search` אחת. */
  findDebounced(query: string, onOutcome: (outcome: SearchOutcome) => void): void;
  /** מחליפה את ההתאמה הפעילה. `replacement` בלבד — כך החוזה. */
  replace(replacement: string): Promise<SearchOutcome>;
  /** מחליפה את כל ההתאמות הנוכחיות, כל אחת פעם אחת. */
  replaceAll(replacement: string): Promise<SearchOutcome>;
  /** מבטלת חיפוש-בזמן-הקלדה שממתין. נקראת בפירוק ה-session. */
  dispose(): void;
}

export function createSearchAdapter(ui: SearchHost): SearchAdapter {
  const handle = ui.search;
  const listeners = new Set<(state: SearchState) => void>();
  let replacing = false;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function toState(slice: SearchSlice): SearchState {
    return {
      query: slice.query,
      total: slice.total,
      activeIndex: slice.activeIndex,
      open: slice.open,
      available: slice.available,
      // `canReplace` נשאר כפי שהמנוע מדווח גם בזמן החלפה: הוא היכולת, לא
      // העסוק. `isReplacing` הוא זה שמשתיק את הפקד לרגע.
      canReplace: slice.canReplace,
      isReplacing: replacing,
    };
  }

  function snapshot(): SearchState {
    return toState(handle.getSnapshot());
  }

  function emit(): void {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  }

  function failure(reason: string | undefined): SearchOutcome {
    return { ok: false, message: reasonText(reason), reason };
  }

  function threw(error: unknown): SearchOutcome {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'פעולת החיפוש נכשלה',
      reason: 'threw',
    };
  }

  /**
   * `available: false` הוא המצב שבו כל פעולה נכשלת סגור עם `search-unavailable`.
   * נבדק כאן ולא רק על התוצאה, כדי שהמשתמש יקבל את ההסבר במקום ש-`next()`
   * יחזיר „הפעולה אינה זמינה כרגע” על מסמך שאין בו חיפוש בכלל.
   */
  function unavailable(slice: SearchSlice): SearchOutcome | undefined {
    if (slice.available) return undefined;
    return failure(slice.reason ?? 'search-unavailable');
  }

  /** `handle.search` בלבד, בלי ניווט — זה מה שחיפוש-בזמן-הקלדה צריך. */
  function runSearch(query: string): SearchOutcome {
    try {
      const current = handle.getSnapshot();
      const blocked = unavailable(current);
      if (blocked) return blocked;

      if (!query) {
        handle.clear();
        return { ok: true, snapshot: snapshot() };
      }

      const slice = handle.search(query);
      const rejected = unavailable(slice);
      if (rejected) return rejected;
      return { ok: true, snapshot: toState(slice) };
    } catch (error) {
      return threw(error);
    }
  }

  async function mutate(
    kind: 'replace' | 'replaceAll',
    replacement: string,
  ): Promise<SearchOutcome> {
    let before: SearchSlice;
    try {
      before = handle.getSnapshot();
    } catch (error) {
      return threw(error);
    }

    const blocked = unavailable(before);
    if (blocked) return blocked;

    /* ה-gate של §11 נשאר — החלפה אינה תכולה מובטחת — אבל הוא נעצר בדיוק במה
       שאנחנו יודעים בשם, ולא יותר.

       מה שהיה כאן: `if (!before.canReplace) return failure(before.reason ??
       'replace-unsupported')`. `canReplace` הוא תלוי-מצב, ה-`reason` של ה-slice
       הוא `undefined` בכל המצבים האלה, ולכן ברירת המחדל הייתה זו שמדברת —
       ו-`replace-unsupported` הוא קוד שהמנוע ב-2.8.0 **אינו פולט בכלל**
       (נמדד: הוא מוגדר ב-`SUPERDOC_UI_REASONS` ואין לו אתר ייצור אחד).
       כלומר כל חסימה, מכל סיבה, הוצגה כחוסר בגרסת המנוע.

       שני התנאים שנשארו הם השניים שיש להם שם נכון: אין שאילתה, ואין התאמות.
       בשאר המצבים המנוע הוא שעונה, והתשובה שלו מדויקת ממה שנוכל לנחש —
       `document-readonly` כשהמסמך לקריאה, `operation-unavailable` כשההחלפה
       אינה מחוברת, `search-unavailable` כשאין מצע חיפוש. */
    if (!before.query) {
      return { ok: false, message: NO_QUERY_TEXT, reason: 'no-query' };
    }
    if (before.total === 0) {
      return { ok: false, message: NO_MATCHES_TEXT, reason: 'no-matches' };
    }

    if (replacing) {
      return { ok: false, message: 'ההחלפה הקודמת עדיין רצה', reason: 'replace-pending' };
    }

    replacing = true;
    emit();
    try {
      // session מבוסס worker מחזיר Promise, ומקומי מחזיר תוצאה מיד. `await`
      // מטפל בשניהם, וה-`finally` הוא מה שמחזיק את המצב עד ש-settled.
      const result = await handle[kind](replacement);
      if (!result?.ok) return failure(result?.reason);
      return { ok: true, snapshot: snapshot() };
    } catch (error) {
      return threw(error);
    } finally {
      replacing = false;
      emit();
    }
  }

  function cancelPending(): void {
    if (debounceTimer === undefined) return;
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  return {
    getState: snapshot,

    subscribe(listener) {
      listeners.add(listener);
      let off: (() => void) | undefined;
      try {
        off = handle.subscribe(({ snapshot: slice }) => listener(toState(slice)));
      } catch (error) {
        // הרשמה למצב החיפוש אינה סיבה להפיל פתיחת מסמך. מדווח ללוג כדי
        // שהמונה שיישאר קפוא לא ייראה כמו „אין תוצאות”.
        console.error('[otzaria-word] הרשמה למצב החיפוש נכשלה', error);
      }
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },

    open() {
      try {
        const result = handle.open();
        if (!result?.ok) return failure(result?.reason);
        return { ok: true, snapshot: snapshot() };
      } catch (error) {
        return threw(error);
      }
    },

    close() {
      cancelPending();
      try {
        handle.close();
      } catch (error) {
        // אין למשתמש מה לעשות עם כשל בסגירת דיאלוג, וזריקה כאן הייתה משאירה
        // את הדיאלוג פתוח. ללוג ולא לשקט מוחלט.
        console.error('[otzaria-word] סגירת session החיפוש נכשלה', error);
      }
    },

    clear() {
      cancelPending();
      try {
        handle.clear();
      } catch (error) {
        console.error('[otzaria-word] ניקוי החיפוש נכשל', error);
      }
    },

    find(query, direction) {
      cancelPending();
      try {
        let slice = handle.getSnapshot();
        const blocked = unavailable(slice);
        if (blocked) return blocked;

        if (!query) {
          handle.clear();
          return { ok: true, snapshot: snapshot() };
        }

        if (query !== slice.query) {
          slice = handle.search(query);
          const rejected = unavailable(slice);
          if (rejected) return rejected;
          // `search` כבר מסמן את ההתאמה הראשונה, ולכן `next` אחריו היה מדלג
          // עליה. „מצא קודם” על שאילתה חדשה כן נסוג צעד, כי זו הבקשה.
          if (slice.total === 0 || direction === 'next') {
            return { ok: true, snapshot: toState(slice) };
          }
        } else if (slice.total === 0) {
          // אותה שאילתה בלי התאמות אינה כשל אלא תשובה; המונה אומר „אין תוצאות”.
          return { ok: true, snapshot: toState(slice) };
        }

        const step = direction === 'next' ? handle.next() : handle.previous();
        if (!step?.ok) return failure(step?.reason);
        return { ok: true, snapshot: snapshot() };
      } catch (error) {
        return threw(error);
      }
    },

    findDebounced(query, onOutcome) {
      cancelPending();
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        onOutcome(runSearch(query));
      }, SEARCH_DEBOUNCE_MS);
    },

    replace: (replacement) => mutate('replace', replacement),
    replaceAll: (replacement) => mutate('replaceAll', replacement),

    dispose() {
      cancelPending();
      listeners.clear();
    },
  };
}
