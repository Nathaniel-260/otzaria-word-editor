/**
 * האם המנוע תומך במספור עברי — במספרי עמודים וברשימות.
 * נמדד גם ב-OOXML המיוצא וגם במה שמצויר על המסך.
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('מספור עברי');
const app = await openApp({ name: 'hebnum', port: Number(process.env.QA_PORT ?? 9490) });

try {
  await app.caret(0);
  await app.type('bereshit');
  await app.sleep(900);

  // --- מספרי עמודים ---
  for (const fmt of ['hebrew1', 'hebrew2']) {
    const res = await app.js(`(async function(){
      var doc = window.__otzariaEditor.superdoc.activeEditor.doc;
      try {
        var listing = await doc.sections.list();
        var items = (listing && listing.items) || [];
        var target = items[0] && items[0].address;
        if (!target) return JSON.stringify({ ok: false, error: 'no section address', listing: listing });
        var r = await doc.sections.setPageNumbering({ target: target, format: '${fmt}', start: 1 });
        return JSON.stringify({ ok: true, receipt: r });
      } catch (e) { return JSON.stringify({ ok: false, error: String(e && e.message || e) }); }
    })()`);
    console.log(`sections.setPageNumbering(${fmt}):`, res);
    const files = await app.docx();
    const doc = files['word/document.xml'] || '';
    const m = doc.match(/<w:pgNumType[^>]*\/>/);
    console.log(`  pgNumType ב-docx:`, m ? m[0] : '(אין)');
    if (m && m[0].includes(fmt)) report.pass(`מספרי עמודים — ${fmt}`, m[0]);
    else report.fail(`מספרי עמודים — ${fmt}`, `${res} | ${m ? m[0] : 'אין pgNumType'}`);
  }

  // --- רשימות ---
  const listRes = await app.js(`(async function(){
    var doc = window.__otzariaEditor.superdoc.activeEditor.doc;
    var out = {};
    try {
      var lst = await doc.lists.apply({ preset: 'decimal' });
      out.apply = lst;
    } catch (e) { out.applyErr = String(e && e.message || e); }
    try {
      var listing = await doc.lists.list();
      out.listing = listing;
    } catch (e) { out.listErr = String(e && e.message || e); }
    return JSON.stringify(out);
  })()`);
  console.log('החלת רשימה:', String(listRes).slice(0, 600));

  const styleRes = await app.js(`(async function(){
    var doc = window.__otzariaEditor.superdoc.activeEditor.doc;
    var out = {};
    try {
      var listing = await doc.lists.list();
      var items = (listing && (listing.items || listing.lists || listing.data)) || [];
      out.count = items.length;
      out.first = items[0] || null;
      var numId = items[0] && (items[0].numId || items[0].id);
      out.numId = numId;
      if (numId != null) {
        try {
          out.set = await doc.lists.setLevelNumberStyle({ numId: numId, level: 0, numberStyle: 'hebrew1' });
        } catch (e) { out.setErr = String(e && e.message || e); }
      }
    } catch (e) { out.err = String(e && e.message || e); }
    return JSON.stringify(out);
  })()`);
  console.log('setLevelNumberStyle(hebrew1):', String(styleRes).slice(0, 900));

  await app.sleep(1200);
  const files2 = await app.docx();
  const numbering = files2['word/numbering.xml'] || '';
  const fmts = [...numbering.matchAll(/<w:numFmt w:val="([^"]+)"/g)].map((x) => x[1]);
  console.log('numFmt ב-numbering.xml:', JSON.stringify(fmts));
  console.log('טקסט על המסך:', JSON.stringify((await app.screenText() || '').slice(0, 200)));

  if (fmts.includes('hebrew1')) report.pass('מספור רשימה — hebrew1 נכתב ל-numbering.xml', fmts.join(','));
  else report.fail('מספור רשימה — hebrew1', `numFmt שנמצאו: ${fmts.join(',') || 'אין'}`);

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
