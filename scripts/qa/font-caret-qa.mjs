/**
 * גשש: החלפת גופן עם **סמן מכווץ** ואז הקלדה — issue #14 א׳.
 *
 * הדיווח: „כאשר אני משנה כתב הסמן לא כותב, ולאחר שתי לחיצות על העכבר הוא חוזר
 * לכתב הקודם ומאפשר לכתוב”. שער `home-font-qa` מסמן **טווח** לפני הבחירה בבורר,
 * ולכן אינו מודד את זה. כאן: סמן בסוף שורה, בחירה בבורר הגופן **בלחיצת עכבר
 * אמיתית על פריט ברשימה** (לא `selectValue`, שמזייף `mousedown`), ואז הקלדה —
 * ונבדק (1) איפה המיקוד מיד אחרי הבחירה, (2) באיזה גופן נכתב הטקסט שהוקלד,
 * (3) מה הבורר מציג אחרי שני קליקים **באותו מקום**, (4) ובאיזה גופן ממשיכים.
 *
 *   node scripts/qa/font-caret-qa.mjs
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('גופן — סמן מכווץ ואז הקלדה', { strict: true });
const app = await openApp({ name: 'font-caret', port: Number(process.env.QA_PORT ?? 9602) });

const focusInfo = () =>
  app.js(`(function(){
    var a = document.activeElement;
    return JSON.stringify({
      tag: a ? a.tagName : null,
      inEditor: !!(a && a.closest && a.closest('.ProseMirror, .superdoc, .editor-stack__host')),
    });
  })()`);

/** ה-rPr של הריצה שהטקסט שלה **מתחיל** במחרוזת (ריצות מתמזגות). */
const rPrOf = (doc, text) => {
  const body = doc.slice(doc.indexOf('<w:body'));
  const runs = body.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) || [];
  const hit = runs.find((r) => new RegExp(`<w:t[^>]*>${text}`).test(r));
  if (!hit) return null;
  const m = hit.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
  return m ? m[0] : '';
};

/** בוחר גופן בבורר הרצועה בעכבר אמיתי: קליק על התיבה, ואז קליק על הפריט. */
async function pickFontByMouse(value) {
  await app.click('גופן');
  await app.sleep(500);
  const options = await app.js(`JSON.stringify(Array.from(document.querySelectorAll('[role="option"]')).map(function(o){return o.getAttribute('data-value');}))`);
  const list = JSON.parse(options || '[]');
  const index = list.indexOf(value);
  if (index < 0) return { ok: false, list };
  await app.clickSel('[role="option"]', index);
  return { ok: true, index };
}

try {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await app.sleep(400);

  await app.caret(0);
  await app.type('abc ');
  await app.sleep(500);
  await app.tab('בית');

  const options = (await app.options('גופן')) || [];
  const current = (await app.state('גופן')).value;
  const target = options.map((o) => o.value).find((v) => v && v !== current && /David|Times|Calibri|Frank/i.test(v))
    || options.map((o) => o.value).find((v) => v && v !== current);
  console.log('גופן נוכחי:', current, '→ יעד:', target);

  const picked = await pickFontByMouse(target);
  await app.sleep(600);
  const focusAfter = JSON.parse(await focusInfo());
  console.log('אחרי הבחירה בעכבר:', JSON.stringify(picked), 'focus=', JSON.stringify(focusAfter), 'תיבה=', (await app.state('גופן')).value);
  focusAfter.inEditor
    ? report.pass('המיקוד חזר למסמך מיד אחרי הבחירה בעכבר', JSON.stringify(focusAfter))
    : report.fail('המיקוד לא חזר למסמך אחרי הבחירה — „הסמן לא כותב”', JSON.stringify(focusAfter));

  // הקלדה בלי שום קליק — בדיוק מה שהמשתמש עשה.
  await app.type('fntx');
  await app.sleep(900);
  const rpr = rPrOf((await app.docx())['word/document.xml'], 'fntx');
  console.log('rPr(fntx)=', JSON.stringify(rpr));
  rpr === null
    ? report.fail('ההקלדה אחרי הבחירה לא נכתבה כלל', 'אין ריצה fntx')
    : new RegExp(`<w:rFonts[^>]*"${target}"`).test(rpr)
      ? report.pass('הטקסט שהוקלד נכתב בגופן שנבחר', `rFonts=${target}`)
      : report.fail('הטקסט שהוקלד נכתב בגופן הישן', rpr || '(בלי rPr)');

  // שני קליקים באותו מקום (סוף השורה, על הטקסט החדש) — מה הבורר מציג?
  const rect = JSON.parse(await app.js(`(function(){
    var host = document.querySelector('.editor-stack__host'); var r = host ? host.getBoundingClientRect() : null;
    var sel = window.getSelection(); var range = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    return JSON.stringify({ x: range ? range.right : (r ? r.left + r.width/2 : 400), y: range ? range.top + range.height/2 : (r ? r.top + 80 : 300) });
  })()`));
  await app.clickAt(rect.x, rect.y);
  await app.sleep(300);
  await app.clickAt(rect.x, rect.y);
  await app.sleep(700);
  const shown = (await app.state('גופן')).value;
  console.log('הבורר אחרי שני קליקים על הטקסט החדש:', shown);
  shown === target
    ? report.pass('הבורר מציג את הגופן החדש אחרי שני קליקים על הטקסט החדש', shown)
    : report.fail('הבורר „חזר לכתב הקודם” אחרי שני קליקים', `${shown} במקום ${target}`);

  await app.press('End', 'End', 35);
  await app.type(' agn');
  await app.sleep(800);
  const rpr2 = rPrOf((await app.docx())['word/document.xml'], 'fntx');
  console.log('rPr(הריצה אחרי הקליקים)=', JSON.stringify(rpr2));
  rpr2 && new RegExp(`<w:rFonts[^>]*"${target}"`).test(rpr2)
    ? report.pass('ההקלדה אחרי הקליקים ממשיכה בגופן החדש', `rFonts=${target}`)
    : report.fail('ההקלדה אחרי הקליקים חזרה לגופן הישן', rpr2 || 'null');

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}
process.exit(report.print() > 0 ? 1 : 0);
