/**
 * הרגע שבו התוסף עובר לרקע, ומתי הוא חוזר.
 *
 * ## למה שלושה מקורות ולא אחד
 *
 * התוסף אינו אפליקציה שנסגרת אלא לשונית בתוך אוצריא, ו„המשתמש הלך” מגיע
 * בשלוש צורות שונות — שאף אחת מהן אינה מכסה את השתיים האחרות:
 *
 * - **`plugin.suspended`** — אוצריא מודיעה שה-WebView של החזית הושהה (המשתמש
 *   ניווט משם). זה המסלול הנקי, והיחיד שיודע להבדיל בין „עבר ללשונית אחרת
 *   באוצריא” לבין מזעור החלון. הוא גם היחיד שאינו קיים מחוץ לאוצריא.
 * - **`visibilitychange` → `hidden`** — מגיע גם כשהחלון עצמו הוסתר או מוזער,
 *   בלי שאוצריא ניווטה לשום מקום. זה מה שקורה כשהמשתמש עובר לתוכנה אחרת.
 * - **`pagehide`** — הדף עצמו נפרק. זו ההזדמנות **האחרונה**, ואחריה אין קוד
 *   שירוץ. `beforeunload` אינו בשימוש: הוא מיועד לשאול את המשתמש, ו-WebView
 *   מוטמע אינו מציג את השאלה הזאת בכלל.
 *
 * ## הכפילות היא הכוונה
 *
 * שלושתם עשויים לירות על אותה יציאה — ניווט באוצריא מייצר גם `suspended` וגם
 * `visibilitychange`. הקורא **חייב** להיות אידמפוטנטי, וזה בדיוק מה שכתוב
 * בחוזה של `SessionKeeper.flush`: שמירה נוספת של אותו מצב אינה עולה דבר,
 * ואילו יציאה שלא נתפסה עולה בעבודה של המשתמש.
 *
 * ## למה זה לא ב-otzaria-client
 *
 * שם יושב הגשר עצמו — `call`, `on`, ה-boot. כאן יושבת **מדיניות**: אילו
 * אירועים נחשבים „הלך” ואילו „חזר”. ההבחנה הזאת היא מה שנבדק, ומודול נפרד
 * הוא מה שמאפשר לבדוק אותה בלי לזייף SDK שלם.
 */
import { isAvailable, on } from './otzaria-client';

/** מבטל את כל ההרשמות שנעשו יחד. */
export type Unsubscribe = () => void;

function offAll(disposers: Unsubscribe[]): Unsubscribe {
  return () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose();
      } catch (error) {
        console.warn('[otzaria-word] ביטול האזנת מחזור-חיים נכשל', error);
      }
    }
  };
}

/**
 * נרשמת לרגע שבו התוסף יורד מהמסך. ראו שלושת המקורות בראש הקובץ — הקורא
 * חייב להיות אידמפוטנטי.
 *
 * `plugin.suspended` נרשם רק כשה-SDK קיים: בפיתוח בדפדפן ובבדיקות אין גשר,
 * ושתי ההאזנות של ה-DOM עדיין עובדות שם — כלומר המסלול נבדק גם בלי אוצריא.
 */
export function onPluginHidden(listener: () => void): Unsubscribe {
  const disposers: Unsubscribe[] = [];

  if (isAvailable()) {
    try {
      disposers.push(on('plugin.suspended', () => listener()));
    } catch (error) {
      console.warn('[otzaria-word] ההאזנה ל-plugin.suspended נכשלה', error);
    }
  }

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') listener();
  };
  document.addEventListener('visibilitychange', onVisibility);
  disposers.push(() => document.removeEventListener('visibilitychange', onVisibility));

  const onPageHide = (): void => listener();
  window.addEventListener('pagehide', onPageHide);
  disposers.push(() => window.removeEventListener('pagehide', onPageHide));

  return offAll(disposers);
}

/**
 * ומה עם „חזר”?
 *
 * `plugin.resumed` אינו נרשם כאן, ובכוונה: אין לתוסף מה לעשות בו. השהיה
 * שומרת את ה-WebView בזיכרון — המסמך, הסמן והתצוגה ממתינים כפי שהיו — ומה
 * שיכול היה להתיישן, ה-URL של הקובץ, נצרך רק ברגע הפתיחה ולא אחריו. מאזין
 * שאינו עושה דבר הוא קוד שמישהו יתחזק בלי שיידע למה.
 */
