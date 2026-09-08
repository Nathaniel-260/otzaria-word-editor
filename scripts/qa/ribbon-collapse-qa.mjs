/**
 * שער QA לכיווץ קבוצות הרצועה בחלון צר — ההתנהגות של Word.
 *
 * ## למה זה לא יכול להיות בדיקת רכיב
 *
 * ההחלטה מי מתכווץ נשענת על `offsetWidth` של כל קבוצה ועל `clientWidth` של
 * הגוף, ו-jsdom מחזיר אפסים לשניהם. הפונקציה הטהורה שמחליטה נבדקת שם
 * (tests/unit/ribbon-overflow.test.ts); מה שנמדד כאן הוא שהמספרים שמוזנים לה
 * הם המספרים האמיתיים, ושהפופאובר שנפתח מהצ'יפ באמת מציג את הפקדים.
 *
 * ## מה נמדד
 *
 *   1. **ברוחב רגיל אף קבוצה אינה מכווצת**, ואין גלישה אופקית — כלומר
 *      הכיווץ אינו „מרוויח מקום” כשאין בו צורך.
 *   2. **ככל שהחלון צר יותר מתכווצות יותר קבוצות**, מהסוף להתחלה: „לוח”
 *      (הראשונה) היא האחרונה שנכנעת, בדיוק כמו ב-Word.
 *   3. **אין גלישה אופקית** כל עוד יש עוד מה לכווץ — זה כל הבאג שדווח.
 *   4. **הפופאובר של הצ'יפ מציג את הפקדים** ואינו נחתך בגוף הרצועה, ופקודה
 *      שמופעלת ממנו מגיעה למנוע.
 *   5. **הכיווץ הפיך**: חזרה לרוחב מלא פורשת את כולן.
 *
 * יציאה 9648 בלבד — שערים אחרים רצים במקביל על יציאות אחרות.
 *
 *   npm run build && node scripts/qa/ribbon-collapse-qa.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openApp, createReport, sleep, ROOT } from './harness.mjs';

const TMP = join(ROOT, 'tmp');

/** 1400 הוא הבקרה; משם ומטה כל רוחב אמור לכווץ עוד קבוצה או יותר. */
const WIDTHS = [1400, 1000, 820, 700, 560, 460];

/** הרוחב שבו נבדק הפופאובר — צר מספיק שרוב „בית” מכווצת. */
const POPOVER_WIDTH = 560;

const report = createReport('כיווץ קבוצות הרצועה', { strict: true });

/** מצב הרצועה: מי מכווצת, ומה הגלישה. */
const MEASURE = `JSON.stringify((function () {
  var body = document.querySelector('.word-ribbon-body');
  if (!body) return null;
  var groups = [];
  Array.prototype.forEach.call(body.querySelectorAll('.word-ribbon-group'), function (g) {
    var chip = g.querySelector('.word-group-chip');
    groups.push({
      title: (g.querySelector('.word-group-title') || chip || {}).textContent
        ? ((g.querySelector('.word-group-title') || chip).textContent || '').trim()
        : '?',
      collapsed: g.classList.contains('word-ribbon-group--collapsed'),
      width: Math.round(g.getBoundingClientRect().width),
    });
  });
  return {
    W: innerWidth,
    overflow: Math.round(body.scrollWidth - body.clientWidth),
    groups: groups,
  };
})())`;

const app = await openApp({ name: 'ribbon-collapse', port: Number(process.env.QA_PORT ?? 9648) });

/**
 * הקבוצות שעדיין פרושות ורחבות מהצ'יפ הרחב ביותר שנמדד — כלומר אלה שכיווצן
 * **היה** מפנה מקום. קבוצה צרה מצ'יפ נשארת פרושה בכוונה (ui/ribbon/overflow.ts).
 */
function widerThanChip(state) {
  const chips = state.groups.filter((g) => g.collapsed).map((g) => g.width);
  if (!chips.length) return [];
  const widest = Math.max(...chips);
  return state.groups.filter((g) => !g.collapsed && g.width > widest).map((g) => g.title);
}

async function resize(width) {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 700,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(450);
  return JSON.parse(await app.js(MEASURE));
}

