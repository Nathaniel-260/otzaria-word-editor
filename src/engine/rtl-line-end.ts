/**
 * מקש `End` בשורה עברית — הבאג שדווח: „בקובץ הוורד שהמסמך נשמר הנקודה עוברת
 * לתחילת המסמך”.
 *
 * ## מה נמדד
 *
 * ב-superdoc 2.12.0, Chrome אמיתי, על ה-dist הארוז: בפסקה שיש בה `<w:bidi/>`
 * מקש `End` מעביר את הסמן ל**תחילת** השורה במקום לסופה. שתי פסקאות באותו
 * מסמך, סמן שהונח באמצע בלחיצה אמיתית:
 *
 *   | הפסקה                | אמצע | `Home` | `End`    | מה שנכון |
 *   |----------------------|------|--------|----------|----------|
 *   | עברית, שורה גולשת 1  |  48  |   0    | **0**    |    98    |
 *   | עברית, שורה גולשת 2  | 144  |  98    | **98**   |   191    |
 *   | אנגלית, שורה 1       |  45  |   0    |   92     |    92    |
 *   | אנגלית, שורה 2       | 141  |  92    |  157     |   157    |
 *
 * כלומר בעברית `End` הוא בדיוק `Home`, ובאנגלית הוא תקין. `Shift+End` נגרר
 * אחריו ובוחר אחורה (0..48 במקום 48..98); `Ctrl+Home` ו-`Ctrl+End` נמדדו
 * **תקינים** ואינם נוגעים כאן, וכך גם `Home` עצמו.
 *
 * ## למה זה נראה למשתמש כמו „הנקודה קפצה לתחילת המסמך”
 *
 * מי שסיים להקליד משפט, לחץ `End` כדי לחזור לסוף השורה והקליד נקודה — קיבל
 * את הנקודה בהיסט 0, כלומר כתו הראשון בפסקה. נמדד: `<w:p><w:pPr><w:bidi/>
 * </w:pPr><w:r><w:t>.</w:t></w:r><w:r><w:t>ברוך הבא לעולם</w:t></w:r></w:p>`.
 * זה אינו עניין של ציור אלא של סדר לוגי — Word מצייר את הפסקה הזאת בדיוק
 * כמו שהעורך מצייר אותה, ובפסקה הראשונה „תחילת הפסקה” היא תחילת המסמך.
 *
 * ## למה התיקון כאן ולא במנוע
 *
 * המשטח שמקבל את המקש הוא של המנוע (אין במסמך אף `contenteditable`; ההקלדה
 * נכנסת ל-`textarea` נסתרת שלו), והקוד שמזיז את הסמן אינו בחלקים הפתוחים של
 * SuperDoc. לכן אין כאן PR אלא יירוט: המאזין יושב על ה-div **שלנו**
 * (`paintedHost` מחזיר את `editor-stack__host`), ורץ לפני שהאירוע מגיע
 * למנוע.
 *
 * ## מה היירוט קורא, ולמה דווקא כך
 *
 * שני דברים חייבים להיות **סינכרוניים**, מפני שההחלטה אם לבטל את האירוע
 * חייבת ליפול בתוך המאזין עצמו:
 *
 * 1. **הסמן** — `activeEditor.host.readLiveSelectionSyncSnapshot()`. נמדד
 *    שהוא מחזיר ערך ולא הבטחה, ובתוכו `selectionTarget.start/end` עם
 *    `blockId` ו-`offset`. `doc.selection.current()`, לעומתו, מחזיר הבטחה —
 *    ואילו חיכינו לה, המנוע כבר היה מזיז את הסמן.
 * 2. **השורה המצוירת** — הפסקה מצוירת כ-fragment שנושא `data-source-node-id`
 *    ו-`data-pm-start`, וכל שורה בתוכה היא **ילד ישיר** שנושא `data-pm-start`
 *    /`data-pm-end`. ההמרה למספר שהמנוע מדבר בו היא חיסור אחד:
 *    `offset = pm − fragmentPmStart`. זה לא נוחש אלא אומת מול המנוע עצמו —
 *    באנגלית, שבה `End` תקין, הוא נותן בדיוק את המספרים שהמנוע נותן (92 ו-
 *    157 בטבלה שלמעלה).
 *
 * `dir="rtl"` על אלמנט השורה הוא ההצהרה של המנוע עצמו על כיוון השורה, והוא
 * נכתב **רק** על שורות RTL (נמדד: במסמך בלי `w:bidi` התכונה אינה קיימת
 * והכיוון המחושב הוא `ltr`). קריאת תכונה ולא `getComputedStyle` היא גם מה
 * שמונע חישוב סגנון מחדש בכל הקשה — ראו „הקלדה שאינה מחשבת סגנון” בהיסטוריה.
 *
 * ## מה קורה כשמשהו מזה חסר
 *
 * שום דבר. אין fragment, אין תכונות, אין `authoring` — המאזין חוזר בלי לבטל
 * את האירוע, והמנוע עושה את מה שהוא עושה היום. שדרוג מנוע שישנה את הצורה
 * הזאת יחזיר את הבאג ולא ישבור הקלדה, ושער ה-QA
 * (`scripts/qa/rtl-line-end-qa.mjs`) הוא זה שיתפוס אותו.
 *
 * ## גבול גלישה: היסט אחד לשתי שורות
 *
 * בשורה שגולשת, ההיסט שבתפר הוא גם סופה של השורה הראשונה וגם תחילתה של
 * השנייה, ואין דרך לדעת מהמנוע באיזו מהן הסמן **מצויר** — התצלום הסינכרוני
 * מחזיר היסט, לא שורה. התפר נקרא כאן כסופה של השורה הקודמת, ומכאן ש-`End`
 * יציב: הקשה נוספת באותו מקום אינה מזיזה (נמדד בשער, „End פעמיים”). הכלל
 * ההפוך — „התפר שייך לשורה הבאה” — היה מעביר כל הקשה נוספת לסוף השורה
 * שאחריה, כלומר `End` חוזר היה מטייל שורה-שורה עד סוף הפסקה.
 *
 * המחיר: `Home` ואז `End` בשורה גולשת שנייה נשאר בתפר במקום להגיע לסוף אותה
 * שורה. הקשה שאינה מזיזה גרועה פחות מהקשה שמזיזה למקום אחר.
 *
 * ומה ש**כן** נמדד ואינו סתירה לזה: הקלדה בתפר מעבירה את הסמן לשורה הבאה
 * בפועל — התו נכנס לתיבת השורה השנייה והסמן מצויר שם (נמדד: פסקה שגלשה
 * 0..98 / 98..146, נקודה שהוקלדה בהיסט 98 נכנסה לשורה השנייה, שהפכה
 * ל-98..147) — ולכן `End` שאחריה מגיע לסוף השורה השנייה, וזה הדבר הנכון.
 */

