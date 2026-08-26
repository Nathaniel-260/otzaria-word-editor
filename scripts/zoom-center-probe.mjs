/**
 * שער חי על מרכוז העמוד בזום — התלונה שהתיקון נולד ממנה היא ויזואלית, ולכן
 * גם הבדיקה מודדת פיקסלים ומצלמת מסך.
 *
 * שלושת המצבים שנמדדים, כולם בחלון קבוע 1440×900:
 *
 *   1. **הקטנה (60%)** — העמוד קטן מהמאגס וחייב להיות ממורכז. זה המצב
 *      שהתגלה ראשון: המנוע מציב `transform-origin: left top`, והתוכן ברח
 *      אל מחוץ למסך.
 *   2. **הגדלה שנכנסת (150%)** — העמוד גדל אך עדיין צר מהמאגס, וגם כאן הוא
 *      חייב להישאר ממורכז. בלי התיקון מרכזו סוטה ב-199px, כי `margin: 0 auto`
 *      של המנוע קורס לאפס ברגע שקופסת הפריסה צרה מהעמוד.
 *   3. **הגדלה שגולשת (300%)** — העמוד רחב מהמאגס. „ממורכז” כבר אינו הגדרה,
 *      והדרישה היא שתחילת השורה תישאר בהישג יד: הקצה הימני של העמוד יושב על
 *      הקצה הימני של המאגס, ושני הקצוות נגישים בגלילה.
 *
 * הרקע המלא בהערות של engine/zoom-center.ts ו-styles/shell.css.
 *
 *   npm run build && node scripts/zoom-center-probe.mjs
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, requireChrome } from './cdp.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TMP = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp');
const OBSERVE_MS = 40_000;

/** חלון קבוע: הענף „נכנס/גולש” תלוי ברוחב, ובדיקה שאינה קובעת אותו אינה בדיקה. */
const VIEWPORT = { width: 1440, height: 900 };

/** רוחב פס גלילה ושולי עימוד. מעבר לכך זו כבר „בריחה הצידה”. */
const TOLERANCE = 24;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}
requireChrome();
mkdirSync(TMP, { recursive: true });

const STUB = `<script>
  window.Otzaria = {
    call: function (method) {
      if (method === 'app.getInfo') return Promise.resolve({ success: true, data: { version: '9', platform: 'p' }, error: null });
      if (method === 'app.getTheme') return Promise.resolve({ success: true, data: { mode: 'light', colorScheme: {}, typography: {} }, error: null });
      return Promise.resolve({ success: false, data: null, error: { message: 'no' } });
    },
    on: function () {},
    off: function () {}
  };
</script>`;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const latchEnd = html.indexOf('</script>') + '</script>'.length;
const path = join(DIST, 'center-tmp.html');
writeFileSync(path, html.slice(0, latchEnd) + STUB + html.slice(latchEnd));

/**
 * מודדת את העמוד מול תיבת התוכן של מיכל הגלילה, ובודקת נגישות בקצוות: גלילה
 * עד הסוף לכל צד ומדידה מה נראה שם. גלישה מעבר לקצה ההתחלה של מיכל גלילה
 * אינה נכנסת לאזור הגלילה, ולכן „נגיש” אינו נובע מ„קיים”.
 */
const MEASURE = `(async () => {
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const host = q('.editor-stack__host');
  const page = q('.superdoc-page');
  const wrapper = q('.presentation-editor');
  if (!host || !page || !wrapper) return null;

  const edges = () => {
    const b = page.getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) };
  };

  // תיבת התוכן של המיכל: ב-RTL פס הגלילה האנכי יושב בצד שמאל, ולכן ההתחלה
  // היא הקצה הימני של קופסת הגבול והסוף מוסט פנימה ברוחב פס הגלילה.
  const box = host.getBoundingClientRect();
  const view = { right: Math.round(box.right), left: Math.round(box.right - host.clientWidth) };

  const rest = edges();
  host.scrollLeft = 99999; await settle(200); const atStart = edges();
  host.scrollLeft = -99999; await settle(200); const atEnd = edges();
  host.scrollLeft = 0; await settle(200);

  const cs = getComputedStyle(wrapper);
  return {
    view,
    rest,
    atStart,
    atEnd,
    origin: cs.transformOrigin,
    wrapperLayoutWidth: wrapper.offsetWidth,
  };
})()`;

