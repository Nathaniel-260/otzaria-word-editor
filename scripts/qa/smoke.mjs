/**
 * שער העשן של המסגרת עצמה: מוכיח שהיא באמת פותחת מסמך, ממקמת סמן, לוחצת
 * לחיצה אמיתית על פקד ברצועה, ורואה את התוצאה ב-docx המיוצא.
 *
 * אם זה נכשל — כל שער אחר שמסתמך על המסגרת מודד רעש.
 */
import { openApp, createReport } from './harness.mjs';

const report = createReport('שער עשן — המסגרת');
const app = await openApp({ name: 'smoke', port: Number(process.env.QA_PORT ?? 9351) });

try {
  console.log('לשוניות:', await app.js('JSON.stringify(window.__qa.tabs())'));
  console.log('שורות במסמך:', await app.lineCount());

  await app.caret(0);
  await app.type('shalom');
  await app.sleep(800);
  const text = await app.screenText();
  console.log('טקסט על המסך:', JSON.stringify(text?.slice(0, 120)));
  text && text.includes('shalom') ? report.pass('הקלדה נכנסת למסמך') : report.fail('הקלדה', String(text).slice(0, 80));

  // סימון הטקסט שהוקלד, ואז מודגש
  await app.press('Home', 'Home', 36);
  await app.sleep(200);
  await app.extendSelection(6);
  console.log('בחירה:', JSON.stringify(await app.selection()));

  await app.tab('בית');
  const boldBefore = await app.state('מודגש');
  console.log('מצב „מודגש” לפני:', JSON.stringify(boldBefore));
  const clicked = await app.click('מודגש');
  await app.sleep(700);
  const boldAfter = await app.state('מודגש');
  console.log('מצב „מודגש” אחרי:', JSON.stringify(boldAfter));
  console.log('שורת מצב:', JSON.stringify(await app.status()));

  clicked ? report.pass('נמצא הכפתור „מודגש” ונלחץ') : report.fail('הכפתור „מודגש” לא נמצא');

  const files = await app.docx();
  if (!files) {
    report.fail('ייצוא docx', 'לא הוחזר קובץ');
  } else {
    const names = Object.keys(files);
    console.log('קבצים ב-docx:', names.join(', '));
    const doc = files['word/document.xml'] || '';
    console.log('document.xml (600 תווים):', doc.slice(0, 600));
    names.includes('word/document.xml') ? report.pass('ייצוא docx נקרא', `${names.length} קבצים`) : report.fail('ייצוא docx', names.join(','));
    /<w:b\b/.test(doc) ? report.pass('„מודגש” נכתב ל-OOXML') : report.fail('„מודגש” לא הופיע ב-document.xml');
    doc.includes('shalom') ? report.pass('הטקסט שהוקלד נמצא ב-docx') : report.fail('הטקסט שהוקלד אינו ב-docx');
  }

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
