/**
 * הגופן שנארז עם התוסף.
 *
 * למה בכלל לארוז גופן, כשמדריך העיצוב של ה-SDK אומר במפורש שאין צורך
 * (DESIGN_GUIDE.md: „הגופנים זמינים אוטומטית ב-WebView”)? כי מה שאוצריא מזריקה
 * הוא **גופן הקריאה שנבחר בהגדרות** — FrankRuhlCLM, Shofar וכדומה. אלה גופני
 * קריאה של ספרים, לא גופן ממשק: הם משתנים מהגדרה להגדרה, ואין ערובה שהממשק
 * ייראה בהם כפי שתוכנן. הגופן מוצהר כאן פעם אחת ומשרת גם את הממשק וגם את
 * המסמך, מפני ש-SuperDoc מרנדר לתוך אותו document.
 *
 * מה נארז: **Assistant** — גופן עברי-לטיני של The Assistant Project, תחת SIL OFL 1.1,
 * `fsType = 0` (אין הגבלת הטמעה או הפצה). 431 מתווים, מהם 49 בבלוק העברי:
 * בשונה מהגופן שהיה כאן קודם (Selawik, שאין בו עברית כלל), הוא מכסה בפועל את
 * הטקסט שהתוסף מציג. לכן גם אין `unicode-range`: הגופן משרת את כל המתווים
 * שיש בו, ומה שאין בו נופל הלאה בשרשרת של `--font-main`.
 *
 * מה שהגופן הזה **אינו** נותן:
 * - **אין פנים נטויה.** האריזה כוללת רק פנים זקופות; הדפדפן מטה אותן סינתטית.
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

/** קובץ גופן אחד ומשקלו. */
export interface BundledFile {
  weight: string;
  /** נתיב יחסי ל-document. חייב להישאר יחסי — `/` מוחלט נשבר ב-file://. */
  url: string;
}

/**
 * ארבעת המשקלים שנארזים — בדיוק אלה שה-CSS של הממשק מבקש (400 כברירת מחדל,
 * 500 ו-600 בכתוביות ובכפתורים, 700 לטקסט מודגש במסמך). אין נטוי: האריזה
 * כוללת רק פנים זקופות. שאר המשקלים של Assistant (ExtraLight, Light,
 * ExtraBold) אינם נארזים — נפח בלי צורך.
 */
export const BUNDLED_FILES: readonly BundledFile[] = [
  { weight: '400', url: './fonts/Assistant-Regular.ttf' },
  { weight: '500', url: './fonts/Assistant-Medium.ttf' },
  { weight: '600', url: './fonts/Assistant-SemiBold.ttf' },
  { weight: '700', url: './fonts/Assistant-Bold.ttf' },
];

/**
 * השם שבו ה-CSS והמסמכים קוראים לגופן — שמו האמיתי, כפי שהוא רשום בטבלת
 * ה-`name` של הקובץ. אין שם התאמה: שם שאין לו קובץ מתאים במטריקות היה חוטף
 * מתווים מגופן המערכת בלי להיטיב.
 */
export const BUNDLED_FAMILIES: readonly string[] = ['Assistant'];

const STYLE_ID = 'bundled-fonts';

/** בלוק ה-`@font-face` — פנים לכל משקל, לכל שם. */
export function bundledFontFaceCss(
  files: readonly BundledFile[] = BUNDLED_FILES,
  families: readonly string[] = BUNDLED_FAMILIES,
): string {
  return families
    .flatMap((family) =>
      files.map(
        (file) =>
          `@font-face{font-family:'${family}';font-style:normal;` +
          `font-weight:${file.weight};src:url('${file.url}') format('truetype');` +
          `font-display:swap}`,
      ),
    )
    .join('\n');
}

/**
 * מזריקה את ההצהרות ל-`<head>`. אידמפוטנטית: קריאה שנייה אינה מכפילה אותן.
 *
 * `font-display: swap` ולא `block`: הגופן לא יעכב את הצגת המסמך, גם אם המשמעות
 * היא הבזק של גופן המערכת. אוצריא מזריקה את הגופנים שלה עם `block`, אבל שם
 * מדובר בגופן היחיד של הממשק ולא בגופן שכל תפקידו נאמנות של מסמך.
 */
export function installBundledFonts(doc: Document = document): void {
  const parent = doc.head ?? doc.documentElement;
  if (!parent || doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = bundledFontFaceCss();
  parent.appendChild(style);
}
