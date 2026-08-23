/**
 * הגופן שנארז עם התוסף.
 *
 * למה בכלל לארוז גופן, כשמדריך העיצוב של ה-SDK אומר במפורש שאין צורך
 * (DESIGN_GUIDE.md: „הגופנים זמינים אוטומטית ב-WebView”)? כי מה שאוצריא מזריקה
 * הוא **גופן הקריאה שנבחר בהגדרות** — FrankRuhlCLM, Shofar וכדומה. זה מכסה את
 * טקסט הממשק, ולא את מה שהתוסף הזה מציג בפועל: מסמך DOCX שנכתב ב-Word, שקורא
 * לגופנים של Word. הגופן מוצהר כאן פעם אחת ומשרת גם את הממשק וגם את המסמך,
 * מפני ש-SuperDoc מרנדר לתוך אותו document.
 *
 * מה נארז: **Selawik** — הגופן ש-Microsoft שחררה תחת SIL OFL 1.1 כתחליף
 * מטרית-תואם ל-Segoe UI, בדיוק בשביל השימוש הזה. `fsType = 0`, כלומר אין הגבלת
 * הטמעה או הפצה. הוא מוצהר בשני שמות: `Selawik`, שמו האמיתי, ו-`Segoe UI` —
 * שם ההתאמה, כדי שמסמך שכתוב ב-Segoe UI יקבל את המטריקות הנכונות במקום fallback
 * שרירותי של המערכת. זו אותה החלפה שעושים fontconfig ו-LibreOffice; „Segoe UI”
 * הוא סימן מסחרי של Microsoft ומופיע כאן כשם התאמה בלבד.
 *
 * מה שהגופן הזה **אינו** נותן, ונמדד בקבצים עצמם:
 * - **אין בו עברית.** 348 מתווים, אפס בבלוק העברי. טקסט עברי — כלומר כמעט כל
 *   מה שייכתב בתוסף הזה — נופל לגופן הבא בשרשרת. Selawik פותר את הטקסט הלטיני
 *   ואת המטריקות, לא את העברית. `UNICODE_RANGE` מוודא שההצהרה לא תיקח על עצמה
 *   מתווים שאין לה.
 * - **אין פנים נטויה.** הדפדפן מטה את הרגילה סינתטית.
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
 * שלושת המשקלים שנארזים. אין נטוי (Selawik אינו מספק אחד), ואין Light
 * ו-Semilight — הממשק אינו משתמש בהם.
 */
export const BUNDLED_FILES: readonly BundledFile[] = [
  { weight: '400', url: './fonts/selawk.ttf' },
  { weight: '600', url: './fonts/selawksb.ttf' },
  { weight: '700', url: './fonts/selawkb.ttf' },
];

/**
 * השמות שבהם ה-CSS והמסמכים קוראים לגופן. `Selawik` הוא השם האמיתי;
 * `Segoe UI` הוא שם ההתאמה, ובלעדיו מסמך Word לא היה מקבל את המטריקות.
 */
export const BUNDLED_FAMILIES: readonly string[] = ['Selawik', 'Segoe UI'];

/**
 * הטווחים ש-Selawik מכסה בפועל, מעוגלים כלפי חוץ לבלוקים שלמים. נמדד מה-cmap:
 * 348 מתווים ב-40 טווחים — לטינית ותוספיה, דיאקריטיים, פיסוק, מטבע וסימנים.
 *
 * זה לא קוסמטי. בלי `unicode-range`, ההצהרה על השם „Segoe UI” **חוטפת** את השם
 * גם למתווים שאין בגופן: ב-Windows, שבו Segoe UI האמיתי מותקן ויש בו עברית,
 * טקסט עברי במסמך היה מפסיק לקבל אותו ונופל ל-fallback. עם הטווחים, הפנים שלנו
 * אינה מועמדת בכלל למתווים שאינה מכסה, והגופן שבמערכת ממשיך לטפל בהם.
 *
 * הבלוק העברי (U+0590-05FF) חייב להישאר **מחוץ** לרשימה.
 */
export const UNICODE_RANGE = [
  'U+0000-024F', // לטינית, Latin-1, Extended-A/B
  'U+02B0-02FF', // מודיפיירים
  'U+0300-036F', // דיאקריטיים משולבים
  'U+1E00-1EFF', // Latin Extended Additional
  'U+2000-206F', // פיסוק כללי
  'U+20A0-20CF', // מטבע
  'U+2100-214F', // סימנים דמויי-אות
].join(', ');

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
          `unicode-range:${UNICODE_RANGE};font-display:swap}`,
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
