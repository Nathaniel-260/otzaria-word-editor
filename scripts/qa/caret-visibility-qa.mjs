/**
 * שער QA: הסמן נשאר בתצוגה כשמקלידים בחלון צר.
 *
 * ## הדיווח והמדידה
 *
 * „יש בעיה בהקלדה כשהחלון קטן — לא מזיזה את הדף מצד לצד.”
 *
 * עמוד A4 הוא 794px, ומיכל הגלילה צר ממנו ברגע שהחלון יורד מתחת ל-‎~800px.
 * המיכל הוא `direction: ltr` (הצהרה על צד פס הגלילה, styles/shell.css) ולכן
 * נח על `scrollLeft = 0` — הקצה השמאלי, שבמסמך עברי הוא *סוף* השורה. נמדד
 * בחלון 600px לפני התיקון: הבחירה בתחילת השורה, הסמן על `x = 698`, התצוגה
 * נגמרת ב-600, ו-`scrollLeft` נשאר 0 מתוך 209 זמינים — גם אחרי הקלדה שנכנסה
 * ל-OOXML בפועל. כלומר המשתמש מקליד, הטקסט נשמר, ודבר מזה אינו נראה.
 *
 * ## למה זה לא יכול להיות בדיקת רכיב
 *
 * „הסמן מחוץ לתצוגה” הוא יחס בין שני מלבנים אחרי פריסה. ב-jsdom
 * `getBoundingClientRect` מחזיר אפסים ו-`scrollWidth` הוא 0 תמיד — כלומר
 * הבאג עובר שם ירוק בכל צורה שלו, וכך גם כל תיקון שבור.
 * tests/unit/caret-visibility.test.ts מודד את הנוסחה; המפגש שלה עם פריסה
 * אמיתית נמדד רק כאן.
 *
 * ## מה נמדד
 *
 * הסמן מונח בחלון רחב ורק אז החלון מוקטן — זה גם התרחיש שדווח, וגם מה
 * שמונע לחיצה על נקודה שכבר אינה על המסך. בכל צעד אחרי ההקטנה נמדד מלבן
 * הסמן מול תיבת התוכן של מיכל הגלילה.
 *
 * ושלוש בקרות, בלעדיהן השער ירוק גם על ממשק שבור:
 *
 *   1. **המצב באמת מסוכן** — `scrollWidth > clientWidth` אחרי ההקטנה. בלי
 *      זה „הסמן בתצוגה” נכון מאליו, ואינו מעיד על דבר.
 *   2. **הגלילה באמת זזה** — `scrollLeft > 0` אחרי שהסמן הגיע לתחילת השורה.
 *      זה בדיוק המספר שהיה 0 לפני התיקון.
 *   3. **חלון רחב אינו נגרר** — בלי גלישה אסור שהגלילה תזוז בכלל.
 *
 * יציאה 9650 בלבד — שערים אחרים רצים במקביל על יציאות אחרות.
 *
 *   npm run build && node scripts/qa/caret-visibility-qa.mjs
 */
import { openApp, createReport, sleep } from './harness.mjs';

/**
 * הרוחב שבו העמוד גולש. נמדד: חלון 600 נותן מאגס `clientWidth` 585 (פס
 * הגלילה האנכי גורע את ההפרש) מול עמוד של 794 — כלומר 209px גלילה זמינה.
 */
const NARROW = 600;
/** רוחב הבקרה: העמוד נכנס בשלמותו, ואין גלישה כלל. */
const WIDE = 1100;

const report = createReport('הסמן בתצוגה בחלון צר', { strict: true });

const app = await openApp({ name: 'caret-visibility', port: 9650 });

/**
 * מלבן הסמן מול תיבת התוכן של מיכל הגלילה.
 *
 * הסמן נקרא מ-`ui.selection.getAnchorRect()` ולא מה-DOM: נמדד שאלמנט הסמן
 * נהרס ונוצר מחדש בכל הקשה, ושהוא חסר במשך ‎~130ms אחריה — כלומר מדידה
 * ממנו היא מירוץ. ה-API מדווח את אותו מקום בדיוק (נמדד: 777.47 מול 777).
 *
 * `clientWidth` ולא `getBoundingClientRect().width`: פס הגלילה האנכי גורע
 * 15px, וסמן שיושב מתחתיו אינו נראה.
 */
const measure = () =>
  app
    .js(`(() => {
      const host = document.querySelector('.editor-stack__host');
      if (!host) return JSON.stringify({ error: 'אין מיכל גלילה' });
      let rect = null;
      try { rect = window.__otzariaEditor?.ui?.selection?.getAnchorRect?.() ?? null; } catch (e) { rect = null; }
      const box = host.getBoundingClientRect();
      const viewLeft = box.left + host.clientLeft;
      return JSON.stringify({
        scrollLeft: Math.round(host.scrollLeft),
        overflow: Math.round(host.scrollWidth - host.clientWidth),
        viewLeft: Math.round(viewLeft),
        viewRight: Math.round(viewLeft + host.clientWidth),
        caretLeft: rect && typeof rect.left === 'number' ? Math.round(rect.left) : null,
        caretRight: rect && typeof rect.right === 'number' ? Math.round(rect.right) : null,
        caretTop: rect && typeof rect.top === 'number' ? Math.round(rect.top) : null,
      });
    })()`)
    .then(JSON.parse);

