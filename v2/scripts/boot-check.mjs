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
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const CHROME =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT ?? 9333);
/** מכסה את BOOT_TIMEOUT_MS (15 שניות) בתוספת עלייה של המנוע. */
const OBSERVE_MS = 28_000;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}
if (!existsSync(CHROME)) {
  console.error(`לא נמצא דפדפן ב-${CHROME}. הגדירו CHROME=<נתיב>`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** לקוח CDP מינימלי מעל ה-WebSocket המובנה של Node. */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP: החיבור נכשל')), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const settle = pending.get(message.id);
    if (!settle) return;
    pending.delete(message.id);
    settle(message);
  });

  return {
    send(method, params) {
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

/**
 * מצב התוסף.
 *
 * הסימן ל„עלה” הוא כפתור „פתיחת קובץ Word” שנפתח — המעטפת פותחת אותו בשורה
 * שאחרי ה-boot בדיוק, והוא אינו תלוי בנוסח ההודעות. שורת המצב נקראת רק לתיעוד:
 * היא ממשיכה להתחלף (מסמך שנטען, „טרם נשמר”), ולכן היא סימן גרוע — נמדד, גרסה
 * ראשונה של השער נכשלה בדיוק על זה.
 */
async function probe(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(function () {
      var open = document.getElementById('open');
      var status = document.getElementById('status');
      return {
        booted: !!open && open.disabled === false,
        status: status ? status.textContent : null
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.result?.value ?? { booted: false, status: null };
}

function classify({ booted, status }) {
  if (booted) return 'booted';
  if (status?.includes('לא סיימה לאתחל')) return 'timeout';
  if (status?.includes('ממתין')) return 'waiting';
  return 'unknown';
}

/** פרופיל דפדפן לכל מצב בנפרד: דפדפן שנהרג ממשיך לכתוב לתיקייה שלו לרגע. */
const profileFor = (index) => join(tmpdir(), `otzaria-word-boot-check-${index}`);

/** ניקוי לא מפיל את השער — הוא לא מה שנבדק כאן. */
function discard(path) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* תיקיית פרופיל שנשארה ב-tmp אינה סיבה להכשיל בדיקה */
  }
}

let failures = 0;

for (const [index, testCase] of CASES.entries()) {
  const path = join(DIST, 'boot-check-tmp.html');
  const profile = profileFor(index);
  writeFileSync(path, testCase.body);
  discard(profile);

  const chrome = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `file://${path}`,
    ],
    { stdio: 'ignore' },
  );

  let outcome = 'unknown';
  let status = null;
  try {
    // המתנה לפתיחת ה-endpoint של CDP.
    let targets = null;
    for (let i = 0; i < 60 && !targets; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await response.json();
        targets = list.filter((t) => t.type === 'page' && t.url.startsWith('file://'));
        if (!targets.length) targets = null;
      } catch {
        await sleep(250);
      }
    }
    if (!targets) throw new Error('CDP לא נפתח');

    const cdp = await connect(targets[0].webSocketDebuggerUrl);
    const deadline = Date.now() + OBSERVE_MS;
    while (Date.now() < deadline) {
      const reading = await probe(cdp);
      status = reading.status;
      outcome = classify(reading);
      // 'waiting' ו-'unknown' הם מצבי ביניים; ממתינים להכרעה.
      if (outcome === 'booted' || outcome === 'timeout') break;
      await sleep(200);
    }
    cdp.close();
  } catch (error) {
    console.error(`${testCase.name}: ${error.message}`);
    failures++;
    continue;
  } finally {
    chrome.kill('SIGKILL');
    rmSync(path, { force: true });
  }
  discard(profile);

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