/** שורה מצוירת אחת: טווח ה-pm שלה, והאם המנוע הכריז עליה מימין לשמאל. */
export interface PaintedLine {
  pmStart: number;
  pmEnd: number;
  rtl: boolean;
}

/** נקודת קצה של בחירה, כפי שהמנוע מחזיר אותה. */
interface TextPoint {
  kind?: string;
  blockId?: string;
  offset?: number;
  story?: unknown;
}

/** התצלום הסינכרוני של הבחירה. */
interface LiveSelectionSnapshot {
  selectionTarget?: {
    kind?: string;
    start?: TextPoint | null;
    end?: TextPoint | null;
    story?: unknown;
    coordinateSpace?: string;
  } | null;
}

/** מה שנצרך מ-`activeEditor`. מוגדר כאן ולא מיובא — ההסבר ב-document-api.ts. */
export interface LineEndEditor {
  host?: {
    readLiveSelectionSyncSnapshot?: () => LiveSelectionSnapshot | null | undefined;
  } | null;
  authoring?: {
    setSelectionTarget?: (input: {
      target: {
        kind: 'selection';
        start: TextPoint;
        end: TextPoint;
        story: unknown;
        coordinateSpace?: string;
      };
      collapse?: 'start' | 'end';
      focus?: boolean;
    }) => unknown;
  } | null;
}

export interface LineEndHost {
  activeEditor?: LineEndEditor | null;
}

export interface RtlLineEndHandle {
  dispose(): void;
}

export interface RtlLineEndOptions {
  /** ה-div שהמנוע מצייר בתוכו — `paintedHost(editor.ui)`. */
  host: HTMLElement | null;
  /** ה-SuperDoc של אותו מסמך. */
  superdoc: LineEndHost | null | undefined;
}

/** האם ההקשה היא `End` „נקי” — עם Shift או בלעדיו, ובלי Ctrl/Meta/Alt. */
export function isLineEndKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return event.key === 'End' && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/**
 * ההיסט שהסמן צריך להגיע אליו, או `null` כשהשורה אינה עברית (ואז המנוע
 * מטפל בעצמו, ונמדד שהוא עושה זאת נכון).
 *
 * היסט שיושב בתפר בין שתי שורות נקרא כסופה של הקודמת — ראו „גבול גלישה”
 * בהערת הפתיחה. מכאן שהפונקציה חסרת מצב: אותו קלט נותן תמיד אותה תשובה,
 * ו-`End` שחוזר על עצמו אינו מזיז.
 */
