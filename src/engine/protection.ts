/**
 * הגנת מסמך (גל 19): `protection.get/setEditingRestriction/
 * clearEditingRestriction`.
 *
 * ## סדר המדידה שקובע את המימוש
 *
 * המדריך דורש למדוד את **מסלול הביטול לפני מסלול ההפעלה** — וכך נעשה:
 * `setEditingRestriction({mode:'readOnly'})` → `enforced:true`;
 * `capabilities.get()` אחרי ההפעלה: **4 פעולות נפלו ל-false**
 * (התוסף עצמו מוגבל!); `clearEditingRestriction()` → `enforced:false`
 * והמסמך חוזר לגמרי. הביטול עובד בלי סיסמה (v1 אינה תומכת סיסמה).
 *
 * לכן הפקד: מתג עם אישור מפורש, וההסבר אומר בדיוק מה יקרה — המסמך
 * יינעל לקריאה בלבד, 4 פעולות ייפלו, וניתן לבטל מהמתג עצמו.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt } from './document-api';

const UNAVAILABLE_TEXT = 'אינו זמין בגרסה זו';

export interface ProtectionState {
  mode: string;
  enforced: boolean;
}

interface ProtectionApiShape {
  protection?: {
    get?: () => MaybePromise<unknown>;
    setEditingRestriction?: (input: Record<string, unknown>) => MaybePromise<DocReceipt>;
    clearEditingRestriction?: () => MaybePromise<DocReceipt>;
  };
}

export interface ProtectionHost {
  activeEditor?: { doc?: ProtectionApiShape | null } | null;
}

export type ProtectionTarget = SuperDoc | ProtectionHost | null | undefined;

type MaybePromise<T> = T | Promise<T>;

function docOf(host: ProtectionTarget): ProtectionApiShape | null {
  return (host as ProtectionHost | null | undefined)?.activeEditor?.doc ?? null;
}

/** מצב ההגנה הנוכחי. `null` = אין מנוע. */
export async function readProtectionState(host: ProtectionTarget): Promise<ProtectionState | null> {
  const get = docOf(host)?.protection?.get;
  if (typeof get !== 'function') return null;
  try {
    const raw = (await get()) as { editingRestriction?: { mode?: string; enforced?: boolean } } | undefined;
    return {
      mode: raw?.editingRestriction?.mode ?? 'none',
      enforced: raw?.editingRestriction?.enforced === true,
    };
  } catch {
    return null;
  }
}

/**
 * הפעלת הגנה „קריאה בלבד" על המסמך כולו.
 * המסלול נמדד כולו כולל הביטול — ראו הערת הפתיחה.
 */
export async function enableReadOnlyProtection(host: ProtectionTarget): Promise<CommandOutcome> {
  const failedAction = 'הפעלת הגנת המסמך נכשלה';
  const set = docOf(host)?.protection?.setEditingRestriction;
  if (typeof set !== 'function') {
    return { ok: false, message: `${failedAction}: ${UNAVAILABLE_TEXT}`, reason: 'command-unsupported' };
  }

  let receipt: DocReceipt;
  try {
    receipt = await set({ mode: 'readOnly' });
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  // NO_OP = כבר מוגן. הצלחה מבחינת המשתמש.
  if (receipt?.success === false && receipt.failure?.code !== 'NO_OP') {
    return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
  }

  return { ok: true };
}

/** ביטול ההגנה — המסלול שנמדד ראשון. */
export async function disableProtection(host: ProtectionTarget): Promise<CommandOutcome> {
  const failedAction = 'ביטול הגנת המסמך נכשל';
  const clear = docOf(host)?.protection?.clearEditingRestriction;
  if (typeof clear !== 'function') {
    return { ok: false, message: `${failedAction}: ${UNAVAILABLE_TEXT}`, reason: 'command-unsupported' };
  }

  let receipt: DocReceipt;
  try {
    receipt = await clear();
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  if (receipt?.success === false && receipt.failure?.code !== 'NO_OP') {
    return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
  }

  return { ok: true };
}