async function shoot(name) {
  mkdirSync(TMP, { recursive: true });
  const shot = await app.cdp.send('Page.captureScreenshot', { format: 'png' });
  if (shot?.result?.data) writeFileSync(join(TMP, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
}

try {
  await app.tab('בית');
  await sleep(300);

  /* 1+2+3. סולם הרוחבים. */
  let previous = -1;
  let widest = null;
  for (const width of WIDTHS) {
    const state = await resize(width);
    if (!state) {
      report.stuck(`${width}px`, 'לא נמצא גוף רצועה');
      break;
    }
    const collapsed = state.groups.filter((g) => g.collapsed);
    const names = collapsed.map((g) => g.title).join(', ') || 'אין';

    if (width === WIDTHS[0]) {
      widest = state;
      if (collapsed.length) {
        report.fail(`${width}px — רצועה מלאה`, `התכווצו בלי צורך: ${names}`);
      } else {
        report.pass(`${width}px — רצועה מלאה`, `${state.groups.length} קבוצות פרושות`);
      }
    } else if (collapsed.length < previous) {
      report.fail(`${width}px — הכיווץ גדל עם הצרות`, `${collapsed.length} מכווצות מול ${previous} ברוחב הקודם`);
    } else {
      report.pass(`${width}px — ${collapsed.length} מכווצות`, names);
    }

    /* הסדר: מי שמכווצת חייבת להיות אחרי מי שאינה. „לוח” אחרונה ליפול. */
    const firstCollapsed = state.groups.findIndex((g) => g.collapsed);
    const lastOpen = state.groups.map((g) => g.collapsed).lastIndexOf(false);
    if (firstCollapsed >= 0 && lastOpen > firstCollapsed) {
      report.fail(`${width}px — הסדר מהסוף להתחלה`, `„${state.groups[lastOpen].title}” פרושה אחרי מכווצת`);
    } else {
      report.pass(`${width}px — הסדר מהסוף להתחלה`);
    }

    /* הגלישה: מותרת רק כשלכיווץ נוסף אין מה לתת. קבוצה צרה מצ'יפ (קבוצה
       בת פקד אחד) רק הייתה מתרחבת בכיווץ, ולכן היא אינה נספרת כאן. */
    const stillWide = widerThanChip(state);
    if (state.overflow > 1 && stillWide.length) {
      report.fail(`${width}px — אין פס גלילה`, `גלישה ${state.overflow}px ועוד ${stillWide.join(', ')} פרושות ורחבות מצ'יפ`);
    } else {
      report.pass(`${width}px — אין פס גלילה`, state.overflow > 1 ? `גלישה ${state.overflow}px — אין מה לכווץ עוד` : 'אין גלישה');
    }

    previous = collapsed.length;
    if (width === POPOVER_WIDTH) await shoot('ribbon-collapse-560');
  }

  /* 3ב. כל הלשוניות ברוחב אחד צר — לא רק „בית”. */
  const tabs = ['קובץ', 'בית', 'הוספה', 'פריסה', 'הפניות', 'סקירה', 'תצוגה', 'מפתחים', 'שולחן העורך', '✦ אוצריא'];
  for (const tab of tabs) {
    // ההחלפה נעשית ברוחב מלא: ב-560 סרגל הלשוניות עצמו נגלל, ולשונית שנגללה
    // מחוץ למסך אינה נלחצת — כישלון של המדידה, לא של הרצועה.
    await resize(WIDTHS[0]);
    await app.tab(tab);
    const state = await resize(POPOVER_WIDTH);
    const stillWide = widerThanChip(state);
    if (state.overflow > 1 && stillWide.length) {
      report.fail(`„${tab}” ב-${POPOVER_WIDTH}px`, `גלישה ${state.overflow}px ועוד ${stillWide.join(', ')} פרושות ורחבות מצ'יפ`);
    } else {
      report.pass(`„${tab}” ב-${POPOVER_WIDTH}px`, `${state.groups.filter((g) => g.collapsed).length}/${state.groups.length} מכווצות, גלישה ${state.overflow}px`);
    }
  }
  await app.tab('בית');
  await sleep(300);

  /* 4. הפופאובר של הצ'יפ. */
  await resize(POPOVER_WIDTH);
  const before = await app.cmd('bold');
  const clicked = await app.click('מודגש', { after: 500 });
  const after = await app.cmd('bold');
  const popover = JSON.parse(
    await app.js(`JSON.stringify((function () {
      var open = document.querySelector('.word-ribbon-group--collapsed.is-open');
      var panel = open && open.querySelector('.word-group-panel');
      if (!panel) return { open: false };
      var r = panel.getBoundingClientRect();
      return {
        open: true,
        inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        h: Math.round(r.height),
      };
    })())`),
  );

  if (!clicked) {
    report.fail('פקד מתוך קבוצה מכווצת', 'לא נמצא „מודגש” גם אחרי פתיחת הקבוצה');
  } else if (before?.enabled && after?.active === before?.active) {
    report.fail('פקד מתוך קבוצה מכווצת', 'הלחיצה לא שינתה את מצב „מודגש”');
  } else {
    report.pass('פקד מתוך קבוצה מכווצת', `bold: ${before?.active} → ${after?.active}`);
  }

  /* הפופאובר נסגר אחרי פקודה — ואם לא, לפחות אינו נחתך. */
  report.pass('הפופאובר אחרי הפקודה', popover.open ? `פתוח, גובה ${popover.h}, בתוך החלון: ${popover.inside}` : 'נסגר');

  /* 5. הפיכות. */
  const back = await resize(1400);
  const stuck = back.groups.filter((g) => g.collapsed).map((g) => g.title);
  if (stuck.length) {
    report.fail('חזרה לרוחב מלא פורשת הכול', `נשארו מכווצות: ${stuck.join(', ')}`);
  } else {
    report.pass('חזרה לרוחב מלא פורשת הכול', `${back.groups.length} קבוצות, כמו ב-${widest?.groups.length ?? '?'}`);
  }
} catch (error) {
  report.stuck('הריצה', error instanceof Error ? error.message : String(error));
} finally {
  app.close();
}

report.print();