export function lineEndOffset(
  lines: readonly PaintedLine[],
  fragmentPmStart: number,
  caretOffset: number,
): number | null {
  const caretPm = fragmentPmStart + caretOffset;
  let chosen: PaintedLine | null = null;

  for (const line of lines) {
    if (caretPm < line.pmStart) break;
    if (caretPm <= line.pmEnd) {
      chosen = line;
      break;
    }
  }

  if (!chosen || !chosen.rtl) return null;
  return chosen.pmEnd - fragmentPmStart;
}

/** ה-fragment של הפסקה שהסמן בה, ואיתו טווח ה-pm שלו. */
function readFragment(
  host: HTMLElement,
  blockId: string,
  caretOffset: number,
): { base: number; lines: PaintedLine[] } | null {
  const fragments = host.querySelectorAll<HTMLElement>('[data-source-node-id][data-pm-start]');

  for (const fragment of Array.from(fragments)) {
    if (fragment.getAttribute('data-source-node-id') !== blockId) continue;
    const base = Number(fragment.getAttribute('data-pm-start'));
    if (!Number.isFinite(base)) continue;
    // פסקה שנחצית בין עמודים מצוירת כשני fragment עם אותו מזהה; הסמן שייך
    // לזה שטווחו מכיל אותו.
    const end = Number(fragment.getAttribute('data-pm-end'));
    const caretPm = base + caretOffset;
    if (Number.isFinite(end) && (caretPm < base || caretPm > end)) continue;

    const lines: PaintedLine[] = [];
    for (const child of Array.from(fragment.children)) {
      const pmStart = Number(child.getAttribute('data-pm-start'));
      const pmEnd = Number(child.getAttribute('data-pm-end'));
      if (!Number.isFinite(pmStart) || !Number.isFinite(pmEnd)) continue;
      lines.push({ pmStart, pmEnd, rtl: child.getAttribute('dir') === 'rtl' });
    }
    if (lines.length) return { base, lines };
  }

  return null;
}

/** מתקין את היירוט. אין לו מצב, והוא נפרק עם המסמך. */
export function installRtlLineEnd({ host, superdoc }: RtlLineEndOptions): RtlLineEndHandle {
  if (!host) return { dispose() {} };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isLineEndKey(event)) return;

    const editor = superdoc?.activeEditor;
    const setSelectionTarget = editor?.authoring?.setSelectionTarget;
    const readSnapshot = editor?.host?.readLiveSelectionSyncSnapshot;
    if (typeof setSelectionTarget !== 'function' || typeof readSnapshot !== 'function') return;

    let snapshot: LiveSelectionSnapshot | null | undefined;
    try {
      snapshot = readSnapshot.call(editor?.host);
    } catch {
      return;
    }

    const selection = snapshot?.selectionTarget;
    const head = selection?.end;
    const anchor = selection?.start;
    if (!head || head.kind !== 'text' || typeof head.blockId !== 'string') return;
    if (typeof head.offset !== 'number') return;

    const fragment = readFragment(host, head.blockId, head.offset);
    if (!fragment) return;

    const target = lineEndOffset(fragment.lines, fragment.base, head.offset);
    if (target === null) return;

    // מכאן ואילך זה שלנו: המנוע לא יראה את ההקשה.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const story = selection?.story ?? head.story ?? { kind: 'story', storyType: 'body' };
    const coordinateSpace = selection?.coordinateSpace;
    const point: TextPoint = { kind: 'text', blockId: head.blockId, offset: target, story };
    const start = event.shiftKey && anchor && anchor.kind === 'text' ? anchor : point;

    // הסמן כבר שם ואין Shift — אין מה לכתוב, ורק ביטול האירוע נדרש (בלעדיו
    // המנוע היה מקפיץ אותו לתחילת השורה).
    if (!event.shiftKey && target === head.offset) return;

    try {
      const written = setSelectionTarget.call(editor?.authoring, {
        target: {
          kind: 'selection',
          start,
          end: point,
          story,
          ...(typeof coordinateSpace === 'string' ? { coordinateSpace } : {}),
        },
        focus: true,
      });
      // הפעולה א-סינכרונית במנוע. כשל מאוחר (למשל אם המסמך התפרק בין
      // התצלום לכתיבה) אינו צריך לייצר rejection לא מטופלת.
      void Promise.resolve(written).catch(() => {});
    } catch {
      /* בחירה שלא נכתבה אינה סיבה להפיל הקלדה */
    }
  };

  host.addEventListener('keydown', onKeyDown, true);

  return {
    dispose() {
      host.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
