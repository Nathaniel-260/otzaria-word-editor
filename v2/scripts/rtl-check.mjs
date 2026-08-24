/**
 * שער הכיווניות: האם **מסמך חדש** באמת נפתח מימין לשמאל, על ה-dist הארוז
 * מ-`file://`.
 *
 * למה שער ולא בדיקת יחידה: הניסיון הראשון להחיל RTL עשה זאת בפקודות ה-Ribbon
 * (`direction-rtl`, `text-align`), הן נכשלו ב-`selection-required` — לפסקה של
 * מסמך שנפתח כרגע אין עוד סמן — הכשל נבלע ב-`void`, ובדיקות היחידה שאישרו
 * ש„הפקודה נשלחה” המשיכו לעבור. מה שהיה חסר הוא מדידה על המנוע האמיתי.
 *
 * מה נמדד:
 *   1. `data-document-direction="rtl"` על שורש ה-HTML. זו אינה הצהרה קוסמטית:
 *      האפליקציה קובעת אותה **רק** כששלוש הקבלות של המנוע — docDefaults, מקטע
 *      ופסקה — חזרו בהצלחה, ומוחקת אותה בכל כשל. כלומר התכונה הזאת היא
 *      הקבלות של המנוע, במקום שאפשר לקרוא אותו מבחוץ.
 *   2. אין שורת console של „כיווניות המסמך החדש לא הוחלה” — הנוסח שהאפליקציה
 *      כותבת ללוג של אוצריא כשההחלה נכשלה חלקית.
 *
 * מה **אינו** נמדד כאן, במפורש: התוסף אינו חושף את מופע SuperDoc ל-`window`,
 * ולכן השער אינו קורא את `sectionDirection` ואת `bidi` מהמסמך בעצמו. הקריאה
 * הזאת נעשתה ידנית ב-CDP בזמן המימוש (המנוע החזיר `sectionDirection: "rtl"`
 * ו-`props: {bidi: true}`), וההחלפה שלה בשער הייתה מחייבת לפתוח את המנוע
 * ל-`window` בבנייה ארוזה — API ציבורי חדש לצורך בדיקה, שאינו שווה את המחיר.
 *
 *   npm run build && npm run check:rtl
 */
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, requireChrome, sleep } from './cdp.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const INDEX = join(DIST, 'index.html');
/** נדיב: המנוע והמסמך הריק עולים ב-~500ms ארוז, וההחלה היא אחרי onReady. */
const SETTLE_MS = 9000;

if (!existsSync(INDEX)) {
  console.error('dist/index.html אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}
requireChrome();

/** Host-דמה שעונה ל-RPC, כדי שהמעטפת תעלה בלי אוצריא. */
const STUB = `
<script>
  (function () {
    var BOOT = {
      plugin: { id: 'rtl-check', version: '0' },
      app: { version: '9.9.9', platform: 'rtl-check' },
      theme: { mode: 'light', colorScheme: {}, typography: {} },
      connectivity: { isOnline: false },
      permissions: []
    };
    window.Otzaria = {
      call: function (method) {
        if (method === 'app.getInfo') return Promise.resolve({ success: true, data: BOOT.app, error: null });
        if (method === 'app.getTheme') return Promise.resolve({ success: true, data: BOOT.theme, error: null });
        return Promise.resolve({ success: false, data: null, error: { message: 'לא נתמך: ' + method } });
      },
      on: function () {},
      off: function () {}
    };
    // console של תוסף מגיע ללוג של אוצריא; כאן הוא נאסף כדי שהשער יראה אזהרה.
    window.__rtlCheckLog = [];
    ['warn', 'error'].forEach(function (level) {
      var original = console[level];
      console[level] = function () {
        window.__rtlCheckLog.push([].map.call(arguments, String).join(' '));
        original.apply(console, arguments);
      };
    });
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));
  })();
</script>
`;

const html = readFileSync(INDEX, 'utf8');
const afterLatch = html.indexOf('</script>') + '</script>'.length;
const path = join(DIST, 'rtl-check-tmp.html');
writeFileSync(path, html.slice(0, afterLatch) + STUB + html.slice(afterLatch));

const PROBE = `(function () {
  return {
    direction: document.documentElement.getAttribute('data-document-direction'),
    status: (document.getElementById('status') || {}).textContent,
    log: window.__rtlCheckLog || []
  };
})()`;

const page = await openPage(`file://${path}`, { label: 'rtl' });
let report;
try {
  await sleep(SETTLE_MS);
  report = await page.cdp.evaluate(PROBE);
} finally {
  page.close();
  rmSync(path, { force: true });
}

const errors = [];
if (report?.direction !== 'rtl') {
  errors.push(
    `data-document-direction=${report?.direction ?? 'חסר'} — האפליקציה לא הצהירה על RTL, ` +
      'כלומר לפחות אחת מקבלות המנוע נכשלה',
  );
}
for (const line of report?.log ?? []) {
  if (line.includes('כיווניות')) errors.push(`אזהרה מהתוסף: ${line}`);
}

console.log(
  `direction=${report?.direction ?? '?'} status="${(report?.status ?? '').slice(0, 60)}"`,
);

if (errors.length) {
  for (const error of errors) console.error(`שגיאה: ${error}`);
  process.exit(1);
}
console.log('שער הכיווניות עבר: מסמך חדש נפתח RTL — docDefaults, מקטע ופסקה.');
