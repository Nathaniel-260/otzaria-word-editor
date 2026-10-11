/**
 * קובץ Word שתוסף אחר שולח (`plugin.page_opened`), בדפדפן אמיתי ועל מנוע אמיתי.
 *
 * ארבעה מצבים, והראשון הוא העיקר:
 *
 * 1. **לפני הבאנדל.** „סייר קבצים” פותח את הלשונית, ואוצריא מוסרת את האירוע
 *    מיד בסוף ה-boot — לפני שהמאזין ב-App.vue קיים. האירוע נורה כאן מתוך הדף
 *    עצמו, אחרי `plugin.boot` ולפני שהבאנדל רץ, וה-latch שב-`index.html` הוא
 *    היחיד שיכול לתפוס אותו. מה שנבדק הוא שהמסמך **נפתח עם התוכן שלו**, ולא
 *    רק שהופיע טאב.
 * 2. **כשהעורך כבר חי** — דרך המאזין החי (`__qaHost.emit`, כמו ה-SDK).
 *    המסמך הראשון מסומן כלא-שמור, ולכן השני נפתח בטאב נוסף ולא דורס אותו.
 * 3. **בלי תוכן** — `{ name, path }`, מה שהסייר שולח היום. הודעה בשורת
 *    המצב, ושום טאב לא נפתח.
 * 4. **בלי קובץ בכלל** — כפתור „לשונית חדשה” של אוצריא. שום דבר לא משתנה.
 *
 * הרצה: npm run build && node scripts/qa/received-file-qa.mjs
 */
import { openApp, createReport, sleep } from './harness.mjs';
import { buildDocx, p } from './docx-fixtures.mjs';

const PORT = Number(process.env.QA_PORT ?? 9671);
const EARLY_TEXT = 'נשלח מהסייר לפני שהעורך עלה';
const LIVE_TEXT = 'נשלח מהסייר כשהעורך כבר פתוח';

const dataUrl = (text) =>
  `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${buildDocx({ body: p(text) }).toString('base64')}`;

/*
 * אחרי הדמה של אוצריא (שיורה `plugin.boot` בעצמו) ולפני הבאנדל — כמו
 * `PluginPageLauncher.markPageReady`, שמוסר את האירועים הממתינים מיד אחרי
 * הזרקת ה-boot. ההזרקה יושבת **לפני** ה-latch בדף, ולכן הירייה ממתינה שהוא
 * ייפרס; הבאנדל הוא מודול, כלומר רץ רק אחרי סוף הפריסה. `__qaEarly` מתעד אם
 * המאזין החי כבר היה שם ברגע הירייה — אם כן, השער בודק את המסלול הלא נכון.
 */
const early = `<script>
(function fire() {
  var latch = window.__otzariaPageOpened;
  if (!latch) { setTimeout(fire, 0); return; }
  window.__qaEarly = { liveAtDispatch: latch.live };
  window.dispatchEvent(new CustomEvent('plugin.page_opened', { detail: ${JSON.stringify({
    param: { name: 'מהסייר.docx', dataUrl: dataUrl(EARLY_TEXT) },
    openedBy: 'com.example.explorer',
  })} }));
})();
</script>`;

const report = createReport('קובץ מתוסף אחר', { strict: true });
const app = await openApp({ name: 'received-file', port: PORT, extra: early });

const tabs = () => app.js('JSON.stringify([...document.querySelectorAll(".word-doctab")].map(e => e.textContent.trim()))').then(JSON.parse);
const activeTab = () => app.js('document.querySelector(".word-doctab.active")?.textContent.trim() ?? null');

async function until(predicate, ms = 20_000) {
  for (let waited = 0; waited < ms; waited += 250) {
    if (await predicate()) return true;
    await sleep(250);
  }
  return false;
}

