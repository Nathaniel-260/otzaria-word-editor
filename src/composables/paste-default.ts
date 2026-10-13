/**
 * ברירת המחדל של Ctrl+V — „הגדר הדבקת ברירת מחדל” של Word.
 *
 * העדפה של התוכנה, לא תכונה של המסמך: היא אינה נכתבת ל-DOCX ואינה נוסעת עם
 * הקובץ, בדיוק כמו צבע הבד (composables/canvas-color.ts).
 *
 * „שמירה על עיצוב המקור” היא ברירת המחדל: במצב הזה Ctrl+V אינו נחטף כלל,
 * וההדבקה היא של המנוע כפי שהייתה (engine/paste-intercept.ts).
 */
import { ref } from 'vue';
import { loadSetting, saveSetting } from '../host/settings';
import { isPasteMode, type PasteMode } from '../engine/paste-formatting';

const PASTE_DEFAULT_KEY = 'paste-default-mode';

/** מה ש-Ctrl+V עושה עכשיו. משותף לרצועה, לתפריט ההקשר ולמיירט. */
export const pasteDefaultMode = ref<PasteMode>('keep-source');

/** נקראת פעם אחת בעלייה. ערך לא מוכר מ-storage נופל לברירת המחדל. */
export async function loadPasteDefault(): Promise<void> {
  pasteDefaultMode.value = await loadSetting<PasteMode>(PASTE_DEFAULT_KEY, 'keep-source', (raw) =>
    isPasteMode(raw) ? raw : null,
  );
}

export function setPasteDefault(mode: PasteMode): void {
  if (pasteDefaultMode.value === mode) return;
  pasteDefaultMode.value = mode;
  void saveSetting(PASTE_DEFAULT_KEY, mode);
}
