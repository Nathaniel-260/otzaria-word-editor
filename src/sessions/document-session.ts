/**
 * אשכול ה-state של מסמך בודד — כל מה שיצטרך להיות נפרד לכל טאב כשיהיה אפשר
 * לפתוח כמה מסמכים בבת אחת: `EditorSwap` (המנוע), `SaveCoordinator` (שמירה),
 * `SessionKeeper` (רשומה + טיוטה), והמודלים שקוראים את המסמך הפתוח (מדידה,
 * סרגל, גבולות עמוד, מספרי שורות, סימני עיצוב).
 *
 * ## למה זה קיים בלי צרכן
 *
 * זהו חלק 1 מתוך שלושה: שכבת ה-state בלבד. `App.vue` ממשיך להחזיק את כל אלה
 * כ-singletons ברמת המודול, בדיוק כמו קודם — הקובץ הזה רק חושף את הצורה
 * וההרכבה/הפירוק, כדי שחלקים 2-3 (הרצועה, TitleBar, ניהול הטאבים) יוכלו
 * להשתמש בהם בלי לתכנן טיפוסים מחדש.
 *
 * `metrics`/`ruler`/`pageBorders`/`lineNumbers`/`formattingMarks` הם `null`
 * עד שהמסמך נפתח בפועל — בדיוק כמו ב-App.vue היום, שם הם נוצרים רק אחרי
 * `swap.open()` הראשון ומוחלפים בכל פתיחה נוספת.
 */
import type { DocumentSessionId } from './session-state';
import { createDocumentSessionId } from './session-state';
import type { EditorSwap } from './editor-swap';
import type { SaveCoordinator } from './save-coordinator';
import type { SessionKeeper } from './session-keeper';
import type { DocMetricsAdapter } from '../engine/doc-metrics';
import type { RulerModel } from '../engine/page-ruler';
import type { LineNumberingModel, PageBorderModel } from '../engine/page-setup';
import type { FormattingMarksModel } from '../engine/formatting-marks';

export interface DocumentSession {
  readonly id: DocumentSessionId;
  readonly swap: EditorSwap;
  readonly save: SaveCoordinator;
  readonly keeper: SessionKeeper;
  metrics: DocMetricsAdapter | null;
  ruler: RulerModel | null;
  pageBorders: PageBorderModel | null;
  lineNumbers: LineNumberingModel | null;
  formattingMarks: FormattingMarksModel | null;
  /**
   * מפרקת את כל מה שבאשכול — המנוע, השמירה, זוכר ההפעלה.
   *
   * `removeDraft: true` הוא מסלול הסגירה-הסופית (טאב שנסגר בלי שמירה): טיוטת
   * המסמך הזה נמצאת בנתיב ייחודי לו (`draftPathFor`, ב-session-state.ts),
   * ובלי מחיקה מפורשת כאן היא נשארת יתומה במרחב הפרטי לצמיתות — לפני ריבוי
   * המסמכים נתיב קבוע ומשותף מיחזר את עצמו אוטומטית; עכשיו כל מסמך אחראי
   * לניקוי של עצמו.
   */
  destroy(options?: { removeDraft?: boolean }): Promise<void>;
}

export interface DocumentSessionParts {
  /** ברירת המחדל: מזהה חדש. מוגדר בפירוש כשמאמצים רשומה קיימת מה-storage. */
  id?: DocumentSessionId;
  swap: EditorSwap;
  save: SaveCoordinator;
  keeper: SessionKeeper;
}

/** מרכיבה אשכול ממה שכבר נבנה. אינה יודעת לבנות swap/save/keeper בעצמה —
 * אלה תלויים בסגירות (closures) ספציפיות ל-App.vue, ראו initSaveCoordinator/
 * initSessionKeeper שם. */
export function createDocumentSession(parts: DocumentSessionParts): DocumentSession {
  const session: DocumentSession = {
    id: parts.id ?? createDocumentSessionId(),
    swap: parts.swap,
    save: parts.save,
    keeper: parts.keeper,
    metrics: null,
    ruler: null,
    pageBorders: null,
    lineNumbers: null,
    formattingMarks: null,
    async destroy(options = {}) {
      session.swap.destroy();
      session.save.dispose();
      if (options.removeDraft) await session.keeper.discardDraft();
      session.keeper.dispose();
    },
  };
  return session;
}
