/**
 * שער: תוכן עניינים נבנה מכל רמות הכותרת, ומספר העמוד יושב בקצה השורה עם
 * מוביל נקודות.
 *
 * שני הסימפטומים שדווחו, ושניהם נמדדים כאן על ה-dist הארוז ובלחיצות אמיתיות:
 *
 *  1. „נוצר רק בכותרת אחת גם כאשר מגדירים התאמה לשאר הכותרות”. הסיבה לא
 *     הייתה בתוכן העניינים: `quickGallery` של המנוע מסנן את
 *     `Heading2`…`Heading9` (התבנית מסמנת אותם `w:semiHidden`), ולכן לא הייתה
 *     דרך במסך להחיל רמה 2 — ובמסמך לא היו כותרות שהטבלה תאסוף. השער דורש
 *     שהגלריה תציע „כותרת 2” ו„כותרת 3”, ושהחלתן תגיע לטבלה כשורות
 *     `TOC2`/`TOC3`.
 *  2. „מוצג לצד שמאל ללא הפרדה בין הכותרת למספר העמוד”. שורות הטבלה נכתבות
 *     עם תו טאב בלי שום עצירה, בשום שכבה. השער דורש עצירה עם `w:leader="dot"`
 *     ב-OOXML, מוביל **מצויר** על המסך, ומספר עמוד בתוך אזור הטקסט ולא חורג
 *     ממנו אל השוליים.
 *  3. ההזחה לפי רמה, שנוספה אחריהם: `w:ind` שגדל עם הרמה, כותרות שנכנסות
 *     פנימה מדרגה-מדרגה, ומספרי עמודים שנשארים **בעמודה אחת** למרות ההזחה —
 *     המנוע גורר איתה את עצירת הטאב, ולכן היא מפוצה. ראו src/engine/toc.ts.
 *
 * ההנמקה המלאה, כולל המדידות שקדמו: src/engine/toc.ts, src/engine/style-gallery.ts
 * ו-docs/engine-gaps.md.
 *
 *   npm run build && node scripts/qa/toc-layout-qa.mjs
 */
import { openApp, createReport } from './harness.mjs';

const PORT = Number(process.env.QA_PORT ?? 9396);
const report = createReport('תוכן עניינים — רמות, מוביל ומספר עמוד', { strict: true });
const log = (...a) => console.log('   ', ...a);

async function widen(app) {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await app.sleep(2000);
}