const resize = async (width) => {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(1_200);
};

/** תיאור קצר למדידה, לשורת הדיווח. */
const where = (m) =>
  `סמן ${m.caretLeft}..${m.caretRight}, תצוגה ${m.viewLeft}..${m.viewRight}, scrollLeft ${m.scrollLeft}/${m.overflow}`;

/** האם הסמן בתוך תיבת התוכן. סבילות פיקסל אחד — עיגול תת-פיקסלי. */
const inside = (m) => m.caretLeft !== null && m.caretLeft >= m.viewLeft - 1 && m.caretRight <= m.viewRight + 1;

try {
  /* -------------------- הסמן מונח בחלון רחב -------------------- */
  await resize(WIDE);
  await app.caretPara(0);
  await sleep(300);
  await app.type('שלום עולם זהו משפט בדיקה', 25);
  await sleep(700);

  const wide = await measure();
  if (wide.overflow <= 0) {
    report.pass('בקרה 3 — בחלון רחב אין גלישה', where(wide));
    if (wide.scrollLeft === 0) report.pass('בקרה 3 — והגלילה לא זזה', `scrollLeft ${wide.scrollLeft}`);
    else report.fail('בקרה 3 — הגלילה זזה בלי סיבה', where(wide));
  } else {
    report.fail('בקרה 3 — חלון רחב אמור להכיל את העמוד', where(wide));
  }

  /* -------------------- ההקטנה -------------------- */
  await resize(NARROW);
  const narrow = await measure();
  if (narrow.overflow > 0) report.pass('בקרה 1 — אחרי ההקטנה יש גלישה אופקית', `${narrow.overflow}px`);
  else report.fail('בקרה 1 — אין גלישה, והמדידה שאחריה חסרת משמעות', where(narrow));

  /* -------------------- הקלדה בחלון הצר -------------------- */
  /*
   * ההקלדה נמשכת עד ש**השורה גולשת**, ולא מספר צעדים שרירותי: בעברית
   * ההקלדה מזיזה את הסמן שמאלה, כלומר *פנימה*, ולכן שורה אחת אינה מבחינה
   * בין תקין לשבור. נמדד — סבב מוטציה על המודול השאיר את הצעד הזה ירוק.
   * מה שכן מבחין הוא הרגע שבו הטקסט עובר לשורה הבאה והסמן קופץ בחזרה לקצה
   * הימני. הגלישה מזוהה לפי `top` של הסמן, שיורד בדיוק אז.
   */
  const firstLineTop = (await measure()).caretTop;
  let broke = null;
  let wrapped = null;
  for (let step = 0; step < 12 && !broke && !wrapped; step += 1) {
    await app.type('ועוד מילים ', 25);
    await sleep(500);
    const m = await measure();
    if (!inside(m)) broke = `בצעד ${step + 1}: ${where(m)}`;
    else if (m.caretTop !== null && firstLineTop !== null && m.caretTop > firstLineTop) wrapped = where(m);
  }
  if (broke) report.fail('הקלדה בחלון צר — הסמן יצא מהתצוגה', broke);
  else if (wrapped) report.pass('גלישת שורה בחלון צר — הסמן נשאר בתצוגה', wrapped);
  else report.fail('הקלדה בחלון צר — השורה לא גלשה, והמדידה אינה מבחינה', where(await measure()));

  /* -------------------- שורה חדשה: הסמן קופץ לתחילת השורה -------------------- */
  /*
   * זה המקרה החמור, ולא הקצה: `Enter` בעברית מחזיר את הסמן לקצה **הימני**
   * של עמודת הטקסט — הנקודה שנמדדה על `x = 698` מול תצוגה שנגמרת ב-600.
   * אחרי `Enter` הפסקה ריקה, ולכן תו אחד מספיק כדי שיהיה מה למדוד.
   */
  await app.press('Enter', 'Enter', 13);
  await sleep(600);
  await app.type('א', 60);
  await sleep(700);

  const fresh = await measure();
  if (inside(fresh)) report.pass('שורה חדשה — הסמן בתחילת השורה נראה', where(fresh));
  else report.fail('שורה חדשה — הסמן בתחילת השורה מחוץ לתצוגה', where(fresh));

  if (fresh.scrollLeft > 0) report.pass('בקרה 2 — הגלילה האופקית אכן זזה', `scrollLeft ${fresh.scrollLeft}/${fresh.overflow}`);
  else report.fail('בקרה 2 — הגלילה נשארה באפס', where(fresh));

  /* -------------------- הטקסט באמת נכתב -------------------- */
  const files = await app.docx();
  const body = files['word/document.xml'] ?? '';
  if (body.includes('ועוד מילים')) report.pass('הטקסט שהוקלד נכתב למסמך', 'נמצא ב-word/document.xml');
  else report.fail('הטקסט שהוקלד לא הגיע למסמך', 'אין „ועוד מילים” ב-word/document.xml');

  const log = await app.log();
  const noise = log.filter((line) => !line.includes('reader.addContextMenuItem'));
  if (noise.length === 0) report.pass('אין שגיאות בדף', `${log.length} שורות, כולן ידועות`);
  else report.fail('שגיאות בדף', noise.join(' | '));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