try {
  // 1 — לפני הבאנדל
  const earlyProbe = await app.js('JSON.stringify(window.__qaEarly ?? null)').then(JSON.parse);
  earlyProbe && earlyProbe.liveAtDispatch === false
    ? report.pass('האירוע נורה לפני שהמאזין החי נרשם — כלומר רק ה-latch יכול היה לתפוס אותו')
    : report.fail('האירוע נורה לפני שהמאזין החי נרשם — כלומר רק ה-latch יכול היה לתפוס אותו', JSON.stringify(earlyProbe));

  const earlyOpened = await until(async () => (await app.screenText()).includes(EARLY_TEXT));
  earlyOpened
    ? report.pass('אירוע שנורה לפני הבאנדל נפתח, עם התוכן שלו')
    : report.fail('אירוע שנורה לפני הבאנדל נפתח, עם התוכן שלו', `על המסך: ${(await app.screenText()).slice(0, 80)}`);

  const afterEarly = await tabs();
  afterEarly.length === 1 && afterEarly[0].includes('מהסייר')
    ? report.pass('הוא החליף את המסמך הריק של העלייה, בשם שנשלח')
    : report.fail('הוא החליף את המסמך הריק של העלייה, בשם שנשלח', JSON.stringify(afterEarly));

  const earlyStatus = await app.status();
  /נפתח מתוסף אחר/.test(earlyStatus.text ?? '') && !earlyStatus.error
    ? report.pass('שורת המצב אומרת מאיפה הוא הגיע ומה „שמור” יעשה')
    : report.fail('שורת המצב אומרת מאיפה הוא הגיע ומה „שמור” יעשה', JSON.stringify(earlyStatus));

  (await app.exists('.word-doctab.active .word-doctab-dirty'))
    ? report.pass('הוא מסומן כלא-שמור — אין לו קובץ לכתוב אליו')
    : report.fail('הוא מסומן כלא-שמור — אין לו קובץ לכתוב אליו', 'אין סימון שינויים בטאב');

  // 2 — העורך חי
  await app.js(`window.__qaHost.emit('plugin.page_opened', ${JSON.stringify({
    param: { name: 'שני.docx', dataUrl: dataUrl(LIVE_TEXT) },
    openedBy: 'com.example.explorer',
  })})`);
  const liveOpened = await until(async () => (await app.screenText()).includes(LIVE_TEXT));
  const afterLive = await tabs();
  liveOpened && afterLive.length === 2 && (await activeTab())?.includes('שני')
    ? report.pass('אירוע שמגיע לעורך חי נפתח בטאב חדש ופעיל')
    : report.fail('אירוע שמגיע לעורך חי נפתח בטאב חדש ופעיל', `נפתח=${liveOpened} טאבים=${JSON.stringify(afterLive)}`);

  // 3 — בלי תוכן
  await app.js(`window.__qaHost.emit('plugin.page_opened', ${JSON.stringify({
    param: { name: 'נתיב.docx', path: 'C:\\docs\\נתיב.docx' },
    openedBy: 'com.example.explorer',
  })})`);
  const explained = await until(async () => /נתיב\.docx.*לא צירף את תוכן הקובץ/.test((await app.status()).text ?? ''), 5_000);
  const rejectedStatus = await app.status();
  explained && rejectedStatus.error && (await tabs()).length === 2
    ? report.pass('נתיב בלי תוכן — הודעת שגיאה שמסבירה, ובלי טאב')
    : report.fail('נתיב בלי תוכן — הודעת שגיאה שמסבירה, ובלי טאב', `${JSON.stringify(rejectedStatus)} טאבים=${(await tabs()).length}`);

  // 4 — בלי קובץ
  await app.js(`window.__qaHost.emit('plugin.page_opened', { source: 'newTabButton' })`);
  await sleep(1_500);
  const quietStatus = await app.status();
  (await tabs()).length === 2 && quietStatus.text === rejectedStatus.text
    ? report.pass('אירוע בלי קובץ אינו פותח דבר ואינו מציג הודעה')
    : report.fail('אירוע בלי קובץ אינו פותח דבר ואינו מציג הודעה', JSON.stringify(quietStatus));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
