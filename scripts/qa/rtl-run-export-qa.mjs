/**
 * שער: תו ניטרלי שסוגר פסקה עברית יוצא לקובץ עם RLM אחריו.
 *
 * מה שדווח: „הנקודה שבסוף הפסקה מוצגת בתחילת השורה”. תו ניטרלי אינו נושא כיוון
 * משלו, ובריצה שהמנוע כתב Word פותר אותו כשמאל-לימין ומציב אותו בקצה ההתחלה
 * של הפסקה. ראו engine/docx-neutral-mark.ts — שם גם המדידה שפסלה את הגישה
 * הקודמת (`<w:rtl/>`), ו-issue 4011 למעלה.
 *
 * ## למה השער הזה אינו יכול להשתמש ב-`app.docx()`
 *
 * `window.__qa.exportBase64` קורא ל-`superdoc.export` **ישירות**, ולכן הוא
 * מודד את פלט המנוע ולא את מה שנכתב לקובץ. התיקון יושב ב-`engine/export.ts`,
 * על המסלול שהשמירה עוברת בו. לכן השער כאן מיירט את ההעלאה עצמה
 * (`fetch(uploadUrl, {method:'PUT'})`) וקורא את הבייטים שנשלחו — אותם בייטים
 * בדיוק שהמשתמש מקבל בקובץ.
 *
 * וזאת גם הבקרה: אותו מסמך דרך `app.docx()` חייב לצאת **בלי** אף RLM. שער
 * ששתי הקריאות בו נותנות אותו דבר אינו מודד את השלב שלנו אלא את המנוע.
 *
 * ## ומה שנמדד כאן הוא גם מה ש**לא** קורה
 *
 * שתי שורות בשער אינן על התיקון אלא על גבולותיו, והן החשובות שבו: פסקה
 * מודגשת חייבת לצאת עם ה-`rPr` שלה **כפי שהייתה** — בלי `w:rtl`, בלי `w:bCs`
 * ובלי `w:szCs` — ופסקה שיש בה מילה לועזית חייבת לצאת באותו מספר ריצות. שתיהן
 * נכשלו בגישה הקודמת, ושתיהן הן מה שהפך אותה לאובדן עיצוב. ראו את הטבלה
 * ב-`docx-neutral-mark.ts`.
 *
 * ושורה שלישית מודדת את **מראת הכתב המורכב**: ריצה שכבר מצהירה `w:rtl` —
 * הצורה של כל קובץ שנוצר ב-Word — חייבת לצאת עם `bCs`/`szCs`/`rFonts@cs`,
 * אחרת Word מצייר אותה Arial 12 לא-מודגש. נמדד.
 *
 * ובאותה שמירה נבדק גם **nsid ייחודי**: רשימה עברית שנוצרה בהקלדה ירשה את
 * ה-nsid של ההגדרה העשרונית, ו-Word הציג אותה כ-„1. 2.”.
 *
 * הרצה:  node scripts/qa/rtl-run-export-qa.mjs   (QA_PORT דורס 9387)
 */
import { openApp, createReport, unzip } from './harness.mjs';
import { buildDocx, numberingXml } from './docx-fixtures.mjs';

const RTL = '<w:bidi/>';

/** ‏U+200F, חסר רוחב. */
const RLM = '‏';

/** פסקה עברית שהנקודה שלה היא ריצה בפני עצמה — הצורה שהמנוע כותב. */
const HEBREW_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:t xml:space="preserve">שלום עולם</w:t></w:r>` +
  `<w:r><w:t xml:space="preserve">.</w:t></w:r>` +
  `</w:p>`;

/** פסקה עברית מודגשת — כאן נמדד שה-`rPr` יוצאת כמות שהיא. */
const BOLD_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">כותרת מודגשת.</w:t></w:r>` +
  `</w:p>`;

/**
 * ריצה שכבר **מצהירה** `w:rtl`, כמו בכל קובץ שנוצר ב-Word, עם הצד הלטיני
 * בלבד — בדיוק מה שנמדד יוצא מהמנוע ב-Ctrl+B. כאן נמדדת המראה.
 */