const READY = `(async () => {
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + ${OBSERVE_MS};
  while (Date.now() < deadline) {
    if (document.querySelector('.word-tab-strip') && window.__otzariaEditor) break;
    await settle(250);
  }
  const sd = window.__otzariaEditor && window.__otzariaEditor.superdoc;
  if (!sd) return false;
  while (Date.now() < deadline) {
    if (sd.ui && sd.ui.commands.get('zoom').getState().enabled) break;
    await settle(250);
  }
  await settle(1500);
  return true;
})()`;

async function screenshot(cdp, file) {
  const response = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const data = response?.result?.data;
  if (!data) {
    console.error(`לא ניתן לצלם (${file})`);
    return;
  }
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`📷 ${file}`);
}

let failures = 0;

function check(ok, message) {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures += 1;
}

let page;
try {
  page = await openPage(`file://${path}`, { label: 'center' });
  await page.cdp.send('Emulation.setDeviceMetricsOverride', {
    ...VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  if (!(await page.cdp.evaluate(READY))) throw new Error('האתחול לא הושלם');

  for (const percent of [100, 60, 150, 300]) {
    await page.cdp.evaluate(`window.__otzariaEditor.superdoc.setZoom(${percent})`);
    await new Promise((r) => setTimeout(r, 1500));
    await screenshot(page.cdp, join(TMP, `zoom-center-${percent}.png`));

    const m = await page.cdp.evaluate(MEASURE);
    if (!m) {
      console.error(`✗ ${percent}%: לא נמדד עמוד`);
      failures += 1;
      continue;
    }
    console.log(`\n${percent}%: ${JSON.stringify(m)}`);

    const viewWidth = m.view.right - m.view.left;
    const viewCenter = (m.view.right + m.view.left) / 2;
    const pageCenter = (m.rest.right + m.rest.left) / 2;

    if (m.rest.width <= viewWidth) {
      const drift = Math.abs(pageCenter - viewCenter);
      check(drift <= TOLERANCE, `${percent}%: העמוד נכנס למאגס וממורכז (סטייה ${Math.round(drift)}px)`);
    } else {
      // גולש: הקצה הימני על הקצה הימני של המאגס, כדי שכל הגלישה תצא שמאלה —
      // לשם אפשר לגלול. הצמדה הפוכה הייתה מסתירה את תחילת השורה לצמיתות.
      const pinned = Math.abs(m.rest.right - m.view.right);
      check(pinned <= TOLERANCE, `${percent}%: העמוד גולש ומוצמד לקצה ההתחלה (סטייה ${Math.round(pinned)}px)`);
      check(
        Math.abs(m.atStart.right - m.view.right) <= TOLERANCE,
        `${percent}%: הקצה הימני נגיש בגלילה (${m.atStart.right} מול ${m.view.right})`,
      );
      check(
        Math.abs(m.atEnd.left - m.view.left) <= TOLERANCE,
        `${percent}%: הקצה השמאלי נגיש בגלילה (${m.atEnd.left} מול ${m.view.left})`,
      );
    }

    // ה-origin הנכון הוא הקצה הימני של קופסת הפריסה (ראו shell.css): בפיקסלים
    // זהו רוחב הפריסה של האלמנט עצמו. סטייה כאן = מישהו שינה את האנקור, וכל
    // חישוב המרכוז נשען עליו.
    const expected = m.wrapperLayoutWidth;
    const actual = Number.parseFloat(m.origin);
    check(
      Boolean(expected) && !Number.isNaN(actual) && Math.abs(actual - expected) <= 2,
      `${percent}%: transform-origin מעוגן בקצה הימני של קופסת הפריסה (${m.origin} מול ${expected}px)`,
    );
  }
} catch (error) {
  console.error(`center-probe נכשל: ${error.message}`);
  failures += 1;
} finally {
  page?.close();
  rmSync(path, { force: true });
}

process.exit(failures ? 1 : 0);
