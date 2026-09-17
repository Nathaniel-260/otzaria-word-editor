/**
 * חצים אופקיים בשורה עברית — „לוחץ ימין והסמן הולך שמאלה”.
 *
 * ## מה שבור במנוע
 *
 * המנוע בוחר מודל כיוון **לכל פסקה בנפרד**: בפסקה עברית נקייה החצים חזותיים
 * (ימין=ימינה, כמו Word), ואילו בפריט רשימה, בפסקה עם טאב, ובכל שורה שיש בה
 * ספרות או לטינית הם לוגיים — כלומר ימין מזיז את הסמן שמאלה על המסך. אותו
 * מקש, שתי התנהגויות הפוכות, באותו מסמך. ‏`Shift+חץ` יורש את הסתירה, ובגבול
 * בין פסקה „חזותית” ל„לוגית” הסמן מקפץ בין השתיים ואינו חולף.
 *
 * ‏**`Shift+חץ` נשאר למנוע** — לא כי הוא תקין, אלא כי התצלום הסינכרוני אינו
 * מוסר בחירה שאינה מכווצת, ולכן אין מאיפה להמשיך בהקשה הבאה. הפירוט
 * ב-`isHorizontalArrow`, ושם גם המדידה שהפריכה את הנימוק שנכתב כאן קודם
 * („בחירה שנכתבת דרך ה-API אינה מצוירת” — היא כן).
 *
 * מדוד ומתועד ב-`docs/engine-gaps.md` („חצים אופקיים בעברית”), ודווח למעלה
 * כ-[#3996](https://github.com/superdoc/docx-editor/issues/3996). הקוד שמזיז
 * את הסמן אינו בחלקים הפתוחים של SuperDoc, ולכן אין PR — רק יירוט.
 *
 * ## למה אפשר לתקן את זה מבחוץ, אף שנכתב כאן קודם שאי אפשר
 *
 * הטענה הקודמת הייתה ש„היעד הנכון תלוי במודל הדו-כיווני שהמנוע מחזיק ואיננו
 * רואים”. זה לא נכון, ונמדד כלא נכון: הטקסט מצויר ב-DOM אמיתי, ולכן **המיקום
 * המצויר של כל תו ניתן למדידה מכאן**. אין צורך במודל של המנוע — צריך רק לדעת
 * מי התו שמצויר מימין לסמן, וזו שאלה על מלבנים.
 *
 * הגשש `scripts/qa/rtl-caret-visual-feasibility.mjs` הוכיח את זה מול האמת:
 * לכל היסט בשורה נכתבה בחירה, נמדד ה-x שהמנוע צייר בו את הסמן, והושווה למה
 * שהחישוב כאן גוזר מה-DOM. התוצאה (superdoc 2.15.0, Chrome, ה-dist הארוז):
 *
 *   | השורה                        | התאמה     |
 *   |------------------------------|-----------|
 *   | עברית נקייה                  | **20/20** |
 *   | פריט ברשימה ממוספרת          | **18/18** |
 *   | עברית עם ספרות               | **12/12** |
 *   | בקרה: שורה לטינית            | **17/17** |
 *   | שורה שנגמרת בספרה            | **13/13** |
 *   | שורה שמתחילה באי לטיני       | 12/13     |
 *   | עברית עם מילה באנגלית        | 12/14     |
 *
 * זהה עד עשירית פיקסל, וכל אי-התאמה היא **היסט תפר** — בדיוק אלה שמדולגים
 * כאן. שתי השורות האחרונות שבטבלה נוספו ב-17.9.2026, כשהוטל ספק בחריץ הראשון
 * ובחריץ האחרון של שורה; ראו `caretSlots`.
 *
 * ## המחיר — מה נמדד, ומה לא
 *
 * מה שנכתב כאן קודם („חציון 0.1–0.5ms, הגרוע 4.8ms”) היה מדידה של **רכיב אחד**
 * מתוך המסלול — חילוץ התיבות של שורה אחת — והוצג כמחיר ההקשה. נמדד מחדש
 * ב-17.9.2026 בשתי רמות, 40 חזרות לכל שורה:
 *
 *   | מה נמדד                                   | חציון      | הגרוע  |
 *   |-------------------------------------------|------------|--------|
 *   | חילוץ התיבות של שורה (`charBoxes`)        | 0–0.8ms    | 1.1ms  |
 *   | הקשה שלמה: `keydown` אמיתי דרך כל המסלול  | 0.1–7.7ms  | 17.8ms |
 *
 * ההקשה השלמה כוללת את הסמן המצויר ומלבנו, שלוש הסריקות על המארח,
 * `lineDistance` לכל מועמדת, `readLineChars` (ובקצה — פעמיים), ואת החלק
 * הסינכרוני של `setSelectionTarget`. היא **אינה** כוללת את הציור עצמו, שהוא
 * א-סינכרוני. שתי ריצות על אותו build נתנו לשורה הכבדה (88 תווים, רוחב A4
 * מלא) חציון 4.7ms והגרוע 11.8ms, ואז חציון 7.7ms והגרוע 17.8ms — כלומר
 * פריים (16ms) הוא סדר הגודל ולא גבול בטוח, על מכונה עמוסה.
 *
 * וזה רץ **רק בהקשת חץ**; הקלדה אינה נוגעת בו. אבל חץ הוא המקש שמחזיקים,
 * ולכן „רק בהקשה” אינו גבול — ולכן נמדד גם מה עולה חץ **מוחזק**, עם
 * ‏`PerformanceObserver` על `event` ועל `longtask` ומונה פריימים:
 *
 *   | מה                                   | פסקה עברית | פריט רשימה |
 *   |--------------------------------------|------------|------------|
 *   | הקשות בשנייה                         | 51         | 46         |
 *   | עיבוד ה-`keydown` השלם, טיפוסי       | 5–8ms      | 5–6ms      |
 *   | הגרוע באותה ריצה                     | 17ms       | 11ms       |
 *   | ‏`longtask` (מעל 50ms)                | 0          | 0          |
 *   | פריימים ב-1.2 שניות (במנוחה: 74)     | **74**     | **74**     |
 *
 * כלומר בהחזקה רצופה, מעל קצב ה-autorepeat של Windows, **לא נפל אף פריים**
 * ולא נרשמה אף משימה ארוכה. ‎~30% מהחוט הראשי בזמן ההחזקה — וזה **גזירה**
 * מהמספרים שבטבלה, לא מדידה נפרדת.
 *
 * (אותה מדידה רצה קודם, בטעות, על superdoc 2.14.0-next.5 שנשאר ב-
 * `node_modules` של העץ הראשי, ונתנה את אותן התאמות ואת אותם ערכי x בדיוק.)
 *
 * ## שלושה דברים שהמדידה מצאה, והם מה שמעצב את הקוד כאן
 *
 * 1. **כיוון הוא תכונה של מה שמצויר, לא של מה שהוצהר.** „פרק 12 בספר” הוא
 *    ריצת OOXML **אחת** שבתוכה אי לטיני; חלוקה לפי אלמנטים או לפי `w:rtl`
 *    מחמיצה אותו. לכן הכיוון כאן נגזר מ**צמידות**: שני תווים עוקבים שהתיבות
 *    שלהם נוגעות זו בזו שייכים לאותו קטע, והצד שבו הן נוגעות הוא הכיוון.
 *    ראו `bidi-declaration-is-not-direction` בהיסטוריה.
 *
 * 2. **לתפר יש שני בתים, ואין ידית לבחור ביניהם.** בגבול בין עברית ללטינית
 *    להיסט לוגי אחד יש **שני** מיקומים חוקיים על המסך, והמנוע בוחר לפי איך
 *    הגעת. נמדד ב„מילה ABC מילה”: היסט 56 מצויר ב-980 אחרי לחיצה בעכבר,
 *    וב-1012.9 אחרי כתיבה דרך `setSelectionTarget` — שמקבל מספר בלי צד.
 *    נמדדו חמש צורות כתיבה — עוגן מכל צד, `collapse` לשני הכיוונים — וכולן
 *    החזירו את **אותו** x בדיוק. אין ידית.
 *
 *    ומכאן ההכרעה: **היסט שיושב על תפר אינו יעד.** אילו כיוונו אליו, המנוע
 *    היה מצייר אותו בבית שהוא בחר — ובאי לטיני זה הבית שבצד השני, כלומר
 *    „שמאלה” היה מזיז ימינה. זו בדיוק התקלה שבאנו לתקן. המחיר הוא עצירה אחת
 *    בכל קצה של אי לועזי (עדיין נגישה בלחיצת עכבר), והתמורה היא
 *    **מונוטוניות**: ימין לעולם אינו מזיז שמאלה.
 *
 *    ‏**שני קצות השורה אינם תפר כזה** — זה נמדד בנפרד, ראו `caretSlots`:
 *    בשורה שמתחילה או נגמרת באי לועזי המנוע מצייר את ההיסט הראשון והאחרון
 *    בבית של **התו**, בדיוק במקום שמחושב כאן.
 *
 * 3. **כל אלמנט מצויר נושא את טווח ה-pm שלו.** ‏`SPAN.superdoc-text-run` וגם
 *    `SPAN.superdoc-tab` — והטאב הוא יחידת pm אחת בלי טקסט (נמדד:
 *    `pm=5..6`, רוחב 24, אפס תווים). לכן ההיסט של כל תו נקרא מהאלמנט שלו
 *    ואינו נספר באינדקסים, וסמן המספור של פריט רשימה — שאינו נושא טווח —
 *    נופל מעצמו.
 *
 * ## קצוות
 *
 * בקצה השורה אין חריץ בכיוון המבוקש, ואז היעד הוא **השכן הלוגי** בשורה או
 * בפסקה הסמוכה: ימין בשורה עברית הוא אחורה לוגית, ולכן הוא מוביל לסוף השורה
 * שמעליה — שהוא קצה שמאל שלה. בלי זה ההקשה הייתה חוזרת למנוע, והוא מזיז שם
 * קדימה לוגית, כלומר **שמאלה על המסך** — נמדד בשער.
 *
 * מה שנשאר למנוע: תנועה **בתוך** תא טבלה ובכותרת עליונה, פסקה שכנה שאינה
 * צמודה במסמך, עמוד שעוד לא צויר, שורה שאינה מוכרזת `dir="rtl"` — שם הוא
 * נמדד תקין —
 * ושורה שטווחי ה-pm המצוירים בה אינם רציפים. בכל אלה ההקשה עוברת אליו כפי
 * שהיא. שער: `npm run check:arrows`.
 *
 * וגם **`Ctrl/Alt/Meta+חץ`** — קפיצת מילה — נשאר לו, ובמודע: היא דורשת גבולות
 * מילה, ומפת התיבות כאן אינה יודעת עליהן דבר. המחיר הוא סתירה חדשה: באותו
 * פריט רשימה `ArrowRight` יזוז ימינה בעוד `Ctrl+ArrowRight` יקפוץ מילה
 * שמאלה (לפני המודול הזה שניהם זזו שמאלה). מתועד ב-`docs/engine-gaps.md`.
 * ו-`Shift+חץ` — ההסבר ב-`isHorizontalArrow`.
 *
 * ## פסקה ריקה
 *
 * אין בה תו מצויר, ולכן אין ממה לגזור חריץ — אבל יש בה בדיוק מקום סמן אחד,
 * וההקשה שייכת לנו. נמדד בשער שמסירה למנוע כאן אינה ניטרלית: מתחילת הפסקה
 * שאחרי הריקה `ArrowRight` הזיז אותו **בתוך** אותה פסקה מהיסט 0 להיסט 1,
 * כלומר שמאלה על המסך, והריקה דולגה. הצורה המצוירת נמדדה: fragment שטווחו
 * באורך אפס (‏`14..14`) ובתוכו שורה באותו טווח בלי אף נושא היסט — וכן, פסקה
 * ריקה תופסת מקום pm נוסף אחריה (‏`1..13`, `14..14`, `16..28`).
 *
 * ## תחילת המסמך וסופו — ההקשה נבלעת
 *
 * שם אין לאן לזוז, ומסירה למנוע אינה ניטרלית: בפסקה שהמנוע מזיז בה לוגית הוא
 * זז לכיוון ההפוך, ההקשה הבאה שלנו מחזירה, והסמן קפץ בין שני היסטים בלי סוף
 * (נמדד בשתי הקצוות). הקצה מזוהה מהעמודים, ולא מהיעדר פסקה ב-DOM: המנוע
 * מצייר רק עמודים קרובים (נמדד: 3 מתוך 25), ולכן „אין פסקה אחרי” לבדו אינו
 * סוף המסמך.
 *
 * ## פסקה שנחצית בין עמודים
 *
 * כל חלק שלה הוא fragment משלו, וההמשך מתחיל ב-pm שבו הקודם נגמר (נמדד:
 * 1214..2112 ו-2112..2383, עם `data-continues-from-prev`). ההיסט של הסמן
 * יחסי לתחילת **הפסקה**, ולא לתחילת ה-fragment, ולכן הבסיס נלקח מהחלק
 * הראשון; בגבול עצמו — pm אחד ששייך לשניהם — ה-y של הסמן מכריע, כמו בין
 * שורות גולשות. בלי זה החלק השני נמסר כולו למנוע, והחץ בגבול קפץ לתחילת
 * השורה האחרונה בעמוד הקודם (נמדד: 898 → 811).
 *
 * ## טבלה שכנה — נכנסים לתא
 *
 * טבלה מצוירת כ-fragment בלי מזהה מקור, והפסקאות שבתאים שלה הן אלמנטים עם
 * מזהה אבל בלי טווח משלהם — הטווח על השורות (נמדד: הטבלה pm 115..122, ובתוכה
 * פסקת התא עם שורה 115..122; הפסקה שלפני נגמרת ב-114 וזו שאחרי מתחילה
 * ב-123). מסירה למנוע אינה עובדת כאן בפסקה לוגית: הוא זז קדימה בתוך הפסקה
 * ולא נכנס לטבלה (נמדד). לכן היעד הוא קצה הפסקה הראשונה בטבלה (קדימה) או
 * האחרונה (אחורה). התנועה **בתוך** התא עצמו נשארת למנוע.
 */

