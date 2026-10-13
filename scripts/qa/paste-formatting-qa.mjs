/**
 * שער: „אפשרויות הדבקה” — שמירה על עיצוב המקור, מיזוג עיצוב, טקסט בלבד —
 * וברירת המחדל של Ctrl+V. ההנמקה ב-src/engine/paste-formatting.ts.
 *
 * הלוח כאן הוא לוח המערכת של הדפדפן, והפקדים נלחצים בעכבר: התפריט של „הדבק”
 * ברצועה, ו-Ctrl+V אמיתי (`Input.dispatchKeyEvent` עם הפקודה `paste`, כלומר
 * אירוע `paste` שהדפדפן עצמו ממלא מהלוח). ההוכחה היא ה-OOXML שהמנוע מייצא.
 *
 * המקור בכל המקרים: Arial 20 אדום, מילה אחת מודגשת ויישור למרכז.
 * היעד: ריצה ב-David 18 כחולה — עיצוב ישיר, המקרה שבו `match-destination`
 * של המנוע נמדד כמשאיר את הטקסט בלי עיצוב — ופסקה שלא עוצבה כלל.
 *
 *   npm run build && node scripts/qa/paste-formatting-qa.mjs
 */
import { openApp, createReport, sleep } from './harness.mjs';

const PORT = Number(process.env.QA_PORT ?? 9398);
const report = createReport('אפשרויות הדבקה', { strict: true });
const log = (...a) => console.log('   ', ...a);

const SOURCE_HTML =
  '<p style="text-align:center"><span style="font-family:Arial;font-size:20pt;color:#ff0000">' +
  'מקור <b>מודגש</b> סוף</span></p>';
const SOURCE_TEXT = 'מקור מודגש סוף';
const DEST_HTML = (marker) =>
  `<p><span style="font-family:David;font-size:18pt;color:#0000ff">${marker}</span></p>`;

const app = await openApp({ name: 'paste-formatting-qa', port: PORT });

/** כותבת ללוח המערכת דרך ה-API של הדפדפן. */
async function setClipboard(html, text) {
  return app.js(`(async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([${JSON.stringify(html)}], { type: 'text/html' }),
        'text/plain': new Blob([${JSON.stringify(text)}], { type: 'text/plain' }),
      })]);
      return 'ok';
    } catch (e) { return String(e); }
  })()`);
}

/** פסקה חדשה בסוף, עם ריצת היעד (David 18 כחול), והסמן אחריה. */
async function destination(marker, html = DEST_HTML(marker)) {
  await app.press('End', 'End', 35, 2);
  await app.press('Enter', 'Enter', 13, 0, '\r');
  await sleep(400);
  {
    await app.js(`(async () => { const sd = window.__qa.sd(); const doc = sd.activeEditor.doc;
      const target = sd.ui.selection.getSnapshot().selectionTarget;
      const p = await doc.clipboard.parse({ source: 'browser', items: [{ type: 'text/html', kind: 'string', data: ${JSON.stringify(html)} }] });
      await doc.clipboard.insert({ plan: p.plan, target }); })()`);
    await sleep(900);
    await app.press('End', 'End', 35, 0);
  }
  // הקריאה של מצבי הפקודות מתיישבת אחרי תזוזת הסמן.
  await sleep(1200);
}

/**
 * Ctrl+V אמיתי: `rawKeyDown` trusted, כמו הקשה. שתי חלופות נמדדו כאן ואינן
 * מוכיחות דבר: אירוע `paste` סינתטי נבלע על ידי המנוע בלי להדביק, ו-
 * `commands: ['paste']` עוקף את ה-`keydown` שהמנוע מטפל בו.
 */
async function ctrlV() {
  await app.cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, modifiers: 2,
  });
  await app.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2 });
  await sleep(2000);
}

async function menu(label) {
  const items = await app.openMenu('אפשרויות הדבקה');
  if (!items) return { ok: false, items: null };
  const ok = await app.clickMenu(label);
  await sleep(1500);
  return { ok, items };
}

