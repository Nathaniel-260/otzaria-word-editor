/**
 * הערת שוליים והערת סיום, דרך `doc.footnotes.insert`.
 *
 * **`footnotes` הוא adapter אופציונלי בחוזה** (`footnotes?:` ב-
 * `DocumentApiAdapters`). כשהוא חסר, `doc.capabilities.get()` מסמן את כל
 * הפעולות של ה-namespace כ-`available: false` עם `NAMESPACE_UNAVAILABLE` —
 * ולכן בדיקת היכולת לבדה מספיקה כדי להחליט אם הפקד פעיל, ואין צורך בניחוש.
 * זה גם מה ש-§12 דורש: „פקד שאין לו API ציבורי אמין מסומן „לא זמין בגרסה
 * זו”; לא מממשים אותו דרך XML ידני או DOM פנימי.”
 *
 * `at` אינו נשלח: החוזה קובע שבהיעדרו ההוספה נעשית במקום הסמן — „the
 * toolbar/default editor path” — וזו בדיוק ההתנהגות שפקד בסרגל צריך. שליחת
 * `at` הייתה מחייבת אותנו לחשב כתובת טקסט מהבחירה, כלומר לשחזר בקוד שלנו את
 * מה שהמנוע כבר עושה.
 *
 * `content: ''` ולא טקסט מקום: Word מוסיף הערה ריקה ומעביר אליה את הסמן, ואין
 * שום טקסט שנכון לשתול במסמך של מישהו אחר. הוולידציה במנוע דורשת מחרוזת, לא
 * מחרוזת לא ריקה.
 */
import type { SuperDoc } from 'superdoc';
import type { CommandOutcome } from './command-adapter';
import { receiptFailureText, thrownText, type DocReceipt, type MaybePromise } from './document-api';

export type NoteType = 'footnote' | 'endnote';

export interface FootnotesDocumentApi {
  footnotes?: {
    insert?: (input: { type: NoteType; content: string }) => MaybePromise<DocReceipt>;
  };
}

export interface FootnotesHost {
  activeEditor?: { doc?: FootnotesDocumentApi | null } | null;
}

/** ה-union מאפשר גם את המופע האמיתי וגם כפיל. ההסבר המלא ב-page-setup.ts. */
export type FootnotesTarget = SuperDoc | FootnotesHost | null | undefined;

const NOTE_LABEL: Record<NoteType, string> = {
  footnote: 'הוספת הערת שוליים נכשלה',
  endnote: 'הוספת הערת סיום נכשלה',
};

/**
 * מוסיפה הערה במקום הסמן.
 *
 * לעולם אינה זורקת: `footnotes.insert` זורק `INVALID_INPUT` על קלט פסול במקום
 * להחזיר קבלה, וחריגה מפקד ב-Ribbon מפילה את רינדור הרצועה כולה.
 */
export async function insertNote(
  host: FootnotesTarget,
  type: NoteType,
): Promise<CommandOutcome> {
  const failedAction = NOTE_LABEL[type];
  const insert = (host as FootnotesHost | null | undefined)?.activeEditor?.doc?.footnotes?.insert;

  if (typeof insert !== 'function') {
    // אותו נוסח שהתכנית קובעת ב-§12, ואותו נוסח שהיכולת מחזירה — כדי שהמשתמש
    // יראה את אותו הסבר בין אם הפקד מנוטרל ובין אם הוא נלחץ לפני שהיכולות נקראו.
    return { ok: false, message: `${failedAction}: אינו זמין בגרסה זו`, reason: 'command-unsupported' };
  }

  let receipt: DocReceipt;
  try {
    receipt = await insert({ type, content: '' });
  } catch (error) {
    return { ok: false, message: thrownText(failedAction, error), reason: 'threw' };
  }

  if (receipt?.success === false) {
    return { ok: false, message: receiptFailureText(failedAction, receipt), reason: receipt.failure?.code };
  }

  return { ok: true };
}