/** תו מצויר אחד: ההיסט שלו (ב-pm של המנוע) והתיבה שלו על המסך. */
export interface PaintedChar {
  pm: number;
  left: number;
  right: number;
  /** אשכול הגרפמה עצמו — אות ואיתה הניקוד והטעמים שלה. חסר בטאב, שאין לו טקסט. */
  ch?: string;
  /**
   * כמה יחידות UTF-16 האשכול תופס. חסר = 1; ‏3 ב-„שָׁ”, 2 באימוג'י —
   * ההסבר ב-`readLineChars`.
   */
  units?: number;
}

/** יחידות ה-UTF-16 של התו. ראו `PaintedChar.units`. */
const unitsOf = (c: PaintedChar): number => c.units ?? 1;

/** מקום חוקי לסמן: ההיסט וה-x שבו הוא מצויר. */
export interface CaretSlot {
  pm: number;
  x: number;
}

/**
 * שתי תיבות נחשבות נוגעות עד לסף הזה. הן נמדדו נוגעות **בדיוק** (הפרש 0),
 * והסף קיים רק בשביל עיגול של תת-פיקסל.
 */
const TOUCH = 0.6;

/**
 * מערכות כתב שנקראות מימין לשמאל. אות שלהן היא R או AL ב-UBA.
 */