const DECLARED_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:rPr><w:rFonts w:ascii="David" w:hAnsi="David"/><w:b/><w:sz w:val="36"/><w:rtl/></w:rPr>` +
  `<w:t xml:space="preserve">כותרת מוצהרת</w:t></w:r></w:p>`;

/** משפט עברי עם מילה לועזית, כריצה אחת — כמו שהעורך כותב אותו. */
const MIXED_PARA =
  `<w:p><w:pPr>${RTL}</w:pPr>` +
  `<w:r><w:t xml:space="preserve">מילה Word בעברית.</w:t></w:r>` +
  `</w:p>`;

/**
 * הגדרת המספור של הפיקסטורה, עם `w:nsid` — כמו בתבנית של המנוע. בלעדיו אין מה
 * לשכפל, ובדיקת הייחודיות עוברת על כלום (נמדד: `nsids: []`).
 */
const NUMBERING = numberingXml().replace(
  '<w:multiLevelType w:val="hybridMultilevel"/>',
  '<w:nsid w:val="587013BA"/><w:multiLevelType w:val="hybridMultilevel"/>',
);

/** פסקה לטינית — מה שאסור לגעת בו. */
const LATIN_PARA =
  `<w:p>` +
  `<w:r><w:t xml:space="preserve">hello world</w:t></w:r>` +
  `<w:r><w:t xml:space="preserve">.</w:t></w:r>` +
  `</w:p>`;

const report = createReport('תו ניטרלי סוגר יוצא עם RLM', { strict: true });
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

/** הפסקאות של `document.xml`, וכל מה שהשער שואל עליהן. */
function paragraphsOf(xml) {
  const body = xml.slice(xml.indexOf('<w:body'));
  return (body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((para) => {
    const pPr = (para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) ?? [''])[0];
    const runs = para.replace(pPr, '').match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
    const text = (para.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('');
    return {
      text,
      plain: text.split(RLM).join(''),
      marks: (text.match(new RegExp(RLM, 'g')) ?? []).length,
      endsMarked: text.replace(/\s+$/u, '').endsWith(RLM),
      runs: runs.length,
      // מה שהגישה הקודמת הוסיפה, וכאן חייב להישאר אפס.
      rtl: runs.filter((run) => /<w:rtl\s*\/?>/.test(run)).length,
      cs: /<w:bCs\s*\/?>|<w:szCs\b|<w:iCs\s*\/?>|\sw:cs=/.test(para),
    };
  });
}

try {
  await captureUpload();
  const opened = await openDocx(
    buildDocx({ body: HEBREW_PARA + BOLD_PARA + DECLARED_PARA + MIXED_PARA + LATIN_PARA, numbering: NUMBERING }),
    'rtl-run-export',
  );
  if (opened !== 'rtl-run-export') {
    report.fail('פתיחת המסמך', `שם המסמך אחרי הפתיחה: ${opened}`);
  } else {
    /* בקרה: פלט המנוע עצמו, לפני השלב שלנו. */
    const engine = paragraphsOf((await app.docx())['word/document.xml'] ?? '');
    const engineMarks = engine.reduce((sum, para) => sum + para.marks, 0);
    if (engineMarks === 0) {
      report.pass('בקרה — המנוע עצמו אינו כותב RLM', `${engine.length} פסקאות, 0 סימנים`);
    } else {
      report.fail(
        'בקרה — המנוע עצמו אינו כותב RLM',
        `${engineMarks} סימנים כבר בפלט המנוע — השער אינו מודד את השלב שלנו`,
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
      // ‏Home לפני ההקלדה, ובכוונה: הלחיצה נופלת במרכז **תיבת השורה**, ובפסקה
      // עברית קצרה המרכז הזה יושב בשטח הריק שמשמאל לטקסט — כלומר בקצה הלוגי,
      // אחרי הנקודה. תו שנכנס שם הופך את התו המכריע האחרון לאות, והפסקה יוצאת
      // מהכלל שהשער בא למדוד: הוא היה נכשל על מיקום הסמן ולא על התיקון.
      await app.press('Home', 'Home', 36);
      await app.sleep(200);
      await app.type('א');
      await app.sleep(900);
      // רשימה עברית מזיהוי ההקלדה, בפסקה חדשה — בשביל בדיקת ה-nsid.
      await app.press('End', 'End', 35);
      await app.press('Enter', 'Enter', 13, 0, '\r');
      await app.sleep(400);
      await app.type('א) פריט', 90);
      await app.sleep(1500);
      await app.press('s', 'KeyS', 83, 2, 's');
      await app.sleep(6000);

      const saved = await app.js('window.__savedDocx || ""');
      if (!saved) {
        report.fail('שמירה', 'לא נתפסה שום העלאה — המסמך לא נשמר');
      } else {
        const parts = unzip(Buffer.from(saved, 'base64'));
        const paragraphs = paragraphsOf(parts['word/document.xml'] ?? '');
        const hebrew = paragraphs.find((para) => para.plain.includes('שלום עולם'));
        const bold = paragraphs.find((para) => para.plain.startsWith('כותרת'));
        const mixed = paragraphs.find((para) => para.plain.includes('Word'));
        const latin = paragraphs.find((para) => para.plain.startsWith('hello'));
        const declared = paragraphs.find((para) => para.plain.includes('כותרת מוצהרת'));

        /* התיקון עצמו — הבאג שדווח. */
        if (!hebrew) report.fail('הנקודה הסוגרת', 'הפסקה העברית לא נמצאה בקובץ שנשמר');
        else if (hebrew.endsMarked && hebrew.marks === 1)
          report.pass('הנקודה הסוגרת קיבלה RLM', JSON.stringify(hebrew.text));
        else
          report.fail(
            'הנקודה הסוגרת קיבלה RLM',
            `סימנים=${hebrew.marks}, בסוף=${hebrew.endsMarked} — ${JSON.stringify(hebrew.text)}`,
          );

        /* הגבול: העיצוב יוצא כמות שהוא. זו השורה שהגישה הקודמת נכשלה בה. */
        if (!bold) report.fail('העיצוב אינו נגע', 'הפסקה המודגשת לא נמצאה');
        else if (bold.endsMarked && bold.rtl === 0 && !bold.cs)
          report.pass('העיצוב אינו נגע', 'ריצה מודגשת קיבלה RLM, וה-rPr שלה כמות שהיא');
        else
          report.fail(
            'העיצוב אינו נגע',
            `בסוף=${bold.endsMarked}, rtl=${bold.rtl}, כתב-מורכב=${bold.cs} — סימון w:rtl או מראה מוחקים עיצוב ב-Word`,
          );

        /* הגבול השני: מבנה הריצות אינו משתנה. */
        if (!mixed) report.fail('הריצה אינה מפוצלת', 'הפסקה המעורבת לא נמצאה');
        else if (mixed.runs === 1 && mixed.endsMarked && mixed.rtl === 0)
          report.pass('הריצה אינה מפוצלת', `ריצה אחת, RLM בסופה: ${JSON.stringify(mixed.text)}`);
        else
          report.fail(
            'הריצה אינה מפוצלת',
            `ריצות=${mixed.runs}, בסוף=${mixed.endsMarked}, rtl=${mixed.rtl}`,
          );

        /* המראה: ריצה שכבר מצהירה rtl מקבלת את מחסנית הכתב המורכב. */
        if (!declared) report.fail('מראת הכתב המורכב', 'הפסקה המוצהרת לא נמצאה');
        else if (declared.cs) report.pass('מראת הכתב המורכב', 'ריצה מוצהרת קיבלה את התאומים');
        else
          report.fail(
            'מראת הכתב המורכב',
            'ריצה שמצהירה w:rtl יצאה בלי bCs/szCs/cs — ‏Word יצייר אותה Arial 12 לא-מודגש',
          );

        const numbering = parts['word/numbering.xml'] ?? '';
        const nsids = [...numbering.matchAll(/<w:abstractNum\b[\s\S]*?<w:nsid w:val="([^"]+)"/g)].map((m) =>
          m[1].toUpperCase(),
        );
        const hebrewList = /<w:numFmt w:val="hebrew1"/.test(numbering);
        console.log('nsid:', JSON.stringify(nsids), 'hebrew1:', hebrewList);
        if (!hebrewList) report.fail('nsid ייחודי', 'הרשימה העברית לא נכתבה — אין מה לבדוק');
        else if (nsids.length < 2)
          report.fail('nsid ייחודי', `פחות משתי הגדרות עם nsid (${nsids.length}) — הבדיקה אינה מודדת דבר`);
        else if (new Set(nsids).size === nsids.length)
          report.pass('nsid ייחודי לכל הגדרת מספור', nsids.join(','));
        else report.fail('nsid ייחודי לכל הגדרת מספור', `כפולים: ${nsids.join(',')}`);

        if (!latin) report.fail('הפסקה הלטינית לא נגעה', 'לא נמצאה בקובץ שנשמר');
        else if (latin.marks === 0 && latin.rtl === 0)
          report.pass('הפסקה הלטינית לא נגעה', `${latin.runs} ריצות, 0 סימנים`);
        else report.fail('הפסקה הלטינית לא נגעה', `סימנים=${latin.marks}, rtl=${latin.rtl}`);
      }
    }
  }
} finally {
  report.print();
  await app.close();
}
