/**
 * שער על הטולטיפ המעוצב — ui/tooltip/TooltipLayer.vue.
 *
 * למה דפדפן אמיתי ולא jsdom: כל מה שנמדד כאן אינו קיים ב-jsdom.
 *
 *   1. **`elementFromPoint`.** זה המסלול שמאתר כפתור **מנוטרל**, שאירועי עכבר
 *      אינם נשלחים אליו כלל אלא להורה שלו — ובדיוק שם הטולטיפ נושא את הסיבה
 *      („אין בחירה”). jsdom מחזיר null מכל `elementFromPoint`, ולכן בדיקה שם
 *      הייתה מאשרת בירוק בדיוק את המסלול שאינו עובד.
 *   2. **פריסה.** המיקום נמדד מ-`getBoundingClientRect`, ו-jsdom מחזיר אפסים
 *      מכולם — כלומר „הכרטיס בתוך החלון” אינו ניתן לבדיקה שם.
 *   3. **הטולטיפ המולד.** ההסרה של `title` מהעוגן הפעיל קיימת כדי שמערכת
 *      ההפעלה לא תצייר מלבן אפור מעל הכרטיס. שהתכונה חוזרת אחר כך — ולכן שם
 *      הכפתור אינו נעלם — נמדד כאן.
 *
 * הזזת העכבר היא `Input.dispatchMouseEvent` ולא `dispatchEvent` מתוך הדף:
 * אירוע מסונתז ב-JS אינו מזיז את סמן העכבר האמיתי, ולכן `elementFromPoint` היה
 * נמדד על נקודה שאין בה עכבר — כלומר שוב בדיקה שאינה מודדת את המסלול.
 *
 *   npm run build && node scripts/tooltip-probe.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, requireChrome, sleep } from './cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const TMP = join(ROOT, 'tmp');

const VIEWPORT = { width: 1440, height: 900 };
const READY_MS = 40_000;

/** SHOW_DELAY_MS בקומפוננטה הוא 400. ההמתנה כאן נדיבה ואינה מודדת תזמון. */
const SETTLE_MS = 900;

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
const path = join(DIST, 'tooltip-tmp.html');
writeFileSync(path, html.slice(0, latchEnd) + STUB + html.slice(latchEnd));

const READY = `(async () => {
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + ${READY_MS};
  while (Date.now() < deadline) {
    if (document.querySelector('.word-tab-strip') && window.__otzariaEditor) break;
    await settle(250);
  }
  await settle(2000);
  return Boolean(document.querySelector('[data-tip-title]'));
})()`;

/** מרכז הפקד שהסלקטור מוצא, בקואורדינטות חלון. */
const centerOf = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    title: element.getAttribute('title'),
    disabled: element.disabled === true,
  };
})()`;

/** מה שהכרטיס מציג בפועל, ואיפה הוא. */
const TIP_STATE = `(() => {
  const tip = document.querySelector('.word-tip');
  if (!tip) return null;
  const box = tip.getBoundingClientRect();
  const text = (selector) => {
    const node = tip.querySelector(selector);
    return node ? node.textContent.trim() : null;
  };
  return {
    title: text('.word-tip__title'),
    shortcut: text('.word-tip__key'),
    description: text('.word-tip__desc'),
    rect: { top: box.top, left: box.left, width: box.width, height: box.height },
    inViewport:
      box.top >= 0 && box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
  };
})()`;

const nativeTitleOf = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  return element ? element.getAttribute('title') : null;
})()`;

/**
 * הכפתור המנוטרל הראשון שיש לו גם *הסבר* — לא סתם שם.
 *
 * „בטל”/„חזור” בפס העליון הם `disabled` בלי סיבה מוסברת (אין עדיין מה לבטל).
 * הכפתורים ש-vertAlignTooltip / tooltipFor מזינים (כתב עליון, הדבק, גזור) הם
 * המקרה שהמסלול הזה נבנה בשבילו: `disabled` **עם** `data-tip-desc` שנושא את
 * הסיבה. אינו קשיח: איזה מהם מנוטרל תלוי בזמינות המנוע ובבחירה במסמך.
 */
const DISABLED_BUTTON = `(() => {
  const buttons = Array.from(document.querySelectorAll('button[disabled][data-tip-desc]'));
  const found = buttons[0];
  if (!found) return null;
  const box = found.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    tipTitle: found.getAttribute('data-tip-title'),
    description: found.getAttribute('data-tip-desc'),
  };
})()`;

let failures = 0;

function check(ok, message) {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures += 1;
}

async function screenshot(cdp, file) {
  const response = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const data = response?.result?.data;
  if (!data) {
    console.error(`לא ניתן לצלם (${file})`);
    return;
  }
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`\u{1F4F7} ${file}`);
}