const RTL_SCRIPT =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;

/** ספרה — EN או AN ב-UBA, ובשני המקרים נקראת משמאל לימין גם בשורה עברית. */
const DIGIT = /\p{Nd}/u;

/** אות — כולל סימני ניקוד שמצטרפים לאות (Other_Alphabetic). */
const LETTER = /\p{Alphabetic}/u;

/**
 * האם הדפדפן מסדר את התו הזה משמאל לימין גם בתוך שורה עברית.
 *
 * ספרה, או אות שאינה ממערכת כתב ימנית — כן. סימן — לא: ב-UBA הוא ניטרלי (ON),
 * הדפדפן מצייר אותו בכיוון הפסקה, ושני התפרים שלו נמצאים ב-x שונה — זו
 * אינה הנקודה העיוורת שלמטה, וקיפול שלהם מוחק מקום נגיש. נמדד: ב-„שלוש × ארבע” ההיסטים
 * 5 ו-6 מצוירים ב-1008.5 ו-999.4, וסיווג של × כלועזי הקפיץ את החץ מ-4 ישר ל-7.
 */
function isLtrIntrinsic(ch: string): boolean {
  if (ch === '') return false;
  return DIGIT.test(ch) || (LETTER.test(ch) && !RTL_SCRIPT.test(ch));
}

/**
 * הכיוון של כל תו.
 *
 * `true` = התו שייך לקטע ימין-לשמאל. הכיוון נגזר מהגאומטריה: שני תווים עוקבים
 * שהתיבות שלהם נוגעות שייכים לאותו קטע, והצד שבו הן נוגעות הוא הכיוון. תו
 * שאין לו שכן צמוד משני צדדיו — למשל רווח שמפריד בין עברית לאי לטיני, או
 * טאב — נופל לכיוון השורה.
 *
 * ## אי של תו אחד
 *
 * לגאומטריה יש נקודה עיוורת אחת: ספרה או אות לטינית **בודדת** בין שני תווים
 * עבריים („סעיף 3 בחוק”, „אות a אחת”) נוגעת בשכניה בדיוק כמו תו עברי, כי אין
 * לה שכן לטיני שיגלה את הכיוון שלה. היא סווגה כעברית, שני התפרים שלה נשארו
 * יעדים, והמנוע מצייר את שניהם באותו x — ולכן כל הקשה החזירה את הסמן לתפר
 * השני ולא עברה את התו (נמדד: „3” ב-[1005, 1013], והיסטים 5 ו-6 מצוירים שניהם
 * ב-1005; „a” ב-[1012.1, 1019.2], ו-4 ו-5 שניהם ב-1019.2). כשהגאומטריה אינה
 * מראה צמידות לטינית, התו עצמו מכריע.
 */
export function charDirections(chars: readonly PaintedChar[], lineRtl: boolean): boolean[] {
  const dirs: (boolean | null)[] = new Array(chars.length).fill(null);

  for (let i = 0; i + 1 < chars.length; i += 1) {
    const a = chars[i]!;
    const b = chars[i + 1]!;
    let rtl: boolean | null = null;
    if (Math.abs(b.left - a.right) < TOUCH) rtl = false;
    else if (Math.abs(a.left - b.right) < TOUCH) rtl = true;
    if (rtl === null) continue;
    if (dirs[i] === null) dirs[i] = rtl;
    dirs[i + 1] = rtl;
  }

  return dirs.map((value, i) => {
    if (value !== false && isLtrIntrinsic(chars[i]!.ch ?? '')) return false;
    return value ?? lineRtl;
  });
}

/**
 * כל המקומות שהסמן רשאי לעצור בהם בשורה, בלי אלה שיושבים על תפר.
 *
 * הסמן בהיסט o יושב על ה**קצה המוביל** של התו שבהיסט o — שמאל לתו לטיני,
 * ימין לתו עברי — ובסוף השורה על הקצה הנגרר של האחרון. היסט שהכיוון משתנה
 * בו מושמט; ההסבר בהערת הפתיחה.
 *
 * ## ושני קצות השורה **אינם** תפר — נמדד
 *
 * הדילוג חל על היסט שיש לו שני בתים, ולכאורה גם קצה של שורה שמתחילה או
 * נגמרת באי לועזי הוא כזה: מעבר לתו הראשון ולאחרון עומדת הפסקה, שכיוונה
 * הפוך. נמדד בשער (`check:arrows`, 17.9.2026) שזה **לא** המצב — המנוע מצייר
 * שם את הבית של **התו**, בדיוק מה שמחושב כאן:
 *
 *   • „ABC מילה כאן” (פסקה `w:bidi`, האי בקצה הימני ‏[1010.5 … 1043.3]):
 *     היסט 0 מצויר ב-**1010.5**, כלומר בקצה השמאלי של `A` — ולא בתחילת
 *     הפסקה שמימין. ההליכה שלמה: ‏…4@1006.4 → 0@1010.5 → 1@1022, וההפוכה
 *     ‏3@1043.3 → 2@1032.7 → 1@1022 → 0@1010.5 → 4@1006.4.
 *   • „לפני הטבלה 4” (הספרה בקצה השמאלי, ‏[967 … 975.4]): היסט הסיום 12
 *     מצויר ב-**975.4**, הקצה הימני של הספרה — ולא בקצה השמאלי של השורה.
 *     ‏12@975.4 → 10@979.4 → 9@986.9, בלי צעד לכיוון ההפוך.
 *
 * דילוג על החריצים האלה היה **מוחק** מקום נגיש שהמנוע מצייר נכון: לפי אותן
 * תיבות שנמדדו, בלי החריץ 0@1010.5 ההקשה מ-4@1006.4 הייתה נוחתת על 1@1022 —
 * כלומר מעל „A” כולו (גזירה מהמדידה, לא ריצה נוספת). לכן התו הראשון אינו
 * נבדק מול קודמו, וחריץ הסיום נפלט תמיד.
 */
