/**
 * ההחלטות שלפני החלפת מסמך.
 *
 * הלוגיקה הזאת יושבת מחוץ למעטפת בכוונה. היא קובעת אם עבודה של המשתמש נמחקת,
 * וקוד כזה חייב להיות נבדק — סבב ביקורת הראה שמוטציה שהחליפה את כל הזרימה
 * ב„פשוט תמחק” עברה את כל הבדיקות, כי המעטפת עצמה אינה מכוסה.
 */

export type SwitchDecision =
  /** לשמור קודם, ורק אם השמירה הצליחה להחליף. */
  | { action: 'save-first' }
  /** להחליף מיד; אין מה לאבד, או שהמשתמש אישר לאבד. */
  | { action: 'switch' }
  /** לא לעשות כלום. */
  | { action: 'cancel'; reason: 'user' | 'saving' };

export interface SwitchDeps {
  /** האם יש שינויים שלא נשמרו. */
  isDirty: () => boolean;
  /** האם שמירה רצה כרגע. */
  isSaving: () => boolean;
  /** שאלת כן/לא למשתמש. `ui.showConfirm` הוא דו-כפתורי. */
  confirm: (question: { title: string; content: string }) => Promise<boolean>;
  /** שם המסמך הפתוח, להודעות. */
  documentName: () => string;
}

/**
 * מה לעשות עם המסמך הפתוח לפני שמחליפים אותו.
 *
 * שלושת המצבים נבנים משתי שאלות, כי ל-Host יש רק דיאלוג דו-כפתורי. „לא” על
 * הראשונה אינו „למחוק” — הוא רק „לא לשמור”, ולכן חייבת לבוא שאלה שנייה
 * שמאשרת את המחיקה במפורש.
 */
export async function decideDocumentSwitch(deps: SwitchDeps): Promise<SwitchDecision> {
  // מעבר מסמך בזמן שמירה מותיר סבב שיסתיים על מסמך שכבר אינו פתוח. הקואורדינטור
  // זורק תוצאה כזאת, אבל אין סיבה להגיע לשם.
  if (deps.isSaving()) return { action: 'cancel', reason: 'saving' };
  if (!deps.isDirty()) return { action: 'switch' };

  const name = deps.documentName();
  if (
    await deps.confirm({
      title: 'המסמך לא נשמר',
      content: `לשמור את ${name} לפני פתיחת מסמך אחר?`,
    })
  ) {
    return { action: 'save-first' };
  }

  const discard = await deps.confirm({
    title: 'לפתוח בלי לשמור?',
    content: `השינויים ב${name} יימחקו ואין דרך לשחזר אותם.`,
  });
  return discard ? { action: 'switch' } : { action: 'cancel', reason: 'user' };
}

/**
 * האם לטפל בקיצור השמירה.
 *
 * בזמן שמירה `saveNow` מצטרף לסבב שרץ, ולכן Ctrl+Shift+S היה נראה כאילו פתח
 * „שמור בשם” בעוד שבפועל הוא רק המתין לשמירה הרגילה — ואז לא נפתח שום דיאלוג.
 */
export function saveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  isSaving: boolean,
): {
  /** צירוף השמירה. יש לבטל את התנהגות ברירת המחדל גם בזמן שמירה, אחרת
   *  ה-WebView פותח את דיאלוג השמירה של הדף עצמו. */
  isSaveKey: boolean;
  /** להריץ שמירה. `false` בזמן שמירה. */
  handled: boolean;
  saveAs: boolean;
} {
  const isSaveKey = event.key.toLowerCase() === 's' && (event.ctrlKey || event.metaKey);
  return {
    isSaveKey,
    handled: isSaveKey && !isSaving,
    saveAs: event.shiftKey,
  };
}
