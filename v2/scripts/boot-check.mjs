/**
 * שער האתחול: מה קורה לתוסף כשאוצריא משגרת plugin.boot **לפני** שהבאנדל שלו
 * נטען.
 *
 * זה הכשל שנצפה בפועל — „אוצריא לא סיימה לאתחל את התוסף” בטעינה ראשונה, ותוסף
 * שעולה רק אחרי רענון. האירוע חד-פעמי ואינו משוחזר, ולכן הרשמה בזמן טעינת
 * המודול אינה מספיקה: 10MB של באנדל נטענים אחרי שהאירוע כבר נורה.
 *
 * שלושה מצבים, כולם על ה-dist האמיתי מ-file://, עם Host-דמה שמוזרק לפני app.js:
 *
 *   1. ה-latch + boot מוקדם            → התוסף עולה.
 *   2. בלי latch + boot מוקדם + RPC מת → הכשל המקורי, מילה במילה. הבקרה: בלעדיה
 *                                        אין הוכחה שה-latch הוא מה שמציל.
 *   3. בלי latch + בלי boot + RPC חי    → התוסף עולה בשחזור RPC.
 *
 * מונע דרך CDP ולא ב-`--dump-dom`: ברגע שהמנוע עולה, אירוע ה-load אינו מגיע
 * (נמדד — הדפדפן נתלה), ו-`--virtual-time-budget` נתקע מול ה-workers.
 *
 *   npm run build && npm run check:boot
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, requireChrome, sleep } from './cdp.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
/** מכסה את BOOT_TIMEOUT_MS (15 שניות) בתוספת עלייה של המנוע. */
const OBSERVE_MS = 28_000;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}
requireChrome();

/**
 * Host-דמה. `answersRpc` קובע אם `app.getInfo`/`app.getTheme` עונים — כלומר אם
 * מסלול השחזור יכול להצליח; `firesBoot` אם האירוע נורה בכלל.
 */
function stub({ firesBoot, answersRpc }) {
  return `
<script>
  (function () {
    var BOOT = {
      plugin: { id: 'boot-check', version: '0' },
      app: { version: '9.9.9', platform: 'boot-check' },
      theme: { mode: 'light', colorScheme: {}, typography: {} },
      connectivity: { isOnline: false },
      permissions: []
    };
    var answers = ${answersRpc};
    window.Otzaria = {
      call: function (method) {
        if (answers && method === 'app.getInfo') {
          return Promise.resolve({ success: true, data: BOOT.app, error: null });
        }
        if (answers && method === 'app.getTheme') {
          return Promise.resolve({ success: true, data: BOOT.theme, error: null });
        }
        return Promise.resolve({
          success: false, data: null, error: { message: 'Otzaria SDK not ready yet' }
        });
      },
      on: function () {},
      off: function () {}
    };
    if (${firesBoot}) {
      // כאן העיקר: האירוע נורה עכשיו, לפני שאף שורה מ-app.js הורצה.
      window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));
    }
  })();
</script>
`;
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const latchEnd = html.indexOf('</script>');
if (latchEnd === -1 || !html.slice(0, latchEnd).includes('__otzariaBoot')) {
  console.error('ה-latch אינו הסקריפט הראשון ב-dist/index.html — check:dist היה אמור לתפוס זאת');
  process.exit(1);
}
const afterLatch = latchEnd + '</script>'.length;
const withLatch = (injected) => html.slice(0, afterLatch) + injected + html.slice(afterLatch);
const withoutLatch = (injected) => injected + html.slice(afterLatch);

const CASES = [
  {
    name: 'ה-latch + boot מוקדם',
    body: withLatch(stub({ firesBoot: true, answersRpc: false })),
    expect: 'booted',
  },
  {
    name: 'בקרה: בלי latch, RPC מת',
    body: withoutLatch(stub({ firesBoot: true, answersRpc: false })),
    expect: 'timeout',
  },
  {
    name: 'שחזור: בלי latch ובלי boot, RPC חי',
    body: withoutLatch(stub({ firesBoot: false, answersRpc: true })),
    expect: 'booted',
  },
];

/**
 * מצב התוסף.
 *
 * הסימן ל„עלה” הוא כפתור „פתיחת קובץ Word” שנפתח — המעטפת פותחת אותו בשורה
 * שאחרי ה-boot בדיוק, והוא אינו תלוי בנוסח ההודעות. שורת המצב נקראת רק לתיעוד:
 * היא ממשיכה להתחלף (מסמך שנטען, „טרם נשמר”), ולכן היא סימן גרוע — נמדד, גרסה
 * ראשונה של השער נכשלה בדיוק על זה.
 */
async function probe(cdp) {
  return (
    (await cdp.evaluate(`(function () {
      var open = document.getElementById('open');
      var status = document.getElementById('status');
      return {
        booted: !!open && open.disabled === false,
        status: status ? status.textContent : null
      };
    })()`)) ?? { booted: false, status: null }
  );
}

function classify({ booted, status }) {
  if (booted) return 'booted';
  if (status?.includes('לא סיימה לאתחל')) return 'timeout';
  if (status?.includes('ממתין')) return 'waiting';
  return 'unknown';
}

let failures = 0;

for (const [index, testCase] of CASES.entries()) {
  const path = join(DIST, 'boot-check-tmp.html');
  writeFileSync(path, testCase.body);

  let outcome = 'unknown';
  let status = null;
  let page;
  try {
    page = await openPage(`file://${path}`, { label: `boot-${index}` });
    const deadline = Date.now() + OBSERVE_MS;
    while (Date.now() < deadline) {
      const reading = await probe(page.cdp);
      status = reading.status;
      outcome = classify(reading);
      // 'waiting' ו-'unknown' הם מצבי ביניים; ממתינים להכרעה.
      if (outcome === 'booted' || outcome === 'timeout') break;
      await sleep(200);
    }
  } catch (error) {
    console.error(`${testCase.name}: ${error.message}`);
    failures++;
    continue;
  } finally {
    page?.close();
    rmSync(path, { force: true });
  }

  const verdict = outcome === testCase.expect ? '✓' : '✗';
  console.log(`${verdict} ${testCase.name}: ${outcome} (צפוי ${testCase.expect}) — "${(status ?? '').slice(0, 80)}"`);
  if (outcome !== testCase.expect) failures++;
}

if (failures) {
  console.error(
    'שער האתחול נכשל. אם הבקרה עלתה בכל זאת — הבדיקה אינה מודדת כלום ויש לתקן ' +
      'אותה; אם מצב 1 או 3 לא עלה — התוסף יחזור להיתקע אצל המשתמש.',
  );
  process.exit(1);
}
console.log('שער האתחול עבר: boot מוקדם נתפס ב-latch, ובהיעדרו השחזור ב-RPC מרים את התוסף.');
