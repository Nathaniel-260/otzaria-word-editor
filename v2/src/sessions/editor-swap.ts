/**
 * החלפת מסמך אטומית.
 *
 * הקמת מנוע היא אסינכרונית ויכולה להיכשל — קובץ פגום, DOCX מוגן בסיסמה, worker
 * שלא עלה. אם מפרקים את המסמך הפעיל לפני שהחדש מוכן, כשל כזה משאיר את המשתמש
 * בלי שום מסמך, כלומר עבודה שנעלמת. לכן המסמך המועמד נטען ל-host משלו,
 * וההחלפה קורית רק אחרי שהוא מוכן:
 *
 *   הצליח   → הישן מפורק, החדש נחשף.
 *   נכשל    → המועמד מוסר, הישן נשאר פעיל בדיוק כפי שהיה.
 *   הוחלף   → המועמד מפרק את עצמו; לא נוגעים בפעיל.
 *
 * ה-host של המועמד יושב באותו מקום כמו הפעיל (`position: absolute; inset: 0`)
 * והוא `visibility: hidden` — ולא `display: none` — כדי שיהיה לו box אמיתי
 * למדידה. עימוד שנמדד באלמנט בגודל אפס אינו עימוד.
 */
import type { EditorSession } from '../engine/create-editor';

/** נקראת פעם אחת לכל ניסיון פתיחה, עם ה-host שנוצר עבורו. */
export type OpenEditor = (host: HTMLElement, source?: string | File | Blob) => Promise<EditorSession>;

export type SwapOutcome =
  /** המסמך החדש פעיל. */
  | { status: 'opened'; session: EditorSession }
  /** הפתיחה נכשלה. המסמך שהיה פעיל נשאר פעיל. */
  | { status: 'failed'; error: Error }
  /** פתיחה חדשה יותר החליפה את הבקשה הזאת. */
  | { status: 'superseded' };

export const HOST_CLASS = 'editor-stack__host';
export const PENDING_CLASS = 'editor-stack__host--pending';

export interface EditorSwap {
  /** ה-session הפעיל, או null אם אין מסמך פתוח. */
  readonly current: EditorSession | null;
  /** האם יש פתיחה בתהליך. */
  readonly isOpening: boolean;
  open(source?: string | File | Blob): Promise<SwapOutcome>;
  destroy(): void;
}

export function createEditorSwap(container: HTMLElement, openEditor: OpenEditor): EditorSwap {
  let current: EditorSession | null = null;
  let currentHost: HTMLElement | null = null;
  let generation = 0;
  let pending = 0;

  function createHost(): HTMLElement {
    const host = document.createElement('div');
    host.className = `${HOST_CLASS} ${PENDING_CLASS}`;
    container.appendChild(host);
    return host;
  }

  function discard(session: EditorSession | null, host: HTMLElement | null): void {
    session?.destroy();
    host?.remove();
  }

  return {
    get current() {
      return current;
    },

    get isOpening() {
      return pending > 0;
    },

    async open(source) {
      const mine = ++generation;
      const host = createHost();
      pending += 1;

      let session: EditorSession;
      try {
        session = await openEditor(host, source);
      } catch (error) {
        host.remove();
        pending -= 1;
        if (mine !== generation) return { status: 'superseded' };
        return {
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
      pending -= 1;

      // בקשה חדשה יותר כבר בדרך, או שכבר הוחלף: המועמד הזה מפרק את עצמו ואינו
      // נוגע בפעיל — גם אם הוא זה שהתיישב אחרון.
      if (mine !== generation) {
        discard(session, host);
        return { status: 'superseded' };
      }

      discard(current, currentHost);
      current = session;
      currentHost = host;
      host.classList.remove(PENDING_CLASS);
      return { status: 'opened', session };
    },

    destroy() {
      // כל פתיחה שבדרך תיראה את עצמה כמוחלפת ותפרק את עצמה.
      generation += 1;
      discard(current, currentHost);
      current = null;
      currentHost = null;
    },
  };
}
