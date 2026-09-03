/**
 * גשש: פעולות הרשימה כשהסמן **מכווץ** — issue #14 ג׳.
 *
 * הדיווח: „במספור פסקאות – רשימה מופיע ‚יש למקם את הסמן בתוך הרשימה׳ … כאשר
 * העכבר על אחד התפריטים הוא כאילו יוצא מהמסמך”. שער `hebrew-numbering-ui-qa`
 * עובר, אבל הוא בוחר **טווח** („בחר הכל”) לפני שפותח את התפריט. כאן נמדדים
 * שלושה מסלולים של משתמש שמקליד:
 *   1. סמן מכווץ בתוך פריט רשימה עם טקסט.
 *   2. סמן על פריט רשימה **ריק** (Enter אחרי הפריט האחרון) — הרגע שבו בוחרים
 *      סגנון מספור לפריט הבא.
 *   3. סמן בפסקה **רגילה** (לא רשימה) ובחירת סגנון מספור מהתפריט — האם התפריט
 *      יוצר רשימה, או מסרב.
 * ובכל אחד: `doc.selection.current()` (אסינכרוני!) לפני התפריט ובזמן שהוא פתוח.
 *
 * כל שורת פעולה דורשת שני דברים: שלא הופיעה ההודעה „יש למקם את הסמן” (שומר
 * הרגרסיה על הדיווח המקורי), ושהתוצאה **נמדדה** — הסמנים שמצוירים על המסך
 * וה-OOXML של הפסקה עצמה. „שקט” אינו הצלחה.
 *
 *   node scripts/qa/list-caret-qa.mjs
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('רשימה — סמן מכווץ ותפריט', { strict: true });
const app = await openApp({ name: 'list-caret', port: Number(process.env.QA_PORT ?? 9601) });

const readSelection = () =>
  app.js(`(async function(){
    try {
      var ed = window.__otzariaEditor && window.__otzariaEditor.superdoc && window.__otzariaEditor.superdoc.activeEditor;
      if (!ed || !ed.doc || !ed.doc.selection) return JSON.stringify({error:'no editor'});
      var info = await ed.doc.selection.current();
      var listed = await ed.doc.blocks.list();
      var seg = info && info.target && info.target.segments && info.target.segments[0];
      var block = seg ? (listed.blocks || []).find(function(b){ return b.nodeId === seg.blockId; }) : null;
      return JSON.stringify({
        empty: info ? info.empty : undefined,
        target: info ? info.target : undefined,
        selectionTarget: info ? info.selectionTarget : undefined,
        blockNodeType: block ? block.nodeType : null,
        activeElement: document.activeElement ? document.activeElement.tagName : null,
      });
    } catch (e) { return JSON.stringify({error: String(e)}); }
  })()`);

/** הסמנים שמצוירים בפועל — מה שהמשתמש רואה, ועל מה הוא דיווח. */
const markersOf = () =>
  app.js(
    `JSON.stringify(Array.from(document.querySelectorAll('[class*="list-marker"]'))` +
      `.filter(function(n){ return n.getBoundingClientRect().width > 0; })` +
      `.map(function(n){ return n.textContent.replace(/\\u200f/g,''); }))`,
  ).then(JSON.parse);

const parse = (json) => { try { return JSON.parse(json); } catch { return { error: json }; } };
const blockIdOf = (info) => (info?.target?.segments?.[0]?.blockId) ?? null;

const paragraphsOf = (files) => (files['word/document.xml'] || '').match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
const numberingOf = (files) => files['word/numbering.xml'] || '';
const textOf = (p) =>
  (p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, '').replace(/[\u200e\u200f\ufeff]/g, ''))
    .join('');

/**
 * ה-`numId` של הפסקה → ה-`<w:num>` שלה → ה-`abstractNum` → ה-`<w:lvl w:ilvl="0">`.
 * בלי השרשור הזה „יש hebrew1 ב-numbering.xml” עובר גם על תבנית של פריט או רמה אחרים.
 */
function lvl0Of(paragraph, numbering) {
  const numId = paragraph.match(/<w:numId w:val="(\d+)"\s*\/>/)?.[1] ?? null;
  const num = numId ? numbering.match(new RegExp(`<w:num w:numId="${numId}"[^>]*>[\\s\\S]*?</w:num>`))?.[0] ?? '' : '';
  const abstractNumId = num.match(/<w:abstractNumId w:val="(\d+)"\s*\/>/)?.[1] ?? null;
  const abstract = abstractNumId
    ? numbering.match(new RegExp(`<w:abstractNum w:abstractNumId="${abstractNumId}"[^>]*>[\\s\\S]*?</w:abstractNum>`))?.[0] ?? ''
    : '';
  const lvl0 = abstract.match(/<w:lvl w:ilvl="0"[^>]*>[\s\S]*?<\/w:lvl>/)?.[0] ?? '';
  const override = num.match(/<w:lvlOverride w:ilvl="0"[^>]*>[\s\S]*?<\/w:lvlOverride>/)?.[0] ?? '';
  return {
    numId,
    abstractNumId,
    numFmt: lvl0.match(/<w:numFmt w:val="([^"]+)"/)?.[1] ?? null,
    start: lvl0.match(/<w:start w:val="(\d+)"\s*\/>/)?.[1] ?? null,
    startOverride: override.match(/<w:startOverride w:val="(\d+)"\s*\/>/)?.[1] ?? null,
  };
}

