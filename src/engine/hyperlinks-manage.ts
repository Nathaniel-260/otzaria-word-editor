/**
 * ניהול היפר-קישורים (גל 22): רשימה, הסרה ועריכה — דרך
 * `hyperlinks.list/wrap/remove`. `hyperlinks.patch` אינה זמינה ב-2.8.0,
 * ולכן **עריכה = הסרה + עטיפה מחדש** — אותה תבנית של `captions.update`
 * בגל 8: שתי פעולות לא-אטומיות מעל תוכן המשתמש.
 *
 * ## מה שנמדד
 *
 * - **היעד ל-wrap/remove הוא `TextAddress`** (`{kind:'text',blockId,range}`) —
 *   SelectionTarget נדחה ("requires a valid TextAddress target").
 * - **wrap דורש מפרט קישור:** `{ link: { destination: { href } } }` — href בלבד
 *   זרק "requires a link specification object".
 * - `list()` מחזיר `stories[].hyperlinks[]`; הסרה על טווח שאינו מכיל קישור
 *   מחזירה `TARGET_NOT_FOUND`.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt } from './document-api';

const UNAVAILABLE_TEXT = 'אינו זמין בגרסה זו';

export interface HyperlinkInfo {
  id?: string;
  href?: string;
  anchor?: string;
}

interface HyperlinksApiShape {
  selection?: {
    current?: () => MaybePromise<SelectionInfoLike | undefined>;
  };
  hyperlinks?: {
    list?: (input?: Record<string, unknown>) => MaybePromise<unknown>;
    wrap?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
    remove?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
  };
}

export interface HyperlinksHost {
  activeEditor?: { doc?: HyperlinksApiShape | null } | null;
}

export type HyperlinksTarget = SuperDoc | HyperlinksHost | null | undefined;

interface SelectionInfoLike {
  empty?: boolean;
  target?: {
    segments?: ReadonlyArray<{ blockId?: string; range?: { start?: number; end?: number } }>;
  } | null;
}

type MaybePromise<T> = T | Promise<T>;

function docOf(host: HyperlinksTarget): HyperlinksApiShape | null {
  return (host as HyperlinksHost | null | undefined)?.activeEditor?.doc ?? null;
}

/** TextAddress מהבחירה — הקטע הראשון עם blockId וטווח. `null` אם אין. */
async function readTextAddress(
  doc: HyperlinksApiShape,
): Promise<{ kind: 'text'; blockId: string; range: { start: number; end: number } } | null> {
  try {
    const info = await doc.selection?.current?.();
    const segment = info?.target?.segments?.find(
      (s) =>
        typeof s?.blockId === 'string' &&
        typeof s.range?.start === 'number' &&
        typeof s.range.end === 'number',
    );
    if (!segment) return null;
    return {
      kind: 'text',
      blockId: segment.blockId as string,
      range: { start: segment.range!.start as number, end: segment.range!.end as number },
    };
  } catch {
    return null;
  }
}

/** דולה את הקישורים מכל ה-stories לרשימה אחת שטוחה. */
function flattenLinks(raw: unknown): HyperlinkInfo[] {
  if (!raw || typeof raw !== 'object') return [];
  const stories = (raw as { stories?: unknown }).stories;
  if (!Array.isArray(stories)) return [];
  const out: HyperlinkInfo[] = [];
  for (const story of stories) {
    const links = (story as { hyperlinks?: unknown }).hyperlinks;
    if (!Array.isArray(links)) continue;
    for (const link of links) {
      if (link && typeof link === 'object') out.push(link as HyperlinkInfo);
    }
  }
  return out;
}

/** רשימת כל הקישורים במסמך. מחזירה `null` כשאין מנוע. */
export async function listHyperlinks(host: HyperlinksTarget): Promise<HyperlinkInfo[] | null> {
  const list = docOf(host)?.hyperlinks?.list;
  if (typeof list !== 'function') return null;
  try {
    return flattenLinks(await list());
  } catch {
    return null;
  }
}

