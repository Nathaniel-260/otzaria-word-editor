/**
 * מחוון הטעינה בשורת המצב, ו„דלג” שמפסיק את ההמתנה.
 *
 * למה שער חי ולא בדיקת יחידה בלבד: הבדיקות ב-`tests/unit/document-load.test.ts`
 * מודדות את המודל, וב-`tests/component/shell-bars.test.ts` את הרינדור — אבל
 * שתיהן מוזנות ממספרים שאני מסרתי להן. מה שאי אפשר להניח הוא ש**הפתיחה
 * האמיתית** מדווחת אותם: שהמחוון עולה על מסמך שנפתח מהמאחז, שהוא זז בזמן
 * שהמנוע עובד, ושהוא יורד כשנגמר. פתיחה שאינה מדווחת אף תחנה תיראה כאן כפס
 * שקפא, ואילו בבדיקות היחידה היא תמשיך לעבור.
 *
 * ההאטה מוזרקת ב-`fetch` של המסמך עצמו ולא במנוע: `preflightSource` קורא את
 * הבייטים לפני שהמנוע רואה אותם (engine/docx-preflight.ts), וזה השלב היחיד
 * שאפשר להאריך בלי לגעת במנוע — כלומר בלי לשנות את מה שנמדד. „דלג” בשלב הזה
 * הוא גם המסלול שבו הביטול נבדק במלואו: הוא חייב למנוע מהפתיחה להמשיך למנוע
 * בכלל, ולא רק לזרוק את התוצאה שלה.
 *
 * ## „דלג” נמדד על הטאבים, לא על הכותרת הפעילה
 *
 * שלוש הטענות סביב „דלג” נכתבו כשלתוסף היה מסמך אחד, והן דרשו שהכותרת תישאר
 * כשהייתה ושיהיה host יחיד. מאז „פתח קובץ” **מפעיל טאב חדש** לפני הפתיחה
 * (App.vue, מיד לפני `openDocument`), ולכן שלושתן נכשלו על התנהגות תקינה:
 * הכותרת הפעילה היא של הטאב החדש, ויש host לכל טאב.
 *
 * מה שנמדד עכשיו הוא מה שבאמת אסור לקרות: שהמסמך הקודם ייעלם (הוא חייב
 * להישאר בטאב שלו), שיישאר host **עודף** מעבר למספר הטאבים (זה של הפתיחה
 * שנזנחה), ושהפתיחה שבוטלה תתיישב באיחור (השם שנזנח אסור שיופיע בשום טאב).
 * הטאב החדש עם „מסמך חדש” בתוכו אינו כשל — זה `onSkipLoad` שמוצא טאב בלי
 * מסמך ופותח בו אחד ריק, בכוונה.
 *
 *   node scripts/qa/load-progress-qa.mjs
 */
import { openApp, createReport, sleep } from './harness.mjs';

const PORT = Number(process.env.QA_PORT ?? 9381);
const report = createReport('מחוון הטעינה ו„דלג”', { strict: true });

/**
 * מאט את קריאת המסמך, ומקליט את שורת המצב 20 פעמים בשנייה.
 *
 * ההקלטה בתוך הדף ולא ב-CDP מדגימה את מה שהמשתמש רואה: כל דגימה היא tick על
 * החוט הראשי, ולכן חוט שנחסם משאיר חור בהקלטה במקום להסתיר את עצמו מאחורי
 * זמני רשת של הפרוטוקול.
 */
const INSTRUMENT = `
<script>
(function () {
  var slow = (window.__qaSlow = { ms: 0, hits: 0 });
  var fetch0 = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (slow.ms > 0 && url.indexOf('data:application/vnd.openxml') === 0) {
      slow.hits++;
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(fetch0(input, init)); }, slow.ms);
      });
    }
    return fetch0(input, init);
  };

  var samples = (window.__qaLoad = []);
  setInterval(function () {
    var box = document.querySelector('.status-load');
    var bar = box && box.querySelector('[role="progressbar"]');
    var text = box && box.querySelector('.status-load__text');
    samples.push({
      t: Math.round(performance.now()),
      on: !!box,
      pct: bar ? Number(bar.getAttribute('aria-valuenow')) : null,
      text: text ? (text.textContent || '').trim() : null,
      skip: !!(box && box.querySelector('.status-load__skip')),
    });
  }, 50);
  window.__qaLoadReset = function () { samples.length = 0; };
})();
<\/script>
`;