async function menuAction(label) {
  await app.reset();
  await app.click('פעולות מספור');
  await app.sleep(600);
  const during = parse(await readSelection());
  const picked = await app.clickMenu(label);
  // פריט שלא נמצא = מדידה שלא קרתה, לא „התקבל”. נכשל בקול, לא בשקט.
  if (!picked) throw new Error(`פריט התפריט „${label}” לא נמצא — הבדיקה לא מדדה כלום`);
  await app.sleep(1100);
  const status = await app.status();
  return { during, picked, status, markers: await markersOf(), files: await app.docx() };
}

try {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await app.sleep(400);

  // רשימה של שני פריטים, כמו שהשער הירוק בונה אותה, ואחריה פסקה רגילה.
  await app.caret(0);
  await app.type('ראשון');
  await app.press('Enter', 'Enter', 13);
  await app.type('שני');
  await app.sleep(500);
  await app.tab('בית');
  await app.click('בחר הכל');
  await app.sleep(500);
  await app.click('מספור');
  await app.sleep(1200);

  /* ---- 1. סמן מכווץ בפריט עם טקסט ---- */
  // כל פסקה מציירת גם `.superdoc-fragment` וגם `.superdoc-line`, ולכן אינדקס 1
  // הוא עוד הפריט הראשון; הפריט השני הוא 2.
  await app.caret(2);
  await app.press('End', 'End', 35);
  await app.sleep(400);
  const s1 = parse(await readSelection());
  console.log('1 לפני התפריט:', JSON.stringify(s1));
  blockIdOf(s1)
    ? report.pass('1. סמן מכווץ בפריט עם טקסט — יש blockId', `${blockIdOf(s1)} (${s1.blockNodeType})`)
    : report.fail('1. סמן מכווץ בפריט עם טקסט — אין blockId', JSON.stringify(s1));
  const r1 = await menuAction('התחל מחדש מ-1');
  const numbering1 = numberingOf(r1.files);
  const first1 = lvl0Of(paragraphsOf(r1.files).find((p) => textOf(p) === 'ראשון') || '', numbering1);
  const second1 = lvl0Of(paragraphsOf(r1.files).find((p) => textOf(p) === 'שני') || '', numbering1);
  // הראיה היא ה**ניתוק**: פריט שממשיך לספור חולק את ה-`numId` של קודמו. את
  // ההתחלה מ-1 בודקים בשתי הצורות — נמדד ש-`startOverride=1` יושב על כל
  // `<w:num>` שהמנוע יוצר, ולכן לבדו הוא אינו מבחין בין אתחול להמשך.
  const startsAtOne = second1.startOverride === '1' || second1.start === '1';
  const restarted = !!first1.numId && !!second1.numId && second1.numId !== first1.numId && startsAtOne;
  console.log('1 בזמן התפריט:', JSON.stringify(r1.during), '| אחרי:', JSON.stringify(r1.status),
    '| סמנים:', JSON.stringify(r1.markers), '| ראשון:', JSON.stringify(first1), '| שני:', JSON.stringify(second1));
  if (/יש למקם את הסמן/.test(r1.status.text || '')) {
    report.fail('1. „התחל מחדש מ-1” על הפריט השני — סורב (הדיווח ב-#14)', r1.status.text);
  } else if (r1.markers.join(' ') === '1. 1.' && restarted) {
    report.pass('1. „התחל מחדש מ-1” על הפריט השני — לא סורב, והמספור אותחל',
      `סמנים ${r1.markers.join(' ')} | numId ${first1.numId}→${second1.numId} עם startOverride=1`);
  } else {
    report.fail('1. „התחל מחדש מ-1” על הפריט השני — לא סורב, אך המספור לא אותחל',
      `סמנים ${JSON.stringify(r1.markers)} (הצפי „1. 1.”) | ראשון=${JSON.stringify(first1)} שני=${JSON.stringify(second1)} status=${r1.status.text}`);
  }

  /* ---- 2. פריט רשימה ריק (Enter אחרי האחרון) ---- */
  await app.caret(2);
  await app.press('End', 'End', 35);
  await app.press('Enter', 'Enter', 13);
  await app.sleep(600);
  const s2 = parse(await readSelection());
  console.log('2 פריט ריק:', JSON.stringify(s2));
  blockIdOf(s2)
    ? report.pass('2. סמן על פריט ריק — יש blockId', `${blockIdOf(s2)} (${s2.blockNodeType})`)
    : report.fail('2. סמן על פריט ריק — אין blockId (target=null?)', JSON.stringify(s2));
  const r2 = await menuAction('א, ב, ג … יא, יב (גימטריה)');
  // הפריט הריק אינו מזוהה לפי טקסט — הוא הפסקה הממוספרת היחידה שאין בה טקסט.
  const empties = paragraphsOf(r2.files).filter((p) => /<w:numPr>/.test(p) && textOf(p) === '');
  const lvl2 = empties.length === 1 ? lvl0Of(empties[0], numberingOf(r2.files)) : null;
  const lastMarker2 = r2.markers[r2.markers.length - 1] || '';
  console.log('2 בזמן התפריט:', JSON.stringify(r2.during), '| picked=', r2.picked, '| אחרי:', JSON.stringify(r2.status),
    '| סמנים:', JSON.stringify(r2.markers), '| ריקות ממוספרות:', empties.length, '| הפריט הריק:', JSON.stringify(lvl2));
  if (/יש למקם את הסמן/.test(r2.status.text || '')) {
    report.fail('2. סגנון עברי על פריט ריק — סורב (הדיווח ב-#14)', r2.status.text);
  } else if (empties.length !== 1) {
    report.fail('2. סגנון עברי על פריט ריק — הפריט לא זוהה ב-OOXML, המדידה לא קרתה',
      `פסקאות ממוספרות בלי טקסט: ${empties.length}`);
  } else if (lvl2.numFmt === 'hebrew1' && /^[א-ת]+\.$/.test(lastMarker2)) {
    report.pass('2. סגנון עברי על פריט ריק — לא סורב, והפריט הזה עצמו קיבל hebrew1',
      `numId=${lvl2.numId}→abstractNum=${lvl2.abstractNumId}, lvl0 numFmt=hebrew1 | הסמן שלו „${lastMarker2}” | סמנים ${r2.markers.join(' ')}`);
  } else {
    report.fail('2. סגנון עברי על פריט ריק — לא סורב, אך הפריט לא קיבל מספור עברי',
      `lvl0 של הפריט=${JSON.stringify(lvl2)} | סמן אחרון „${lastMarker2}” | סמנים ${JSON.stringify(r2.markers)} status=${r2.status.text}`);
  }

  /* ---- 3. פסקה רגילה, לא רשימה ---- */
  // יוצאים מהרשימה: Enter נוסף על פריט ריק מסיים אותה (כמו ב-Word), ואז מקלידים.
  await app.press('Enter', 'Enter', 13);
  await app.sleep(400);
  await app.type('פסקה חופשית');
  await app.sleep(500);
  const s3 = parse(await readSelection());
  console.log('3 פסקה רגילה:', JSON.stringify(s3));
  // `fail` ולא `partial`: `partial` אינו מפיל גם ב-strict, ובלוק שאינו פסקה
  // פירושו שהמסלול מודד „סגנון על פריט רשימה” — כלומר לא את מה שנכתב.
  report[s3.blockNodeType === 'paragraph' ? 'pass' : 'fail']('3. הסמן בפסקה רגילה', `nodeType=${s3.blockNodeType}`);
  const r3 = await menuAction('א, ב, ג … יא, יב (גימטריה)');
  // הפסקה **עצמה** — `<w:p>` שמחזיק את הטקסט — ולא הסביבה: הפריטים שלפניה
  // ממוספרים ממילא, וחיפוש numPr „בקרבת מקום” היה עובר בירוק בלי שנוצר דבר.
  const free = paragraphsOf(r3.files).find((p) => p.includes('פסקה חופשית')) || '';
  const numbered = /<w:numPr>/.test(free);
  const lvl3 = lvl0Of(free, numberingOf(r3.files));
  const hebrew = lvl3.numFmt === 'hebrew1';
  console.log('3 בזמן התפריט:', JSON.stringify(r3.during), '| אחרי:', JSON.stringify(r3.status),
    '| סמנים:', JSON.stringify(r3.markers), '| lvl0 של הפסקה:', JSON.stringify(lvl3));
  if (/יש למקם את הסמן/.test(r3.status.text || '')) {
    report.fail('3. סגנון מספור על פסקה רגילה — „יש למקם את הסמן בתוך רשימה” (הדיווח ב-#14)', r3.status.text);
  } else if (numbered && hebrew) {
    report.pass('3. סגנון מספור על פסקה רגילה — הפסקה מוספרה, ובעברית',
      `numPr בפסקה + numId=${lvl3.numId}→abstractNum=${lvl3.abstractNumId}, lvl0 numFmt=hebrew1`);
  } else {
    report.fail('3. סגנון מספור על פסקה רגילה — לא סורב, אך לא מוספר כמבוקש',
      `numPr=${numbered} lvl0=${JSON.stringify(lvl3)} status=${r3.status.text}`);
  }

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}
process.exit(report.print() > 0 ? 1 : 0);
