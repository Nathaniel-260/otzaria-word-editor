/**
 * „שולחן העורך” — תשתית משותפת לכלי העריכה התורניים שנוידו מתבניות ה-Word
 * של שולחן העורך (ראו docs/shulchan-haorech.md: מה נויד, מה לא, ולמה).
 *
 * כל הכלים עובדים על אותו מודל: קריאת הבלוקים הקנוניים
 * (`doc.blocks.list({includeText:true})` — אותו מסלול שנמדד ב-engine/search.ts),
 * חישוב טהור ב-JS על הטקסט, וכתיבה נקודתית דרך המשטחים הציבוריים
 * (`doc.replace`, `doc.format.apply`, `doc.format.paragraph.*`). שום כלי אינו
 * ניגש ל-DOM של המנוע ואינו תלוי בפגינציה — זה בדיוק הקו שהפריד בין הכלים
 * שנוידו לאלה שלא.
 */
import type { SuperDoc } from 'superdoc';
import type { MaybePromise, DocReceipt } from '../document-api';
import { receiptFailureText, thrownText } from '../document-api';
import type { CommandOutcome } from '../command-adapter';
import type { SearchableBlock } from '../text-search';

/** נקודת טקסט ביעד בחירה — המודל הציבורי של `SelectionPoint`. */
export interface ShulchanTextPoint {
  kind: 'text';
  blockId: string;
  offset: number;
}

/** יעד בחירה שנבנה מקואורדינטות-טקסט של בלוק — ראו text-search.ts. */
export interface ShulchanSelectionTarget {
  kind: 'selection';
  start: ShulchanTextPoint;
  end: ShulchanTextPoint;
}

/** קטע בחירה כפי ש-`doc.selection.current()` מחזיר אותו. */
interface SelectionSegmentLike {
  blockId?: string;
  range?: { start?: number; end?: number };
}

interface SelectionInfoLike {
  target?: { segments?: readonly SelectionSegmentLike[] } | null;
}

interface BlocksPage {
  blocks?: readonly { nodeId?: string; text?: string; nodeType?: string }[];
}

/** צומת במודל `doc.get()` — רק החלק שהכלים קוראים. */
export interface ShulchanModelNode {
  id?: string;
  paragraphIds?: { paraId?: string };
  kind?: string;
  paragraph?: { content?: readonly unknown[]; props?: Record<string, unknown> };
  heading?: { content?: readonly unknown[]; props?: Record<string, unknown> };
  list?: { content?: readonly unknown[]; props?: Record<string, unknown> };
}

export interface ShulchanDocumentApi {
  selection?: {
    current?: (input?: { includeText?: boolean }) => MaybePromise<SelectionInfoLike | undefined>;
  };
  blocks?: {
    list?: (input: { includeText?: boolean; offset?: number; limit?: number }) => MaybePromise<BlocksPage | undefined>;
    delete?: (input: { target: { kind: 'block'; nodeType: string; nodeId: string } }) => MaybePromise<unknown>;
  };
  get?: (input?: { options?: { includeResolved?: boolean } }) => MaybePromise<{ body?: readonly ShulchanModelNode[] } | undefined>;
  replace?: (input: { target: ShulchanSelectionTarget; text: string }) => MaybePromise<DocReceipt>;
  format?: {
    apply?: (input: { target: ShulchanSelectionTarget; inline: Record<string, unknown> }) => MaybePromise<DocReceipt>;
    paragraph?: Record<string, unknown>;
  };
}

export interface ShulchanUi {
  selection?: { apply?: (target: unknown) => unknown };
  viewport?: {
    scrollIntoView?: (input: {
      target: { kind: 'text'; blockId: string; range: { start: number; end: number } };
      block?: string;
      behavior?: string;
    }) => MaybePromise<unknown>;
  };
}

