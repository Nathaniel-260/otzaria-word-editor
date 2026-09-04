/**
 * אזכור „@”: הקלדת „@פסחים לד” פותחת רשימת הצעות, ובחירה בה מחליפה את האזכור
 * בקישור עומק לאוצריא.
 *
 * המבנה זהה ל-book-completion-overlay.ts, ומאותם טעמים שנמדדו שם:
 *
 * - **הרשימה היא DOM חיצוני לעץ של SuperDoc.** אין API להוסיף decoration בתוך
 *   המסמך, ושאילתה על מחלקות פנימיות של המנוע אסורה (engine-boundaries).
 * - **המיקום מגיע מ-`ui.selection.getAnchorRect`.** משטח ההקלדה של המנוע הוא
 *   `<textarea>` ברוחב פיקסל, וה-`getBoundingClientRect` של ה-anchorNode
 *   הדפדפני הוא אפס תמיד — `window.getSelection()` אינו כלי אמין כאן.
 * - **הטריגר נקרא ב-`input`/`keyup` ולא ב-`keydown`.** ב-keydown הטקסט עדיין
 *   לא נכתב למודל, ו-`doc.selection` היה מחזיר את המצב הישן.
 * - **`keydown` נתפס ב-capture, ו-`preventDefault` רק כשהרשימה פתוחה** — אחרת
 *   חצים ו-Tab מפסיקים להתנהג רגיל בשאר המסמך.
 *
 * ## כתיבת הקישור: שני מסלולים
 *
 * `hyperlinks.insert({target, text, link})` הוא הפעולה האטומית המתאימה, אבל
 * היא לא נמדדה כאן (`wrap` כן — ראו hyperlinks-manage.ts). לכן היא מנוסה
 * ראשונה, ובכשל יש נפילה ל-`doc.insert` + `hyperlinks.wrap`: שני חלקים
 * שכל אחד מהם מוכח בנפרד. אחרי מדידה בשער ה-QA אפשר להשאיר רק אחד.
 */
import type { SuperDoc } from 'superdoc';
import {
  WORD_WINDOW_RADIUS,
  type ResolvedRangeLike,
  type SelectionPointLike,
  type SelectionTargetLike,
  type WordSelectionDoc,
} from './word-selection';
import type { DocReceipt, MaybePromise } from './document-api';
import {
  buildLinkText,
  buildRefHref,
  isQueryable,
  parseAtTrigger,
  suggestionSubtitle,
  type ResolvedRefHit,
} from './at-mention';
import { resolveRef } from '../host/otzaria-reader';

/** כתובת טווח טקסט, כפי ש-`hyperlinks.wrap`/`insert` מקבלים אותה. */
interface TextAddressLike {
  kind: 'text';
  blockId: string;
  range: { start: number; end: number };
  story?: unknown;
}

interface HyperlinkSpecLike {
  destination: { href: string };
}

export interface AtMentionDoc extends WordSelectionDoc {
  insert?: (input: { value: string; type: 'text'; target?: unknown }) => MaybePromise<DocReceipt>;
  hyperlinks?: {
    insert?: (input: {
      target?: TextAddressLike;
      text: string;
      link: HyperlinkSpecLike;
    }) => MaybePromise<DocReceipt>;
    wrap?: (input: {
      target: TextAddressLike;
      link: HyperlinkSpecLike;
    }) => MaybePromise<DocReceipt>;
  } | null;
}

/** מלבן צבוע, כפי ש-`ui.selection.getAnchorRect` מחזירה אותו. */
export interface AnchorRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AtMentionHost {
  activeEditor?: { doc?: AtMentionDoc | null } | null;
  ui?: {
    selection?: {
      getAnchorRect?: (input?: { placement?: 'start' | 'end' | 'center' }) => AnchorRectLike | null;
    } | null;
  } | null;
}

export type AtMentionTarget = SuperDoc | AtMentionHost | null | undefined;

export interface AtMentionHandle {
  dispose(): void;
}

export interface AtMentionOptions {
  /** הודעת סטטוס למשתמש — כשל הרשאה, כשל כתיבה. לא נקראת על „אין התאמות”. */
  onStatus?: (message: string, isError: boolean) => void;
}

/** אותו debounce כמו בהשלמה מהספר; כאן הוא גם חוסך קריאות RPC. */
const INPUT_DEBOUNCE_MS = 180;

/** כמה הצעות להציג. מעבר לזה הרשימה מכסה את הטקסט שמעליה. */
const MAX_SUGGESTIONS = 8;

