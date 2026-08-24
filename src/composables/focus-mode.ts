/**
 * מצב מיקוד: איזה חלק מהמעטפת נחשף כשהמצביע מתקרב לקצה.
 *
 * למה זה כאן ולא רק ב-CSS: המימוש הראשון היה
 * `.word-app-shell.focus-mode:hover { opacity: 1 }`, וה-hover הוא על **כל
 * המעטפת** — כלומר כל תנועת עכבר בחלון החזירה את כל הפסים, ומצב המיקוד לא
 * הסתיר כלום בפועל. אין דרך לכתוב „hover על הקצה” ב-CSS בלי אלמנט עזר
 * ו-`:has()`, ופונקציה טהורה גם אפשר לבדוק.
 *
 * `null` = שום דבר אינו נחשף.
 */
export type RevealZone = 'top' | 'bottom' | null;

/**
 * עובי רצועת החשיפה בפיקסלים.
 *
 * גדול מספיק שאפשר לכוון אליו בעכבר בלי דיוק, וקטן מספיק שהוא לא ייגע כשהמצביע
 * נמצא בגוף המסמך. הערך נמדד מול גובה הפס עצמו (48px) — רצועה בעובי הפס הייתה
 * נחשפת כבר בשורה הראשונה של הטקסט.
 */
export const REVEAL_EDGE_PX = 24;

/**
 * לאיזה קצה המצביע קרוב.
 *
 * `viewportHeight` נמסר ולא נקרא מ-`window`, כדי שהפונקציה תהיה טהורה ובדיקה
 * לא תצטרך לזייף את החלון.
 */
export function revealZone(
  clientY: number,
  viewportHeight: number,
  edge = REVEAL_EDGE_PX,
): RevealZone {
  if (!Number.isFinite(clientY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }
  // חלון נמוך מפעמיים הרצועה: הקצה העליון גובר, אחרת שני האזורים חופפים
  // והתחתון היה מנצח בכל מקום.
  if (clientY <= edge) return 'top';
  if (clientY >= viewportHeight - edge) return 'bottom';
  return null;
}
