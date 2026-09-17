/**
 * ההחלה של זיהוי הרשימות בהקלדה. ההחלטה עצמה — מי סמן ומי לא — יושבת
 * ב-`list-autoformat.ts` ונבדקת ביחידה; כאן רק החיווט למנוע.
 *
 * ## מה נבדק במנוע, ומה זה מכתיב (scripts/qa/list-autoformat-qa.mjs)
 *
 * 1. **קריאות מחכות לשקט.** `ranges.resolve`, `blocks.list`, `getNodeById`
 *    ו-`lists.getState` עונים רק כשהמנוע נרגע מההקשה האחרונה — ו-`getState`
 *    מאוחר מכולן. בהקלדה רציפה אף אחת מהן אינה חוזרת עד שההקלדה נעצרת. גרסה
 *    שקראה את הטקסט אחרי הרווח המירה רק כשהמשתמש הפסיק להקליד — בדיוק מה
 *    שדווח („זה עובר רק אחרי שאני גומר להקליד”).
 * 2. **מוטציות אינן מחכות.** `doc.insert` ו-`lists.create` באמצע הקלדה רציפה
 *    הוחלו מיד, הסמן החי עבר איתן, ואף תו לא אבד. `mutations.apply` — לא:
 *    אחריה הסמן נשאר מחוץ לטקסט והמנוע דחה כל הקשה שבאה אחריה.
 * 3. **`ui.selection.get()` סינכרוני.** ב-`keydown` (לפני שהמנוע רואה את
 *    המקש) הוא מחזיר את מצב הסמן אחרי ההקשות הקודמות — מדויק בקצב אנושי,
 *    אבל בהקלדה מהירה מאוד הוא מפגר **ומדווח `ready`**. אחרי Enter הוא
 *    `stale` עד שהמנוע קלט אותו.
 *
 * ## ולכן: ההקשות עצמן הן המקור, לא קריאת המסמך
 *
 * - **רצף** (`run`) — התווים שנלחצו מאז האיפוס האחרון (כל מקש אחר, לחיצת
 *   עכבר, הדבקה).
 * - **עוגן** — הוכחה שהרצף התחיל בהיסט 0 של בלוק ידוע. התו הראשון מראה
 *   היסט 0, **ו**הוכח שמקש האיפוס כבר נקלט: המצב שונה ממה שנראה כשנלחץ,
 *   והמנוע היה מדויק כשנלחץ. כל תו אחר כך חייב להראות בדיוק את מספר התווים
 *   שלפניו. כל אי-התאמה בכל הקשה — גם מחוץ לרצף — מכניסה ל„מצב זהיר”.
 * - **הנתיב המהיר**: עוגן, ו„פסקה רגילה” ידועה → ברגע שהמנוע קלט את כל
 *   ההקשות (היסט = אורך הסמן + מה שנלחץ אחריו) מוחקים ויוצרים. בלי קריאה.
 * - **„האם זו כבר רשימה”** נשמר לכל בלוק מקריאות רקע, שעונות ברגעי שקט.
 *   פסקה שנוצרה ב-Enter מפסקה רגילה יורשת „פסקה רגילה” בלי קריאה. כל מה
 *   שעשוי לשנות רשימות (עכבר, מחיקה, Tab, קיצורים, הדבקה) מוחק את הזיכרון.
 * - **הנתיב המאומת** — כשחסר עוגן או סוג: ממתין לשקט, קורא את סוג הבלוק ואת
 *   תחילתו, ומוודא שהסמן עומד בדיוק אחרי כל מה שהוקלד מאז האיפוס. כשהמנוע
 *   שקט, השוויון הזה הוא עצמו ההוכחה שהרצף התחיל בהיסט 0.
 *
 * ## למה `lists.create` ולא פקודת הרצועה
 *
 * `numbered-list` היא טוגל שיוצרת רשימה **עשרונית**, ותיקון הסגנון אחריה הוא
 * מוטציה שנייה עם ציור ביניהן („`א.` נהיה `1.` ורק אחרי זה מחליף”).
 * `lists.create` יוצר ישר בסגנון המבוקש, ואינו טוגל — ולכן גם אינו מסרב על
 * פריט רשימה קיים: נמדד שהוא מנתק אותו לרשימה חדשה. מכאן בדיקת סוג הבלוק.
 *
 * ## Backspace שייך למנוע
 *
 * Backspace בתחילת פריט מסיר את הרשימה ומשאיר את הטקסט
 * (`scripts/qa/list-backspace-owner-probe.mjs`), ולכן המודול אינו נוגע בו.
 *
 * ## Ctrl+Z מיד אחרי ההמרה — צעד אחד, כמו ב-Word
 *
 * ההמרה היא שלושה צעדי היסטוריה (נמדד, לכל סוג: המחיקה, יצירת הרשימה, והסגנון).
 * בלי קיבוץ, Ctrl+Z הראשון הציג רשימה **עשרונית** „1.”, השני פסקה ריקה, ורק
 * השלישי החזיר את „א) ”. ב-Word הקשה אחת מחזירה את הטקסט. לכן העומק נמדד
 * לפני ההמרה ואחריה (`history.get` עונה תוך ‎~1ms גם באמצע הקלדה — נמדד),
 * וכשהביטול מגיע לאותו עומק — מיד, או אחרי שבוטלה ההקלדה שבאה אחריה — שלושת
 * הצעדים מתבטלים יחד. שלוש קריאות `undo` שנשלחות יחד מסתיימות ב-‎~85ms בלי
 * שהסמן העשרוני יצויר בדרך (נמדד). ‏Ctrl+Y מחזיר את ההמרה באותה צורה.
 *
 * כל עוד יש המרה כזו בהיסטוריה, Ctrl+Z/Ctrl+Y עוברים כאן: ההחלטה אם לקבץ
 * תלויה בעומק, והעומק נקרא רק בקריאה א-סינכרונית — מאוחר מכדי להחליט אם לתת
 * למקש להמשיך. ביטול שאינו מגיע לעומק הזה הוא צעד אחד, דרך אותה היסטוריה.
 * הקבוצה נזרקת כשההיסטוריה ירדה מתחתיה (בוטלה בדרך אחרת) או התרחקה ממנה
 * יותר מ-`GROUP_HORIZON` צעדים.
 *
 * ## הצורות שהמנוע ממיר בעצמו
 *
 * המנוע ממיר בעצמו „- ”, „* ”, „+ ” ו-„N. ” לכל מספר (נמדד, בלי המודול). שני
 * דברים יוצאים מזה: המתג „כבוי” לא כיבה אותן — מי שכותב „1. ” כטקסט לא קיבל את
 * מה שהמתג הבטיח — ובמצב „פעיל” „- ” יצא `•` של המנוע ולא ה-`-` המתועד כאן.
 *
 * אין הגדרה במנוע שמכבה את זה, והכלל שלו יושב במסלול הכנסת הטקסט: עצירת
 * `keydown` לבדה אינה עוזרת (נמדד), וגם הכנסת הרווח דרך ה-API אינה פתרון —
 * הסמן החי נשאר **לפני** הרווח, וההקלדה שאחריו נכנסת לפניו (נמדד, בשלושה
 * מסלולים). מה שכן עובד: עצירת `keydown` של הרווח, ובמקום ה-`beforeinput`
 * שנוצר ממנו — `beforeinput` מסוג `insertReplacementText` עם אותו רווח. המנוע
 * מכניס אותו במקום הסמן, לפי סדר ההקשות, **בלי** הכלל (נמדד גם בהקשות של
 * 15ms). אם המנוע אינו מטפל בו, נשלח `insertText` רגיל — הרווח לא הולך לאיבוד.
 *
 * הרווח נעצר רק כשמה שהוקלד מאז האיפוס הוא בדיוק אחת הצורות האלה: כשהמתג
 * כבוי — כולן; כשהוא דלוק — רק אלה שיש להן תוכנית כאן, כדי שההמרה תהיה שלנו.
 *
 * ## כשל
 *
 * המשתמש לא ביקש רשימה — הוא הקליד. כשל בין מחיקת הסמן ליצירת הרשימה מחזיר
 * את הטקסט שנמחק ושותק.
 */