/** הזזת סמן אמיתית, ואז המתנה שההשהיה תחלוף. */
async function hover(cdp, x, y) {
  // שתי הזזות: הראשונה מוציאה את הסמן ממה שהיה תחתיו, והשנייה נחה על היעד.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 500, buttons: 0 });
  await sleep(60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(SETTLE_MS);
}

let page;
try {
  page = await openPage(`file://${path}`, { label: 'tooltip' });
  await page.cdp.send('Emulation.setDeviceMetricsOverride', {
    ...VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  if (!(await page.cdp.evaluate(READY))) throw new Error('הרצועה לא נטענה עם תכונות טולטיפ');

  /* 1. כפתור אייקון עם שלושת השדות — „מודגש”, Ctrl+B, וההסבר. */
  const bold = await page.cdp.evaluate(centerOf('button[data-tip-title="מודגש"]'));
  check(Boolean(bold), 'נמצא כפתור „מודגש” ברצועה');
  if (bold) {
    check(bold.title === 'מודגש (Ctrl+B)', `title מולד נשמר לפני הריחוף: ${bold.title}`);

    await hover(page.cdp, bold.x, bold.y);
    const tip = await page.cdp.evaluate(TIP_STATE);
    check(Boolean(tip), 'הכרטיס נפתח בריחוף');
    if (tip) {
      console.log(`   ${JSON.stringify(tip)}`);
      check(tip.title === 'מודגש', `הכותרת היא שם הפקד: ${tip.title}`);
      check(tip.shortcut === 'Ctrl+B', `הצירוף מוצג בשבשבת: ${tip.shortcut}`);
      check(tip.description === 'מעבה את הטקסט המסומן', `ההסבר מוצג מתחת: ${tip.description}`);
      check(tip.inViewport, 'הכרטיס כולו בתוך החלון');
      check(tip.rect.width > 0 && tip.rect.height > 0, 'לכרטיס יש מידות');
    }

    const suppressed = await page.cdp.evaluate(nativeTitleOf('button[data-tip-title="מודגש"]'));
    check(
      suppressed === null,
      `הטולטיפ המולד כבוי בזמן שהכרטיס מוצג (title=${JSON.stringify(suppressed)})`,
    );

    await screenshot(page.cdp, join(TMP, 'tooltip-bold.png'));

    /* 2. יציאה — הכרטיס נסגר, וה-title חוזר. */
    await page.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 720,
      y: 700,
      buttons: 0,
    });
    await sleep(600);
    check((await page.cdp.evaluate(TIP_STATE)) === null, 'הכרטיס נסגר ביציאת העכבר');
    check(
      (await page.cdp.evaluate(nativeTitleOf('button[data-tip-title="מודגש"]'))) ===
        'מודגש (Ctrl+B)',
      'ה-title המולד חזר לכפתור — שם הכפתור אינו נעלם',
    );
  }

  /* 3. כפתור גדול עם תווית והסבר נגזר — „מברשת עיצוב”. */
  const painter = await page.cdp.evaluate(centerOf('button[data-tip-title="מברשת עיצוב"]'));
  if (painter) {
    await hover(page.cdp, painter.x, painter.y);
    const tip = await page.cdp.evaluate(TIP_STATE);
    check(tip?.title === 'מברשת עיצוב', `כותרת מהתווית: ${tip?.title}`);
    check(
      tip?.description === 'העתק עיצוב ממקום אחד והחל במקום אחר',
      `ה-tooltip הקיים ירד להסבר: ${tip?.description}`,
    );
    await screenshot(page.cdp, join(TMP, 'tooltip-painter.png'));
  } else {
    console.log('… „מברשת עיצוב” לא נמצאה — הדילוג אינו כשל');
  }

  /* 4. כפתור מנוטרל — המסלול של elementFromPoint. */
  const off = await page.cdp.evaluate(DISABLED_BUTTON);
  if (off) {
    console.log(`   כפתור מנוטרל: ${off.tipTitle} / ${off.description}`);
    await hover(page.cdp, off.x, off.y);
    const tip = await page.cdp.evaluate(TIP_STATE);
    check(Boolean(tip), 'כפתור מנוטרל מקבל טולטיפ — זה המסלול של elementFromPoint');
    if (tip) {
      console.log(`   ${JSON.stringify(tip)}`);
      check(tip.title === off.tipTitle, `הכותרת נשארת שם הפקד גם כשהוא מנוטרל: ${tip.title}`);
      check(Boolean(tip.description), `הסיבה יורדת לשורת ההסבר: ${tip.description}`);
    }
    await screenshot(page.cdp, join(TMP, 'tooltip-disabled.png'));
  } else {
    console.log('… אין כפתור מנוטרל במסמך שנטען — הדילוג אינו כשל');
  }

  /* 5. Escape מסלק את הכרטיס. */
  const escape = await page.cdp.evaluate(centerOf('button[data-tip-title="נטוי"]'));
  if (escape) {
    await hover(page.cdp, escape.x, escape.y);
    check(Boolean(await page.cdp.evaluate(TIP_STATE)), 'הכרטיס פתוח לפני Escape');
    await page.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
    await sleep(200);
    check((await page.cdp.evaluate(TIP_STATE)) === null, 'Escape סוגר את הכרטיס');
  }

  /* 6. אזור המסמך אינו מקבל טולטיפ של המעטפת. */
  await page.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: VIEWPORT.width / 2,
    y: 600,
    buttons: 0,
  });
  await sleep(SETTLE_MS);
  check((await page.cdp.evaluate(TIP_STATE)) === null, 'ריחוף מעל המסמך אינו פותח כרטיס');
} catch (error) {
  console.error(`✗ ${error.message}`);
  failures += 1;
} finally {
  page?.close();
}

console.log(failures ? `\n${failures} כשלים` : '\nהכול עבר');
process.exit(failures ? 1 : 0);
