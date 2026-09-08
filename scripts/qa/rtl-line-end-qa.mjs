/**
 * שער רגרסיה ל„הנקודה עוברת לתחילת המסמך”.
 *
 * מה שדווח: משתמש הקליד משפט בעברית, לחץ `End` כדי לחזור לסוף השורה, הקליד
 * נקודה — ובקובץ הוורד השמור הנקודה יושבת בתחילת המסמך. השורש שנמדד
 * (superdoc 2.12.0): בפסקה עם `<w:bidi/>` המנוע מפרש `End` כ„תחילת השורה”,
 * כלומר בדיוק כמו `Home`, ולכן כל מה שמוקלד אחריו נכנס בהיסט 0.
 *
 * מה שהשער מודד, על ה-dist הארוז ובלחיצות והקשות אמיתיות:
 *
 *   1. `End` בשורה עברית גולשת מגיע לסוף השורה — היעד נגזר מהמסמך המצויר
 *      (`data-pm-end` של השורה פחות `data-pm-start` של הפסקה) ולא ממספר קשיח.
 *   2. הנקודה שמוקלדת אחרי `End` יושבת בסוף הטקסט ב-`word/document.xml`,
 *      ולא בראשו. זו הצורה שהמשתמש דיווח עליה.
 *   3. `End` פעמיים אינו מטייל לשורה הבאה.
 *   3א. המסלול שדווח מקצה לקצה על פסקה קצרה: `Home`, `End`, נקודה — והפסקה
 *      נגמרת בנקודה במקום להיפתח בה.
 *   4. `Shift+End` בוחר קדימה, מהסמן ועד סוף השורה.
 *   5. באנגלית `End` ממשיך לעשות מה שהוא עשה — היירוט אינו נוגע בשורה שאינה
 *      עברית.
 *   6. `Ctrl+End` עדיין מגיע לסוף המסמך.
 *
 * שימוש:  CHROME=<path> node scripts/qa/rtl-line-end-qa.mjs   (QA_PORT דורס 9371)
 */
import { openApp, createReport } from './harness.mjs';
import { buildDocx, p } from './docx-fixtures.mjs';

const RTL = '<w:bidi/>';
/** פסקה עברית שגולשת לשתי שורות מצוירות. */
const HEB =
  'אמר רבי חנינא לא מצאתי לגוף טוב אלא שתיקה וכל המרבה דברים מביא חטא והנה זה כלל גדול בתורה ואין לך דבר שעומד בפני התשובה ולכן צריך אדם לפשפש במעשיו';
/** פסקה קצרה בת שורה אחת — המסמך שהמשתמש תיאר. */
const SHORT = 'משפט קצר בעברית';
const ENG = 'the quick brown fox jumps over the lazy dog and keeps running across the wide field';

const report = createReport('„הנקודה עוברת לתחילת המסמך” — End בשורה עברית', { strict: true });
const app = await openApp({ name: 'rtl-line-end', port: Number(process.env.QA_PORT ?? 9371) });

async function openDocx(buffer, name) {
  const dataUrl =
    'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' +
    Buffer.from(buffer).toString('base64');
  await app.js(
    `window.__qaHost.replies['fs.pickUserFile']=function(){return Promise.resolve({success:true,error:null,` +
      `data:{token:'tok-${name}',url:${JSON.stringify(dataUrl)},name:${JSON.stringify(name + '.docx')},size:${buffer.length},access:'readwrite'}})}`,
  );
  await app.tab('קובץ');
  await app.click('פתח קובץ', { after: 2500 });
  // הכפתור ברצועה פותח את מסך „פתח מסמך”; הבורר יושב מאחורי „עיון בקבצים…”.
  await app.js("document.querySelector('.open-browse')?.scrollIntoView({ block: 'center' })");
  await app.clickSel('.open-browse', 0, { after: 12000 });
  return app.js("document.querySelector('.doc-title-input')?.value");
}

/** השורות המצוירות, עם טווח ה-pm וההיסט שלהן בתוך הפסקה. */
const paintedLines = () =>
  app
    .js(
      `(function(){
        var out = [];
        Array.prototype.forEach.call(document.querySelectorAll('[data-source-node-id][data-pm-start]'), function(frag){
          var base = Number(frag.getAttribute('data-pm-start'));
          Array.prototype.forEach.call(frag.children, function(line){
            var s = Number(line.getAttribute('data-pm-start')), e = Number(line.getAttribute('data-pm-end'));
            if (!isFinite(s) || !isFinite(e)) return;
            var r = line.getBoundingClientRect();
            out.push({ blockId: frag.getAttribute('data-source-node-id'), base: base,
              startOffset: s - base, endOffset: e - base, rtl: line.getAttribute('dir') === 'rtl',
              text: (line.textContent || '').slice(0, 18),
              x: Math.round((r.left + r.right) / 2), y: Math.round((r.top + r.bottom) / 2) });
          });
        });
        return JSON.stringify(out);
      })()`,
    )
    .then(JSON.parse);

const selection = () =>
  app
    .js(
      `(async function(){
        var doc = window.__otzariaEditor.superdoc.activeEditor.doc;
        var info = await doc.selection.current();
        var t = info && info.selectionTarget;
        return JSON.stringify({ empty: !!(info && info.empty), block: t && t.start && t.start.blockId,
          start: t && t.start && t.start.offset, end: t && t.end && t.end.offset });
      })()`,
    )
    .then(JSON.parse);