/** המסמך שייפתח: ה-DOCX של המסמך שעל המסך, כ-data: URL. */
async function armPicker(app, name) {
  const base64 = await app.js('window.__qa.exportBase64()');
  const dataUrl =
    'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + base64;
  await app.js(
    `window.__qaHost.replies['fs.pickUserFile']=function(){return Promise.resolve({success:true,error:null,` +
      `data:{token:'qa-load-token',url:${JSON.stringify(dataUrl)},name:${JSON.stringify(name)},size:2048,access:'readwrite'}})}`,
  );
}

const samples = (app) => app.js('JSON.stringify(window.__qaLoad)').then(JSON.parse);
const titleNow = (app) => app.js("document.querySelector('.doc-title-input')?.value ?? null");
const hostCount = (app) => app.js("document.querySelectorAll('.editor-stack__host').length");
/** תוויות הטאבים. ה-`×` של כפתור הסגירה הוא חלק מה-textContent ולכן נחתך. */
const tabTitles = (app) =>
  app
    .js(
      'JSON.stringify(Array.from(document.querySelectorAll(".word-doctab")).map(function (n) { return (n.textContent || "").trim().replace(/\u00d7$/, ""); }))',
    )
    .then(JSON.parse);

/** הדגימות שבהן המחוון היה על המסך. */
const shown = (all) => all.filter((s) => s.on);

/**
 * ממתינה לפתיחה שהסתיימה — לא לזמן שנראה מספיק.
 *
 * חלון קבוע נכשל כאן פעם אחת, ולא בגלל המוצר: פתיחה על Chrome קר נמשכה מעבר
 * לחלון, והכותרת נקראה בדיוק בין `onReady` לרענון של Vue. שער שמודד מחוון
 * טעינה אינו יכול להיות זה שנשען על תזמון.
 */
async function waitOpened(app, name, ms = 40_000) {
  for (let waited = 0; waited < ms; waited += 250) {
    await sleep(250);
    if (!(await app.exists('.status-load')) && (await titleNow(app)) === name) return true;
  }
  return false;
}