export function caretSlots(chars: readonly PaintedChar[], lineRtl: boolean): CaretSlot[] {
  if (!chars.length) return [];
  const dirs = charDirections(chars, lineRtl);
  const slots: CaretSlot[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    if (i > 0 && dirs[i] !== dirs[i - 1]) continue;
    const c = chars[i]!;
    slots.push({ pm: c.pm, x: dirs[i] ? c.right : c.left });
  }

  const last = chars[chars.length - 1]!;
  slots.push({
    pm: last.pm + unitsOf(last),
    x: dirs[chars.length - 1] ? last.left : last.right,
  });

  return slots;
}

/**
 * החריץ הקרוב ביותר בכיוון המבוקש **על המסך**, או `null` כשאין כזה בשורה.
 *
 * נקודת המוצא היא ה-x שהסמן **מצויר** בו ולא החריץ של ההיסט שלו: בתפר השניים
 * אינם זהים, וה-x המצויר הוא האמת. כך טעות בצעד אחד אינה נצברת — כל הקשה
 * מודדת מחדש מאיפה שהסמן באמת נמצא.
 */
export function visualTarget(
  slots: readonly CaretSlot[],
  caretX: number,
  toRight: boolean,
): CaretSlot | null {
  let best: CaretSlot | null = null;
  for (const slot of slots) {
    if (toRight ? slot.x <= caretX + 0.5 : slot.x >= caretX - 0.5) continue;
    if (!best || (toRight ? slot.x < best.x : slot.x > best.x)) best = slot;
  }
  return best;
}

/**
 * הכניסה לשורה או לפסקה הסמוכה: הקצה הלוגי שלה מהצד שממנו באים.
 *
 * `caretPm` מוחרג מפני שגבול בין שתי שורות גולשות הוא **היסט אחד** ששייך
 * לשתיהן — בלי ההחרגה הצעד היה מחזיר את הסמן לעצמו.
 */
export function edgeSlot(
  slots: readonly CaretSlot[],
  forward: boolean,
  caretPm: number,
): CaretSlot | null {
  let best: CaretSlot | null = null;
  for (const slot of slots) {
    if (slot.pm === caretPm) continue;
    if (!best || (forward ? slot.pm < best.pm : slot.pm > best.pm)) best = slot;
  }
  return best;
}

/**
 * האם התנועה המבוקשת היא **קדימה לוגית**.
 *
 * בשורה עברית „ימינה על המסך” הוא אחורה בטקסט, ובשורה לטינית להפך. זה כל מה
 * שצריך כדי לדעת לאיזו שורה או פסקה לעבור בקצה.
 */
export function movesForward(toRight: boolean, lineRtl: boolean): boolean {
  return toRight ? !lineRtl : lineRtl;
}

/**
 * האם ההקשה היא חץ אופקי „נקי” — בלי Ctrl/Meta/Alt, **ובלי Shift**.
 *
 * ‏`Shift+חץ` אינו שלנו, ולא מפני שהוא תקין: הוא יורש בדיוק את אותה סתירה
 * (בפסקה הבחירה מתרחבת אחורה, ברשימה קדימה). הוא אינו שלנו מפני ש**אין
 * מאיפה לקרוא את ראש הבחירה בהקשה הבאה** —
 *
 *   • ‏`readLiveSelectionSyncSnapshot()` מחזיר `selectionTarget: null` לכל
 *     בחירה שאינה מכווצת — גם לזו שהמנוע עצמו יצר. זהו מקור הקריאה היחיד
 *     שרץ **בתוך** ה-keydown; ‏`doc.selection.current()` א-סינכרוני, ולכן
 *     ההקשה השנייה ברצף לא תדע מאיפה להמשיך.
 *   • המנוע מנרמל `start`/`end` לסדר המסמך, ולכן גם כיוון הבחירה אובד.
 *
 * ‏**מה שנכתב כאן קודם היה שגוי, ותוקן ממדידה.** הנימוק הקודם היה „בחירה
 * שאינה מכווצת אינה מצוירת כלל אחרי כתיבה דרך `setSelectionTarget`”. הוא
 * נסמך על חיפוש **אלמנט** ששמו מכיל `selection`, וזו אינה שאלה על פיקסלים:
 * אותו חיפוש מחזיר ריק גם כשהמנוע עצמו מצייר את הבחירה. נמדד מחדש
 * ב-17.9.2026 (superdoc 2.15.0) בצילום מלבן הפסקה והשוואת בתים —
 *
 *   | מה נעשה                              | התמונה |
 *   |--------------------------------------|--------|
 *   | בקרת יציבות: אותו מצב פעמיים         | זהה    |
 *   | ‏`Shift+חץ` של המנוע                  | השתנתה |
 *   | ‏`Shift+End` — כתיבה דרך ה-API        | השתנתה |
 *   | כתיבה ידנית של טווח 2..8 דרך ה-API   | השתנתה |
 *
 * כלומר טווח שנכתב דרך ה-API **כן** מצויר, ו-`rtl-line-end.ts` אינו כותב
 * בחירה בלתי-נראית. מה שנשאר חוסם הוא התצלום הסינכרוני שלמעלה.
 */