export interface ShulchanHost {
  activeEditor?: { doc?: ShulchanDocumentApi | null } | null;
  ui?: ShulchanUi | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל בבדיקות. ההסבר המלא ב-page-setup.ts. */
export type ShulchanTarget = SuperDoc | ShulchanHost | null | undefined;

export function shulchanDoc(host: ShulchanTarget): ShulchanDocumentApi | undefined {
  return (host as ShulchanHost | null | undefined)?.activeEditor?.doc ?? undefined;
}

export function shulchanUi(host: ShulchanTarget): ShulchanUi | undefined {
  return (host as ShulchanHost | null | undefined)?.ui ?? undefined;
}

/**
 * „ב-3 פסקאות” מול „בפסקה אחת”.
 *
 * „ב-1 פסקאות” אינו עברית, וזה בדיוק מה שהמשתמש רואה בשורת המצב אחרי
 * הרצה שנגעה בפסקה אחת — המקרה השכיח כשמסמנים פסקה ומפעילים כלי.
 * המקבילה ל-`moduleCountText` ב-engine/vba-import.ts.
 */
export function inParagraphsText(count: number): string {
  return count === 1 ? 'בפסקה אחת' : `ב-${count} פסקאות`;
}

export const NO_DOCUMENT_TEXT = 'אין מסמך פתוח, או שהמסמך אינו תומך בפעולה';
export const NO_SELECTION_TEXT = 'יש לסמן את הפסקאות לעיבוד, או להעמיד את הסמן בפסקה';

export function unavailableOutcome(failedAction: string): CommandOutcome {
  return { ok: false, message: `${failedAction}: ${NO_DOCUMENT_TEXT}`, reason: 'command-unsupported' };
}

/** אותם גבולות דפדוף כמו ב-engine/search.ts — כיסוי מלא או כשל גלוי. */
const BLOCKS_PAGE_SIZE = 500;
const BLOCKS_MAX_PAGES = 50;

/**
 * כל בלוקי המסמך, עם הטקסט הקנוני, בסדר המסמך. `null` כשאין `blocks.list`
 * או כשקריאה נכשלה — כיסוי חלקי מסוכן יותר מכשל גלוי (ראו search.ts).
 */
export async function readShulchanBlocks(host: ShulchanTarget): Promise<SearchableBlock[] | null> {
  const list = shulchanDoc(host)?.blocks?.list;
  if (typeof list !== 'function') return null;

  const blocks: SearchableBlock[] = [];
  let offset = 0;
  try {
    for (let page = 0; page < BLOCKS_MAX_PAGES; page += 1) {
      const result = await list({ includeText: true, offset, limit: BLOCKS_PAGE_SIZE });
      const entries = result?.blocks ?? [];
      for (const entry of entries) {
        if (typeof entry?.nodeId === 'string') {
          blocks.push({
            blockId: entry.nodeId,
            text: typeof entry.text === 'string' ? entry.text : '',
            nodeType: typeof entry.nodeType === 'string' ? entry.nodeType : undefined,
          });
        }
      }
      if (entries.length < BLOCKS_PAGE_SIZE) break;
      offset += entries.length;
    }
  } catch {
    return null;
  }
  return blocks;
}

export type ShulchanScope = 'selection' | 'document';

export interface ScopedBlocksResult {
  /** הבלוקים לעיבוד, בסדר המסמך. */
  blocks: SearchableBlock[];
  /** כל בלוקי המסמך — לכלים שצריכים הקשר (בלוק קודם/עוקב). */
  all: SearchableBlock[];
}

/**
 * הבלוקים שהכלי יעבוד עליהם: כל המסמך, או הפסקאות שבבחירה (סמן בלבד ⟵
 * הפסקה שבה הסמן). `{ ok:false }` כשאין מסמך; בחירה שלא נקראה נופלת לכשל
 * סגור ולא ל"כל המסמך" — כלי שמעבד את המסמך כולו כי קריאת הבחירה נכשלה
 * הוא בדיוק ההפתעה שאסור לייצר.
 */
export async function scopedBlocks(
  host: ShulchanTarget,
  scope: ShulchanScope,
  failedAction: string,
): Promise<{ ok: true; result: ScopedBlocksResult } | { ok: false; outcome: CommandOutcome }> {
  const all = await readShulchanBlocks(host);
  if (all === null) return { ok: false, outcome: unavailableOutcome(failedAction) };
  if (scope === 'document') return { ok: true, result: { blocks: all, all } };

  const current = shulchanDoc(host)?.selection?.current;
  if (typeof current !== 'function') return { ok: false, outcome: unavailableOutcome(failedAction) };

  let info: SelectionInfoLike | undefined;
  try {
    info = await current();
  } catch (error) {
    return { ok: false, outcome: { ok: false, message: thrownText(failedAction, error), reason: 'threw' } };
  }

  const ids = new Set<string>();
  for (const segment of info?.target?.segments ?? []) {
    if (typeof segment?.blockId === 'string') ids.add(segment.blockId);
  }
  if (ids.size === 0) {
    return {
      ok: false,
      outcome: { ok: false, message: `${failedAction}: ${NO_SELECTION_TEXT}`, reason: 'no-selection' },
    };
  }
  return { ok: true, result: { blocks: all.filter((block) => ids.has(block.blockId)), all } };
}

export function textTarget(blockId: string, start: number, end: number): ShulchanSelectionTarget {
  return {
    kind: 'selection',
    start: { kind: 'text', blockId, offset: start },
    end: { kind: 'text', blockId, offset: end },
  };
}

/** `doc.replace` בודד עם טיפול כשל אחיד. אותו מסלול כמו ההחלפה בחיפוש. */
export async function replaceRange(
  host: ShulchanTarget,
  target: ShulchanSelectionTarget,
  text: string,
  failedAction: string,
): Promise<CommandOutcome> {
  const replace = shulchanDoc(host)?.replace;
  if (typeof replace !== 'function') return unavailableOutcome(failedAction);
  try {
    const receipt = await replace({ target, text });
    if (receipt?.success === false) {
      return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }
}

/** `doc.format.apply` על טווח טקסט, בלי להזיז את הבחירה החיה. */
export async function applyInline(
  host: ShulchanTarget,
  target: ShulchanSelectionTarget,
  inline: Record<string, unknown>,
  failedAction: string,
): Promise<CommandOutcome> {
  const apply = shulchanDoc(host)?.format?.apply;
  if (typeof apply !== 'function') return unavailableOutcome(failedAction);
  try {
    const receipt = await apply({ target, inline });
    if (receipt?.success === false) {
      return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }
}

/** בוחרת וגוללת אל טווח — ויזואלי בלבד, כשל נבלע (אותה תבנית כמו focusActiveMatch). */
export async function revealRange(host: ShulchanTarget, blockId: string, start: number, end: number): Promise<void> {
  const ui = shulchanUi(host);
  try {
    ui?.selection?.apply?.(textTarget(blockId, start, end));
  } catch {
    /* ויזואלי בלבד */
  }
  try {
    await ui?.viewport?.scrollIntoView?.({
      target: { kind: 'text', blockId, range: { start, end } },
      block: 'center',
      behavior: 'smooth',
    });
  } catch {
    /* ויזואלי בלבד */
  }
}

/* ------------------------------------------------------------------ */
/* קריאת עיצוב פתור מהמודל                                             */
/* ------------------------------------------------------------------ */

interface RunLike {
  kind?: string;
  run?: { text?: string; props?: Record<string, unknown>; resolved?: Record<string, unknown> };
}

/** תכונות הגופן שהכלים צורכים, מתוך `resolved` (ואם אין — `props`) של run. */
export interface ResolvedRunFont {
  /** בנקודות. */
  fontSize?: number;
  fontSizeCs?: number;
  fontFamily?: string;
  bold?: boolean;
}

function nodeParagraphId(node: ShulchanModelNode): string | undefined {
  if (typeof node.id === 'string' && node.id !== '') return node.id;
  const paraId = node.paragraphIds?.paraId;
  return typeof paraId === 'string' && paraId !== '' ? paraId : undefined;
}

function nodeInner(node: ShulchanModelNode): { content?: readonly unknown[] } | undefined {
  return node.paragraph ?? node.heading ?? node.list;
}

function readFont(record: Record<string, unknown> | undefined): ResolvedRunFont {
  if (!record) return {};
  const font: ResolvedRunFont = {};
  if (typeof record.fontSize === 'number' && Number.isFinite(record.fontSize)) font.fontSize = record.fontSize;
  if (typeof record.fontSizeCs === 'number' && Number.isFinite(record.fontSizeCs)) font.fontSizeCs = record.fontSizeCs;
  if (typeof record.fontFamily === 'string') font.fontFamily = record.fontFamily;
  else {
    const fonts = record.fonts as { cs?: string; ascii?: string } | undefined;
    if (typeof fonts?.cs === 'string') font.fontFamily = fonts.cs;
    else if (typeof fonts?.ascii === 'string') font.fontFamily = fonts.ascii;
  }
  if (typeof record.bold === 'boolean') font.bold = record.bold;
  return font;
}

/**
 * תכונות הגופן של ה-run שמכסה היסט-טקסט נתון בבלוק, מתוך מודל שכבר נקרא.
 * ההיסט נספר על טקסט ה-runs בלבד — אותה ספירה שהבלוק הקנוני מחזיר. `{}`
 * כשהבלוק/ההיסט לא נמצאו: הכלי מחליט בעצמו מה ברירת המחדל שלו.
 */
export function resolvedFontAt(
  body: readonly ShulchanModelNode[] | undefined,
  blockId: string,
  offset: number,
): ResolvedRunFont {
  if (!Array.isArray(body)) return {};
  for (const node of body) {
    if (!node || typeof node !== 'object') continue;
    if (nodeParagraphId(node) !== blockId) continue;
    const content = nodeInner(node)?.content ?? [];
    let position = 0;
    let lastFont: ResolvedRunFont = {};
    for (const child of content) {
      const run = (child as RunLike) ?? {};
      if (run.kind !== 'run' || !run.run) continue;
      const text = typeof run.run.text === 'string' ? run.run.text : '';
      const font = readFont(run.run.resolved ?? run.run.props);
      if (offset >= position && offset < position + text.length) return font;
      position += text.length;
      lastFont = font;
    }
    // היסט בסוף הבלוק (או בלוק בלי runs) — התכונות של ה-run האחרון.
    return lastFont;
  }
  return {};
}

/**
 * המודל המלא עם ערכים פתורים. `undefined` בכשל — הקורא נופל לברירת מחדל
 * שלו, לא לזריקה.
 */
export async function readResolvedBody(host: ShulchanTarget): Promise<readonly ShulchanModelNode[] | undefined> {
  const get = shulchanDoc(host)?.get;
  if (typeof get !== 'function') return undefined;
  try {
    const model = await get({ options: { includeResolved: true } });
    return Array.isArray(model?.body) ? model.body : undefined;
  } catch {
    return undefined;
  }
}
