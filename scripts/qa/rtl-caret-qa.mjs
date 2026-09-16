/**
 * שער: חץ ימני אינו מזיז את הסמן שמאלה.
 *
 * זו התכונה היחידה שהמשתמש מרגיש, וזו שהייתה שבורה: המנוע בוחר מודל כיוון
 * לכל פסקה בנפרד, ולכן אותו מקש עשה שני דברים הפוכים בשתי פסקאות סמוכות.
 * העקיפה יושבת ב-`src/engine/rtl-caret.ts`, וההסבר המלא שם.
 *
 * ## מה נבדק, ולמה דווקא כך
 *
 * לא „ההיסט ירד ב-1” אלא **ה-x המצויר של הסמן**. ההיסט הוא מודל פנימי; מה
 * שהמשתמש רואה הוא לאן הסמן זז על המסך, ובשורה דו-כיוונית השניים אינם אותו
 * דבר. לכן האינוריאנטה נמדדת על הציור:
 *
 *   `ArrowRight` לעולם אינו מקטין את x, ו-`ArrowLeft` לעולם אינו מגדיל אותו.
 *
 * והיא נכונה גם בעברית וגם בלטינית — ולכן פסקה לטינית היא בקרה אמיתית כאן
 * ולא מקרה נפרד.
 *
 * צעד שעובר שורה — לבלוק אחר, או לשורה אחרת באותה פסקה גולשת — אינו נמדד
 * ככיוון: שם x קופץ לקצה השני מעצם הפריסה. „מלכודת” — חזרה לאותו (בלוק,
 * היסט) אחרי ביקור בשני — נמדדת בנפרד, כי זה ה„נתקע” שדווח.
 *
 * ‏`Shift+חץ` נבדק לבעלות ולא לכיוון: הוא נשאר של המנוע (ההסבר ב-
 * `isHorizontalArrow`), והשורות שלו מוודאות שהבחירה עדיין נוצרת.
 *
 *   npm run check:arrows            (QA_PORT עוקף 9714)
 */
import { openApp, createReport } from './harness.mjs';
import { zipStored } from './docx-fixtures.mjs';

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';

const RTL = '<w:bidi/>';
const numPr = (numId, ilvl = 0) =>
  `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`;

const pRuns = (runs, pPr = '') =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs
    .map(
      (r) =>
        `<w:r>${r.rPr ? `<w:rPr>${r.rPr}</w:rPr>` : ''}${
          r.tab ? '<w:tab/>' : `<w:t xml:space="preserve">${r.t}</w:t>`
        }</w:r>`,
    )
    .join('')}</w:p>`;

const p1 = (text, pPr = '', rPr = '<w:rtl/>') => pRuns([{ t: text, rPr }], pPr);

const lvl = (fmt, text) =>
  `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/>` +
  `<w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
  `<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`;

const numberingXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvl('decimal', '%1.')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvl('bullet', '•')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const stylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr/></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
</w:styles>`;

function buildDocx(bodyXml) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
  return zipStored({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'word/document.xml': documentXml,
    'word/numbering.xml': numberingXml(),
    'word/styles.xml': stylesXml(),
  });
}

const BODY = [
  p1('אבגדהוז ראשון גדול', RTL),
  p1('מספור ראשון ברשימה', RTL + numPr(1)),
  p1('תבליט עגול בפריט', RTL + numPr(2)),
  pRuns([{ t: 'קודם', rPr: '<w:rtl/>' }, { tab: true }, { t: 'אחרון', rPr: '<w:rtl/>' }], RTL),
  p1('פרק 12 בספר הזה', RTL),
  pRuns(
    [
      { t: 'מילה ', rPr: '<w:rtl/>' },
      { t: 'ABC', rPr: '' },
      { t: ' מילה אחרת', rPr: '<w:rtl/>' },
    ],
    RTL,
  ),
  p1('הזחה בלי מספור כאן', RTL + '<w:pStyle w:val="ListParagraph"/>'),
  p1(Array.from({ length: 40 }, (_, i) => `מילה${i}`).join(' '), RTL),
  p1('plain latin paragraph', '', ''),
].join('');

const CASES = [
  { label: 'פסקה עברית רגילה', find: 'אבגדהוז ראשון גדול' },
  { label: 'רשימה ממוספרת', find: 'מספור ראשון ברשימה' },
  { label: 'רשימת תבליטים', find: 'תבליט עגול בפריט' },
  { label: 'פסקה עם טאב', find: 'קודם' },
  { label: 'עברית עם ספרות', find: 'פרק 12 בספר הזה' },
  { label: 'עברית עם לטינית', find: 'מילה ABC מילה אחרת' },
  { label: 'הזחה בלי מספור', find: 'הזחה בלי מספור כאן' },
  { label: 'פסקה גולשת לשתי שורות', find: 'מילה0 מילה1' },
  { label: 'בקרה: פסקה לטינית', find: 'plain latin paragraph' },
];

const docx = buildDocx(BODY);
const report = createReport('חצים אופקיים: ימין אינו מזיז שמאלה', { strict: true });
const app = await openApp({ name: 'rtl-caret', port: Number(process.env.QA_PORT ?? 9714) });

/** „פתח קובץ” פותח דיאלוג; הבורר נקרא רק מ„עיון בקבצים…” שבתוכו. */
async function openFixture() {
  const dataUrl =
    'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' +
    Buffer.from(docx).toString('base64');
  await app.js(
    `window.__qaHost.replies['fs.pickUserFile']=function(){return Promise.resolve({success:true,error:null,` +
      `data:{token:'tok-arrow',url:${JSON.stringify(dataUrl)},name:'rtl-caret.docx',size:${docx.length},access:'readwrite'}})}`,
  );
  await app.tab('קובץ');
  if (!(await app.click('פתח קובץ', { after: 500 }))) throw new Error('„פתח קובץ” לא נמצא');
  await app.js("document.querySelector('.open-browse')?.scrollIntoView({ block: 'center' })");
  await app.click('עיון בקבצים…', { after: 8000 });
  for (let waited = 0; waited < 40_000; waited += 250) {
    await app.sleep(250);
    if (!(await app.exists('.status-load'))) break;
  }
  await app.sleep(2500);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await app.tab('בית');
      break;
    } catch {
      await app.sleep(1500);
    }
  }
  const paras = await app.paraCount();
  console.log(`פתיחה: paraCount=${paras}`);
  return paras >= 9;
}

/** הסמן: היכן המנוע מצייר אותו, ובאיזה בלוק והיסט הוא לדעתו. */
const caretState = () =>
  app
    .js(`(function(){
      var ed = window.__otzariaEditor && window.__otzariaEditor.superdoc && window.__otzariaEditor.superdoc.activeEditor;
      var snap = ed && ed.host && ed.host.readLiveSelectionSyncSnapshot && ed.host.readLiveSelectionSyncSnapshot();
      var sel = snap && snap.selectionTarget;
      var el = document.querySelector('.sd-v2-local-selection-caret');
      var r = el ? el.getBoundingClientRect() : null;
      return JSON.stringify({
        block: sel && sel.end ? sel.end.blockId : null,
        off: sel && sel.end ? sel.end.offset : null,
        x: r ? Math.round(r.left * 10) / 10 : null,
        y: r ? Math.round(r.top) : null
      });
    })()`)
    .then(JSON.parse);

/** הבחירה דרך ה-API הא-סינכרוני — היחיד שמתאר טווחים (נמדד). */
const asyncSelection = () =>
  app
    .js(`(async function(){
      try {
        var ed = window.__otzariaEditor.superdoc.activeEditor;
        var info = await ed.doc.selection.current();
        var seg = info && info.target && info.target.segments && info.target.segments[0];
        return JSON.stringify({
          empty: info ? info.empty : null,
          start: seg && seg.range ? seg.range.start : null,
          end: seg && seg.range ? seg.range.end : null
        });
      } catch (e) { return JSON.stringify({ error: String(e).slice(0, 60) }); }
    })()`)
    .then(JSON.parse);

/**
 * מניחה סמן ב**אמצע הטקסט** של הפסקה ולא במלבן השורה.
 *
 * קצה השורה של פריט רשימה הוא אזור ההזחה, ולחיצה שם נוחתת על היסט 0 בכל
 * הפריטים — מה שהיה מסתיר את מה שנמדד כאן. נמדד בגשש הסקר.
 */
async function caretMid(find) {
  const rect = JSON.parse(
    await app.js(`(function(){
      var frags = document.querySelectorAll('.superdoc-fragment');
      for (var i = 0; i < frags.length; i++) {
        if ((frags[i].textContent || '').indexOf(${JSON.stringify(find)}) < 0) continue;
        var runs = frags[i].querySelectorAll('.superdoc-text-run');
        var left = Infinity, right = -Infinity, top = 0, bottom = 0;
        for (var j = 0; j < runs.length; j++) {
          var r = runs[j].getBoundingClientRect();
          if (!r.width) continue;
          left = Math.min(left, r.left); right = Math.max(right, r.right);
          top = r.top; bottom = r.bottom;
        }
        if (right < 0) return JSON.stringify(null);
        return JSON.stringify({
          x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2),
          nodeId: frags[i].getAttribute('data-source-node-id')
        });
      }
      return JSON.stringify(null);
    })()`),
  );
  if (!rect) throw new Error(`אין טקסט מצויר לפסקה „${find}”`);
  await app.clickAt(rect.x, rect.y);
  await app.sleep(600);
  const state = await caretState();
  if (state.block !== rect.nodeId) {
    throw new Error(`הלחיצה נחתה על בלוק ${state.block} ולא על ${rect.nodeId}`);
  }
  return state;
}

async function walk(key, times, { shift = false } = {}) {
  const vk = key === 'ArrowRight' ? 39 : 37;
  const steps = [];
  for (let i = 0; i < times; i += 1) {
    await app.press(key, key, vk, shift ? 8 : 0);
    await app.sleep(220);
    steps.push(await caretState());
  }
  return steps;
}

const trace = (steps) =>
  steps.map((s) => `${String(s.block ?? '?').slice(-2)}:${s.off ?? '?'}@${s.x ?? '?'}`).join(' → ');

/**
 * ההפרות: צעדים **בתוך אותה שורה מצוירת** שבהם הסמן זז לכיוון ההפוך מהמקש.
 * מעבר בלוק או שורה אינו נמדד — שם x קופץ לקצה השני מעצם הפריסה.
 */
function violations(steps, toRight) {
  const bad = [];
  let moved = 0;
  for (let i = 1; i < steps.length; i += 1) {
    const a = steps[i - 1];
    const b = steps[i];
    if (a.block !== b.block) continue;
    if (typeof a.x !== 'number' || typeof b.x !== 'number') continue;
    if (typeof a.y === 'number' && typeof b.y === 'number' && Math.abs(a.y - b.y) > 2) continue;
    const dx = b.x - a.x;
    if (Math.abs(dx) <= 0.5) continue;
    moved += 1;
    if (toRight ? dx < 0 : dx > 0) bad.push(`${a.off}@${a.x} → ${b.off}@${b.x}`);
  }
  return { bad, moved };
}

/** „נתקע”: חזרה לאותו (בלוק, היסט) אחרי ביקור בבלוק אחר. */
function trapped(steps) {
  let loops = 0;
  for (let i = 2; i < steps.length; i += 1) {
    const a = steps[i - 2];
    const b = steps[i - 1];
    const c = steps[i];
    if (a.block !== b.block && b.block !== c.block && a.block === c.block && a.off === c.off) {
      loops += 1;
    }
  }
  return loops;
}

try {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await app.sleep(400);
  if (!(await openFixture())) {
    report.fail('פתיחת הקובץ', 'המסמך לא נפתח');
    throw new Error('no doc');
  }

  for (const c of CASES) {
    let start;
    try {
      start = await caretMid(c.find);
    } catch (error) {
      report.stuck(c.label, String(error.message || error).slice(0, 90));
      continue;
    }

    const right = [start, ...(await walk('ArrowRight', 6))];
    await caretMid(c.find);
    const left = [start, ...(await walk('ArrowLeft', 6))];

    console.log(`\n== ${c.label}`);
    console.log(`   ArrowRight: ${trace(right)}`);
    console.log(`   ArrowLeft : ${trace(left)}`);

    const r = violations(right, true);
    const l = violations(left, false);
    const loops = trapped(right) + trapped(left);

    if (r.bad.length || l.bad.length) {
      report.fail(
        c.label,
        `ימין הזיז שמאלה ב-${r.bad.length} צעדים (${r.bad.slice(0, 2).join('; ')}), ` +
          `שמאל הזיז ימינה ב-${l.bad.length}`,
      );
    } else if (!r.moved || !l.moved) {
      report.fail(c.label, `הסמן לא זז כלל (ימין ${r.moved} צעדים, שמאל ${l.moved})`);
    } else if (loops) {
      report.fail(c.label, `מלכודת גבול: ${loops} חזרות לאותו היסט`);
    } else {
      report.pass(c.label, `${r.moved} צעדים ימינה, ${l.moved} שמאלה, אף אחד לכיוון ההפוך`);
    }
  }

  /* -------- Shift+חץ נשאר של המנוע -------- */
  /*
   * לא בודקים כאן כיוון אלא **בעלות**. נמדד ב-`shift-arrow-probe.mjs` שבחירה
   * שנכתבת דרך `authoring.setSelectionTarget` קיימת אך אינה מצוירת כלל,
   * ושהתצלום הסינכרוני אינו מתאר טווחים — ולכן היירוט אינו נוגע ב-Shift.
   * השורות האלה שומרות על ההימנעות הזאת: המנוע חייב עדיין ליצור בחירה.
   */
  for (const c of CASES.filter((x) => /רגילה|ממוספרת|לטינית$/.test(x.label))) {
    try {
      await caretMid(c.find);
    } catch (error) {
      report.stuck(`${c.label} — Shift`, String(error.message || error).slice(0, 90));
      continue;
    }
    await walk('ArrowRight', 3, { shift: true });
    const selection = await asyncSelection();
    console.log(`\n== ${c.label} — Shift+ArrowRight: ${JSON.stringify(selection)}`);
    const width = typeof selection.end === 'number' ? selection.end - selection.start : 0;
    if (selection.error) {
      report.stuck(`${c.label} — Shift נשאר למנוע`, selection.error);
    } else if (selection.empty === false && width > 0) {
      report.pass(`${c.label} — Shift נשאר למנוע`, `נבחרו ${width} תווים`);
    } else {
      report.fail(`${c.label} — Shift נשאר למנוע`, `לא נוצרה בחירה (${JSON.stringify(selection)})`);
    }
  }
} catch (error) {
  console.error(error);
  report.fail('הריצה', String(error.message || error).slice(0, 120));
} finally {
  report.print();
  app.close();
}
