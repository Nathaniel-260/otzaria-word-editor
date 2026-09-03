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

const parse = (json) => { try { return JSON.parse(json); } catch { return { error: json }; } };
const blockIdOf = (info) => (info?.target?.segments?.[0]?.blockId) ?? null;

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
  return { during, picked, status };
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
  await app.caret(1);
  await app.press('End', 'End', 35);
  await app.sleep(400);
  const s1 = parse(await readSelection());
  console.log('1 לפני התפריט:', JSON.stringify(s1));
  blockIdOf(s1)
    ? report.pass('1. סמן מכווץ בפריט עם טקסט — יש blockId', `${blockIdOf(s1)} (${s1.blockNodeType})`)
    : report.fail('1. סמן מכווץ בפריט עם טקסט — אין blockId', JSON.stringify(s1));
  const r1 = await menuAction('התחל מחדש מ-1');
  console.log('1 בזמן התפריט:', JSON.stringify(r1.during), '| אחרי:', JSON.stringify(r1.status));
  /יש למקם את הסמן/.test(r1.status.text || '')
    ? report.fail('1. „התחל מחדש” — סורב', r1.status.text)
    : report.pass('1. „התחל מחדש” — התקבל', r1.status.text || '(שקט)');

  /* ---- 2. פריט רשימה ריק (Enter אחרי האחרון) ---- */
  await app.caret(1);
  await app.press('End', 'End', 35);
  await app.press('Enter', 'Enter', 13);
  await app.sleep(600);
  const s2 = parse(await readSelection());
  console.log('2 פריט ריק:', JSON.stringify(s2));
  blockIdOf(s2)
    ? report.pass('2. סמן על פריט ריק — יש blockId', `${blockIdOf(s2)} (${s2.blockNodeType})`)
    : report.fail('2. סמן על פריט ריק — אין blockId (target=null?)', JSON.stringify(s2));
  const r2 = await menuAction('א, ב, ג … יא, יב (גימטריה)');
  console.log('2 בזמן התפריט:', JSON.stringify(r2.during), '| picked=', r2.picked, '| אחרי:', JSON.stringify(r2.status));
  /יש למקם את הסמן/.test(r2.status.text || '')
    ? report.fail('2. סגנון עברי על פריט ריק — סורב', r2.status.text)
    : report.pass('2. סגנון עברי על פריט ריק — התקבל', r2.status.text || '(שקט)');

  /* ---- 3. פסקה רגילה, לא רשימה ---- */
  // יוצאים מהרשימה: Enter נוסף על פריט ריק מסיים אותה (כמו ב-Word), ואז מקלידים.
  await app.press('Enter', 'Enter', 13);
  await app.sleep(400);
  await app.type('פסקה חופשית');
  await app.sleep(500);
  const s3 = parse(await readSelection());
  console.log('3 פסקה רגילה:', JSON.stringify(s3));
  report[s3.blockNodeType === 'paragraph' ? 'pass' : 'partial']('3. הסמן בפסקה רגילה', `nodeType=${s3.blockNodeType}`);
  const r3 = await menuAction('א, ב, ג … יא, יב (גימטריה)');
  console.log('3 בזמן התפריט:', JSON.stringify(r3.during), '| אחרי:', JSON.stringify(r3.status));
  const files = await app.docx();
  const docx = files['word/document.xml'];
  // הפסקה **עצמה** — `<w:p>` שמחזיק את הטקסט — ולא הסביבה: הפריטים שלפניה
  // ממוספרים ממילא, וחיפוש numPr „בקרבת מקום” היה עובר בירוק בלי שנוצר דבר.
  const paragraphs = docx.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  const free = paragraphs.find((p) => p.includes('פסקה חופשית')) || '';
  const numbered = /<w:numPr>/.test(free);
  const hebrew = /w:val="hebrew1"/.test(files['word/numbering.xml'] || '');
  if (/יש למקם את הסמן/.test(r3.status.text || '')) {
    report.fail('3. סגנון מספור על פסקה רגילה — „יש למקם את הסמן בתוך רשימה” (הדיווח ב-#14)', r3.status.text);
  } else if (numbered && hebrew) {
    report.pass('3. סגנון מספור על פסקה רגילה — הפסקה מוספרה, ובעברית', 'numPr בפסקה + hebrew1 ב-numbering.xml');
  } else {
    report.fail('3. סגנון מספור על פסקה רגילה — לא סורב, אך לא מוספר כמבוקש', `numPr=${numbered} hebrew1=${hebrew} status=${r3.status.text}`);
  }

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}
process.exit(report.print() > 0 ? 1 : 0);
