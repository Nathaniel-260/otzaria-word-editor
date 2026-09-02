/**
 * אותה שאלה של `font-focus-probe.mjs`, אבל דרך תיבת הגודל שבתפריט הלחצן הימני.
 *
 * למה זה שער נפרד ולא עוד שלב שם: הסדר הפנימי שונה. ברצועה הפקד פולט „סיימתי”
 * ו„בית” מחזירה את המיקוד **לפני** ההחלה; בכרטיס (`ContextMenuFontPicker.vue`)
 * ההחלה רצה ראשונה, ורק אחריה הכרטיס נסגר והמעטפת מחזירה מיקוד
 * (`App.vue`, `closeContextMenu`). זה בדיוק הסדר ההפוך, ומה שנמדד ברצועה אינו
 * מלמד עליו — אחד השניים עובד ואחד לא, וזה מה שנמדד כאן.
 *
 * ההקשר: Y-PLONI#14 סעיף א. \`context-menu-model.ts\` מצהיר במפורש שהמקטע
 * הזה חל גם על סמן מכווץ („הוא קובע את מה שיוקלד”), ולכן זו ההבטחה שנבדקת.
 *
 * אבחון בלבד. יציאה 9542.
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('מיקוד אחרי תיבת הגודל בתפריט ההקשר', { strict: true });
const app = await openApp({ name: 'ctx-font-focus', port: Number(process.env.QA_PORT ?? 9542) });

const note = (...p) =>
  console.log(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

const focused = () =>
  app.js(`(function () {
    var a = document.activeElement;
    if (!a) return 'null';
    var name = a.getAttribute('data-tip-title') || a.getAttribute('aria-label') || a.className || '';
    return a.tagName + (name ? '|' + name : '');
  })()`);

const xml = async () => (await app.docx())['word/document.xml'] || '';

function szOf(doc, text) {
  const body = doc.slice(doc.indexOf('<w:body'));
  const runs = body.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) || [];
  const hit = runs.find((r) => new RegExp(`<w:t[^>]*>[^<]*${text}[^<]*</w:t>`).test(r));
  if (!hit) return null;
  const sz = hit.match(/<w:sz w:val="(\d+)"/);
  return sz ? Number(sz[1]) : 0;
}

/** לחיצה ימנית אמיתית. `contextmenu` מסונתז ב-Chromium מהודעת הכפתור. */
async function rightClick(x, y) {
  await app.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await app.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await app.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await app.sleep(600);
}

const menuOpen = () => app.exists('.ctx-menu');
const boxInMenu = () =>
  app.js(`JSON.stringify(window.__qa.rect('גודל גופן', { scope: '.ctx-menu' }))`).then(JSON.parse);
const boxValueInMenu = () =>
  app.js(`(function () {
    var m = document.querySelector('.ctx-menu');
    var el = m && m.querySelector('input[role="combobox"][data-tip-title="גודל גופן"]');
    return el ? el.value : null;
  })()`);

async function waitForLines(min = 2, ms = 30_000) {
  const until = Date.now() + ms;
  for (;;) {
    const lines = Number(await app.lineCount());
    if (lines >= min) return lines;
    if (Date.now() > until) throw new Error(`המסמך לא הציג ${min} שורות בזמן (${lines})`);
    await app.sleep(500);
  }
}

try {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await app.sleep(600);
  await app.tab('בית');

  /* ===== פיקסטורה ===== */
  await app.caret(0);
  await app.type('alfa beta gama', 28);
  await app.press('Enter', 'Enter', 13);
  await app.sleep(300);
  await app.type('cola diva mila', 28);
  await app.sleep(1500);
  note('פיקסטורה:', await app.screenText(), '| שורות:', await waitForLines());

  /* ===== סמן מכווץ, ואז לחיצה ימנית באותה נקודה ===== */
  const spot = await app.caret(1);
  await app.sleep(300);
  await rightClick(spot.x, spot.y);
  const opened = await menuOpen();
  note('התפריט נפתח:', opened, '| הגודל שהתיבה בכרטיס מציגה:', await boxValueInMenu());

  if (!opened) {
    report.fail('התפריט נפתח בלחיצה ימנית', 'אין `.ctx-menu` — אי אפשר למדוד את התיבה שבו');
  } else {
    const rect = await boxInMenu();
    if (!rect) {
      report.fail('תיבת הגודל קיימת בכרטיס', 'לא נמצאה תיבה עם הטולטיפ „גודל גופן” בתוך `.ctx-menu`');
    } else {
      await app.clickAt(rect.x, rect.y);
      await app.sleep(350);
      await app.type('14');
      await app.sleep(200);
      await app.press('Enter', 'Enter', 13);
      await app.sleep(1000);

      const afterEnter = { focus: await focused(), menu: await menuOpen() };
      note('אחרי Enter — מיקוד:', afterEnter.focus, '| התפריט עדיין פתוח:', afterEnter.menu);

      const screenBefore = (await app.screenText()) || '';
      await app.type('q');
      await app.sleep(800);
      const screenAfter = (await app.screenText()) || '';
      const typedIntoDoc = screenAfter.includes('q') && screenAfter.length > screenBefore.length;
      note('אחרי הקלדת „q” — נכנס למסמך:', typedIntoDoc);
      note('  מסך:', JSON.stringify(screenBefore.slice(0, 50)), '→', JSON.stringify(screenAfter.slice(0, 50)));

      typedIntoDoc
        ? report.pass('ההקלדה אחרי הבחירה בכרטיס נכנסת למסמך', `מיקוד: ${afterEnter.focus}`)
        : report.fail('ההקלדה אחרי הבחירה בכרטיס נכנסת למסמך', `המיקוד ב-${afterEnter.focus}`);

      const szq = szOf(await xml(), 'q');
      note('sz של „q”:', szq);
      szq === 28
        ? report.pass('הגודל שהוחל מהכרטיס על סמן מכווץ שרד', 'התו שהוקלד נכתב ב-w:sz=28')
        : report.fail(
            'הגודל שהוחל מהכרטיס על סמן מכווץ שרד',
            `התו נכתב ב-${szq === null ? 'אין ריצה כזאת' : 'w:sz=' + szq}`,
          );
    }
  }

  note('שורת מצב:', await app.status());
} finally {
  app.close();
}
process.exit(report.print() > 0 ? 1 : 0);
