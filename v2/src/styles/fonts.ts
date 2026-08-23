/**
 * הגופן שנארז עם התוסף.
 *
 * למה בכלל לארוז גופן, כשמדריך העיצוב של ה-SDK אומר במפורש שאין צורך
 * (DESIGN_GUIDE.md: „הגופנים זמינים אוטומטית ב-WebView”)? כי מה שאוצריא מזריקה
 * הוא **גופן הקריאה שנבחר בהגדרות** — FrankRuhlCLM, Shofar וכדומה. זה מכסה את
 * טקסט הממשק, ולא את מה שהתוסף הזה מציג בפועל: מסמך DOCX שנכתב ב-Word, שקורא
 * לגופנים של Word. „Segoe UI” הוא הנפוץ שבהם, ואינו קיים ב-macOS או בלינוקס —
 * בלעדיו המסמך נופל ל-fallback של המערכת, עם מטריקות אחרות ועימוד אחר מזה
 * שהמשתמש רואה ב-Word. הגופן מוצהר כאן פעם אחת ומשרת גם את הממשק וגם את
 * המסמך, מפני ש-SuperDoc מרנדר לתוך אותו document.
 *
 * למה בהזרקה מ-JS ולא בקובץ CSS?
 * 1. ולידציית העיצוב של אוצריא סורקת `*.css` ובלוקי `<style>` ב-HTML, ופוסלת כל
 *    `font-family` שאינו `var(--font-*)` — כולל בתוך `@font-face`, שהיא אינה
 *    מחריגה. CSS שעובר דרך ה-bundler מוטמע ב-app.js ולכן אינו נסרק, אבל קובץ
 *    גופנים נפרד היה נסרק ונפסל.
 * 2. `url()` בתוך CSS ש-Vite מעבד נפתר על ידו לנכס עם נתיב שהוא מחשב; ב-build
 *    IIFE החישוב הזה נשען על `import.meta.url` שאינו קיים. מחרוזת שנבנית בזמן
 *    ריצה נפתרת מול ה-document — `dist/index.html` שיושב ליד `dist/fonts/` —
 *    וזה עובד גם ב-file:// וגם בשרת הפיתוח.
 */

/** פנים גופן אחת: מה שמוצהר ב-CSS ואיזה קובץ נטען. */
export interface BundledFace {
  /** השם שבו CSS ומסמכי DOCX קוראים לגופן. */
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  /** נתיב יחסי ל-document. חייב להישאר יחסי — `/` מוחלט נשבר ב-file://. */
  url: string;
}

/**
 * ארבע הפנים שנארזות. `seguisb.ttf` הוא במקור משפחה נפרדת בשם
 * „Segoe UI Semibold”; ההצהרה כאן ממפה אותו למשקל 600 של „Segoe UI”, כמו
 * שמקובל ב-CSS.
 *
 * נמדד: לפנים הנטויה (`segoeuii.ttf`) **אין** כיסוי עברי כלל, ולכן טקסט עברי
 * נטוי ייפול לגופן הבא בשרשרת. זו גם ההתנהגות ב-Word עצמו, ולכן לא הוספה כאן
 * מיפוי-עקיפה.
 */
export const SEGOE_UI_FACES: readonly BundledFace[] = [
  { family: 'Segoe UI', weight: '400', style: 'normal', url: './fonts/segoeui.ttf' },
  { family: 'Segoe UI', weight: '600', style: 'normal', url: './fonts/seguisb.ttf' },
  { family: 'Segoe UI', weight: '700', style: 'normal', url: './fonts/segoeuib.ttf' },
  { family: 'Segoe UI', weight: '400', style: 'italic', url: './fonts/segoeuii.ttf' },
];

const STYLE_ID = 'bundled-fonts';

/** בלוק ה-`@font-face` של הפנים שנמסרו. */
export function bundledFontFaceCss(faces: readonly BundledFace[] = SEGOE_UI_FACES): string {
  return faces
    .map(
      (face) =>
        `@font-face{font-family:'${face.family}';font-style:${face.style};` +
        `font-weight:${face.weight};src:url('${face.url}') format('truetype');` +
        `font-display:swap}`,
    )
    .join('\n');
}

/**
 * מזריקה את ההצהרות ל-`<head>`. אידמפוטנטית: קריאה שנייה אינה מכפילה אותן.
 *
 * `font-display: swap` ולא `block`: 3.3MB של גופן לא יעכבו את הצגת המסמך, גם אם
 * המשמעות היא הבזק של גופן המערכת. אוצריא מזריקה את הגופנים שלה עם `block`,
 * אבל שם מדובר בגופן היחיד של הממשק ולא בגופן שכל תפקידו נאמנות של מסמך.
 */
export function installBundledFonts(doc: Document = document): void {
  const parent = doc.head ?? doc.documentElement;
  if (!parent || doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = bundledFontFaceCss();
  parent.appendChild(style);
}
