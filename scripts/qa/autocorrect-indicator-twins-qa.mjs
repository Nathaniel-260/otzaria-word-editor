/**
 * שתי מילים זהות שתוקנו, והקלדה לפניהן שמזיזה את הראשונה בדיוק למקום שבו הייתה
 * השנייה. הסימון של השנייה חייב להישאר על השנייה — לא לקפוץ אל הראשונה.
 *   node scripts/qa/autocorrect-indicator-twins-qa.mjs
 */
import { openApp, createReport } from './harness.mjs';
const report = createReport('מילים זהות', { strict: true });
const app = await openApp({ name: 'acorr-twins', port: Number(process.env.QA_PORT ?? 9634) });

const wordBox = (needle, nth) =>
  app
    .js(`(function(){
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n, k = 0;
    while ((n = w.nextNode())) {
      if (!n.parentElement || !n.parentElement.closest('[data-source-node-id][data-pm-start]')) continue;
      var from = 0, i;
      while ((i = n.nodeValue.indexOf(${JSON.stringify(needle)}, from)) >= 0) {
        if (k++ === ${nth}) {
          var r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + ${JSON.stringify(needle)}.length);
          var b = r.getBoundingClientRect();
          var r1 = document.createRange(); r1.setStart(n, i); r1.setEnd(n, i + 1);
          var f = r1.getBoundingClientRect();
          return JSON.stringify({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2, fl: f.left, fr: f.right, bottom: b.bottom });
        }
        from = i + 1;
      }
    }
    return 'null';
  })()`)
    .then(JSON.parse);

async function marked(needle, nth) {
  const box = await wordBox(needle, nth);
  if (!box) return 'אין מילה בדף';
  await app.js(`(document.elementFromPoint(${box.x},${box.y})||document).dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:${box.x},clientY:${box.y}}))`);
  await app.sleep(120);
  const chip = await app.js(`(function(){var c=document.querySelector('.otzaria-acorr-chip'); if(!c||c.style.display!=='block') return 'null'; var r=c.getBoundingClientRect(); return JSON.stringify({l:r.left,r:r.right,t:r.top});})()`).then(JSON.parse);
  if (!chip) return 'אין סימון';
  const dx = Math.abs(chip.l - box.fl) + Math.abs(chip.r - box.fr);
  return dx < 3 && Math.abs(chip.t - (box.bottom - 2)) < 3 ? 'ok' : `סימון במקום שגוי dx=${dx.toFixed(1)}`;
}

try {
  await app.caret(0);
  await app.type('אאכ ');
  await app.sleep(700);
  await app.type('אאכ ');
  await app.sleep(1200);
  // 'אא"כ ' הוא 5 תווים: חמישה תווים בתחילה מזיזים את הראשונה אל ההיסט של השנייה
  await app.press('Home', 'Home', 36);
  await app.sleep(400);
  await app.type('abcde');
  await app.sleep(1200);
  const text = await app.js("document.querySelector('[data-source-node-id][data-pm-start]').textContent");
  text.startsWith('abcde') ? report.pass('ההקלדה נכנסה לתחילת הפסקה', text) : report.fail('ההקלדה נכנסה לתחילת הפסקה', text);
  for (const nth of [0, 1]) {
    const r = await marked('אא"כ', nth);
    r === 'ok' ? report.pass(`מילה זהה מס' ${nth + 1} מסומנת במקומה`) : report.fail(`מילה זהה מס' ${nth + 1} מסומנת במקומה`, r);
  }
} finally {
  report.print();
  app.close();
}
