/**
 * מבודד את המרוץ של „החלף הכל": מה בדיוק צריך להתייצב לפני ההחלפה —
 * מניין ההתאמות, או הפרויקציה של המסמך אחרי ההקלדה.
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('מרוץ „החלף הכל"', { strict: true });
const count = (s, n) => s.split(n).length - 1;
const NEEDLE = 'zzq';

async function run(label, { sleepAfterTyping, settlePoll }) {
  const app = await openApp({ name: 'race' + label, port: Number(process.env.QA_PORT ?? 9494) });
  try {
    await app.caret(0);
    await app.type((NEEDLE + ' ').repeat(8).trim());
    await app.sleep(sleepAfterTyping);

    const res = await app.js(`(async function(){
      var E = window.__otzariaEditor, sd = E.superdoc;
      var s = (E.ui && E.ui.search) || (sd.ui && sd.ui.search);
      var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
      s.open && s.open();
      var first = (typeof s.find === 'function') ? s.find('${NEEDLE}') : s.search('${NEEDLE}');
      var trail = [first && first.total];
      if (${settlePoll}) {
        for (var i = 0; i < 40; i++) {
          await sleep(100);
          var t = s.getSnapshot().total;
          trail.push(t);
          if (t > 0 && trail[trail.length-1] === trail[trail.length-2]) break;
        }
      }
      var atReplace = s.getSnapshot().total;
      var r = await s.replaceAll('YYY');
      await sleep(800);
      return JSON.stringify({ trail: trail, atReplace: atReplace, r: r });
    })()`);
    await app.sleep(1200);
    const files = await app.docx();
    const doc = files['word/document.xml'] || '';
    const left = count(doc, NEEDLE), put = count(doc, 'YYY');
    const log = await app.log();
    console.log(`[${label}] sleepAfterTyping=${sleepAfterTyping} settlePoll=${settlePoll}`);
    console.log(`   ${res}`);
    console.log(`   → נשארו ${left}, הוחלפו ${put} מתוך 8`);
    if (log && log.length) console.log(`   לוג: ${JSON.stringify(log).slice(0, 300)}`);
    (left === 0 && put === 8) ? report.pass(label, `8/8`) : report.fail(label, `נשארו ${left}, הוחלפו ${put}`);
  } finally { app.close(); }
}

await run('א־בלי־המתנה־בלי־פולינג', { sleepAfterTyping: 0, settlePoll: false });
await run('ב־בלי־המתנה־עם־פולינג', { sleepAfterTyping: 0, settlePoll: true });
await run('ג־עם־המתנה־בלי־פולינג', { sleepAfterTyping: 1200, settlePoll: false });
await run('ד־עם־המתנה־עם־פולינג', { sleepAfterTyping: 1200, settlePoll: true });

process.exit(report.print() > 0 ? 1 : 0);