function paragraphs(xml) {
  return xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
}
function textOf(p) {
  return (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('');
}
function describe(p) {
  return {
    text: textOf(p).slice(0, 24),
    style: p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '(אין)',
    indent: Number(p.match(/<w:ind\b[^>]*w:left="(-?\d+)"/)?.[1] ?? 0),
    tabs: [...p.matchAll(/<w:tab\b([^>]*)\/>/g)]
      .map((m) => m[1])
      .filter((a) => /w:pos=/.test(a))
      .map((a) => a.replace(/\s+/g, ' ').trim()),
  };
}

/**
 * הגאומטריה של שורת הטבלה בקואורדינטות **העמוד**, כדי שחריגה אל השוליים
 * תהיה קריאה: אזור הטקסט של A4 עם שוליים של אינץ' מתחיל ב-x=96.
 *
 * הנקודות אינן טקסט — הצייר מייצר `div.superdoc-leader` עם `border-bottom`
 * מקווקו — ולכן הן נמדדות כאלמנט. בדיקה שחיפשה תווי נקודה בטקסט דיווחה
 * „אין נקודות” על שורה שהיו בה.
 */
async function geometry(app, title) {
  const raw = await app.js(
    `(function(){` +
      `var page=document.querySelector('[data-page-index]');` +
      `if(!page)return JSON.stringify({error:'no-page'});` +
      `var pr=page.getBoundingClientRect();` +
      `var L=page.querySelectorAll('.superdoc-line');` +
      `for(var i=0;i<L.length;i++){var t=(L[i].textContent||'');` +
      `if(t.indexOf(${JSON.stringify(title)})<0||!/\\d/.test(t))continue;` +
      `var lr=L[i].getBoundingClientRect();` +
      `var out={line:{x:Math.round(lr.left-pr.left),w:Math.round(lr.width)},title:null,number:null,leaders:[]};` +
      `var lds=L[i].querySelectorAll('.superdoc-leader');` +
      `for(var k=0;k<lds.length;k++){var q=lds[k].getBoundingClientRect();` +
      `out.leaders.push({x:Math.round(q.left-pr.left),w:Math.round(q.width),style:lds[k].getAttribute('data-style'),` +
      `border:(lds[k].ownerDocument.defaultView.getComputedStyle(lds[k]).borderBottomStyle||'')});}` +
      `var w=document.createTreeWalker(L[i],NodeFilter.SHOW_TEXT);var n;` +
      `while((n=w.nextNode())){var s=(n.textContent||'').trim();if(!s)continue;` +
      `var rg=document.createRange();rg.selectNodeContents(n);var r=rg.getBoundingClientRect();` +
      `if(!r.width)continue;` +
      `if(s.indexOf(${JSON.stringify(title)})>=0&&out.title===null)out.title={x:Math.round(r.left-pr.left),w:Math.round(r.width)};` +
      `if(/^\\d+$/.test(s))out.number={x:Math.round(r.left-pr.left),w:Math.round(r.width),text:s};}` +
      `return JSON.stringify(out);}` +
      `return JSON.stringify({error:'no-row'});})()`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return { error: String(raw).slice(0, 120) };
  }
}

/**
 * הקצה **הימני** של הכותרת ו-x של מספר העמוד, לכל שורות הטבלה. בעברית
 * ההזחה דוחפת את הכותרת מימין פנימה, ולכן הקצה הימני הוא מה שאמור לרדת
 * מדרגה-מדרגה — ומספרי העמודים אמורים לא לזוז בכלל.
 */
async function rowColumns(app) {
  const raw = await app.js(
    `(function(){` +
      `var page=document.querySelector('[data-page-index]');if(!page)return '[]';` +
      `var pr=page.getBoundingClientRect();var out=[];` +
      `var L=page.querySelectorAll('.superdoc-line');` +
      `for(var i=0;i<L.length;i++){var t=(L[i].textContent||'');` +
      `if(t.indexOf('פרק')<0&&t.indexOf('סעיף')<0&&t.indexOf('סימן')<0)continue;` +
      `if(!/\\d/.test(t))continue;` +
      `var row={text:t.slice(0,16),titleEnd:null,number:null};` +
      `var w=document.createTreeWalker(L[i],NodeFilter.SHOW_TEXT);var n;` +
      `while((n=w.nextNode())){var s=(n.textContent||'').trim();if(!s)continue;` +
      `var rg=document.createRange();rg.selectNodeContents(n);var r=rg.getBoundingClientRect();` +
      `if(!r.width)continue;` +
      `if(/^\\d+$/.test(s)){row.number=Math.round(r.left-pr.left);}` +
      `else if(row.titleEnd===null){row.titleEnd=Math.round(r.left+r.width-pr.left);}}` +
      `out.push(row);}return JSON.stringify(out);})()`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const app = await openApp({ name: 'toc-layout', port: PORT });
try {
  await widen(app);

  const lines = ['פרק ראשון', 'סעיף אלף', 'סעיף קטן א', 'גוף הטקסט', 'פרק שני'];
  await app.caret(0);
  for (let i = 0; i < lines.length; i++) {
    await app.type(lines[i]);
    if (i < lines.length - 1) {
      await app.press('Enter', 'Enter', 13);
      await app.sleep(350);
    }
  }
  await app.sleep(900);

  /* 1 — הגלריה מציעה את הרמות */
  await app.tab('בית');
  const gallery = (await app.galleryItems()).map((item) => item.label ?? item);
  log('פריטי הגלריה:', JSON.stringify(gallery));
  const missing = ['כותרת 1', 'כותרת 2', 'כותרת 3'].filter((label) => !gallery.includes(label));
  missing.length === 0
    ? report.pass('הגלריה מציעה שלוש רמות כותרת', JSON.stringify(gallery))
    : report.fail('רמות כותרת חסרות בגלריה', `חסרות: ${missing.join(', ')} | יש: ${gallery.join(', ')}`);

  const applied = [
    ['פרק ראשון', 'כותרת 1'],
    ['סעיף אלף', 'כותרת 2'],
    ['סעיף קטן א', 'כותרת 3'],
    ['פרק שני', 'כותרת 1'],
  ];
  for (const [para, style] of applied) {
    await app.caretPara(para);
    await app.sleep(250);
    const ok = await app.clickGallery(style, { after: 900 });
    if (!ok) report.fail(`לחיצה על „${style}”`, 'הכרטיס לא נמצא בגלריה');
  }

  const headed = paragraphs((await app.docx())['word/document.xml'] ?? '')
    .map(describe)
    .filter((p) => /^Heading[1-9]$/.test(p.style))
    .map((p) => `${p.style}:${p.text}`);
  log('כותרות במסמך:', JSON.stringify(headed));
  headed.length === 4 && headed.some((h) => h.startsWith('Heading2')) && headed.some((h) => h.startsWith('Heading3'))
    ? report.pass('הכרטיסים מחילים את הרמות על המסמך', JSON.stringify(headed))
    : report.fail('הרמות לא הוחלו', JSON.stringify(headed));

  /* 2 — ההכנסה: כל הרמות בטבלה, ולכל שורה עצירה עם מוביל */
  await app.tab('הפניות');
  await app.caretPara('גוף הטקסט');
  await app.press('End', 'End', 35);
  await app.sleep(300);
  const clicked = await app.click('תוכן עניינים', { after: 5000 });
  await app.sleep(1500);
  if (!clicked) report.fail('הכנסה', 'הכפתור „תוכן עניינים” לא נמצא');

  const rows = paragraphs((await app.docx())['word/document.xml'] ?? '')
    .filter((p) => /w:val="TOC\d"/.test(p))
    .map(describe);
  log('שורות הטבלה:', JSON.stringify(rows.map((r) => `${r.style}:${r.text}`)));
  log('עצירות:', JSON.stringify(rows.map((r) => r.tabs)));

  const styles = rows.map((r) => r.style);
  styles.includes('TOC1') && styles.includes('TOC2') && styles.includes('TOC3')
    ? report.pass('הטבלה נבנתה משלוש הרמות', JSON.stringify(styles))
    : report.fail('הטבלה אינה כוללת את כל הרמות', JSON.stringify(styles));

  const dotted = rows.filter((r) => r.tabs.some((t) => t.includes('w:leader="dot"')));
  dotted.length === rows.length && rows.length > 0
    ? report.pass('לכל שורה עצירת טאב עם מוביל נקודות', JSON.stringify(rows[0].tabs))
    : report.fail(
        'שורות בלי עצירה',
        `${dotted.length} מתוך ${rows.length}: ${JSON.stringify(rows.map((r) => r.tabs))}`
      );

  /* 3 — מה שרואים על המסך */
  const g = await geometry(app, 'פרק ראשון');
  log('גאומטריה:', JSON.stringify(g));

  const leader = (g.leaders ?? []).find((l) => l.style === 'dot' && l.border === 'dotted');
  leader && leader.w > 20
    ? report.pass('המוביל מצויר', `רוחב ${leader.w}px`)
    : report.fail('המוביל אינו מצויר', JSON.stringify(g.leaders));

  if (!g.number || !g.title) {
    report.fail('הכותרת או מספר העמוד לא נמצאו בשורה', JSON.stringify(g));
  } else {
    // בעברית מספר העמוד משמאל לכותרת, וזה כבר היה נכון. מה שנשבר היה
    // **המרחק**: 38 פיקסלים מהכותרת, בלי קשר לרוחב העמוד.
    const gap = g.title.x - (g.number.x + g.number.w);
    const inside = g.number.x >= g.line.x;
    gap > g.line.w / 2
      ? report.pass('מספר העמוד בקצה השורה', `${gap}px מהכותרת, בשורה ברוחב ${g.line.w}`)
      : report.fail('מספר העמוד צמוד לכותרת', `${gap}px בלבד, בשורה ברוחב ${g.line.w}`);
    inside
      ? report.pass('מספר העמוד בתוך אזור הטקסט', `x=${g.number.x}, אזור הטקסט מ-${g.line.x}`)
      : report.fail('מספר העמוד חורג אל השוליים', `x=${g.number.x}, אזור הטקסט מ-${g.line.x}`);
  }

  /* 3ב — ההזחה לפי רמה */
  const indents = rows.map((r) => `${r.style}:${r.indent}`);
  log('הזחות:', JSON.stringify(indents));
  const wanted = ['TOC1:0', 'TOC2:220', 'TOC3:440', 'TOC1:0'];
  JSON.stringify(indents) === JSON.stringify(wanted)
    ? report.pass('כל רמה מוזחת בצעד של Word', JSON.stringify(indents))
    : report.fail('ההזחה אינה לפי הרמה', `${JSON.stringify(indents)} במקום ${JSON.stringify(wanted)}`);

  const columns = await rowColumns(app);
  log('עמודות:', JSON.stringify(columns));
  const ends = columns.map((r) => r.titleEnd);
  const steps = ends.length === 4 && ends[0] > ends[1] && ends[1] > ends[2] && ends[3] === ends[0];
  steps
    ? report.pass('הכותרות נכנסות פנימה מדרגה-מדרגה', `קצה ימני: ${JSON.stringify(ends)}`)
    : report.fail('הכותרות אינן מדורגות', `קצה ימני: ${JSON.stringify(ends)}`);

  const pageNumbers = columns.map((r) => r.number);
  const spread = Math.max(...pageNumbers) - Math.min(...pageNumbers);
  spread <= 1
    ? report.pass('מספרי העמודים בעמודה אחת למרות ההזחה', `x=${JSON.stringify(pageNumbers)}`)
    : report.fail('ההזחה גררה את מספרי העמודים', `x=${JSON.stringify(pageNumbers)} (פיזור ${spread}px)`);

  /* 4 — „עדכן טבלה” אינו מבטל את מה שנעשה */
  const before = JSON.stringify(rows.map((r) => r.tabs));
  await app.click('עדכן טבלה', { after: 4000 });
  await app.sleep(1500);
  const after = paragraphs((await app.docx())['word/document.xml'] ?? '')
    .filter((p) => /w:val="TOC\d"/.test(p))
    .map(describe);
  const afterTabs = JSON.stringify(after.map((r) => r.tabs));
  log('עצירות אחרי „עדכן טבלה”:', afterTabs);
  const stillDotted =
    after.length === rows.length && after.every((r) => r.tabs.some((t) => t.includes('w:leader="dot"')));
  const stillIndented = JSON.stringify(after.map((r) => r.indent)) === JSON.stringify(rows.map((r) => r.indent));
  stillDotted && stillIndented
    ? report.pass('„עדכן טבלה” משאיר את השורות מעוצבות', `${afterTabs} | הזחות ${JSON.stringify(after.map((r) => r.indent))}`)
    : report.fail(
        '„עדכן טבלה” מוחק את העיצוב',
        `עצירות: לפני ${before} אחרי ${afterTabs}; הזחות: לפני ${JSON.stringify(rows.map((r) => r.indent))} אחרי ${JSON.stringify(after.map((r) => r.indent))}`
      );
} finally {
  app.close();
}
report.print();