const POPUP_CLASS = 'otzaria-at-mention';
const POPUP_MAX_HEIGHT_PX = 260;
const POPUP_WIDTH_PX = 320;
/** מרווח בין הסמן לרשימה, וגם השוליים מקצה החלון. */
const POPUP_GAP_PX = 4;

function pointAt(blockId: string, offset: number, story: unknown): SelectionPointLike {
  const point: SelectionPointLike = { kind: 'text', blockId, offset };
  if (story !== undefined && story !== null) point.story = story;
  return point;
}

interface Seed {
  blockId: string;
  offset: number;
  story: unknown;
}

/**
 * הזרע נקרא מ-`selectionTarget` ולא מ-`target`: רק לו יש נקודות קצה, והוא
 * הצורה ש-`doc.insert` מקבל (ראו doc-selection.ts).
 */
function readCaretSeed(target: SelectionTargetLike | null | undefined): Seed | null {
  if (!target || target.kind !== 'selection') return null;
  if (target.coordinateSpace !== undefined && target.coordinateSpace !== 'visible') return null;
  const { start, end } = target;
  if (start?.kind !== 'text' || end?.kind !== 'text') return null;
  if (typeof start.blockId !== 'string' || start.blockId !== end.blockId) return null;
  if (typeof start.offset !== 'number' || start.offset !== end.offset) return null;
  return { blockId: start.blockId, offset: start.offset, story: target.story ?? start.story ?? null };
}

interface CaretText {
  /** הטקסט מתחילת החלון ועד הסמן. */
  beforeCaret: string;
  /** ההיסט בבלוק שממנו מתחיל `beforeCaret`. */
  base: number;
  cursorOffset: number;
  blockId: string;
  story: unknown;
}

/** קוראת את הטקסט שלפני הסמן. `null` = אין סמן יחיד בבלוק טקסט. */
async function readCaretText(doc: AtMentionDoc): Promise<CaretText | null> {
  if (typeof doc.selection?.current !== 'function') return null;
  if (typeof doc.ranges?.resolve !== 'function') return null;

  const info = await doc.selection.current();
  const seed = readCaretSeed(info?.selectionTarget);
  if (!seed) return null;

  const from = Math.max(0, seed.offset - WORD_WINDOW_RADIUS);
  const request: Record<string, unknown> = {
    start: { kind: 'point', point: pointAt(seed.blockId, from, seed.story) },
    end: { kind: 'point', point: pointAt(seed.blockId, seed.offset, seed.story) },
  };
  if (seed.story) request.in = seed.story;

  const resolved: ResolvedRangeLike | undefined = await doc.ranges.resolve(request);
  const text = resolved?.preview?.text;
  // `preview.text` נחתך ב-200 תווים; חלון של 90 בטוח מתחת לגבול, וקטיעה כאן
  // הייתה מזיזה את היסט ה-@ ביחס לטקסט.
  if (typeof text !== 'string' || resolved?.preview?.truncated === true) return null;

  return {
    beforeCaret: text,
    base: resolved?.target?.start?.offset ?? from,
    cursorOffset: seed.offset,
    blockId: seed.blockId,
    story: seed.story,
  };
}

type Session =
  | { kind: 'idle' }
  | {
      kind: 'suggesting';
      hits: ResolvedRefHit[];
      activeIndex: number;
      /** ההפניה כפי שהוקלדה — נשלחת ל-detection כשאין id חד-משמעי. */
      query: string;
      /** היסט ה-„@” בבלוק: תחילת הטווח שיוחלף. */
      replaceStart: number;
      cursorOffset: number;
      blockId: string;
      story: unknown;
    };

