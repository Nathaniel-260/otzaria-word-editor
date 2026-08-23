/**
 * הורדת קובץ דרך blob: ו-<a download>.
 *
 * זה מסלול זמני לשלב 0 בלבד, והוא כאן כדי שאפשר יהיה לאמת בשער Windows
 * שהמנוע מייצא DOCX שנפתח ב-Word אמיתי. הוא אינו „שמור”: אין לו יעד קבוע,
 * הוא תלוי בדיאלוג של המערכת, ואי אפשר לבנות עליו autosave.
 *
 * „שמור” אמיתי מחייב API כתיבה ב-SDK של אוצריא (תכנית §7) — כתיבה אטומית עם
 * token, דרך loopback, בלי להעביר bytes בגשר ה-JS. עד שהוא יתווסף, הפונקציה
 * הזאת היא נקודת המידה היחידה ל-round-trip.
 *
 * הדפוס עצמו מוכח ב-WebView של אוצריא — התוסף הקיים (1.3.6) מייצא כך docx.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // שחרור מיד אחרי הקליק מבטל את ההורדה בחלק מהמנועים — נותנים לה רגע.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
