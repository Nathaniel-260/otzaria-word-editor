/**
 * שער: הריצות העבריות יוצאות לקובץ עם `<w:rtl/>`.
 *
 * מה שדווח: „הנקודה שבסוף הפסקה מוצגת בתחילת השורה”. המנוע כותב ריצות עבריות
 * בלי ההצהרה, ו-Word — שקובע כיוון לפי ההצהרה ולא לפי התווים — מציב תו ניטרלי
 * בקצה ההתחלה של הפסקה. ראו engine/docx-run-direction.ts, ו-issue 4011 למעלה.
 *
 * ## למה השער הזה אינו יכול להשתמש ב-`app.docx()`
 *
 * `window.__qa.exportBase64` קורא ל-`superdoc.export` **ישירות**, ולכן הוא
 * מודד את פלט המנוע ולא את מה שנכתב לקובץ. התיקון יושב ב-`engine/export.ts`,
 * על המסלול שהשמירה עוברת בו. לכן השער כאן מיירט את ההעלאה עצמה
 * (`fetch(uploadUrl, {method:'PUT'})`) וקורא את הבייטים שנשלחו — אותם בייטים
 * בדיוק שהמשתמש מקבל בקובץ.
 *
 * וזאת גם הבקרה: אותו מסמך דרך `app.docx()` חייב לצאת **בלי** אף `w:rtl`. שער
 * ששתי הקריאות בו נותנות אותו דבר אינו מודד את השלב שלנו אלא את המנוע.
 *
 * הרצה:  node scripts/qa/rtl-run-export-qa.mjs   (QA_PORT דורס 9387)
 */
import { openApp, createReport, unzip } from './harness.mjs';
import { buildDocx } from './docx-fixtures.mjs';

const RTL = '<w:bidi/>';

/** פסקה עברית שהנקודה שלה היא ריצה בפני עצמה — הצורה שהמנוע כותב. */
const HEBREW_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:t xml:space="preserve">שלום עולם</w:t></w:r>` +
  `<w:r><w:t xml:space="preserve">.</w:t></w:r>` +
  `</w:p>`;

/** פסקה עברית מודגשת — כאן נמדדת מראת הכתב המורכב. */
const BOLD_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">כותרת מודגשת</w:t></w:r>` +
  `</w:p>`;

/** פסקה לטינית — מה שאסור לגעת בו. */
const LATIN_PARA =
  `<w:p>` +
  `<w:r><w:t xml:space="preserve">hello world</w:t></w:r>` +
  `<w:r><w:t xml:space="preserve">.</w:t></w:r>` +
  `</w:p>`;

const report = createReport('ריצות עבריות יוצאות עם w:rtl', { strict: true });
const app = await openApp({ name: 'rtl-run-export', port: Number(process.env.QA_PORT ?? 9387) });

/** מיירט את ההעלאה ושומר את הבייטים שנשלחו. */
async function captureUpload() {
  await app.js(
    `(function(){if(window.__origFetch)return;window.__origFetch=window.fetch.bind(window);` +
      `window.fetch=function(url,opts){` +
      `if(opts&&opts.method==='PUT'){` +
      `var body=opts.body;` +
      `var read=body&&body.arrayBuffer?body.arrayBuffer():Promise.resolve(null);` +
      `return read.then(function(buf){` +
      `if(buf){var b=new Uint8Array(buf),s='';for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);` +
      `window.__savedDocx=btoa(s);}` +
      `return new Response('',{status:200});});}` +
      `return window.__origFetch(url,opts);};})()`,
  );
  await app.js(
    `window.__qaHost.replies['fs.beginBinaryWrite']=function(){return Promise.resolve({success:true,error:null,` +
      `data:{writeToken:'wt-rtl',uploadUrl:'https://qa-upload.local/rtl',maxBytes:999999999}})}`,
  );
  await app.js(
    `window.__qaHost.replies['fs.commitUserFileWrite']=function(){return Promise.resolve({success:true,error:null,` +
      `data:{cancelled:false,token:'tok-rtl',name:'rtl.docx',size:1234}})}`,
  );
}

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
  await app.js("document.querySelector('.open-browse')?.scrollIntoView({ block: 'center' })");
  await app.clickSel('.open-browse', 0, { after: 12000 });
  return app.js("document.querySelector('.doc-title-input')?.value");
}

