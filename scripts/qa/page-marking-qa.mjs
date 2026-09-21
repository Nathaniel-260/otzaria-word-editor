/**
 * שער QA ממוקד: „סימון עמודים” של שולחן העורך — שהלחיצה מסמנת בפועל.
 *
 * למה שער ולא בדיקת יחידה: הלוגיקה (engine/shulchan/page-marking.ts) נבדקת
 * ב-tests/unit/shulchan-pages-print.test.ts ועברה ירוק כל הזמן — ובכל זאת
 * הכפתור נכשל אצל המשתמש בכל לחיצה, עם „לא נמצאו עמודים לסימון”. הסיבה
 * הייתה **חיווט**: `provide(PAGE_MARKING)` נמחק מ-App.vue, ל-`inject` יש
 * ברירת מחדל שה-`measure` שלה מחזיר `[]`, וכך התכונה כבתה בלי שאף בדיקה
 * תאדים. השרשרת שנשברה — כפתור → שכבה מורכבת → `[data-page-index]` ב-DOM
 * המצויר → מלבנים — קיימת רק בדפדפן אמיתי, ולכן היא נמדדת כאן.
 *
 * `success: true` אינו הוכחה: נמדדים גם הטקסט שבשורת המצב וגם המלבנים
 * המצוירים בפועל, כמו ב-page-border-overlay-qa.mjs.
 *
 * הרצה:
 *   node scripts/qa/page-marking-qa.mjs
 * יציאה 9382 בלבד — שערים מקבילים רצים על יציאות אחרות.
 */
import { openApp, createReport } from './harness.mjs';

const PORT = Number(process.env.QA_PORT ?? 9382);
const report = createReport('סימון עמודים — סימון בפועל בעורך', { strict: true });

const app = await openApp({ name: 'page-marking', port: PORT });

await app.cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await app.sleep(1200);

/** המלבנים שהשכבה ציירה, ומלבן העמוד הראשון — למדוד אותם זה מול זה. */
async function marks() {
  const raw = await app.js(`(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('.page-marking-layer__mark'));
    var items = els.map(function (el) {
      var r = el.getBoundingClientRect();
      return {
        kind: el.className.indexOf('--first') >= 0 ? 'first' : el.className.indexOf('--last') >= 0 ? 'last' : 'changed',
        left: r.left, top: r.top, width: r.width, height: r.height,
      };
    });
    items.sort(function (a, b) { return a.top - b.top; });
    var page = document.querySelector('[data-page-index]');
    var pr = page ? page.getBoundingClientRect() : null;
    return JSON.stringify({
      layer: !!document.querySelector('.page-marking-layer'),
      pages: document.querySelectorAll('[data-page-index]').length,
      count: items.length,
      items: items,
      page: pr ? { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom } : null,
    });
  })()`);
  return JSON.parse(raw);
}

/** ה-API של הבדיקה מחזיר {text, error} — הטקסט בלבד נמדד כאן. */
const status = async () => (await app.js('window.__qa.status().text')) ?? '';