import type { SuperDoc } from 'superdoc';
import type { DocReceipt, MaybePromise } from './document-api';
import { planListAutoformat, type ListAutoformat } from './list-autoformat';
import { resolveListItemAt, type ListsTarget } from './lists';
import type { ResolvedRangeLike, SelectionPointLike, SelectionTargetLike } from './word-selection';

/** הסמן הארוך ביותר בלי תו ההפעלה: `(א)`. */
const LONGEST_MARKER = 3;

/** כל כמה לבדוק אם המנוע כבר קלט את הרווח. הבדיקה סינכרונית וזולה. */
const WATCH_INTERVAL_MS = 15;

/** אחרי כמה זמן בלי התאמה מדויקת עוברים לנתיב המאומת. */
const WATCH_LIMIT_MS = 1200;

/** כמה זמן אחרי אי-התאמה הנתיב המהיר כבוי. */
const CAUTIOUS_MS = 2000;

/** אחרי שקט כזה המנוע כבר קלט כל מה שנלחץ. */
const IDLE_MS = 300;

/** אחרי לחיצת עכבר הבחירה `stale` כמה מאות מילישניות; זה המרווח שמעליהן. */
const POINTER_SETTLE_MS = 500;
const SETTLE_POLL_MS = 60;
const SETTLE_POLLS = 10;

/** נסיונות של הנתיב המאומת: המשתמש עשוי לחזור להקליד בין הקריאות. */
const VERIFY_ATTEMPTS = 3;

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'OS']);

/** מזיזים סמן בלי לשנות אף בלוק — מאפסים את הרצף, לא את הזיכרון. */
const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

const EDIT_EVENTS = ['paste', 'cut', 'drop', 'compositionstart'];

/** מה שהמנוע ממיר בעצמו כשבא אחריו רווח (נמדד). */
const ENGINE_MARKER = /^\s*(?:[-+*]|\d{1,9}\.)$/;

/** כמה תווים נשמרים מאז האיפוס לבדיקת `ENGINE_MARKER`. */
const ENGINE_MARKER_MAX = 12;

/** Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — לפי `code`, כדי שיעבדו גם בפריסה עברית. */
function historyKey(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  // `code` ולא `key`: בפריסה עברית `key` של Ctrl+Z הוא „ז” (ראו
  // tests/contract/shortcut-registry.test.ts).
  const letter = event.code === 'KeyZ' ? 'z' : event.code === 'KeyY' ? 'y' : null;
  if (letter === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (letter === 'y' && !event.shiftKey) return 'redo';
  return null;
}

/** הרווח, כהכנסה שהמנוע מבצע בלי כללי ההקלדה שלו. `false` — לא טופל. */
function insertPlainSpace(target: EventTarget, ours: WeakSet<Event>): boolean {
  const send = (inputType: string, withData: boolean): boolean => {
    const init: InputEventInit = { bubbles: true, cancelable: true, composed: true, inputType, data: ' ' };
    if (withData && typeof DataTransfer === 'function') {
      try {
        const transfer = new DataTransfer();
        transfer.setData('text/plain', ' ');
        init.dataTransfer = transfer;
      } catch {
        /* בלי העברה — המנוע קורא גם את `data` */
      }
    }
    const event = new InputEvent('beforeinput', init);
    ours.add(event);
    // `dispatchEvent` מחזיר `false` כשמישהו ביטל את ברירת המחדל — כלומר המנוע
    // קלט את ההכנסה.
    return !target.dispatchEvent(event);
  };
  if (send('insertReplacementText', true)) return true;
  return send('insertText', false);
}

/** `paragraph` — פסקה רגילה, בלי מספור. כל השאר אינו מומר. */
type BlockKind = 'paragraph' | 'other';

interface BlockListing {
  nodeId?: string;
  nodeType?: string;
  paragraphNumbering?: unknown;
  numbering?: unknown;
}

export interface ListAutoformatDoc {
  ranges?: { resolve?: (input: unknown) => MaybePromise<ResolvedRangeLike | undefined> };
  blocks?: {
    list?: (input?: Record<string, unknown>) => MaybePromise<{ blocks?: BlockListing[] } | undefined>;
  } | null;
  insert?: (input: { value: string; type: 'text'; target?: unknown }) => MaybePromise<DocReceipt>;
  lists?: {
    create?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
  } | null;
  history?: {
    get?: () => MaybePromise<{ undoDepth?: unknown; redoDepth?: unknown } | null | undefined>;
    undo?: () => MaybePromise<unknown>;
    redo?: () => MaybePromise<unknown>;
  } | null;
}

export interface UiSelectionLike {
  status?: string;
  selectionTarget?: SelectionTargetLike | null;
}

export interface ListAutoformatHost {
  activeEditor?: { doc?: ListAutoformatDoc | null } | null;
  ui?: { selection?: { get?: () => UiSelectionLike | null | undefined } | null } | null;
}

export interface ListAutoformatOptions {
  /** ה-container של המסמך — ראו create-editor.ts:EditorSession.container. */
  container: HTMLElement;
  host: SuperDoc | ListAutoformatHost | null | undefined;
  /**
   * המתג. `false` — אין המרה, ורק ההמרות של המנוע עצמו נחסמות. ברירת המחדל
   * דלוקה, כמו ב-host/settings.ts.
   */
  enabled?: boolean;
}

export interface ListAutoformatHandle {
  /**
   * „בטל” שאינו עובר במקלדת (פס הכותרת). `true` — יש המרה בהיסטוריה, והביטול
   * יצא לדרך כאן (מקובץ או צעד אחד); אין להריץ עוד ביטול.
   */
  undo(): boolean;
  /** „חזור”, באותו תנאי. */
  redo(): boolean;
  dispose(): void;
}

function docOf(host: ListAutoformatOptions['host']): ListAutoformatDoc | null {
  return (host as ListAutoformatHost | null | undefined)?.activeEditor?.doc ?? null;
}

function point(blockId: string, offset: number, story: unknown): SelectionPointLike {
  const at: SelectionPointLike = { kind: 'text', blockId, offset };
  if (story !== undefined && story !== null) at.story = story;
  return at;
}

/** הסמן המכווץ בלבד: בחירה של טווח אינה הקלדה. */
interface Caret {
  blockId: string;
  offset: number;
  story: unknown;
}

function readCaret(target: SelectionTargetLike | null | undefined): Caret | null {
  if (!target || target.kind !== 'selection') return null;
  if (target.coordinateSpace !== undefined && target.coordinateSpace !== 'visible') return null;

  const { start, end } = target;
  if (start?.kind !== 'text' || end?.kind !== 'text') return null;
  if (typeof start.blockId !== 'string' || start.blockId !== end.blockId) return null;
  if (typeof start.offset !== 'number' || start.offset !== end.offset) return null;

  return { blockId: start.blockId, offset: start.offset, story: target.story ?? start.story ?? null };
}

function sameCaret(a: Caret, b: Caret): boolean {
  return a.blockId === b.blockId && a.offset === b.offset;
}

function textTarget(at: Caret, from: number, to: number): SelectionTargetLike {
  return {
    kind: 'selection',
    start: point(at.blockId, from, at.story),
    end: point(at.blockId, to, at.story),
    ...(at.story ? { story: at.story } : {}),
  };
}

function isBodyStory(story: unknown): boolean {
  return !story || (story as { storyType?: unknown }).storyType === 'body';
}

/**
 * הרמות שנכתבות. **רמה 0 בלבד** — בשונה מ-`setListNumberStyle` ב-lists.ts,
 * שנקראת מבחירה מפורשת בגלריה ולכן דורסת את הקסקדה כולה. גם Word כותב את
 * התבנית שהוקלדה ל-`ListLevels(1)` בלבד (נמדד).
 */
function levelsFor(plan: ListAutoformat): Array<Record<string, unknown>> {
  if (plan.kind === 'bullet') {
    return [{ level: 0, numFmt: 'bullet', lvlText: plan.lvlText, markerFont: plan.markerFont }];
  }
  // `markerFont: ''` הוא הריקון היחיד שהחוזה מקבל (`null` נדחה) — בלעדיו סמן
  // ממוספר יורש את גופן הסמלים של תבליט שקדם לו.
  return [{ level: 0, numFmt: plan.numFmt, lvlText: plan.lvlText, markerFont: '' }];
}

/** קריאה אחת שלעולם אינה זורקת. `NO_OP` הוא הצלחה. */
async function call(run: () => MaybePromise<DocReceipt>): Promise<boolean> {
  try {
    const receipt = await run();
    return !(receipt?.success === false && receipt.failure?.code !== 'NO_OP');
  } catch {
    return false;
  }
}

/**
 * ידית QA: בלעדיה „לא קרה כלום” אינו ניתן להבחנה מ„המודול לא הותקן”. אין לה
 * קורא בקוד האפליקציה.
 */
interface AutoformatDebug {
  installs: number;
  evaluates: number;
  applies: number;
  last: string;
  /** שתים-עשרה הסיבות האחרונות. */
  trail: string[];
}

function debugHandle(): AutoformatDebug | null {
  if (typeof window === 'undefined') return null;
  const holder = window as unknown as { __otzariaListAutoformat?: AutoformatDebug };
  holder.__otzariaListAutoformat ??= { installs: 0, evaluates: 0, applies: 0, last: '', trail: [] };
  return holder.__otzariaListAutoformat;
}

/**
 * איפה הרצף מתחיל בהיסט 0: בלוק ידוע, או „הבלוק ש-Enter יצר” — שאינו ידוע
 * עד שהמנוע קלט את ה-Enter, אבל הסמן בו מתחיל תמיד בהיסט 0.
 */
type Anchor = Caret | { afterEnter: string };

function anchoredAt(anchor: Anchor | null, at: Caret | null): Caret | null {
  if (!anchor || !at) return null;
  if ('afterEnter' in anchor) return at.blockId !== anchor.afterEnter ? at : null;
  return at.blockId === anchor.blockId ? at : null;
}

/** סמן שהוקלד ומחכה להמרה. */
interface Pending {
  typed: string;
  plan: ListAutoformat;
  anchor: Anchor | null;
  /** תווים שנלחצו אחרי תו ההפעלה — חלק מההיסט הצפוי. ממשיך לספור עד ההמרה. */
  keysAfter: number;
  since: number;
  /** Tab: רק דרך הנתיב המאומת — השלמה מהספר עשויה לבלוע אותו ולהכניס טקסט. */
  verifyOnly: boolean;
}

/** האיפוס שלפני הרצף, והמצב שנראה כשקרה. */
interface ResetMark {
  kind: 'install' | 'key' | 'pointer';
  seen: Caret | null;
  /** המנוע היה מדויק כשהאיפוס נלחץ. */
  exact: boolean;
  /** כמה מקשי איפוס ברצף, בלי הקלדה או שקט ביניהם. */
  count: number;
  at: number;
  enter: boolean;
}

/** המרה שאפשר לבטל בהקשה אחת: כמה צעדים, ובאיזה עומק היסטוריה. */
interface HistoryGroup {
  steps: number;
  depth: number;
}

/** כמה צעדים מעל ההמרה עוד שווה לחכות לה. מעבר לזה — המקש שוב של המנוע. */
const GROUP_HORIZON = 200;

async function historyDepth(doc: ListAutoformatDoc | null): Promise<{ undo: number; redo: number } | null> {
  const get = doc?.history?.get;
  if (typeof get !== 'function') return null;
  try {
    const state = await get.call(doc!.history);
    const undo = state?.undoDepth;
    const redo = state?.redoDepth;
    return typeof undo === 'number' && typeof redo === 'number' ? { undo, redo } : null;
  } catch {
    return null;
  }
}

export function installListAutoformat(options: ListAutoformatOptions): ListAutoformatHandle {
  const { container, host } = options;
  const enabled = options.enabled !== false;
  const debug = debugHandle();
  if (debug) debug.installs += 1;

  let disposed = false;
  let applying = false;
  /** הוקלד משהו בזמן ההמרה — ההיסטוריה שלה אינה רצף נקי. */
  let typedWhileApplying = false;
  /** התווים מאז האיפוס, לזיהוי הצורות שהמנוע ממיר בעצמו. `null` — ארוך מדי. */
  let sinceReset: string | null = '';
  /** ה-`keydown` של רווח נעצר, וה-`beforeinput` שלו יוחלף. */
  let spaceArmed = false;
  const ours = new WeakSet<Event>();
  let undoGroup: HistoryGroup | null = null;
  let redoGroup: HistoryGroup | null = null;
  /** התווים מאז האיפוס. `null` — הוקלד משהו שאינו יכול להיות סמן. */
  let run: string | null = '';
  let anchor: Anchor | null = null;
  let pending: Pending | null = null;
  let watchTimer: ReturnType<typeof setTimeout> | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  let resetMark: ResetMark = { kind: 'install', seen: null, exact: true, count: 1, at: now(), enter: false };
  /** המצב שנראה בתו הקודם, כשלא היה איפוס מאז. */
  let lastTyped: Caret | null = null;
  /** ההקשה או הלחיצה האחרונה. */
  let lastInputAt = -Infinity;
  let cautiousUntil = 0;
  /** למה הרצף האחרון לא עוגן — לידית ה-QA בלבד. */
  let anchorMiss = '';

  const kinds = new Map<string, BlockKind>();
  const reading = new Set<string>();
  let generation = 0;
  /** הבלוק שבו נלחץ Enter, כשידוע שהוא פסקה רגילה. חי עד האיפוס הבא. */
  let inheritFrom: string | null = null;

  function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function note(reason: string): void {
    if (!debug) return;
    debug.last = reason;
    debug.trail.push(reason);
    if (debug.trail.length > 12) debug.trail.shift();
  }

  function later(task: () => void, ms: number): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) task();
    }, ms);
    timers.add(timer);
  }

  function caretNow(): Caret | null {
    let selection: UiSelectionLike | null | undefined;
    try {
      selection = (host as ListAutoformatHost | null | undefined)?.ui?.selection?.get?.();
    } catch {
      return null;
    }
    if (!selection || selection.status !== 'ready') return null;
    return readCaret(selection.selectionTarget);
  }

  function caretSoon(polls = SETTLE_POLLS): Promise<Caret | null> {
    const at = caretNow();
    if (at || polls <= 0) return Promise.resolve(at);
    return new Promise((resolve) => later(() => void caretSoon(polls - 1).then(resolve), SETTLE_POLL_MS));
  }

  function forgetKinds(): void {
    generation += 1;
    kinds.clear();
    reading.clear();
  }

  function startRun(): void {
    run = '';
    anchor = null;
    lastTyped = null;
    inheritFrom = null;
    sinceReset = '';
  }

  /** האם לעצור את הרווח הזה — ההסבר בהערת הפתיחה. */
  function interceptsSpace(): boolean {
    if (sinceReset === null || !ENGINE_MARKER.test(sinceReset)) return false;
    return !enabled || planListAutoformat(`${sinceReset} `) !== null;
  }

  /** ביטולים/חזרות שנשלחו ועוד לא הסתיימו — כדי שהקשות רצופות יסתדרו בתור. */
  let replaying: Promise<void> = Promise.resolve();

  /**
   * ביטול או חזרה כשיש המרה בהיסטוריה: כל הקבוצה, כשהעומק הוא שלה; אחרת צעד
   * אחד. `null` אחרי זה — הקבוצה אינה רלוונטית עוד.
   */
  async function replay(kind: 'undo' | 'redo'): Promise<void> {
    const doc = docOf(host);
    const history = doc?.history;
    const step = kind === 'undo' ? history?.undo : history?.redo;
    if (typeof step !== 'function') return;
    const group = kind === 'undo' ? undoGroup : redoGroup;
    const before = await historyDepth(doc);
    const depth = before && (kind === 'undo' ? before.undo : before.redo);
    const whole = group !== null && depth === group.depth;

    const calls: Promise<unknown>[] = [];
    for (let i = 0; i < (whole ? group.steps : 1); i += 1) {
      try {
        calls.push(Promise.resolve(step.call(history)));
      } catch {
        break;
      }
    }
    await Promise.allSettled(calls);
    forgetKinds();
    if (disposed) return;

    const after = await historyDepth(doc);
    if (disposed) return;
    if (whole && group && after) {
      // הקבוצה עברה לצד השני של ההיסטוריה.
      const moved = { steps: group.steps, depth: kind === 'undo' ? after.redo : after.undo };
      if (kind === 'undo') {
        undoGroup = null;
        redoGroup = moved;
      } else {
        redoGroup = null;
        undoGroup = moved;
      }
      note(`${kind}:grouped`);
      return;
    }
    note(`${kind}:single`);
    if (after) pruneGroups(after);
  }

  /** קבוצה שההיסטוריה עברה אותה, או התרחקה ממנה, אינה רלוונטית עוד. */
  function pruneGroups(depth: { undo: number; redo: number }): void {
    if (undoGroup && (depth.undo < undoGroup.depth || depth.undo - undoGroup.depth > GROUP_HORIZON)) {
      undoGroup = null;
    }
    if (redoGroup && (depth.redo < redoGroup.depth || depth.redo - redoGroup.depth > GROUP_HORIZON)) {
      redoGroup = null;
    }
  }

  /** `true` — המקש שלנו: יש המרה בצד הזה של ההיסטוריה. */
  function takeHistory(kind: 'undo' | 'redo'): boolean {
    if (!(kind === 'undo' ? undoGroup : redoGroup)) return false;
    replaying = replaying.then(() => replay(kind)).catch(() => {});
    return true;
  }

  /** עריכה חדשה מוחקת את צד ה„חזור” של ההיסטוריה, ואיתו את הקבוצה שבו. */
  function dropRedoGroup(): void {
    redoGroup = null;
  }

  async function readKind(doc: ListAutoformatDoc, at: Caret): Promise<BlockKind | null> {
    const list = doc.blocks?.list;
    if (typeof list === 'function') {
      try {
        const input: Record<string, unknown> = { nodeIds: [at.blockId] };
        if (!isBodyStory(at.story)) input.in = at.story;
        const listed = await list(input);
        const block = listed?.blocks?.find((b) => b.nodeId === at.blockId);
        if (block) {
          return block.nodeType === 'paragraph' && !block.paragraphNumbering && !block.numbering
            ? 'paragraph'
            : 'other';
        }
      } catch {
        // נופלים ל-getState: היא מכסה גם פסקאות בתוך טבלה.
      }
    }
    const state = await resolveListItemAt(host as ListsTarget, at.blockId);
    if (state.kind === 'not-list') return 'paragraph';
    return state.kind === 'item' ? 'other' : null;
  }

  function learnKind(at: Caret): void {
    // כשהמתג כבוי אין המרה, ולכן גם אין בשביל מה לקרוא את סוג הבלוק.
    if (!enabled || kinds.has(at.blockId) || reading.has(at.blockId)) return;
    const doc = docOf(host);
    if (!doc) return;
    const asked = generation;
    reading.add(at.blockId);
    void readKind(doc, at).then((kind) => {
      if (disposed || asked !== generation) return;
      reading.delete(at.blockId);
      if (kind) kinds.set(at.blockId, kind);
    });
  }

  function learnWhenSettled(): void {
    void caretSoon().then((at) => {
      if (at && !disposed) learnKind(at);
    });
  }

  async function readPrefix(doc: ListAutoformatDoc, at: Caret, length: number): Promise<string | null> {
    const resolve = doc.ranges?.resolve;
    if (typeof resolve !== 'function') return null;
    const request: Record<string, unknown> = {
      start: { kind: 'point', point: point(at.blockId, 0, at.story) },
      end: { kind: 'point', point: point(at.blockId, length, at.story) },
    };
    if (at.story) request.in = at.story;
    try {
      const resolved = await resolve(request);
      const text = resolved?.preview?.text;
      if (typeof text !== 'string' || resolved?.preview?.truncated === true) return null;
      if ((resolved?.target?.start?.offset ?? 0) !== 0) return null;
      return text;
    } catch {
      return null;
    }
  }

  async function apply(p: Pending, at: Caret, how: string): Promise<void> {
    const doc = docOf(host);
    const insert = doc?.insert;
    const create = doc?.lists?.create;
    if (disposed || applying || typeof insert !== 'function' || typeof create !== 'function') return;

    applying = true;
    typedWhileApplying = false;
    dropRedoGroup();
    // לפני המוטציה: Enter שנלחץ עכשיו יוצר פריט רשימה, לא פסקה רגילה.
    kinds.set(at.blockId, 'other');
    // המחיקה מזיזה את ההיסט בין שתי הקשות — לא אי-התאמה של המנוע.
    lastTyped = null;
    try {
      const before = await historyDepth(doc!);
      const erased = await call(() =>
        insert({ value: '', type: 'text', target: textTarget(at, 0, p.plan.markerLength) }),
      );
      if (!erased) {
        kinds.delete(at.blockId);
        note('erase-failed');
        return;
      }

      const created = await call(() =>
        create({
          mode: 'fromParagraphs',
          target: { kind: 'block', nodeType: 'paragraph', nodeId: at.blockId },
          kind: p.plan.kind === 'bullet' ? 'bullet' : 'ordered',
          style: { version: 1, levels: levelsFor(p.plan) },
          sequence: { mode: 'new', startAt: p.plan.kind === 'numbered' ? p.plan.startAt : 1 },
        }),
      );

      if (!created) {
        await call(() => insert({ value: p.typed, type: 'text', target: textTarget(at, 0, 0) }));
        kinds.delete(at.blockId);
        note('create-failed');
        return;
      }

      if (debug) debug.applies += 1;
      note(`applied:${p.plan.kind}:${how}`);

      const after = await historyDepth(doc!);
      if (before && after && after.undo > before.undo && !typedWhileApplying && !disposed) {
        undoGroup = { steps: after.undo - before.undo, depth: after.undo };
      }
    } finally {
      applying = false;
      lastTyped = null;
    }
  }

  /**
   * הנתיב שאינו סומך על העוגן: סוג הבלוק והטקסט שבתחילתו, מהמסמך. הקריאות
   * עונות רק כשהמנוע שקט, ואז היסט הסמן שווה בדיוק לכל מה שהוקלד מאז האיפוס
   * רק אם הרצף התחיל בהיסט 0.
   */
  async function verify(p: Pending): Promise<void> {
    const doc = docOf(host);
    if (!doc) return;
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
      const known = p.anchor && !('afterEnter' in p.anchor) ? p.anchor : null;
      const guess = known ?? (await caretSoon());
      if (disposed || pending !== p) return;
      if (!guess) break;
      // תמיד קריאה טרייה: המנוע שקט ממילא, וזיכרון ישן כאן היה מחמיץ המרה.
      const kind = await readKind(doc, guess);
      const text = await readPrefix(doc, guess, p.typed.length);
      if (disposed || pending !== p) return;

      const at = await caretSoon();
      if (disposed || pending !== p) return;
      if (!at || at.blockId !== guess.blockId || at.offset !== p.typed.length + p.keysAfter) continue;
      pending = null;
      if (kind !== 'paragraph') {
        note(`kind:${kind ?? 'unknown'}`);
        return;
      }
      if (text !== p.typed) {
        note(`changed:${JSON.stringify(text)}`);
        return;
      }
      await apply(p, at, 'verified');
      return;
    }
    if (pending === p) pending = null;
    note('verify:gave-up');
  }

  function watch(p: Pending): void {
    if (watchTimer !== undefined) clearTimeout(watchTimer);
    const tick = (): void => {
      watchTimer = undefined;
      if (disposed || pending !== p) return;
      const at = anchoredAt(p.anchor, caretNow());
      if (at && at.offset === p.typed.length + p.keysAfter) {
        inherit(at);
        if (kinds.get(at.blockId) === 'paragraph') {
          pending = null;
          void apply(p, at, 'typed');
        } else {
          note(`kind-unknown:${kinds.get(at.blockId) ?? (reading.has(at.blockId) ? 'reading' : 'none')}`);
          void verify(p);
        }
        return;
      }
      if (now() - p.since > WATCH_LIMIT_MS) {
        note('watch-timeout');
        void verify(p);
        return;
      }
      watchTimer = setTimeout(tick, WATCH_INTERVAL_MS);
    };
    watchTimer = setTimeout(tick, 0);
  }

  /**
   * העוגן של רצף חדש, מהמצב שנראה בתו הראשון שלו (לפני שהמנוע ראה אותו).
   *
   * המצב הזה מוכיח משהו רק אם מקש האיפוס כבר נקלט: המנוע היה מדויק כשהאיפוס
   * נלחץ (`exact`), היה איפוס אחד בלבד, והמצב השתנה מאז. Enter יוצר בלוק שבו
   * הסמן בהיסט 0 — ולכן עוגן אחריו אינו תלוי בשאלה אם כבר נקלט.
   */
  function anchorFor(at: Caret | null, time: number): Anchor | null {
    const mark = resetMark;
    if (mark.kind !== 'install') {
      if (mark.count !== 1 || !mark.exact) return null;
      if (mark.enter && mark.seen) {
        const moved = at !== null && at.blockId !== mark.seen.blockId;
        return moved && at.offset !== 0 ? null : { afterEnter: mark.seen.blockId };
      }
    }
    if (!at || at.offset !== 0 || time < cautiousUntil) return null;
    if (mark.kind === 'install') return at;
    const moved = mark.seen !== null && !sameCaret(at, mark.seen);
    return moved || (mark.kind === 'pointer' && time - mark.at >= POINTER_SETTLE_MS) ? at : null;
  }

  /** בלוק ש-Enter יצר מפסקה רגילה הוא פסקה רגילה. */
  function inherit(at: Caret | null): void {
    if (!at || inheritFrom === null || at.blockId === inheritFrom) return;
    if (!kinds.has(at.blockId)) kinds.set(at.blockId, 'paragraph');
    inheritFrom = null;
  }

  function onMarker(typedRun: string | null, anchored: Anchor | null, trigger: ' ' | '\t'): void {
    if (!enabled || typedRun === null || typedRun === '' || applying || pending) return;
    if (debug) debug.evaluates += 1;
    const typed = `${typedRun}${trigger}`;
    const plan = planListAutoformat(typed);
    if (!plan) {
      note(`no-plan:${JSON.stringify(typed)}`);
      return;
    }
    const p: Pending = { typed, plan, anchor: anchored, keysAfter: 0, since: now(), verifyOnly: trigger === '\t' };
    pending = p;
    if (p.verifyOnly || !anchored) {
      note(p.verifyOnly ? 'tab' : `no-anchor:${anchorMiss}`);
      void verify(p);
    } else {
      watch(p);
    }
  }

  function onPrintable(key: string, at: Caret | null, time: number): void {
    if (applying) typedWhileApplying = true;
    dropRedoGroup();
    if (lastTyped && (!at || at.blockId !== lastTyped.blockId || at.offset !== lastTyped.offset + 1)) {
      cautiousUntil = time + CAUTIOUS_MS;
    }
    lastTyped = at;
    if (pending) pending.keysAfter += 1;

    if (run === '') {
      anchor = anchorFor(at, time);
      if (!anchor) {
        const m = resetMark;
        anchorMiss = `${m.kind}/${m.count}/${m.exact ? 'exact' : 'inexact'}/${at ? at.offset : 'stale'}`;
      }
    } else if (
      anchor && run !== null && !('afterEnter' in anchor) &&
      (!at || at.blockId !== anchor.blockId || at.offset !== run.length)
    ) {
      anchor = null;
      anchorMiss = `lag/${at ? at.offset : 'stale'}/${run.length}`;
    }
    inherit(at);

    if (key === ' ') {
      const typedRun = run;
      const anchored = anchor;
      run = null;
      anchor = null;
      onMarker(typedRun, anchored, ' ');
      return;
    }
    if (run !== null) run = run.length < LONGEST_MARKER ? run + key : null;
    if (at) learnKind(at);
  }

  function onReset(kind: ResetMark['kind'], at: Caret | null, time: number, isEnter: boolean): void {
    const exact = lastTyped
      ? !!at && at.blockId === lastTyped.blockId && at.offset === lastTyped.offset + 1
      : !!at && time - lastInputAt >= IDLE_MS;
    if (lastTyped && !exact) cautiousUntil = time + CAUTIOUS_MS;
    const chained = !lastTyped && resetMark.kind !== 'install' && time - lastInputAt < IDLE_MS;
    resetMark = chained
      ? { ...resetMark, kind, count: resetMark.count + 1, at: time, enter: isEnter }
      : { kind, seen: at, exact, count: 1, at: time, enter: isEnter };
    lastInputAt = time;

    const waiting = pending;
    pending = null;
    startRun();

    if (!isEnter) return;
    // Enter בפריט רשימה ריק מוציא אותו מהרשימה. מפסקה רגילה — אינו משנה דבר.
    if (!at || kinds.get(at.blockId) !== 'paragraph') forgetKinds();
    // Enter אחרי הרווח ולפני ההמרה: אם הכול כבר נקלט, הבלוק ידוע.
    if (waiting) {
      const ready = anchoredAt(waiting.anchor, at);
      if (
        ready && exact && !waiting.verifyOnly &&
        ready.offset === waiting.typed.length + waiting.keysAfter &&
        kinds.get(ready.blockId) === 'paragraph'
      ) {
        void apply(waiting, ready, 'typed');
      }
      return;
    }
    if (at && exact && !applying && kinds.get(at.blockId) === 'paragraph') inheritFrom = at.blockId;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed) return;
    const { key } = event;
    if (MODIFIER_KEYS.has(key)) return;
    const inside = container.contains(event.target as Node | null);
    const history = historyKey(event);

    if (history && inside && takeHistory(history)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      onReset('key', caretNow(), now(), false);
      return;
    }

    // מקש ברצועה, בתפריט או בדיאלוג עשוי להפעיל פקודת רשימות.
    if (!inside) {
      onEdit();
      return;
    }
    const time = now();
    const at = caretNow();
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;

    if (plain && [...key].length === 1) {
      const intercept = key === ' ' && interceptsSpace();
      onPrintable(key, at, time);
      if (sinceReset !== null) sinceReset = sinceReset.length < ENGINE_MARKER_MAX ? sinceReset + key : null;
      lastInputAt = time;
      if (intercept) {
        // המנוע לא יראה את ה-keydown; את ה-beforeinput מחליף `onBeforeInput`.
        event.stopImmediatePropagation();
        spaceArmed = true;
      }
      return;
    }
    const tab = plain && key === 'Tab' && !event.shiftKey;
    const typedRun = run;
    const anchored = anchor;
    onReset('key', at, time, plain && key === 'Enter' && !event.shiftKey);
    if (!NAVIGATION_KEYS.has(key)) dropRedoGroup();
    if (!NAVIGATION_KEYS.has(key) && key !== 'Enter') forgetKinds();
    if (tab) onMarker(typedRun, anchored, '\t');
  };

  const onBeforeInput = (event: Event): void => {
    if (disposed || !spaceArmed || ours.has(event)) return;
    spaceArmed = false;
    const input = event as InputEvent;
    if (input.inputType !== 'insertText' || input.data !== ' ' || !event.target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    insertPlainSpace(event.target, ours);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === ' ') spaceArmed = false;
    if (disposed || !container.contains(event.target as Node | null)) return;
    const at = caretNow();
    if (at) learnKind(at);
  };

  /** לחיצה בתוך המסמך אינה משנה רשימות; לחיצה ברצועה או בתפריט — אולי. */
  const onPointerDown = (event: PointerEvent): void => {
    onReset('pointer', caretNow(), now(), false);
    if (!container.contains(event.target as Node | null)) forgetKinds();
  };

  const onEdit = (): void => {
    onReset('key', null, now(), false);
    dropRedoGroup();
    forgetKinds();
  };

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  container.addEventListener('pointerup', learnWhenSettled);
  container.addEventListener('focusin', learnWhenSettled);
  for (const type of EDIT_EVENTS) container.addEventListener(type, onEdit, true);
  learnWhenSettled();

  return {
    undo: () => !disposed && takeHistory('undo'),
    redo: () => !disposed && takeHistory('redo'),
    dispose() {
      disposed = true;
      if (watchTimer !== undefined) clearTimeout(watchTimer);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('beforeinput', onBeforeInput, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      container.removeEventListener('pointerup', learnWhenSettled);
      container.removeEventListener('focusin', learnWhenSettled);
      for (const type of EDIT_EVENTS) container.removeEventListener(type, onEdit, true);
    },
  };
}