/** הריצות של הפסקה שמכילה את `marker`: `[טקסט, rPr]`. */
function paragraphRuns(xml, marker) {
  const body = xml.slice(xml.indexOf('<w:body>'));
  for (const p of body.split('</w:p>')) {
    const text = [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!text.includes(marker)) continue;
    return {
      text,
      runs: [...p.matchAll(/<w:r>(?:<w:rPr>(.*?)<\/w:rPr>)?<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => [m[2], m[1] ?? '']),
    };
  }
  return null;
}

/** הריצות שהגיעו מהמקור — כל מה שאחרי ה-marker. */
function pasted(paragraph, marker) {
  const at = paragraph.runs.findIndex(([t]) => t.includes(marker));
  return paragraph.runs.slice(at + 1).filter(([t]) => t.trim());
}

try {
  try {
    await app.cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  } catch (e) {
    log('הענקת הרשאת לוח נכשלה:', String(e?.message ?? e));
  }
  await app.tab('בית');
  await app.caret(0);

  const written = await setClipboard(SOURCE_HTML, SOURCE_TEXT);
  if (written !== 'ok') throw new Error(`כתיבה ללוח נכשלה: ${written}`);

  /* ---------- התפריט ---------- */
  // ראשון: הפסקה הראשונה, שהוקלדה בלי שום עיצוב. אחרי פסקה מעוצבת, הקלדה
  // בפסקה חדשה ממשיכה את העיצוב שלה — ושם „לא עוצב” כבר אינו נכון.
  await app.type('יעדרגיל');
  await sleep(1200);
  await menu('מיזוג עיצוב');

  await destination('יעדמזג');
  const merge = await menu('מיזוג עיצוב');
  const labels = (merge.items ?? []).map((item) => item.label);
  log('פריטי התפריט:', JSON.stringify(labels));
  const expected = [
    'שמירה על עיצוב המקור', 'מיזוג עיצוב', 'שמירת טקסט בלבד',
    'Ctrl+V: שמירה על עיצוב המקור', 'Ctrl+V: מיזוג עיצוב', 'Ctrl+V: שמירת טקסט בלבד',
  ];
  JSON.stringify(labels) === JSON.stringify(expected)
    ? report.pass('תפריט „אפשרויות הדבקה”', 'שש אפשרויות')
    : report.fail('תפריט „אפשרויות הדבקה”', JSON.stringify(labels));

  await destination('יעדטקסט');
  await menu('שמירת טקסט בלבד');


  // יעד עם סימון (highlight): הצורה שהמנוע מקבל לסימון ב-fragment אינה
  // מתועדת, וערך שגוי היה מפיל את ה-`insert` כולו.
  await destination('יעדסימון', '<p><span style="background:yellow">יעדסימון</span></p>');
  await menu('מיזוג עיצוב');

  /* ---------- Ctrl+V ---------- */
  await destination('יעדמקור');
  await ctrlV();

  await menu('Ctrl+V: מיזוג עיצוב');
  await app.openMenu('אפשרויות הדבקה');
  const radio = await app.js(`JSON.stringify(Array.from(document.querySelectorAll('.ribbon-menu__popover [role="menuitemradio"]')).map((b) => [b.textContent.trim().slice(0, 30), b.getAttribute('aria-checked')]))`);
  await app.escape();
  log('ברירת מחדל:', radio);
  /"Ctrl\+V: מיזוג עיצוב[^"]*","true"/.test(radio)
    ? report.pass('ברירת מחדל מסומנת', 'Ctrl+V: מיזוג עיצוב')
    : report.fail('ברירת מחדל מסומנת', radio);

  await destination('יעדקיצור');
  await ctrlV();

  const xml = (await app.docx())['word/document.xml'];

  const has = (rpr, re) => re.test(rpr);
  const target = (rpr) => has(rpr, /w:ascii="David"/) && has(rpr, /<w:sz w:val="36"/) && has(rpr, /w:val="0000FF"/);
  const noSource = (rpr) => !has(rpr, /Arial/) && !has(rpr, /FF0000/) && !has(rpr, /w:val="40"/);

  function check(name, marker, expect) {
    const paragraph = paragraphRuns(xml, marker);
    if (!paragraph) return report.fail(name, `הפסקה של ${marker} לא נמצאה`);
    const runs = pasted(paragraph, marker);
    log(name, JSON.stringify(paragraph.text), JSON.stringify(runs));
    const problem = expect(runs, paragraph);
    problem ? report.fail(name, problem) : report.pass(name, paragraph.text);
  }

  check('מיזוג עיצוב מהתפריט', 'יעדמזג', (runs) => {
    if (runs.length === 0) return 'לא הודבק כלום';
    if (!runs.every(([, rpr]) => target(rpr) && noSource(rpr))) return 'לא כל הריצות ב-David 18 כחול בלי עיצוב המקור';
    const bold = runs.filter(([, rpr]) => /<w:b\/>/.test(rpr)).map(([t]) => t.trim());
    return JSON.stringify(bold) === '["מודגש"]' ? null : `ההדגשה: ${JSON.stringify(bold)}`;
  });

  check('טקסט בלבד מהתפריט', 'יעדטקסט', (runs) => {
    if (runs.length === 0) return 'לא הודבק כלום';
    if (!runs.every(([, rpr]) => target(rpr) && noSource(rpr))) return 'לא כל הריצות ב-David 18 כחול';
    return runs.some(([, rpr]) => /<w:b\/>/.test(rpr)) ? 'ההדגשה של המקור נשארה' : null;
  });

  check('מיזוג לטקסט שלא עוצב — ברירות המחדל אינן נכתבות', 'יעדרגיל', (runs) => {
    if (runs.length === 0) return 'לא הודבק כלום';
    if (!runs.every(([, rpr]) => noSource(rpr) && !/w:rFonts|<w:sz |<w:color/.test(rpr))) {
      return 'נכתב גופן/גודל/צבע על טקסט שלא היה לו עיצוב ישיר';
    }
    const bold = runs.filter(([, rpr]) => /<w:b\/>/.test(rpr)).map(([t]) => t.trim());
    return JSON.stringify(bold) === '["מודגש"]' ? null : `ההדגשה: ${JSON.stringify(bold)}`;
  });

  // ההדבקה של המנוע עצמו מכניסה `<p>` שלם כפסקה משלו (נמדד), ולכן עיצוב
  // המקור נבדק בפסקה שאחרי היעד ולא בתוכה.
  {
    const name = 'Ctrl+V בברירת המחדל — ההדבקה של המנוע, בעיצוב המקור';
    const body = xml.slice(xml.indexOf('<w:body>')).split('</w:p>');
    const at = body.findIndex((p) => p.includes('יעדמקור'));
    const next = at >= 0 ? body[at + 1] ?? '' : '';
    const text = [...next.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    log(name, JSON.stringify(text));
    text.includes('מודגש') && /Arial/.test(next) && /FF0000/.test(next)
      ? report.pass(name, text)
      : report.fail(name, `הפסקה שאחרי היעד: ${JSON.stringify(text)}`);
  }

  // הרקע נבדק מול ריצת היעד עצמה, ולא מול צורה קבועה: המנוע כותב רקע של
  // HTML כ-`w:shd` (נמדד), וזה מה שהטקסט המודבק צריך להמשיך.
  check('מיזוג ליעד מסומן — הרקע נמשך, וההדבקה אינה נופלת', 'יעדסימון', (runs, paragraph) => {
    if (runs.length === 0) return 'לא הודבק כלום';
    const dest = paragraph.runs.find(([t]) => t.includes('יעדסימון'))?.[1] ?? '';
    const background = dest.match(/<w:(?:highlight|shd)\b[^>]*\/>/)?.[0];
    if (!background) return `ליעד אין רקע: ${dest}`;
    return runs.every(([, rpr]) => rpr.includes(background) && noSource(rpr)) ? null : `הרקע ${background} לא נמשך`;
  });

  check('Ctrl+V אחרי „Ctrl+V: מיזוג עיצוב” — ממוזג, ופעם אחת', 'יעדקיצור', (runs, paragraph) => {
    const times = paragraph.text.split('מודגש').length - 1;
    if (times !== 1) return `הודבק ${times} פעמים`;
    if (!runs.every(([, rpr]) => target(rpr) && noSource(rpr))) return 'לא ממוזג';
    return null;
  });

  const errors = (await app.log()).filter((line) => /^error/.test(line) && !/projectBodyWindow/.test(line));
  errors.length === 0 ? report.pass('בלי שגיאות בדף') : report.fail('בלי שגיאות בדף', errors.join(' | ').slice(0, 400));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
