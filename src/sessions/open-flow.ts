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

/**
 * לשם מה נשאלת השאלה. שני המקרים חולקים את כל ההחלטה ונבדלים בנוסח בלבד,
 * ולכן הם פרמטר ולא פונקציה שנייה: זהו הקוד שקובע אם עבודה של המשתמש נמחקת,
 * ועותק שני שלו הוא עותק שני שיכול להתפצל בשקט.
 */
export type SwitchIntent = 'open-other' | 'exit';

/** הנוסח לכל כוונה. שאלת המחיקה זהה בשתיהן, ולכן היא אינה כאן. */
const WORDING: Record<SwitchIntent, { savePrompt: (name: string) => string; discardTitle: string }> =
  {
    'open-other': {
      savePrompt: (name) => `לשמור את ${name} לפני פתיחת מסמך אחר?`,
      discardTitle: 'לפתוח בלי לשמור?',
    },
    exit: {
      savePrompt: (name) => `לשמור את ${name} לפני יציאה?`,
      discardTitle: 'לצאת בלי לשמור?',
    },
  };

export interface SwitchDeps {
  /** האם יש שינויים שלא נשמרו. */
  isDirty: () => boolean;
  /** האם שמירה רצה כרגע. */
  isSaving: () => boolean;
  /** שאלת כן/לא למשתמש. `ui.showConfirm` הוא דו-כפתורי. */
  confirm: (question: { title: string; content: string }) => Promise<boolean>;
  /** שם המסמך הפתוח, להודעות. */
  documentName: () => string;
  /** ברירת המחדל היא מעבר מסמך — הכוונה שהפונקציה נכתבה בשבילה. */
  intent?: SwitchIntent;
}

/**
 * מה לעשות עם המסמך הפתוח לפני שמחליפים אותו או יוצאים ממנו.
 *
 * שלושת המצבים נבנים משתי שאלות, כי ל-Host יש רק דיאלוג דו-כפתורי. „לא” על
 * הראשונה אינו „למחוק” — הוא רק „לא לשמור”, ולכן חייבת לבוא שאלה שנייה
 * שמאשרת את המחיקה במפורש.
 *
 * `intent` משנה נוסח בלבד. ההחלטה עצמה זהה בשני המקרים, וזו הסיבה שהיא כאן
 * ולא משוכפלת: „יציאה בלי לשמור” ו„פתיחה בלי לשמור” הם אותו סיכון בדיוק.
 */
export async function decideDocumentSwitch(deps: SwitchDeps): Promise<SwitchDecision> {
  // מעבר מסמך בזמן שמירה מותיר סבב שיסתיים על מסמך שכבר אינו פתוח. הקואורדינטור
  // זורק תוצאה כזאת, אבל אין סיבה להגיע לשם.
  if (deps.isSaving()) return { action: 'cancel', reason: 'saving' };
  if (!deps.isDirty()) return { action: 'switch' };

  const name = deps.documentName();
  const wording = WORDING[deps.intent ?? 'open-other'];
  if (
    await deps.confirm({
      title: 'המסמך לא נשמר',
      content: wording.savePrompt(name),
    })
  ) {
    return { action: 'save-first' };
  }

  const discard = await deps.confirm({
    title: wording.discardTitle,
    content: `השינויים ב${name} יימחקו ואין דרך לשחזר אותם.`,
  });
  return discard ? { action: 'switch' } : { action: 'cancel', reason: 'user' };
}