/** הפסקאות של `document.xml`: הטקסט, וכמה מריצותיהן נושאות `w:rtl`. */
function paragraphsOf(xml) {
  const body = xml.slice(xml.indexOf('<w:body'));
  return (body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((para) => {
    const pPr = (para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) ?? [''])[0];
    const runs = para.replace(pPr, '').match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
    return {
      text: (para.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join(''),
      runs: runs.length,
      rtl: runs.filter((run) => /<w:rtl\s*\/?>/.test(run)).length,
      boldCs: /<w:bCs\s*\/?>/.test(para),
    };
  });
}

try {
  await captureUpload();
  const opened = await openDocx(
    buildDocx({ body: HEBREW_PARA + BOLD_PARA + LATIN_PARA }),
    'rtl-run-export',
  );
  if (opened !== 'rtl-run-export') {
    report.fail('פתיחת המסמך', `שם המסמך אחרי הפתיחה: ${opened}`);
  } else {
    /* בקרה: פלט המנוע עצמו, לפני השלב שלנו. */
    const engine = paragraphsOf((await app.docx())['word/document.xml'] ?? '');
    const engineRtl = engine.reduce((sum, para) => sum + para.rtl, 0);
    if (engineRtl === 0) {
      report.pass('בקרה — המנוע עצמו אינו כותב w:rtl', `${engine.length} פסקאות, 0 ריצות מוצהרות`);
    } else {
      report.fail(
        'בקרה — המנוע עצמו אינו כותב w:rtl',
        `${engineRtl} ריצות כבר מוצהרות — השער אינו מודד את השלב שלנו`,
      );
    }

    /* שמירה אמיתית: הקלדה שמלכלכת את המסמך, ואז Ctrl+S. */
    const line = await app.js(
      `(function(){
        var f=document.querySelector('[data-source-node-id][data-pm-start]');
        var l=f&&f.children[0];
        if(!l) return '';
        var r=l.getBoundingClientRect();
        return JSON.stringify({x:Math.round((r.left+r.right)/2),y:Math.round((r.top+r.bottom)/2)});
      })()`,
    );
    if (!line) {
      report.fail('שמירה', 'לא נמצאה שורה מצוירת להניח בה את הסמן');
    } else {
      const { x, y } = JSON.parse(line);
      await app.clickAt(x, y);
      await app.sleep(500);
      await app.type('א');
      await app.sleep(900);
      await app.press('s', 'KeyS', 83, 2, 's');
      await app.sleep(6000);

      const saved = await app.js('window.__savedDocx || ""');
      if (!saved) {
        report.fail('שמירה', 'לא נתפסה שום העלאה — המסמך לא נשמר');
      } else {
        const parts = unzip(Buffer.from(saved, 'base64'));
        const paragraphs = paragraphsOf(parts['word/document.xml'] ?? '');
        const hebrew = paragraphs.find((para) => para.text.startsWith('שלום עולם'));
        const bold = paragraphs.find((para) => para.text.startsWith('כותרת'));
        const latin = paragraphs.find((para) => para.text.startsWith('hello'));

        if (!hebrew) report.fail('הפסקה העברית', 'לא נמצאה בקובץ שנשמר');
        else if (hebrew.rtl === hebrew.runs)
          report.pass('כל ריצות הפסקה העברית מוצהרות', `${hebrew.rtl}/${hebrew.runs}`);
        else
          report.fail(
            'כל ריצות הפסקה העברית מוצהרות',
            `${hebrew.rtl}/${hebrew.runs} — הריצה שנשארה היא זו שהנקודה בתוכה`,
          );

        if (!bold) report.fail('מראת ההדגשה', 'הפסקה המודגשת לא נמצאה');
        else if (bold.rtl > 0 && bold.boldCs)
          report.pass('מראת ההדגשה', 'ריצה מודגשת קיבלה w:rtl וגם w:bCs');
        else
          report.fail(
            'מראת ההדגשה',
            `rtl=${bold.rtl}, bCs=${bold.boldCs} — בלי bCs ההדגשה נעלמת ב-Word`,
          );

        if (!latin) report.fail('הפסקה הלטינית', 'לא נמצאה בקובץ שנשמר');
        else if (latin.rtl === 0) report.pass('הפסקה הלטינית לא נגעה', `${latin.runs} ריצות, 0 מוצהרות`);
        else report.fail('הפסקה הלטינית לא נגעה', `${latin.rtl} ריצות סומנו בטעות`);
      }
    }
  }
} finally {
  report.print();
  await app.close();
}