/** „הסר קישור" על הטווח המסומן. TARGET_NOT_FOUND = כבר אין קישור = הצלחה. */
export async function removeHyperlink(host: HyperlinksTarget): Promise<CommandOutcome> {
  const failedAction = 'הסרת הקישור נכשלה';

  const doc = docOf(host);
  const remove = doc?.hyperlinks?.remove;
  if (!doc || typeof remove !== 'function') {
    return { ok: false, message: `${failedAction}: ${UNAVAILABLE_TEXT}`, reason: 'command-unsupported' };
  }

  const address = await readTextAddress(doc);
  if (!address) {
    return { ok: false, message: `${failedAction}: יש לסמן טקסט תחילה`, reason: 'selection-required' };
  }

  let receipt: DocReceipt;
  try {
    receipt = await remove({ within: address });
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  // אין קישור בטווח = המצב המבוקש כבר מתקיים. לא כשל.
  if (receipt?.success === false && receipt.failure?.code === 'TARGET_NOT_FOUND') {
    return { ok: true };
  }
  if (receipt?.success === false) {
    return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
  }

  return { ok: true };
}

/**
 * „עריכת קישור" — remove + wrap. אימות לפני מגע (`list`), ואם העטיפה
 * נכשלת אחרי הסרה — הודעה שאומרת שהקישור אבד והטקסט נשמר.
 */
export async function editHyperlink(host: HyperlinksTarget, newHref: string): Promise<CommandOutcome> {
  const failedAction = 'עריכת הקישור נכשלה';

  const href = typeof newHref === 'string' ? newHref.trim() : '';
  if (href === '' || href.length > 2048) {
    return { ok: false, message: `${failedAction}: כתובת הקישור נדרשת`, reason: 'invalid-href' };
  }

  const doc = docOf(host);
  const wrap = doc?.hyperlinks?.wrap;
  const remove = doc?.hyperlinks?.remove;
  if (!doc || typeof wrap !== 'function' || typeof remove !== 'function') {
    return { ok: false, message: `${failedAction}: ${UNAVAILABLE_TEXT}`, reason: 'command-unsupported' };
  }

  const address = await readTextAddress(doc);
  if (!address) {
    return { ok: false, message: `${failedAction}: יש לסמן טקסט תחילה`, reason: 'selection-required' };
  }

  // אימות לפני מגע: אין קישור בטווח → עטיפה ישירה, בלי remove מיותר.
  let hadLink = false;
  try {
    hadLink = flattenLinks(await doc.hyperlinks?.list?.()).length > 0;
  } catch {
    hadLink = false;
  }

  if (hadLink) {
    let removed: DocReceipt;
    try {
      removed = await remove({ within: address });
    } catch (error) {
      return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
    }
    if (removed?.success === false && removed.failure?.code !== 'TARGET_NOT_FOUND') {
      return { ok: false, message: receiptFailureText(failedAction, removed), reason: removed.failure?.code };
    }
  }

  let wrappedReceipt: DocReceipt;
  try {
    wrappedReceipt = await wrap({ target: address, link: { destination: { href } } });
  } catch (error) {
    if (hadLink) {
      return {
        ok: false,
        message: `${failedAction}: הקישור הוסר אך החדש לא נוצר — הטקסט נשמר ללא קישור`,
        reason: 'link-lost',
      };
    }
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  if (wrappedReceipt?.success === false) {
    if (hadLink) {
      return {
        ok: false,
        message: `${failedAction}: הקישור הוסר אך החדש לא נוצר — הטקסט נשמר ללא קישור`,
        reason: wrappedReceipt.failure?.code,
      };
    }
    return { ok: false, message: receiptFailureText(failedAction, wrappedReceipt), reason: wrappedReceipt.failure?.code };
  }

  return { ok: true };
}

