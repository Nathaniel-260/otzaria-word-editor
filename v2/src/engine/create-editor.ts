/**
 * הקמת מנוע SuperDoc v2 במצב "מנוע בלבד" — `ui: false`.
 * הממשק כולו שלנו; SuperDoc אחראי למודל המסמך, לעימוד, ל-DOCX ולייצוא.
 *
 * חוזה הבעלות על ה-controller (superdoc@2.8.0):
 * המופע כבר מחזיק controller ומחזיר אותו ב-`superdoc.ui`, בטיפוס
 * `BorrowedSuperDocUI` — כלומר `Omit<SuperDocUI, 'destroy'>`. אין לקרוא
 * ל-`createSuperDocUI` מקוד התוסף: זה יוצר controller שני, בבעלותנו, שהמנוע
 * לא יודע עליו. הפירוק נעשה ב-`superdoc.destroy()` בלבד — הוא זה שמפרק גם את
 * ה-controller.
 */
import { SuperDoc } from 'superdoc';
import type { BorrowedSuperDocUI, SuperDocExceptionPayload } from 'superdoc';
import 'superdoc/style.css';
import { engineWorkerUrls } from './workers';

export interface EditorSession {
  superdoc: SuperDoc;
  /** ה-controller של המופע. מושאל — לא לפרק אותו, ואין לו `destroy`. */
  ui: BorrowedSuperDocUI;
  /** רושם ביטול של subscription שלנו. ירוץ ב-`destroy`, לפני פירוק המנוע. */
  onDispose(dispose: () => void): void;
  /** מבטל את ה-subscriptions שלנו ואז מפרק את המנוע. אידמפוטנטי. */
  destroy(): void;
}

export interface CreateEditorOptions {
  /** האלמנט שבתוכו SuperDoc מרנדר את המסמך. */
  container: HTMLElement;
  /**
   * המסמך לפתיחה: URL (מה-loopback של אוצריא) או File/Blob.
   * בלי מסמך נפתח מסמך ריק.
   */
  source?: string | File | Blob;
  /** נקרא על כל exception של המנוע, גם אחרי שהמסמך נטען. */
  onError?: (error: Error, payload: SuperDocExceptionPayload) => void;
}

/**
 * ההודעה שמגיעה מ-exception של SuperDoc. ה-union מגיע מארבעה מקומות שונים
 * במנוע ואינו מנורמל, ולכן קוראים אותו בהגנה במקום להניח שדה.
 */
export function exceptionToError(payload: SuperDocExceptionPayload): Error {
  const raw: unknown = payload?.error;
  if (raw instanceof Error) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return new Error(raw);

  const code = payload && 'code' in payload ? payload.code : undefined;
  if (typeof code === 'string' && code !== '') {
    return new Error(`המנוע דיווח על שגיאה (${code})`);
  }
  return new Error('טעינת המסמך נכשלה');
}

export function createEditor(options: CreateEditorOptions): Promise<EditorSession> {
  const { container, source, onError } = options;

  return new Promise((resolve, reject) => {
    let instance: SuperDoc | undefined;
    let settled = false;

    const disposers: Array<() => void> = [];
    let destroyed = false;

    function destroy(target: SuperDoc): void {
      if (destroyed) return;
      destroyed = true;
      // קודם ה-subscriptions שלנו: listener שירוץ אחרי הפירוק יקרא state
      // של controller מפורק.
      for (const dispose of disposers.splice(0)) {
        try {
          dispose();
        } catch (error) {
          console.error('[otzaria-word] כשל בביטול subscription', error);
        }
      }
      target.destroy();
    }

    const superdoc = new SuperDoc({
      selector: container,
      document: source,

      // הממשק כולו שלנו — SuperDoc לא מרנדר שום toolbar, dialog או popover.
      ui: false,

      // התוסף עובד אופליין וללא הרשאת רשת; טלמטריה תיצור קריאות שייחסמו.
      telemetry: { enabled: false },

      // ב-file:// חייבים workers מ-blob: . undefined משאיר את ברירת המחדל
      // של SuperDoc, שנכונה בפיתוח מ-localhost.
      workerUrls: engineWorkerUrls(),

      // ה-payload נושא את המופע המוכן. משתמשים בו, ולא ב-closure, כדי לא
      // להישען על סדר ההשמה של הבנאי.
      onReady: ({ superdoc: ready }) => {
        if (settled) return;
        settled = true;
        resolve({
          superdoc: ready,
          ui: ready.ui,
          onDispose(dispose) {
            if (destroyed) {
              dispose();
              return;
            }
            disposers.push(dispose);
          },
          destroy: () => destroy(ready),
        });
      },

      onException: (payload) => {
        const error = exceptionToError(payload);
        onError?.(error, payload);
        if (settled) return;
        settled = true;
        // כשל לפני onReady משאיר מופע חצי-בנוי עם workers פתוחים. אם ה-exception
        // נורה בתוך הבנאי עצמו, instance עדיין undefined ואין מה לפרק.
        if (instance) destroy(instance);
        reject(error);
      },
    });

    instance = superdoc;
  });
}