export function isHorizontalArrow(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> &
    Partial<Pick<KeyboardEvent, 'isComposing' | 'keyCode'>>,
): boolean {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return false;
  // הרכבה במקלדת (IME): החץ שייך לחלונית ההרכבה, ולא לסמן. `swallow()` כאן
  // היה בולע אותו לגמרי (הוא עוצר גם את המאזינים האחרים) ומתרגם אותו לתנועת
  // סמן — כלומר שובר את ההרכבה. התקן של הריפו ב-`src/ui/shortcuts/match.ts`:
  // דפדפן שאינו מציב `isComposing` מדווח `keyCode === 229`.
  if (event.isComposing === true || event.keyCode === 229) return false;
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/* ------------------------------------------------------------------ */
/* קריאת מה שמצויר                                                      */
/* ------------------------------------------------------------------ */

/** נקודת קצה של בחירה, כפי שהמנוע מחזיר אותה. */
interface TextPoint {
  kind?: string;
  blockId?: string;
  offset?: number;
  story?: unknown;
}

interface LiveSelectionSnapshot {
  selectionTarget?: {
    kind?: string;
    start?: TextPoint | null;
    end?: TextPoint | null;
    story?: unknown;
    coordinateSpace?: string;
  } | null;
}

/** מה שנצרך מ-`activeEditor`. מוגדר כאן ולא מיובא — ההסבר ב-document-api.ts. */
export interface RtlCaretEditor {
  host?: {
    readLiveSelectionSyncSnapshot?: () => LiveSelectionSnapshot | null | undefined;
  } | null;
  authoring?: {
    setSelectionTarget?: (input: {
      target: {
        kind: 'selection';
        start: TextPoint;
        end: TextPoint;
        story: unknown;
        coordinateSpace?: string;
      };
      focus?: boolean;
    }) => unknown;
  } | null;
}

export interface RtlCaretHost {
  activeEditor?: RtlCaretEditor | null;
}

export interface RtlCaretOptions {
  /** ה-div שהמנוע מצייר בתוכו — `paintedHost(editor.ui)`. */
  host: HTMLElement | null;
  /** ה-SuperDoc של אותו מסמך. */
  superdoc: RtlCaretHost | null | undefined;
}

export interface RtlCaretHandle {
  dispose(): void;
}

/** הסמן המצויר של המנוע. */
const CARET_SELECTOR = '.sd-v2-local-selection-caret';

/** ה-fragment של פסקה. */
const FRAGMENT_SELECTOR = '[data-source-node-id][data-pm-start]';

/** עמוד בגוף המסמך. ה-fragments של הגוף הם ילדיו הישירים (נמדד). */
const PAGE_CLASS = 'superdoc-page';

/** ה-fragment הוא המשך של פסקה שהתחילה בעמוד קודם. */
const CONTINUES_FROM_PREV = 'data-continues-from-prev';
const CONTINUES_ON_NEXT = 'data-continues-on-next';

/**
 * מה שנושא היסטים בתוך שורה. סמן המספור של פריט רשימה אינו אחד מאלה — הוא
 * מצויר בשורה ואינו נושא טווח pm, ולכן נופל מעצמו (נמדד).
 */
const PM_CARRIER_SELECTOR = '.superdoc-text-run, .superdoc-tab';

/**
 * טווח pm מתכונה, או `NaN` כשאין תכונה.
 *
 * ‏`Number(null)` הוא **0**, ולא NaN — ולכן `Number(el.getAttribute(…))` לבדו
 * הופך אלמנט בלי טווח לאלמנט שטווחו 0..0. נמדד: טאב-הסיומת של סמן רשימה
 * (`SPAN.superdoc-tab.superdoc-marker-suffix-tab`) נושא רווח אחד ואין לו
 * טווח, וכך הוא פסל את כל השורה — כלומר החזיר את הבאג לכל פריטי הרשימה.
 */
const attr = (el: Element, name: string): number => {
  const raw = el.getAttribute(name);
  return raw === null ? Number.NaN : Number(raw);
};

/**
 * מה שנצרך מ-`Intl.Segmenter`. הוא אינו בטיפוסי `ES2020` שב-`tsconfig`
 * (נוסף ב-`es2022.intl`), והצורה מוצהרת כאן ולא כהרחבה גלובלית — כדי שלא
 * תתנגש בהצהרה של מודול אחר.
 */
interface GraphemeSegmenter {
  segment(input: string): Iterable<{ index: number; segment: string }>;
}

/**
 * החלוקה לאשכולות גרפמה, פעם אחת למודול — ההסבר ב-`readLineChars`.
 *
 * בלי locale: כללי האשכול ב-UAX-29 אינם תלויים בשפה, והברירה נמדדה נותנת
 * את אותם גבולות בדיוק ל-`he` ולברירת המחדל על שש השורות בגשש.
 */
const GRAPHEMES: GraphemeSegmenter = new (
  Intl as unknown as {
    Segmenter: new (
      locales: undefined,
      options: { granularity: 'grapheme' },
    ) => GraphemeSegmenter;
  }
).Segmenter(undefined, { granularity: 'grapheme' });

/**
 * התיבה של כל אשכול גרפמה בשורה, עם ההיסט שלו.
 *
 * מחזירה `null` כשהטווחים המצוירים אינם מכסים את השורה ברצף — אז אין מיפוי
 * מהימן, וההקשה נמסרת למנוע.
 *
 * ## אשכול גרפמה, לא נקודת קוד ולא יחידת UTF-16
 *
 * ‏`pm` נספר ביחידות UTF-16, אבל היחידה שיש לה מקום על המסך היא **אשכול
 * הגרפמה**: „שָׁ” הוא שלוש נקודות קוד (ש, קמץ, שין-ימנית) ותיבה אחת, ואין
 * מקום סמן בין אות לניקוד שלה. הכלל של הדפדפן נמדד ב-Chrome אמיתי
 * (`node scripts/qa/rtl-caret-cluster-probe.mjs`, 17.9.2026) — הוא מחזיר
 * ל-`Range` שחותך באמצע אשכול את **תיבת האשכול המלאה**:
 *
 *   | האשכול                       | יחידות | רוחב התיבה | כל יחידה בנפרד |
 *   |------------------------------|--------|------------|----------------|
 *   | `😀` — זוג תחליף              |   2    |   22.0     | אותה תיבה      |
 *   | `שָׁ` ב-„מילה abcשָׁלום”        |   3    |    9.8     | אותה תיבה      |
 *   | `e`+U+0301 ב-„מילה éa מילה”  |   2    |    7.1     | אותה תיבה      |
 *
 * (ה-x המוחלט תלוי ברוחב החלון ולכן אינו רשום כאן; מה שקבוע הוא השוויון,
 * וזה מה שהגשש מוודא.)
 *
 * כלומר איטרציה לפי נקודת קוד אינה מספיקה: היא הייתה יוצרת ל-„שָׁ” שלושה
 * חריצים באותו x, ו**שניים מהם הם היסט בין האות לניקוד שלה**. נמדד מקצה
 * לקצה על המודול הזה עם התיבות שהגשש החזיר: ב-„מילה abcשָׁלום” שרדו החריצים
 * ‏`9` ו-`10` באותו x (הבסיס `8` נפל כתפר), וההליכה — לשני הכיוונים — נחתה
 * על `9`, כלומר בין ש לקמץ שלה. הקשה שם הייתה מכניסה תו בין האות לניקודה.
 * (‏„12שָׁלום” ו-„בְּ1948 שְנָה” יצאו שלמים במקרה בלבד: חריץ עם pm נמוך יותר
 * יושב באותו x ומנצח בשוויון של `<`/`>` ב-`visualTarget`.)
 *
 * החלוקה לאשכולות גם **מוזילה** את המסלול על הטקסט שהעורך הזה נועד לו: אותה
 * מדידה על שורה מנוקדת (89 יחידות UTF-16) — 54 קריאות `getBoundingClientRect`
 * במקום 89, חציון 0.3ms במקום 0.7ms; ועל שורה בלי ניקוד (269 יחידות) 269
 * קריאות בשני המסלולים, 1.8ms מול 1.9ms.
 */
export function readLineChars(line: Element): PaintedChar[] | null {
  const chars: PaintedChar[] = [];
  const range = document.createRange();

  for (const el of Array.from(line.querySelectorAll(PM_CARRIER_SELECTOR))) {
    const pmStart = attr(el, 'data-pm-start');
    const pmEnd = attr(el, 'data-pm-end');
    if (!Number.isFinite(pmStart) || !Number.isFinite(pmEnd)) continue;

    const text = el.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) {
      // טאב: יחידת pm אחת בלי טקסט, והתיבה היא של האלמנט עצמו.
      if (pmEnd - pmStart !== 1) return null;
      const rect = el.getBoundingClientRect();
      chars.push({ pm: pmStart, left: rect.left, right: rect.right });
      continue;
    }

    const data = (text as Text).data;
    if (data.length !== pmEnd - pmStart) return null;
    for (const { index, segment } of GRAPHEMES.segment(data)) {
      range.setStart(text, index);
      range.setEnd(text, index + segment.length);
      const rect = range.getBoundingClientRect();
      chars.push({
        pm: pmStart + index,
        left: rect.left,
        right: rect.right,
        ch: segment,
        ...(segment.length > 1 ? { units: segment.length } : {}),
      });
    }
  }

  if (!chars.length) return null;
  chars.sort((a, b) => a.pm - b.pm);
  if (chars[0]!.pm !== attr(line, 'data-pm-start')) return null;
  const last = chars[chars.length - 1]!;
  if (last.pm + unitsOf(last) !== attr(line, 'data-pm-end')) return null;
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i]!.pm !== chars[i - 1]!.pm + unitsOf(chars[i - 1]!)) return null;
  }

  return chars;
}

