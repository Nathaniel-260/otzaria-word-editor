/**
 * ברירות המחדל של מסמך חדש: כיווניות עברית, מימין לשמאל.
 *
 * למה לא דרך פקודות ה-Ribbon, כפי שנעשה קודם: `direction-rtl` ו-`text-align`
 * הן פקודות **פסקה** בקטלוג של ה-controller, והוא מנתב אותן לפי הבחירה הנוכחית.
 * במסמך שנפתח כרגע אין עדיין סמן, ולכן שתיהן נכשלו ב-`selection-required`
 * (נמדד ב-CDP על ה-dist: `{"ok":false,"reason":"selection-required"}`), הכשל
 * נבלע ב-`void`, והמסמך נשאר משמאל לימין. הן גם היו מטפלות בפסקה אחת בלבד.
 *
 * מה נעשה כאן במקום, דרך ה-Document API הציבורי (`superdoc.activeEditor.doc`),
 * שאינו דורש בחירה — שלוש שכבות, בדיוק כפי ש-Word מייצג מסמך עברי:
 *
 * 1. **ברירת המחדל של הגלריה** (`styles.apply` על `docDefaults`, ערוץ הפסקה):
 *    `w:pPrDefault/w:bidi`. זו השכבה שקובעת לכל פסקה שתיווצר במסמך, ולכן היא
 *    זו שעונה על „כל מסמך חדש נפתח מימין לשמאל”.
 * 2. **כיווניות המקטע** (`sections.setSectionDirection`): `w:sectPr/w:bidi`.
 *    זה מה שהופך את המקטע עצמו לעברי — סדר עמודות, מיקום מספור.
 * 3. **הפסקה הקיימת** (`format.paragraph.setDirection`): המסמך הריק נפתח עם
 *    פסקה אחת שנוצרה לפני שהשינויים לעיל הוחלו, ולכן היא מקבלת את הכיווניות
 *    בעיצוב ישיר. בלי זה השורה הראשונה שהמשתמש מקליד בה נשארת LTR.
 *
 * `alignmentPolicy: 'preserve'` ולא `'matchDirection'`: נמדד שהמנוע כותב
 * `alignment: 'left'` תחת `matchDirection` בפסקה RTL — יישור פיזי לשמאל, כלומר
 * בדיוק ההפוך מהמבוקש. בלי יישור מפורש הפסקה נשענת על `bidi` לבדו, וזה גם מה
 * ש-Word עושה במסמך עברי: `w:bidi` בלי `w:jc`, והטקסט נצמד לימין מעצמו.
 *
 * הפעולות מוחלות על **מסמך חדש בלבד**. מסמך שנפתח מקובץ נושא את הכיווניות של
 * מי שכתב אותו, ואין לגעת בה.
 */
import type { SuperDoc } from 'superdoc';

/** תוצאת ההחלה. `failures` בעברית — הן מגיעות לשורת המצב. */
export interface DocumentDefaultsReport {
  /** שמות השכבות שהוחלו בהצלחה, לפי סדר ההחלה. */
  applied: string[];
  /** תיאור בעברית לכל שכבה שנכשלה. */
  failures: string[];
}

/**
 * הצורה שנצרכת מ-`doc`. מוגדרת כאן ולא מיובאת: `BrowserDocumentApi` הוא הטיפוס
 * המלא של מאות פעולות, ובדיקה נגד fake הייתה מחייבת לממש את כולן.
 */
interface Receipt {
  success?: boolean;
  failure?: { code?: string; message?: string };
}

/** הקבלה שהמנוע מחזיר עשויה להיות סינכרונית או הבטחה — הפאסדה בדפדפן א-סינכרונית. */
type MaybePromise<T> = T | Promise<T>;