/** טקסט הפסקה כפי שהוא ב-docx המיוצא — ההוכחה שהמשתמש רואה. */
async function paragraphText(index) {
  const xml = (await app.docx())['word/document.xml'] || '';
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return (paragraphs[index] || '').replace(/<[^>]+>/g, '');
}

async function caretAt(line) {
  await app.clickAt(line.x, line.y);
  await app.sleep(500);
  return selection();
}

try {
  const opened = await openDocx(
    buildDocx({ body: p(HEB, RTL) + p(SHORT, RTL) + p(ENG) }),
    'rtl-line-end',
  );
  if (opened !== 'rtl-line-end') {
    report.fail('פתיחת המסמך', `שם המסמך אחרי הפתיחה: ${opened}`);
  } else {
    const lines = await paintedLines();
    const hebrew = lines.filter((l) => l.rtl);
    const latin = lines.filter((l) => !l.rtl);
    console.log('שורות מצוירות:', JSON.stringify(lines.map(({ text, rtl, startOffset, endOffset }) => ({ text, rtl, startOffset, endOffset }))));

    if (hebrew.length < 2) {
      report.fail('הפסקה העברית גולשת לשתי שורות', `נמצאו ${hebrew.length}`);
    } else {
      /* 1. End מגיע לסוף השורה */
      const first = hebrew[0];
      const before = await caretAt(first);
      await app.press('End', 'End', 35);
      await app.sleep(400);
      const after = await selection();
      if (after.start === first.endOffset)
        report.pass('End בשורה עברית', `${before.start} → ${after.start} (סוף השורה)`);
      else
        report.fail(
          'End בשורה עברית',
          `${before.start} → ${after.start}, וסוף השורה הוא ${first.endOffset}` +
            (after.start === first.startOffset ? ' — זו בדיוק התקלה שדווחה' : ''),
        );

      /* 2. End פעמיים אינו מטייל לשורה הבאה */
      await app.press('End', 'End', 35);
      await app.sleep(400);
      const twice = await selection();
      if (twice.start === first.endOffset) report.pass('End פעמיים', `נשאר על ${twice.start}`);
      else report.fail('End פעמיים', `זז ל-${twice.start} במקום להישאר על ${first.endOffset}`);

      /* 3. הנקודה שמוקלדת אחריו יושבת בסוף, לא בראש */
      await app.type('.');
      await app.sleep(800);
      const text = await paragraphText(0);
      if (text.startsWith('.'))
        report.fail('נקודה אחרי End', `הפסקה נפתחת בנקודה: ${JSON.stringify(text.slice(0, 24))}`);
      else if (text.slice(0, first.endOffset + 1).endsWith('.'))
        report.pass('נקודה אחרי End', `נכנסה בהיסט ${first.endOffset}, בסוף השורה`);
      else
        report.fail('נקודה אחרי End', `לא נמצאה בסוף השורה: ${JSON.stringify(text.slice(0, 40))}`);

      /* 4. המסלול שדווח, מקצה לקצה, על פסקה קצרה בת שורה אחת */
      const fresh = (await paintedLines()).filter((l) => l.rtl);
      const short = fresh.find((l) => l.blockId !== first.blockId);
      if (!short) {
        report.fail('המסלול שדווח', 'לא נמצאה פסקה עברית קצרה');
      } else {
        await caretAt(short);
        await app.press('Home', 'Home', 36);
        await app.sleep(300);
        await app.press('End', 'End', 35);
        await app.sleep(300);
        await app.type('.');
        await app.sleep(800);
        const text = await paragraphText(1);
        if (text.endsWith('.') && !text.startsWith('.'))
          report.pass('המסלול שדווח', `„${text}”`);
        else report.fail('המסלול שדווח', `הפסקה יצאה „${text}”`);
      }

      /* 5. Shift+End בוחר קדימה */
      const anchor = await caretAt(fresh[0]);
      await app.press('End', 'End', 35, 8);
      await app.sleep(400);
      const range = await selection();
      if (!range.empty && range.start === anchor.start && range.end === fresh[0].endOffset)
        report.pass('Shift+End', `${range.start}..${range.end}`);
      else
        report.fail(
          'Shift+End',
          `${range.start}..${range.end}, והעוגן היה ${anchor.start} וסוף השורה ${fresh[0].endOffset}`,
        );
    }

    /* 6. אנגלית — היירוט אינו נוגע */
    if (!latin.length) {
      report.fail('End בשורה אנגלית', 'לא נמצאה שורה שאינה עברית');
    } else {
      const line = latin[0];
      await caretAt(line);
      await app.press('End', 'End', 35);
      await app.sleep(400);
      const after = await selection();
      if (after.start === line.endOffset) report.pass('End בשורה אנגלית', `הגיע ל-${after.start}`);
      else report.fail('End בשורה אנגלית', `${after.start} במקום ${line.endOffset}`);
    }

    /* 7. Ctrl+End עדיין סוף המסמך */
    if (hebrew.length) {
      await caretAt(hebrew[0]);
      await app.press('End', 'End', 35, 2);
      await app.sleep(600);
      const last = (await paintedLines()).at(-1);
      const after = await selection();
      if (after.block === last.blockId && after.start === last.endOffset)
        report.pass('Ctrl+End', `סוף המסמך: ${after.block}:${after.start}`);
      else
        report.fail(
          'Ctrl+End',
          `${after.block}:${after.start}, וסוף המסמך הוא ${last.blockId}:${last.endOffset}`,
        );
    }
  }
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