const flag = (el: Element, name: string): boolean => el.getAttribute(name) === 'true';

/**
 * פסקה או שורה בלי תוכן: טווח באורך אפס.
 *
 * נמדד (17.9.2026, superdoc 2.15.0): פסקה ריקה מצוירת כ-fragment עם
 * `data-pm-start` **שווה** ל-`data-pm-end` (14..14), ובתוכו
 * `DIV.superdoc-line` באותו טווח, עם `dir="rtl"` ובלי אף נושא היסט. יש לה
 * בדיוק מקום סמן אחד, וזה ההיסט הזה עצמו.
 */
function isEmptyRange(el: Element): boolean {
  const from = attr(el, 'data-pm-start');
  return Number.isFinite(from) && from === attr(el, 'data-pm-end');
}

/**
 * החריץ היחיד של שורה ריקה, או `null` כשאינה ריקה.
 *
 * ה-x נלקח ממלבן השורה, והוא אינו נקרא במסלול שמשתמש בחריץ הזה (בקצה נקרא
 * ה-pm בלבד) — אבל חריץ בלי מיקום היה שקר בטיפוס.
 */
function emptyLineSlot(line: Element, rtl: boolean): CaretSlot | null {
  if (!isEmptyRange(line)) return null;
  const rect = line.getBoundingClientRect();
  return { pm: attr(line, 'data-pm-start'), x: rtl ? rect.right : rect.left };
}

/**
 * ה-pm של תחילת הבלוק: ה-fragment הראשון שלו, זה שאינו המשך — או, לפסקה
 * בתוך תא שאין לה טווח משלה, השורה הראשונה שלה. `NaN` כשהבלוק אינו מצויר —
 * ואז אין מיפוי מהיסט ל-pm.
 */
function blockStart(host: HTMLElement, blockId: string): number {
  let bare: Element | null = null;
  for (const el of Array.from(host.querySelectorAll('[data-source-node-id]'))) {
    if (el.getAttribute('data-source-node-id') !== blockId) continue;
    if (!Number.isFinite(attr(el, 'data-pm-start'))) {
      bare ??= el;
      continue;
    }
    if (flag(el, CONTINUES_FROM_PREV)) continue;
    return attr(el, 'data-pm-start');
  }
  const first = bare ? linesOf(bare)[0] : undefined;
  return first ? attr(first, 'data-pm-start') : Number.NaN;
}

/** המרחק האנכי מ-y לשורה הקרובה ביותר ב-fragment שמכילה את ה-pm. */
function lineDistance(fragment: Element, pm: number, y: number): number {
  let best = Infinity;
  for (const line of linesOf(fragment)) {
    if (pm < attr(line, 'data-pm-start') || pm > attr(line, 'data-pm-end')) continue;
    const rect = line.getBoundingClientRect();
    best = Math.min(best, Math.abs((rect.top + rect.bottom) / 2 - y));
  }
  return best;
}

interface CaretHome {
  fragment: HTMLElement;
  caretPm: number;
}

/**
 * ה-fragment שהסמן בו, וה-pm שלו. פסקה שנחצית בין עמודים היא כמה fragments
 * עם אותו מזהה, ובגבול ביניהם ה-pm שייך לשניים — ה-y של הסמן מכריע.
 */
function findFragment(host: HTMLElement, blockId: string, caretOffset: number, caretY: number): CaretHome | null {
  const start = blockStart(host, blockId);
  if (!Number.isFinite(start)) return null;
  const caretPm = start + caretOffset;

  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const fragment of Array.from(host.querySelectorAll<HTMLElement>(FRAGMENT_SELECTOR))) {
    if (fragment.getAttribute('data-source-node-id') !== blockId) continue;
    const from = attr(fragment, 'data-pm-start');
    const to = attr(fragment, 'data-pm-end');
    if (!Number.isFinite(from) || caretPm < from || (Number.isFinite(to) && caretPm > to)) continue;
    const distance = lineDistance(fragment, caretPm, caretY);
    if (!best || distance < bestDistance) {
      best = fragment;
      bestDistance = distance;
    }
  }
  return best ? { fragment: best, caretPm } : null;
}

const isPage = (el: Element | null): boolean => !!el && el.classList.contains(PAGE_CLASS);

/**
 * שני fragments באותו מכל ציור: אותו הורה, או שניהם בגוף — עמוד אחרי עמוד.
 * כותרת עליונה ותא טבלה אינם כאלה.
 */
function sameFlow(a: Element, b: Element): boolean {
  if (a.parentElement === b.parentElement) return true;
  return isPage(a.parentElement) && isPage(b.parentElement);
}

const hasRange = (el: Element): boolean => Number.isFinite(attr(el, 'data-pm-start'));

/** הבלוקים של הגוף שבעמוד — פסקאות וטבלאות — לפי הסדר. */
function pageFragments(page: Element): Element[] {
  return Array.from(page.children).filter(hasRange);
}

/**
 * הבלוק הבא (או הקודם) בזרימה: האח הבא שיש לו טווח, ואם אין — הראשון בעמוד
 * הסמוך. עמוד סמוך שאין בו אף בלוק מצויר אינו „אין שכן” אלא „לא ידוע”, ולכן
 * `null` — והקצה של המסמך נבדק בנפרד.
 */
function neighbourOf(host: HTMLElement, fragment: Element, forward: boolean): Element | null {
  let el = forward ? fragment.nextElementSibling : fragment.previousElementSibling;
  while (el && !hasRange(el)) el = forward ? el.nextElementSibling : el.previousElementSibling;
  if (el) return el;

  const page = fragment.parentElement;
  if (!page || !isPage(page)) return null;
  const pages = Array.from(host.getElementsByClassName(PAGE_CLASS));
  const next = pages[pages.indexOf(page) + (forward ? 1 : -1)];
  if (!next) return null;
  const items = pageFragments(next);
  return items[forward ? 0 : items.length - 1] ?? null;
}

/**
 * האם ה-fragment הוא הקצה של המסמך בכיוון הזה: הראשון בעמוד הראשון, או
 * האחרון בעמוד האחרון — ולא רק האחרון שמצויר.
 */