export interface DefaultsDocumentApi {
  blocks?: {
    list?: () => MaybePromise<{ blocks?: Array<{ nodeId?: string; nodeType?: string }> }>;
  };
  sections?: {
    list?: () => MaybePromise<{ items?: Array<{ address?: unknown }> }>;
    setSectionDirection?: (input: {
      target: unknown;
      direction: 'rtl' | 'ltr';
    }) => MaybePromise<Receipt>;
  };
  styles?: {
    apply?: (input: {
      target: { scope: 'docDefaults'; channel: 'paragraph' };
      patch: { rightToLeft?: boolean };
    }) => MaybePromise<Receipt>;
  };
  format?: {
    paragraph?: {
      setDirection?: (input: {
        target: { kind: 'block'; nodeType: string; nodeId: string };
        direction: 'rtl' | 'ltr';
        alignmentPolicy?: 'preserve' | 'matchDirection';
      }) => MaybePromise<Receipt>;
    };
  };
}

/** מה שנדרש מ-SuperDoc: רק הפאסדה של המסמך. */
export interface DefaultsHost {
  activeEditor?: { doc?: DefaultsDocumentApi | null } | null;
}

/** הודעה בעברית מקבלה שנכשלה, כולל הקוד של המנוע — בלעדיו אין על מה לדווח. */
function failureText(layer: string, receipt: Receipt | undefined): string {
  const code = receipt?.failure?.code;
  return code ? `${layer} (${code})` : layer;
}

/**
 * מחילה את ברירות המחדל של מסמך עברי חדש.
 *
 * לעולם אינה זורקת: כשל בכיווניות אינו סיבה להפיל פתיחת מסמך, והדיווח חוזר
 * ב-`report` כדי שהקורא יחליט אם להציג אותו.
 */
export async function applyHebrewDocumentDefaults(
  superdoc: SuperDoc | DefaultsHost,
): Promise<DocumentDefaultsReport> {
  const report: DocumentDefaultsReport = { applied: [], failures: [] };
  const doc = (superdoc as DefaultsHost).activeEditor?.doc;

  if (!doc) {
    report.failures.push('המנוע אינו חושף את ה-Document API');
    return report;
  }

  // 1. ברירת המחדל לכל פסקה במסמך.
  const applyStyles = doc.styles?.apply;
  if (!applyStyles) {
    report.failures.push('ברירת המחדל של הגלריה אינה נתמכת במנוע');
  } else {
    try {
      const receipt = await applyStyles({
        target: { scope: 'docDefaults', channel: 'paragraph' },
        patch: { rightToLeft: true },
      });
      if (receipt?.success === false) {
        report.failures.push(failureText('ברירת המחדל של הגלריה נכשלה', receipt));
      } else {
        report.applied.push('docDefaults');
      }
    } catch (error) {
      report.failures.push(`ברירת המחדל של הגלריה שגתה: ${describe(error)}`);
    }
  }

  // 2. כיווניות המקטע.
  try {
    const sections = await doc.sections?.list?.();
    const address = sections?.items?.[0]?.address;
    const setSectionDirection = doc.sections?.setSectionDirection;
    if (!address || !setSectionDirection) {
      report.failures.push('כיווניות המקטע אינה נתמכת במנוע');
    } else {
      const receipt = await setSectionDirection({ target: address, direction: 'rtl' });
      if (receipt?.success === false) {
        report.failures.push(failureText('כיווניות המקטע נכשלה', receipt));
      } else {
        report.applied.push('section');
      }
    }
  } catch (error) {
    report.failures.push(`כיווניות המקטע שגתה: ${describe(error)}`);
  }

  // 3. הפסקה שהמסמך נפתח איתה.
  try {
    const listed = await doc.blocks?.list?.();
    const block = listed?.blocks?.[0];
    const setDirection = doc.format?.paragraph?.setDirection;
    if (!block?.nodeId || !setDirection) {
      report.failures.push('כיווניות הפסקה הראשונה אינה נתמכת במנוע');
    } else {
      const receipt = await setDirection({
        target: { kind: 'block', nodeType: block.nodeType ?? 'paragraph', nodeId: block.nodeId },
        direction: 'rtl',
        alignmentPolicy: 'preserve',
      });
      if (receipt?.success === false) {
        report.failures.push(failureText('כיווניות הפסקה הראשונה נכשלה', receipt));
      } else {
        report.applied.push('paragraph');
      }
    }
  } catch (error) {
    report.failures.push(`כיווניות הפסקה הראשונה שגתה: ${describe(error)}`);
  }

  return report;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