try {
  await app.caret(0);
  await app.type('ראש העמוד הראשון');
  await app.press('Enter', 'Enter', 13);
  await app.type('פסקה שנייה במסמך הבדיקה');
  await app.press('Enter', 'Enter', 13);
  await app.type('סוף העמוד האחרון');
  await app.sleep(800);

  const before = await marks();
  console.log('לפני הלחיצה:', JSON.stringify(before));
  if (!before.layer) {
    // זה בדיוק הבאג שהשער הזה נולד בשבילו: השכבה כלל אינה בעץ.
    report.fail('השכבה מורכבת', '.page-marking-layer אינו ב-DOM — PageMarkingOverlay אינו מורכב ב-App.vue');
  } else if (before.count === 0) {
    report.pass('השכבה מורכבת וכבויה', `${before.pages} עמודים מצוירים, 0 סימנים לפני הלחיצה`);
  } else {
    report.fail('השכבה מורכבת וכבויה', `${before.count} סימנים צוירו לפני שנלחץ „סמן עמודים”`);
  }

  await app.tab('שולחן העורך');
  const clicked = await app.click('סמן עמודים', { after: 1500 });
  const marked = await status();
  const after = await marks();
  console.log('אחרי „סמן עמודים”:', marked, JSON.stringify(after));

  if (!clicked) {
    report.fail('לחיצה על „סמן עמודים”', 'הכפתור לא נמצא או מנוטרל בלשונית „שולחן העורך”');
  } else if (/לא נמצאו עמודים לסימון/.test(marked)) {
    report.fail('סימון עמודים', `הפעולה נכשלה: „${marked}”`);
    // שתי הצורות של `markingSummaryText`. „סומן” בנו"ן סופית ו„סומנו” בלעדיה,
    // ולכן זו תבנית אחת לכל צורה ולא קידומת משותפת שאינה קיימת.
  } else if (/^סומן עמוד אחד$/.test(marked) || /^סומנו \d+ עמודים$/.test(marked)) {
    report.pass('סימון עמודים', `שורת המצב: „${marked}”`);
  } else {
    report.fail('סימון עמודים', `שורת מצב לא צפויה: „${marked}”`);
  }

  // המדידה האמיתית: מלבנים מצוירים, לא רק הודעה.
  const inPage = (m) =>
    after.page &&
    m.width > 0 &&
    m.height > 0 &&
    m.left >= after.page.left - 2 &&
    m.left + m.width <= after.page.right + 2 &&
    m.top >= after.page.top - 2 &&
    m.top + m.height <= after.page.bottom + 2;
  const kinds = new Set(after.items.map((m) => m.kind));
  if (after.count >= 2 && kinds.has('first') && kinds.has('last') && after.items.every(inPage)) {
    report.pass('מלבנים על מילות הקצה', `${after.count} מלבנים, ראשונה ואחרונה, כולם בתוך מלבן העמוד`);
  } else {
    report.fail(
      'מלבנים על מילות הקצה',
      `צפויים לפחות 2 מלבנים (first+last) בתוך העמוד — התקבל ${after.count}: ${JSON.stringify(after.items)}`,
    );
  }

  // המילה הראשונה למעלה והאחרונה למטה — לא שני מלבנים על אותה נקודה.
  const first = after.items.find((m) => m.kind === 'first');
  const last = after.items.find((m) => m.kind === 'last');
  if (first && last && last.top > first.top) {
    report.pass('סדר המילים', `הראשונה ב-${Math.round(first.top)}px, האחרונה ב-${Math.round(last.top)}px`);
  } else {
    report.fail('סדר המילים', `הראשונה והאחרונה אינן בסדר אנכי: ${JSON.stringify({ first, last })}`);
  }

  // „בדוק עמודים” על מסמך שלא זז — התצלום נשמר ונקרא.
  const checked = await app.click('בדוק עמודים', { after: 1500 });
  const checkText = await status();
  console.log('אחרי „בדוק עמודים”:', checkText);
  if (!checked) {
    report.fail('בדיקת עמודים', 'הכפתור „בדוק עמודים” לא נמצא או מנוטרל');
  } else if (/אין סימון שמור/.test(checkText)) {
    report.fail('בדיקת עמודים', `התצלום לא נשמר: „${checkText}”`);
  } else if (/לא נמצאו עמודים שהשתנו/.test(checkText)) {
    report.pass('בדיקת עמודים', `מסמך שלא זז: „${checkText}”`);
  } else {
    report.fail('בדיקת עמודים', `שורת מצב לא צפויה: „${checkText}”`);
  }

  // „הסר סימון” — הציור יורד.
  const removed = await app.click('הסר סימון', { after: 1200 });
  const removeText = await status();
  const afterOff = await marks();
  console.log('אחרי „הסר סימון”:', removeText, JSON.stringify(afterOff));
  if (removed && afterOff.count === 0) {
    report.pass('הסרת הסימון', `„${removeText}”, 0 מלבנים ב-DOM`);
  } else {
    report.fail('הסרת הסימון', `צפויים 0 מלבנים — התקבל ${afterOff.count} („${removeText}”)`);
  }
} catch (error) {
  report.fail('ריצה', `זרק: ${error?.message}`);
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
