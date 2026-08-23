/**
 * שער הגופן: האם ה-@font-face שהתוסף מזריק בזמן ריצה נטען בפועל מ-`file://` —
 * ה-origin שממנו אוצריא טוענת תוסף ארוז.
 *
 * רץ על `dist/index.html` עצמו, בלי לשנות בו כלום: `installBundledFonts()` הוא
 * הדבר הראשון שהמעטפת עושה, לפני ההמתנה ל-Host שלא יגיע כאן.
 *
 * מה שנמדד, ולמה דווקא זה: `document.fonts.check()` **אינו עדות** — נמדד שהוא
 * מחזיר `true` גם בדף בלי שום `@font-face`, על מכונה שאין בה את הגופן. מה
 * שמפריד הוא רוחב טקסט על canvas מול serif. ורוחב תחת השם `Segoe UI` הוא מה
 * שמוכיח שההתאמה עובדת: זה שם שאין לו קובץ ב-macOS, ואם הוא מודד אחרת מ-serif
 * — הגליפים באו מהקובץ הארוז.
 *
 *   npm run build && npm run check:fonts
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, requireChrome, sleep } from './cdp.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const INDEX = join(DIST, 'index.html');

if (!existsSync(INDEX)) {
  console.error('dist/index.html אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}
requireChrome();

/** שני השמות ושלושת המשקלים. אין נטוי: Selawik אינו מספק פנים כזאת. */
const SPECS = [
  '400 16px "Selawik"',
  '600 16px "Selawik"',
  '700 16px "Selawik"',
  '400 16px "Segoe UI"',
  '600 16px "Segoe UI"',
  '700 16px "Segoe UI"',
];

const PROBE = `(async function () {
  for (var i = 0; i < 200 && !document.getElementById('bundled-fonts'); i++) {
    await new Promise(function (r) { setTimeout(r, 25); });
  }
  if (!document.getElementById('bundled-fonts')) return { injected: false };

  var specs = ${JSON.stringify(SPECS)};
  var results = [];
  for (var s = 0; s < specs.length; s++) {
    try {
      // טקסט לטיני בכוונה: אין בגופן עברית, ובקשה לעברית לא תטען אותו.
      var faces = await document.fonts.load(specs[s], 'ABC');
      results.push({ spec: specs[s], loaded: faces.length });
    } catch (e) {
      results.push({ spec: specs[s], error: String(e) });
    }
  }

  function width(family) {
    var c = document.createElement('canvas').getContext('2d');
    c.font = '40px ' + family;
    return c.measureText('Handgloves Wgm').width;
  }

  return {
    injected: true,
    origin: location.protocol,
    results: results,
    fontsSize: document.fonts.size,
    widthSelawik: width('"Selawik", serif'),
    widthSegoeAlias: width('"Segoe UI", serif'),
    widthSerif: width('serif')
  };
})()`;

const page = await openPage(`file://${INDEX}`, { label: 'fonts' });
let report;
try {
  // המעטפת מזריקה את ההצהרות בשורה הראשונה של main(); הדף עדיין עולה.
  await sleep(1500);
  report = await page.cdp.evaluate(PROBE);
} finally {
  page.close();
}

const errors = [];
if (!report?.injected) {
  errors.push('ההצהרות לא הוזרקו — installBundledFonts() לא רץ');
} else {
  for (const result of report.results) {
    if (result.loaded !== 1) {
      errors.push(`הפנים ${result.spec} לא נטענה (${result.error ?? `loaded=${result.loaded}`})`);
    }
  }
  if (report.fontsSize !== SPECS.length) {
    errors.push(`document.fonts מכיל ${report.fontsSize} פנים, צפוי ${SPECS.length}`);
  }
  if (report.widthSelawik === report.widthSerif) {
    errors.push('רוחב הטקסט ב-Selawik זהה ל-serif — הקובץ לא נטען בפועל');
  }
  if (report.widthSegoeAlias === report.widthSerif) {
    errors.push('רוחב הטקסט תחת „Segoe UI” זהה ל-serif — ההתאמה אינה עובדת');
  }
}

console.log(
  `origin=${report?.origin ?? '?'} fonts=${report?.fontsSize ?? 0} ` +
    `Selawik=${report?.widthSelawik}px Segoe-alias=${report?.widthSegoeAlias}px ` +
    `serif=${report?.widthSerif}px`,
);

if (errors.length) {
  for (const error of errors) console.error(`שגיאה: ${error}`);
  process.exit(1);
}
console.log('שער הגופן עבר: הגופן הארוז נטען מ-file:// בשני השמות ובכל המשקלים.');