function atDocumentEdge(host: HTMLElement, fragment: Element, forward: boolean): boolean {
  const page = fragment.parentElement;
  if (!page || !isPage(page)) return false;
  const pages = Array.from(host.getElementsByClassName(PAGE_CLASS));
  if (pages[forward ? pages.length - 1 : 0] !== page) return false;
  if (flag(fragment, forward ? CONTINUES_ON_NEXT : CONTINUES_FROM_PREV)) return false;
  const siblings = pageFragments(page);
  return siblings[forward ? siblings.length - 1 : 0] === fragment;
}

/** ההקשה שלנו, אבל אין לאן לזוז — נבלעת. */
export const STAY = 'stay' as const;

/** השורות של ה-fragment — ילדיו הישירים שנושאים טווח pm. */
function linesOf(fragment: Element): Element[] {
  return Array.from(fragment.children).filter(
    (child) =>
      Number.isFinite(attr(child, 'data-pm-start')) && Number.isFinite(attr(child, 'data-pm-end')),
  );
}

/**
 * השורה שהסמן בה.
 *
 * ההיסט לבדו אינו מספיק: גבול בין שתי שורות גולשות הוא **היסט אחד** ששייך
 * לשתיהן, ושתי השורות נגמרות ומתחילות באותו x. מה שמבדיל ביניהן הוא ה-y
 * שהסמן מצויר בו, ולכן הוא זה שמכריע כששתי מועמדות.
 */
