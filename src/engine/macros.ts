/**
 * מערכת המאקרו — חיבור חבילת superdoc-macros ל-session של העורך.
 *
 * מה המשתמש מקבל:
 *   - **מקליט מאקרו** בסגנון Word: Ctrl+Alt+R מתחיל/עוצר הקלטה, Ctrl+Alt+P
 *     מנגן את ההקלטה האחרונה. המקליט מתעד פקודות (דרך ה-controller) והקלדה
 *     (דרך beforeinput) — לא מיקומי סמן, ולכן ניגון פועל מהמקום שבו הסמן
 *     עומד, בדיוק כמו ב-Word.
 *   - **קטעי טקסט** עם השלמה אוטומטית: הקלדת מילת הפעלה ואחריה רווח מחליפה
 *     אותה בתוכן הקטע (למשל `בסד` ⟵ `בס"ד`). קטע לדוגמה נשתל בהפעלה
 *     הראשונה כדי שהיכולת תהיה גלויה.
 *   - **מאקרו כתובים** ב-JavaScript שרצים בארגז חול (iframe מבודד) מול API
 *     מצומצם. אין להם עדיין ממשק ניהול — הם נגישים דרך ה-kit למי שיבנה אותו
 *     (ראו ההערה על `window` בסוף).
 *
 * המערכת שייכת ל-session: ההקלטה עוטפת את `ui.commands` של **המופע הפתוח**,
 * וההחלפה עוברת דרך ה-search handle שלו. לכן היא מותקנת בפתיחת מסמך ומפורקת
 * ב-`onDispose` — אותה תבנית כמו אדפטר החיפוש והמודד (ראו App.vue).
 *
 * השמירה ב-localStorage (ברירת המחדל של החבילה): המאקרו של המשתמש שורדים
 * החלפת מסמך והפעלה מחדש, בלי לגעת ב-workspace של הקבצים.
 */
import type { EditorSession } from './create-editor';
import {
  MacroKit,
  createSuperdocHost,
  type SuperdocLike,
  type SuperdocMacroHost,
} from 'superdoc-macros';

/** ההודעות שהמערכת מדווחת לשורת המצב. מרוכזות כדי שהבדיקות יטענו נוסח אחד. */
export const MACRO_STATUS = {
  recordingStarted: 'מקליט מאקרו… (Ctrl+Alt+R לעצירה)',
  recordingEmpty: 'ההקלטה הופסקה — לא הוקלטו פעולות',
  noRecordings: 'אין מאקרו מוקלט לניגון',
  replayDone: 'המאקרו נוגן',
} as const;

export function recordingSavedText(name: string): string {
  return `המאקרו "${name}" נשמר (Ctrl+Alt+P לניגון)`;
}

export function replayFailedText(message: string): string {
  return `ניגון המאקרו נכשל: ${message}`;
}

export interface MacrosHandle {
  kit: MacroKit;
  /** מפרקת את המאזינים ואת עטיפת ה-controller. אידמפוטנטית. */
  dispose(): void;
}

/**
 * קיצורי ההקלטה יושבים על ה-container ולא על window, ובכוונה: המאקרו פועל
 * על המסמך, והקיצור צריך לחיות איפה שהמסמך חי. דיאלוג פתוח שגוזל מיקוד לא
 * יפעיל הקלטה בטעות.
 */
function bindRecorderKeys(
  container: HTMLElement,
  kit: MacroKit,
  onStatus: (message: string, isError?: boolean) => void,
): () => void {
  const onKeydown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return;
    const key = event.key.toLowerCase();

    if (key === 'r') {
      event.preventDefault();
      event.stopPropagation();
      if (kit.isRecording) {
        const name = `מאקרו ${kit.listRecordings().length + 1}`;
        const recording = kit.stopRecording(name);
        onStatus(recording ? recordingSavedText(recording.name) : MACRO_STATUS.recordingEmpty);
      } else {
        kit.startRecording();
        onStatus(MACRO_STATUS.recordingStarted);
      }
      return;
    }

    if (key === 'p') {
      event.preventDefault();
      event.stopPropagation();
      const recordings = kit.listRecordings();
      const last = recordings[recordings.length - 1];
      if (!last) {
        onStatus(MACRO_STATUS.noRecordings, true);
        return;
      }
      void kit.replayRecording(last.id).then((result) => {
        if (result.ok) onStatus(MACRO_STATUS.replayDone);
        else onStatus(replayFailedText(result.failures[0]?.message ?? 'כשל לא ידוע'), true);
      });
    }
  };

  container.addEventListener('keydown', onKeydown, true);
  return () => container.removeEventListener('keydown', onKeydown, true);
}

/** קטע לדוגמה, פעם אחת בלבד: בלי שום קטע ההשלמה האוטומטית בלתי נראית. */
function seedDefaultSnippet(kit: MacroKit): void {
  if (kit.listSnippets().length > 0) return;
  kit.saveSnippet({ name: 'בס"ד', text: 'בס"ד', trigger: 'בסד' });
}

/**
 * מה שנצרך מה-session: המופע בלבד. `Pick` ולא הטיפוס המלא — כדי שבדיקה תוכל
 * לכפול רק אותו (אותה תבנית כמו `SearchHost` ב-engine/search.ts).
 */
export type MacrosSession = Pick<EditorSession, 'superdoc'>;

export function installMacros(
  editor: MacrosSession,
  container: HTMLElement,
  onStatus: (message: string, isError?: boolean) => void,
): MacrosHandle {
  /* ההצרה ל-SuperdocLike מבנית: החבילה מגדירה בעצמה את תת-הצורה שהיא צורכת
     (commands / doc / search / view), במקום לייבא את הטיפוסים הפנימיים של
     superdoc — אותו טעם כמו ב-document-api.ts. `unknown` באמצע כי הטיפוס
     המלא של SuperDoc מדויק יותר בשדות שהחבילה מכריזה כאופציונליים. */
  const host: SuperdocMacroHost = createSuperdocHost({
    superdoc: editor.superdoc as unknown as SuperdocLike,
    container,
  });

  const kit = new MacroKit({ host, onLog: (line) => onStatus(line) });
  seedDefaultSnippet(kit);

  const unbindShortcuts = kit.attachShortcuts(container);
  const disableAutoText = kit.enableAutoText();
  const unbindRecorderKeys = bindRecorderKeys(container, kit, onStatus);

  /* ידית לכלי פיתוח ולסקריפטי QA, כמו __otzariaEditor ב-create-editor.ts:
     עד שיש דיאלוג ניהול, זו הדרך לשמור ולערוך מאקרו כתובים. קוד האפליקציה
     אינו קורא כאן. */
  (window as unknown as { __otzariaMacros?: MacroKit }).__otzariaMacros = kit;

  let disposed = false;
  return {
    kit,
    dispose() {
      if (disposed) return;
      disposed = true;
      unbindRecorderKeys();
      disableAutoText();
      unbindShortcuts();
      host.dispose();
      const holder = window as unknown as { __otzariaMacros?: MacroKit };
      if (holder.__otzariaMacros === kit) delete holder.__otzariaMacros;
    },
  };
}