async function main() {
  const app = await openApp({ name: 'load-progress', port: PORT, extra: INSTRUMENT });

  try {
    await app.tab('קובץ');

    /* ------------------------------------------------------------------ */
    await (async function stageOne() {
      await armPicker(app, 'מחוון.docx');
      await app.js('window.__qaSlow.ms = 1500; window.__qaLoadReset()');
      await app.click('פתח קובץ', { after: 300 });
      const settled = await waitOpened(app, 'מחוון');

      const all = await samples(app);
      const on = shown(all);
      const pcts = on.map((s) => s.pct).filter((p) => typeof p === 'number');
      const stages = [...new Set(on.map((s) => s.text).filter(Boolean))];
      const title = await titleNow(app);
      const hits = await app.js('window.__qaSlow.hits');

      console.log(`  דגימות: ${all.length}, מהן עם מחוון: ${on.length} | האטה נתפסה: ${hits}`);
      console.log(`  אחוזים: ${pcts.slice(0, 4).join(',')} … ${pcts.slice(-4).join(',')}`);
      console.log(`  שלבים על המסך: ${stages.join(' | ')}`);

      if (on.length === 0) {
        report.fail('המחוון מופיע', 'שורת המצב לא הציגה מחוון בשום דגימה של פתיחה שנמשכה יותר משנייה');
      } else if (!stages.some((s) => s.includes('מחוון.docx'))) {
        report.fail('המחוון מופיע', `המחוון לא אמר מה נטען: ${stages.join(' | ')}`);
      } else {
        report.pass(
          'המחוון מופיע',
          `${on.length} דגימות עם פס, ושם המסמך הנטען עליו (${stages.length} שלבים)`,
        );
      }

      // התקדמות אמיתית: יותר מערך אחד, ואף פעם לא אחורה. פס שקופא על מספר
      // אחד לכל אורך הפתיחה אינו מחוון אלא קישוט.
      const distinct = new Set(pcts).size;
      const regressed = pcts.findIndex((p, i) => i > 0 && p < pcts[i - 1]);
      const overflow = pcts.filter((p) => p > 100).length;
      if (distinct >= 3 && regressed === -1 && overflow === 0) {
        report.pass(
          'הפס מתקדם ואינו נסוג',
          `${distinct} ערכים שונים, כולם עולים, מ-${Math.min(...pcts)}% ל-${Math.max(...pcts)}%`,
        );
      } else {
        report.fail(
          'הפס מתקדם ואינו נסוג',
          `שונים=${distinct} נסיגה בדגימה ${regressed} מעל-100=${overflow}`,
        );
      }

      // הפתיחה נגמרה: המחוון ירד, והמסמך שהוא תיאר אכן נפתח. וגם התחנה
      // האחרונה נמדדת — פס שנעלם בלי להגיע ל-100% קופץ מ-88 לאין.
      const reached100 = pcts.includes(100);
      if (settled && reached100) {
        report.pass(
          'המחוון יורד בסוף',
          `המסמך נפתח („${title}”), הפס עבר ב-100% והוא אינו על המסך`,
        );
      } else {
        report.fail('המחוון יורד בסוף', `הסתיים=${settled} הגיע ל-100=${reached100} כותרת=${title}`);
      }
    })();

    /* ------------------------------------------------------------------ */
    await (async function stageSkip() {
      const before = await titleNow(app);
      const loadName = 'ננטש.docx';
      await armPicker(app, loadName);
      await app.js('window.__qaSlow.ms = 6000; window.__qaLoadReset()');

      // הלחיצה נזרקת ואינה מומתנת: הפתיחה נמשכת ברקע, וזה בדיוק המצב שבו
      // „דלג” אמור להיות זמין.
      await app.click('פתח קובץ', { after: 900 });

      const midway = await samples(app);
      const skipVisible = shown(midway).some((s) => s.skip);
      const clicked = await app.clickSel('.status-load__skip', 0, { after: 1200 });

      const st = await app.status();
      const after = await titleNow(app);
      const hosts = await hostCount(app);
      // „המסמך נשאר” נמדד על ה-session החי ולא על טקסט המסך: המסמך שנפתח כאן
      // הוא ה-DOCX של מסמך ריק, ולכן מסך ריק הוא בדיוק מה שצריך להיראות בו.
      const alive = await app.js(
        "window.__otzariaEditor && window.__otzariaEditor.superdoc ? 'yes' : 'no'",
      );

      console.log(`  „דלג” נראה: ${skipVisible} | נלחץ: ${clicked} | session חי: ${alive}`);
      console.log(`  status: ${JSON.stringify(st)} | כותרת: ${before} → ${after} | hosts: ${hosts}`);

      if (skipVisible && clicked) {
        report.pass('„דלג” על המסך ונלחץ', 'הכפתור הופיע לצד הפס בזמן פתיחה, ולחיצה עליו נתפסה');
      } else {
        report.fail('„דלג” על המסך ונלחץ', `נראה=${skipVisible} נלחץ=${clicked}`);
      }

      const gone = !(await app.exists('.status-load'));
      const tabs = await tabTitles(app);
      // „המסמך לא אבד” נמדד על הטאבים ולא על הכותרת הפעילה: „פתח קובץ” מפעיל
      // טאב חדש (App.vue, לפני `openDocument`), ולכן המסמך הקודם ממשיך
      // להתקיים — בטאב שלו — גם כשהכותרת הפעילה היא של הטאב החדש.
      const kept = tabs.includes(before) && alive === 'yes';
      const said = typeof st?.text === 'string' && st.text.includes('הופסקה');
      const quiet = st?.isError !== true;

      if (gone && kept && said && quiet) {
        report.pass(
          '„דלג” מפסיק בלי לאבד את המסמך הפתוח',
          `הפס ירד, „${before}” עדיין בטאב שלו (${tabs.join(' | ')}), ושורת המצב אמרה „${st.text}” בלי שגיאה`,
        );
      } else {
        report.fail(
          '„דלג” מפסיק בלי לאבד את המסמך הפתוח',
          `פס ירד=${gone} מסמך נשמר=${kept} טאבים=${JSON.stringify(tabs)} כותרת=${after} הודעה=${JSON.stringify(st)}`,
        );
      }

      // ה-host של המועמד שנזנח אינו נשאר על המסך, וגם לא מתחת למסמך הפעיל.
      // מול מספר הטאבים ולא מול 1: כל טאב מחזיק host משלו, ומה שנמדד כאן הוא
      // שאין host **עודף** — זה של הפתיחה שנזנחה.
      if (hosts === tabs.length) {
        report.pass('הפתיחה שנזנחה מפונה', `${hosts} hosts ל-${tabs.length} טאבים — אין host עודף`);
      } else {
        report.fail(
          'הפתיחה שנזנחה מפונה',
          `${hosts} hosts ב-editor-stack מול ${tabs.length} טאבים אחרי הביטול`,
        );
      }

      // ולא הגיע למנוע בכלל: המשתמש ביטל בזמן שהבייטים נקראו, ומי שממשיך
      // משם ל-`swap.open` בונה מסמך שאיש לא ביקש — וההוכחה היא שהמסמך הפתוח
      // אינו מתחלף גם אחרי שההאטה נגמרה.
      await sleep(6500);
      const late = await titleNow(app);
      const lateStatus = await app.status();
      console.log(`  אחרי שההאטה נגמרה: כותרת=${late} status=${JSON.stringify(lateStatus)}`);
      const lateAlive = await app.js(
        "window.__otzariaEditor && window.__otzariaEditor.superdoc ? 'yes' : 'no'",
      );
      // מה שנמדד הוא שהמסמך שנזנח **אינו מופיע** — לא שהכותרת חזרה לקודמת:
      // הטאב הפעיל הוא החדש, ובו „מסמך חדש”. טאב שיקבל את „ננטש” באיחור הוא
      // בדיוק הכשל שהשורה הזאת שומרת מפניו.
      const lateTabs = await tabTitles(app);
      const abandoned = loadName.replace(/\.docx$/, '');
      const settledLate = late === abandoned || lateTabs.includes(abandoned);
      if (!settledLate && lateAlive === 'yes' && lateTabs.includes(before)) {
        report.pass(
          'הפתיחה שבוטלה אינה מתיישבת באיחור',
          `גם אחרי שהקריאה הסתיימה „${abandoned}” אינו על המסך, ו-„${before}” עדיין בטאב שלו`,
        );
      } else {
        report.fail(
          'הפתיחה שבוטלה אינה מתיישבת באיחור',
          `כותרת=${late} טאבים=${JSON.stringify(lateTabs)} (״${abandoned}״ לא אמור להופיע, ״${before}״ כן)`,
        );
      }
    })();

    /* ------------------------------------------------------------------ */
    await (async function stageAgain() {
      // אחרי ביטול הממשק אינו נשאר חסום: „פתח קובץ” עובד שוב.
      await armPicker(app, 'שוב.docx');
      await app.js('window.__qaSlow.ms = 0; window.__qaLoadReset()');
      await app.click('פתח קובץ', { after: 300 });
      await waitOpened(app, 'שוב');

      const title = await titleNow(app);
      const st = await app.status();
      const on = shown(await samples(app));
      console.log(`  כותרת: ${title} | status: ${JSON.stringify(st)} | דגימות עם מחוון: ${on.length}`);

      if (title === 'שוב' && st?.isError !== true) {
        report.pass('אפשר לפתוח שוב אחרי „דלג”', `„${title}” נפתח, ושורת המצב נקייה`);
      } else {
        report.fail('אפשר לפתוח שוב אחרי „דלג”', `כותרת=${title} status=${JSON.stringify(st)}`);
      }
    })();
  } finally {
    app.close();
  }

  report.print();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