function lineAt(lines: readonly Element[], caretPm: number, caretY: number): number {
  const candidates: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (caretPm >= attr(line, 'data-pm-start') && caretPm <= attr(line, 'data-pm-end')) {
      candidates.push(i);
    }
  }
  if (candidates.length <= 1) return candidates[0] ?? -1;

  let best = candidates[0]!;
  let bestGap = Infinity;
  for (const i of candidates) {
    const rect = lines[i]!.getBoundingClientRect();
    const gap = Math.abs((rect.top + rect.bottom) / 2 - caretY);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

/** היעד, וה-fragment שהוא יושב בו. */
interface Target {
  fragment: Element;
  slot: CaretSlot;
}

/**
 * השכן החזותי של הסמן: בתוך השורה, ואם אין — בשורה או בפסקה הסמוכה.
 *
 * `null` פירושו „לא שלנו”, וההקשה ממשיכה למנוע.
 */
export function findTarget(
  host: HTMLElement,
  fragment: Element,
  caretPm: number,
  caretX: number,
  caretY: number,
  toRight: boolean,
): Target | typeof STAY | null {
  const lines = linesOf(fragment);
  const index = lineAt(lines, caretPm, caretY);
  if (index < 0) return null;

  const line = lines[index]!;
  // שורה לטינית — המנוע נמדד תקין בה (17/17), ואין מה לתקן.
  if (line.getAttribute('dir') !== 'rtl') return null;

  /*
   * פסקה ריקה אינה „אין מיפוי” אלא שורה בלי חריצים פנימיים: אין בה תו לעבור,
   * והיעד הוא תמיד השכנה. מסירה למנוע כאן אינה ניטרלית — נמדד בשער שההקשה
   * שנמסרה הזיזה **בתוך** הפסקה שממנה באנו, כלומר לכיוון ההפוך (ימין
   * מ-0 הגיע ל-1, ושמאל מ-12 הגיע ל-11).
   */
  const chars = readLineChars(line);
  if (!chars && !isEmptyRange(line)) return null;

  const inside = chars ? visualTarget(caretSlots(chars, true), caretX, toRight) : null;
  if (inside) return { fragment, slot: inside };

  /* קצה השורה. „ימינה” בשורה עברית הוא אחורה לוגית, ולכן הוא מוביל לשורה
     שמעליה — ואל **סופה**, שהוא קצה שמאל שלה. */
  const forward = movesForward(toRight, true);
  const neighbour = lines[index + (forward ? 1 : -1)];
  if (neighbour) {
    const nextChars = readLineChars(neighbour);
    if (!nextChars) return null;
    const rtl = neighbour.getAttribute('dir') === 'rtl';
    const slot = edgeSlot(caretSlots(nextChars, rtl), forward, caretPm);
    return slot ? { fragment, slot } : null;
  }

  /* קצה הפסקה. השכן הוא הבלוק הבא **באותו מכל ציור** — כותרת עליונה או תא
     טבלה אינם שכנים של הסמן; העמוד הבא בגוף כן. */
  const sibling = neighbourOf(host, fragment, forward);
  if (!sibling) return atDocumentEdge(host, fragment, forward) ? STAY : null;
  if (!sameFlow(fragment, sibling)) return null;

  /* ורק פסקה שצמודה **במסמך**, ולא רק ברשימת הבורר. טבלה מצוירת כ-fragment
     בלי `data-source-node-id` (נמדד: „לפני” pm 104..114, הטבלה 115..122,
     „אחרי” 123..133), ולכן הבורר מדלג עליה והפסקה שמעבר לה נראית שכנה —
     והחץ קפץ מעל הטבלה כולה. פער בטווחים פירושו שיש משהו ביניהן, והמנוע,
     שנכנס לתא כראוי, הוא שמטפל בהקשה. המשך של אותה פסקה בעמוד הבא מתחיל
     בדיוק היכן שהקודם נגמר, ובלי הפרש. */
  const siblingId = sibling.getAttribute('data-source-node-id');
  const sameBlock = siblingId !== null && siblingId === fragment.getAttribute('data-source-node-id');
  /* פסקה ריקה תופסת מקום pm נוסף **אחריה**. נמדד: „לפני הריקה 4” 1..13,
     הריקה 14..14, „אחרי הריקה 5” 16..28 — כלומר הפרש 1 אחרי פסקה עם תוכן,
     והפרש 2 אחרי ריקה. בלי זה הריקה נראית כמו „יש משהו ביניהן”. */
  const earlier = forward ? fragment : sibling;
  const gap = sameBlock ? 0 : isEmptyRange(earlier) ? 2 : 1;
  const contiguous = forward
    ? attr(sibling, 'data-pm-start') === attr(fragment, 'data-pm-end') + gap
    : attr(fragment, 'data-pm-start') === attr(sibling, 'data-pm-end') + gap;
  if (!contiguous) return null;

  /* בלוק בלי מזהה — טבלה: היעד הוא הפסקה הראשונה בה, או האחרונה. */
  if (siblingId === null) {
    const inner = Array.from(sibling.querySelectorAll('[data-source-node-id]')).filter((el) => linesOf(el).length > 0);
    const cell = inner[forward ? 0 : inner.length - 1];
    if (!cell) return null;
    const cellLines = linesOf(cell);
    const cellLine = forward ? cellLines[0] : cellLines[cellLines.length - 1];
    if (!cellLine) return null;
    const cellChars = readLineChars(cellLine);
    if (!cellChars) return null;
    const slot = edgeSlot(caretSlots(cellChars, cellLine.getAttribute('dir') === 'rtl'), forward, caretPm);
    return slot ? { fragment: cell, slot } : null;
  }

  const siblingLines = linesOf(sibling);
  const edgeLine = forward ? siblingLines[0] : siblingLines[siblingLines.length - 1];
  if (!edgeLine) return null;
  const edgeChars = readLineChars(edgeLine);
  const rtl = edgeLine.getAttribute('dir') === 'rtl';
  // שכנה ריקה: החריץ היחיד שלה הוא ההיסט שלה עצמה.
  const slot = edgeChars
    ? edgeSlot(caretSlots(edgeChars, rtl), forward, caretPm)
    : emptyLineSlot(edgeLine, rtl);
  return slot ? { fragment: sibling, slot } : null;
}

/* ------------------------------------------------------------------ */
/* היירוט                                                               */
/* ------------------------------------------------------------------ */

/** מתקין את היירוט. אין לו מצב, והוא נפרק עם המסמך. */
export function installRtlVisualArrows({ host, superdoc }: RtlCaretOptions): RtlCaretHandle {
  if (!host) return { dispose() {} };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isHorizontalArrow(event)) return;

    const editor = superdoc?.activeEditor;
    const setSelectionTarget = editor?.authoring?.setSelectionTarget;
    const readSnapshot = editor?.host?.readLiveSelectionSyncSnapshot;
    if (typeof setSelectionTarget !== 'function' || typeof readSnapshot !== 'function') return;

    /* בלי try/catch: נמדד (17.9.2026, superdoc 2.15.0) שהקריאה אינה זורקת —
       מאות קריאות בסמן מכווץ, בבחירה שאינה מכווצת ואחרי כתיבה. מה שהיא כן
       עושה הוא להחזיר `selectionTarget: null`, וזה מטופל למטה. */
    const snapshot: LiveSelectionSnapshot | null | undefined = readSnapshot.call(editor?.host);

    const selection = snapshot?.selectionTarget;
    const head = selection?.end;
    if (!head || head.kind !== 'text' || typeof head.blockId !== 'string') return;
    if (typeof head.offset !== 'number') return;

    const caretRect = host.querySelector(CARET_SELECTOR)?.getBoundingClientRect();
    if (!caretRect) return;
    const caretY = (caretRect.top + caretRect.bottom) / 2;

    const home = findFragment(host, head.blockId, head.offset, caretY);
    if (!home) return;

    const target = findTarget(
      host,
      home.fragment,
      home.caretPm,
      caretRect.left,
      caretY,
      event.key === 'ArrowRight',
    );
    if (!target) return;

    const swallow = (): void => {
      // מכאן ואילך זה שלנו: המנוע לא יראה את ההקשה.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    if (target === STAY) {
      swallow();
      return;
    }

    // צמצום טיפוס: כל ארבעת המסלולים ב-`findTarget` מחזירים fragment שנבחר
    // **לפי** התכונה הזאת, ולכן היא קיימת; `getAttribute` עדיין מחזיר null.
    const blockId = target.fragment.getAttribute('data-source-node-id');
    if (!blockId) return;

    /* ‏`NaN` כשהחלק הראשון של הפסקה אינו מצויר — היעד הוא המשך של פסקה
       שהתחילה בעמוד שהמנוע לא צייר (נמדד: 3 עמודים מתוך 25), ואז אין מיפוי
       מ-pm להיסט. כמו בכל „אין מיפוי” כאן, ההקשה נמסרת למנוע. */
    const offset = target.slot.pm - blockStart(host, blockId);
    if (!Number.isFinite(offset)) return;

    /*
     * היעד הוא ההיסט שהסמן כבר עליו — ואז בולעים ולא מוסרים.
     *
     * שתי נקודות המוצא של החישוב מתעדכנות בקצב שונה: ההיסט מגיע מהתצלום
     * הסינכרוני, וה-x מהסמן ה**מצויר**. כשהציור מפגר אחרי התצלום (פער מתועד
     * — „ציור שמאחר אחרי לחיצה”) החישוב יוצא מ-x ישן ומחזיר את היעד שכבר
     * נכתב. מסירה למנוע כאן אינה ניטרלית: בפסקה שהוא מזיז בה לוגית הוא זז
     * לכיוון ההפוך — כלומר החזקת חץ ברשימה הייתה מייצרת קפיצות אחורה
     * מזדמנות. אותה הכרעה בדיוק ב-`rtl-line-end.ts` („הסמן כבר שם”), שם
     * ביטול האירוע קודם לבדיקה.
     *
     * ## והחשש ההפוך — שהבליעה תאכל הקשות בהחזקה — נמדד ונשלל
     *
     * הטענה שנבדקה: תחת autorepeat כל הקשה שמקדימה את הציור תיבלע, והמרחק
     * שהסמן עובר ייחסם בקצב הציור ולא בקצב המקשים. נמדד ב-17.9.2026 על
     * ה-dist הארוז, ב-`Input.dispatchKeyEvent` עם `autoRepeat`, בשתי פסקאות
     * — עברית רגילה ופריט רשימה (שבו המנוע זז לוגית):
     *
     *   • **אין חלון.** דגימה בכל פריים אחרי הקשה בודדת: ההיסט וה-x משתנים
     *     ב**אותה** דגימה (‏48@355.3 → 47@363 אחרי 55ms; ברשימה
     *     ‏40@349.7 → 39@356.6 אחרי 52ms). לא נצפתה ולו דגימה אחת שבה ההיסט
     *     כבר חדש וה-x עדיין ישן.
     *   • **אין בליעה.** 25 הקשות מוחזקות ב-19 וב-32 הקשות/שנייה נתנו
     *     ‏**25 קריאות `setSelectionTarget`** בכל אחת מארבע הריצות; הענף הזה
     *     לא ירה אף פעם. במדידה נפרדת 20 הקשות הזיזו את ההיסט ב-20 בדיוק,
     *     גם ב-39 הקשות/שנייה.
     *
     * כלומר הענף נשאר מה שהוא: גידור לפיגור ציור שנמדד בלחיצת עכבר, ולא
     * חסם על מהירות התנועה.
     */
    if (blockId === head.blockId && offset === head.offset) {
      swallow();
      return;
    }

    swallow();

    // ה-`story` מגיע מהתצלום — נמדד שהוא קיים גם על ה-target וגם על הקצה.
    // ברירת מחדל מומצאת הייתה נכתבת למנוע בלי שנמדד אי פעם שהיא הנכונה.
    const story = selection?.story ?? head.story;
    const coordinateSpace = selection?.coordinateSpace;
    const point: TextPoint = { kind: 'text', blockId, offset, story };

    /*
     * בלי try/catch ובלי `.catch`: נמדד מה הכתובת הפסולה ביותר עושה — כתיבה
     * ל-`blockId` שאינו קיים **אינה זורקת ואינה דוחה**, אלא מחזירה הבטחה
     * שנפתרת ב-`{ok:false, reason:'target-not-mounted'}`. זה ערוץ הכשל של
     * המנוע, ואין לו מה לעשות כאן: ההקשה כבר נבלעה, והסמן פשוט נשאר.
     */
    void setSelectionTarget.call(editor?.authoring, {
      target: {
        kind: 'selection',
        start: point,
        end: point,
        story,
        ...(typeof coordinateSpace === 'string' ? { coordinateSpace } : {}),
      },
      focus: true,
    });
  };

  host.addEventListener('keydown', onKeyDown, true);

  return {
    dispose() {
      host.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