/** מתקינה את הפיצ'ר על ה-container של מסמך יחיד. ראו create-editor.ts:EditorSession.container. */
export function installAtMention(
  container: HTMLElement,
  host: AtMentionTarget,
  options: AtMentionOptions = {},
): AtMentionHandle {
  const doc = (host as AtMentionHost | null | undefined)?.activeEditor?.doc;
  const selectionHandle = (host as AtMentionHost | null | undefined)?.ui?.selection;
  let disposed = false;
  let session: Session = { kind: 'idle' };
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let popupEl: HTMLDivElement | null = null;
  /** אחרון שדווח, כדי לא להציף את שורת הסטטוס באותה הודעה. */
  let lastReported: string | null = null;
  /**
   * טוקן ריצה: הערכה אחת עושה קריאת מנוע וקריאת RPC, וקריאה איטית שמסתיימת
   * אחרי מאוחרת ממנה הייתה מחזירה הצעות של מחרוזת שכבר לא מוקלדת.
   */
  let evalToken = 0;

  function report(message: string, isError: boolean): void {
    if (lastReported === message) return;
    lastReported = message;
    options.onStatus?.(message, isError);
  }

  function hidePopup(): void {
    popupEl?.remove();
    popupEl = null;
  }

  function closeSession(): void {
    session = { kind: 'idle' };
    hidePopup();
  }

  function ensurePopup(): HTMLDivElement {
    if (popupEl) return popupEl;
    const el = document.createElement('div');
    el.className = POPUP_CLASS;
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', 'הצעות מקורות');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '2147483647',
      width: `${POPUP_WIDTH_PX}px`,
      maxHeight: `${POPUP_MAX_HEIGHT_PX}px`,
      overflowY: 'auto',
      direction: 'rtl',
      textAlign: 'right',
      background: 'var(--otzaria-surface, #ffffff)',
      color: 'var(--otzaria-text, #202124)',
      border: '1px solid rgba(0, 0, 0, 0.16)',
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      padding: '4px 0',
      font: '13px system-ui, sans-serif',
    } satisfies Partial<CSSStyleDeclaration>);
    // בלי זה הלחיצה גוזלת את המיקוד מהעורך, והסמן — ואיתו טווח ההחלפה — אובד.
    el.addEventListener('mousedown', (event) => event.preventDefault());
    document.body.appendChild(el);
    popupEl = el;
    return el;
  }

  function renderPopup(): void {
    // reference מקומי: `session` הוא משתנה משתנה, ובתוך ה-callbacks TypeScript
    // מאבד את הצמצום. זה אותו אובייקט, ולכן עדכון `activeIndex` דרכו תקף.
    const open = session;
    if (open.kind !== 'suggesting') return hidePopup();
    const rect = selectionHandle?.getAnchorRect?.({ placement: 'end' }) ?? null;
    if (!rect || (rect.width === 0 && rect.height === 0)) return hidePopup();

    const el = ensurePopup();
    el.textContent = '';
    open.hits.forEach((hit, index) => {
      const row = document.createElement('div');
      row.id = `${POPUP_CLASS}-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === open.activeIndex));
      Object.assign(row.style, {
        padding: '6px 12px',
        cursor: 'pointer',
        background: index === open.activeIndex ? 'rgba(26, 115, 232, 0.12)' : 'transparent',
      } satisfies Partial<CSSStyleDeclaration>);

      const title = document.createElement('div');
      title.textContent = buildLinkText(hit, open.query);
      title.style.whiteSpace = 'nowrap';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      row.appendChild(title);

      const subtitle = suggestionSubtitle(hit);
      if (subtitle) {
        const sub = document.createElement('div');
        sub.textContent = subtitle;
        Object.assign(sub.style, {
          fontSize: '11px',
          opacity: '0.65',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } satisfies Partial<CSSStyleDeclaration>);
        row.appendChild(sub);
      }

      row.addEventListener('mouseenter', () => {
        if (session !== open || open.activeIndex === index) return;
        open.activeIndex = index;
        renderPopup();
      });
      row.addEventListener('click', () => void accept(index));
      el.appendChild(row);
    });

    el.setAttribute('aria-activedescendant', `${POPUP_CLASS}-${open.activeIndex}`);
    positionPopup(el, rect);
    // גלילה לפריט הפעיל היא נוחות בלבד, והיא אינה קיימת בכל סביבה — כשל שלה
    // לא אמור להפיל את הציור עצמו.
    const active = el.children[open.activeIndex];
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * עוגן `right` ולא `left`: בעברית הרשימה צריכה להיפתח מנקודת הסמן שמאלה,
   * ועוגן שמאלי היה דוחף אותה לכיוון ההפוך. אנכית — מתחת לסמן אם יש מקום.
   */
  function positionPopup(el: HTMLDivElement, rect: AnchorRectLike): void {
    const right = Math.min(
      Math.max(POPUP_GAP_PX, window.innerWidth - rect.left),
      window.innerWidth - POPUP_WIDTH_PX - POPUP_GAP_PX,
    );
    el.style.right = `${Math.max(POPUP_GAP_PX, right)}px`;
    el.style.left = 'auto';

    const below = rect.top + rect.height + POPUP_GAP_PX;
    const height = Math.min(el.scrollHeight, POPUP_MAX_HEIGHT_PX);
    if (below + height <= window.innerHeight - POPUP_GAP_PX) {
      el.style.top = `${below}px`;
      el.style.bottom = 'auto';
    } else {
      el.style.top = 'auto';
      el.style.bottom = `${Math.max(POPUP_GAP_PX, window.innerHeight - rect.top + POPUP_GAP_PX)}px`;
    }
  }

  async function evaluate(): Promise<void> {
    if (disposed || !doc) return;
    const token = ++evalToken;

    let caret: CaretText | null;
    try {
      caret = await readCaretText(doc);
    } catch {
      caret = null;
    }
    if (token !== evalToken || disposed) return;
    if (!caret) return closeSession();

    const trigger = parseAtTrigger(caret.beforeCaret);
    if (!trigger || !isQueryable(trigger)) return closeSession();

    const result = await resolveRef(trigger.query.trim(), MAX_SUGGESTIONS);
    if (token !== evalToken || disposed) return;

    if (!result.ok) {
      report(result.message, true);
      return closeSession();
    }
    lastReported = null;
    if (result.value.length === 0) return closeSession();

    session = {
      kind: 'suggesting',
      hits: result.value,
      activeIndex: 0,
      query: trigger.query,
      replaceStart: caret.base + trigger.atIndex,
      cursorOffset: caret.cursorOffset,
      blockId: caret.blockId,
      story: caret.story,
    };
    renderPopup();
  }

  function scheduleEvaluate(): void {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void evaluate(), INPUT_DEBOUNCE_MS);
  }

  function move(delta: number): void {
    if (session.kind !== 'suggesting') return;
    const count = session.hits.length;
    session.activeIndex = (session.activeIndex + delta + count) % count;
    renderPopup();
  }

  /** כותבת את הקישור. ראו הערת המודול על שני המסלולים. */
  async function writeLink(
    address: TextAddressLike,
    text: string,
    href: string,
  ): Promise<DocReceipt | null> {
    const link: HyperlinkSpecLike = { destination: { href } };
    const insertLink = doc?.hyperlinks?.insert;
    if (typeof insertLink === 'function') {
      try {
        const receipt = await insertLink({ target: address, text, link });
        if (receipt?.success !== false) return receipt;
      } catch {
        // נופלים למסלול המפורק.
      }
    }

    if (typeof doc?.insert !== 'function' || typeof doc.hyperlinks?.wrap !== 'function') return null;
    const target: SelectionTargetLike = {
      kind: 'selection',
      start: pointAt(address.blockId, address.range.start, address.story),
      end: pointAt(address.blockId, address.range.end, address.story),
      ...(address.story ? { story: address.story } : {}),
    };
    const inserted = await doc.insert({ value: text, type: 'text', target });
    if (inserted?.success === false) return inserted;

    return await doc.hyperlinks.wrap({
      target: {
        kind: 'text',
        blockId: address.blockId,
        range: { start: address.range.start, end: address.range.start + text.length },
        ...(address.story ? { story: address.story } : {}),
      },
      link,
    });
  }

  async function accept(index?: number): Promise<void> {
    if (session.kind !== 'suggesting' || !doc) return;
    const hit = session.hits[index ?? session.activeIndex];
    if (!hit) return;

    const { replaceStart, cursorOffset, blockId, story, query } = session;
    const text = buildLinkText(hit, query);
    const href = buildRefHref(hit, query);
    closeSession();

    const address: TextAddressLike = {
      kind: 'text',
      blockId,
      range: { start: replaceStart, end: cursorOffset },
      ...(story ? { story } : {}),
    };

    let receipt: DocReceipt | null;
    try {
      receipt = await writeLink(address, text, href);
    } catch (error) {
      console.warn('[otzaria-word] אזכור: כתיבת הקישור נכשלה', error);
      report('הוספת הקישור נכשלה', true);
      return;
    }
    if (receipt === null) {
      report('הוספת קישור אינה זמינה במסמך זה', true);
      return;
    }
    if (receipt?.success === false) {
      report(receipt.failure?.message ?? 'הוספת הקישור נכשלה', true);
    }
  }

  const onInput = (): void => scheduleEvaluate();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (session.kind !== 'suggesting') return;
    switch (event.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'Enter':
      case 'Tab':
        void accept();
        break;
      case 'Escape':
        closeSession();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onScroll = (): void => closeSession();
  const onBlur = (): void => closeSession();

  container.addEventListener('input', onInput);
  container.addEventListener('keyup', onInput);
  container.addEventListener('keydown', onKeyDown, true);
  container.addEventListener('scroll', onScroll, true);
  container.addEventListener('focusout', onBlur);
  window.addEventListener('resize', onScroll);

  return {
    dispose() {
      disposed = true;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      closeSession();
      container.removeEventListener('input', onInput);
      container.removeEventListener('keyup', onInput);
      container.removeEventListener('keydown', onKeyDown, true);
      container.removeEventListener('scroll', onScroll, true);
      container.removeEventListener('focusout', onBlur);
      window.removeEventListener('resize', onScroll);
    },
  };
}
