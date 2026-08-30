/**
 * מערכת המאקרו — חיבור חבילת superdoc-macros ל-session של העורך.
 *
 * מה המשתמש מקבל:
 *   - **מקליט מאקרו** בסגנון Word: Ctrl+Alt+R מתחיל/עוצר, Ctrl+Alt+P מנגן את
 *     ההקלטה האחרונה, Alt+F8 פותח את דיאלוג הניהול (הצירוף של Word עצמו).
 *     המקליט מתעד פקודות (דרך ה-controller) והקלדה (דרך beforeinput) — לא
 *     מיקומי סמן, ולכן ניגון פועל מהמקום שבו הסמן עומד, בדיוק כמו ב-Word.
 *   - **קטעי טקסט** עם השלמה אוטומטית: הקלדת מילת הפעלה ואחריה רווח מחליפה
 *     אותה בתוכן הקטע (למשל `בסד` ⟵ `בס"ד`). קטע לדוגמה נשתל בהפעלה
 *     הראשונה כדי שהיכולת תהיה גלויה.
 *   - **מאקרו כתובים** ב-JavaScript שרצים בארגז חול (iframe מבודד) מול API
 *     מצומצם — נכתבים ומורצים מדיאלוג הניהול (MacrosDialog.vue).
 *
 * הקיצורים עצמם **אינם נקשרים כאן**: הם רשומות ברג'יסטרי
 * (ui/shortcuts/registry.ts) ופעולות מעטפת (actions.ts) — מסלול אחד לכל
 * קיצור, כמו כל השאר. מה שכן נקשר כאן: הקיצורים שהמשתמש הצמיד לפריטים
 * שמורים (`kit.attachShortcuts`) — אלה נתונים, לא רשומות סטטיות, ואין להם
 * מקום ברג'יסטרי שנגזר ממנו טיפוס בזמן בנייה.
 *
 * המערכת שייכת ל-session: ההקלטה עוטפת את `ui.commands` של **המופע הפתוח**,
 * וההחלפה עוברת דרך ה-search handle שלו. לכן היא מותקנת בפתיחת מסמך ומפורקת
 * ב-`onDispose` — אותה תבנית כמו אדפטר החיפוש והמודד (ראו App.vue).
 *
 * השמירה ב-localStorage (ברירת המחדל של החבילה): המאקרו של המשתמש שורדים
 * החלפת מסמך והפעלה מחדש, בלי לגעת ב-workspace של הקבצים.
 */
import { shallowRef, type InjectionKey, type Ref } from 'vue';
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
  /** הערכה עצמה — הדיאלוג עובד מולה. כל התוצאות שלה כבר בעברית. */
  kit: MacroKit;
  /**
   * האם הקלטה רצה, כ-ref: `kit.isRecording` הוא getter רגיל ש-Vue אינו
   * רואה, וכפתור „הקלט/עצור” צריך להתעדכן בלי שאיש ילחץ עליו שוב.
   */
  recording: Readonly<Ref<boolean>>;
  /** מתחיל או עוצר הקלטה, ומדווח לשורת המצב. */
  toggleRecording(): void;
  /** מנגן את ההקלטה האחרונה, ומדווח לשורת המצב. */
  replayLast(): void;
  /** מפרקת את המאזינים ואת עטיפת ה-controller. אידמפוטנטית. */
  dispose(): void;
}

/**
 * המערכת של המסמך הפתוח, או `null` כשאין מסמך. `shallowRef` בצד המספק —
 * אותו דפוס כמו `ACTIVE_SUPERDOC` ב-document-api.ts, ומאותו טעם.
 */
export const ACTIVE_MACROS: InjectionKey<Ref<MacrosHandle | null>> = Symbol('activeMacros');

/**
 * מה שנצרך מה-session: המופע בלבד. `Pick` ולא הטיפוס המלא — כדי שבדיקה תוכל
 * לכפול רק אותו (אותה תבנית כמו `SearchHost` ב-engine/search.ts).
 */
export type MacrosSession = Pick<EditorSession, 'superdoc'>;

/** קטע לדוגמה, פעם אחת בלבד: בלי שום קטע ההשלמה האוטומטית בלתי נראית. */
function seedDefaultSnippet(kit: MacroKit): void {
  if (kit.listSnippets().length > 0) return;
  kit.saveSnippet({ name: 'בס"ד', text: 'בס"ד', trigger: 'בסד' });
}

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

  const recording = shallowRef(false);

  const unbindShortcuts = kit.attachShortcuts(container);
  const disableAutoText = kit.enableAutoText();

  let disposed = false;
  return {
    kit,
    recording,

    toggleRecording() {
      if (kit.isRecording) {
        const name = `מאקרו ${kit.listRecordings().length + 1}`;
        const saved = kit.stopRecording(name);
        recording.value = false;
        onStatus(saved ? recordingSavedText(saved.name) : MACRO_STATUS.recordingEmpty);
      } else {
        kit.startRecording();
        recording.value = kit.isRecording;
        onStatus(MACRO_STATUS.recordingStarted);
      }
    },

    replayLast() {
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
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      // הקלטה שנשארה פתוחה בהחלפת מסמך נזרקת: הצעדים הבאים היו מוקלטים
      // מהמסמך הלא נכון.
      kit.cancelRecording();
      recording.value = false;
      disableAutoText();
      unbindShortcuts();
      host.dispose();
    },
  };
}
