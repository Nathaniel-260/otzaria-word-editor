/**
 * שער QA לגלילת הרצועה בגלגלת העכבר.
 *
 * ## למה זה לא יכול להיות בדיקת רכיב
 *
 * שתי ההבטחות כאן הן **פריסה ואירוע קלט אמיתי**, ו-jsdom אינו נותן אף אחת
 * מהן: כל `scrollWidth` שם הוא אפס, וכל `WheelEvent` שם הוא אובייקט שנבנה
 * ביד. מה שנמדד כאן הוא הגלגלת של המערכת דרך `Input.dispatchMouseEvent`,
 * על רצועה שגולשת באמת.
 *
 * המדידה שהולידה את השער: חלון 900px, לשונית „בית” — `scrollWidth` 1227 מול
 * `clientWidth` 900, ו-`scrollLeft` נשאר **0** אחרי גלגול מטה ואחרי גלגול
 * מעלה. כלומר 327 פיקסלים של פקדים שאין דרך להגיע אליהם בגלגלת; כרום אינו
 * מתרגם ציר אנכי לציר אופקי בעצמו.
 *
 * נמדד כאן גם מה שנשאר של הדפדפן, ובכוונה: `deltaX` (מחווה אופקית, וגם
 * Shift+גלגלת שכרום ממיר לציר X) — הקוד שלנו מוותר עליו, ולכן השורה הזאת היא
 * מה שיגלה אם הדפדפן יפסיק לגלול אותו.
 *
 * יציאה 9412 בלבד — שערים אחרים רצים במקביל על יציאות אחרות.
 *
 *   npm run build && node scripts/qa/ribbon-wheel-qa.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, createReport } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = join(ROOT, 'tmp');

/** חלון צר בכוונה: זה מה שמכריח את הרצועה לגלוש. */
const WINDOW = { width: 900, height: 700 };

/** גלגול אחד של גלגלת אמיתית בכרום. */
const NOTCH = 100;

/* `strict`: זה שער ולא סקר — פקד שאי אפשר להגיע אליו הוא רגרסיה, ומפיל. */
const report = createReport('גלילת הרצועה בגלגלת', { strict: true });
const app = await openApp({ name: 'ribbon-wheel', port: Number(process.env.QA_PORT ?? 9412) });

/** המידות של מכולת גלילה, ונקודה במרכזה לעמוד בה עם העכבר. */
const measure = (selector) =>
  app
    .js(
      `JSON.stringify((function () {
        var el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return {
          scrollLeft: Math.round(el.scrollLeft),
          overflow: Math.round(el.scrollWidth - el.clientWidth),
          direction: getComputedStyle(el).direction,
          /* נקודת עכבר בתוך המלבן, וגם כשהוא חורג מהחלון בצד אחד. */
          x: Math.round(Math.min(Math.max(r.left + r.width / 2, 2), window.innerWidth - 2)),
          y: Math.round(r.top + r.height / 2),
          onScreen: r.right > 0 && r.left < window.innerWidth && r.height > 0,
          pageScroll: Math.round(window.scrollY),
        };
      })())`,
    )
    .then(JSON.parse);

/** קיבוע נקודת פתיחה למדידה — גלילה ידנית, בלי גלגלת. */
const park = (selector, scrollLeft) =>
  app.js(
    `(function () {
       var el = document.querySelector(${JSON.stringify(selector)});
       el.scrollLeft = ${scrollLeft};
       return Math.round(el.scrollLeft);
     })()`,
  );

/**
 * גלגול אמיתי במקום שהעכבר עומד בו.
 *
 * `modifiers: 2` הוא Ctrl בפרוטוקול; הוא נמסר גם כ-`modifiers` וגם דרך
 * `Input.dispatchMouseEvent`, כי זה מה שמייצר `ctrlKey` על האירוע בדף.
 */
async function wheel(x, y, { deltaY = 0, deltaX = 0, modifiers = 0 } = {}) {
  await app.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX,
    deltaY,
    modifiers,
    button: 'none',
    buttons: 0,
    pointerType: 'mouse',
  });
  await app.sleep(350);
}

/** תצלום ל-`tmp/`. */
async function shoot(name) {
  mkdirSync(TMP, { recursive: true });
  const shot = await app.cdp.send('Page.captureScreenshot', { format: 'png' });
  const data = shot?.result?.data;
  if (!data) {
    console.error(`לא ניתן לצלם (${name})`);
    return;
  }
  writeFileSync(join(TMP, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`📸 tmp/${name}.png`);
}

const BODY = '.word-ribbon-body';
const GALLERY = '.style-cards-scroll';

try {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WINDOW.width,
    height: WINDOW.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await app.sleep(400);
  await app.tab('בית');

  /* -------------------------------------------------------------- */
  /* 1 — הרצועה גולשת בכלל                                            */
  /* -------------------------------------------------------------- */
  const start = await measure(BODY);
  if (!start) throw new Error(`אין ${BODY} בדף`);
  if (start.overflow <= 1) {
    report.fail(
      'הרצועה גולשת',
      `בחלון ${WINDOW.width}px אין גלישה (${start.overflow}px) — אין מה למדוד`,
    );
    throw new Error('אין גלישה');
  }
  report.pass('הרצועה גולשת', `${start.overflow}px מעבר לחלון, כיוון ${start.direction}`);
  await shoot('ribbon-wheel-start');

  /* -------------------------------------------------------------- */
  /* 2 — גלגלת מטה מתקדמת אל המשך הרצועה                              */
  /* -------------------------------------------------------------- */
  await wheel(start.x, start.y, { deltaY: NOTCH });
  const down = await measure(BODY);
  /* ב-RTL ההמשך שמאלה, כלומר `scrollLeft` יורד; ב-LTR עולה. הסימן נגזר
     מהכיווניות שנמדדה, ולא מונח. */
  const forward = start.direction === 'rtl' ? down.scrollLeft < start.scrollLeft : down.scrollLeft > start.scrollLeft;
  if (forward) {
    report.pass('גלגלת מטה מגלגלת קדימה', `${start.scrollLeft} → ${down.scrollLeft}`);
  } else {
    report.fail('גלגלת מטה מגלגלת קדימה', `נשאר ב-${down.scrollLeft}`);
  }
  await shoot('ribbon-wheel-scrolled');

  /* -------------------------------------------------------------- */
  /* 3 — וגלגלת מעלה חוזרת                                            */
  /* -------------------------------------------------------------- */
  await wheel(start.x, start.y, { deltaY: -NOTCH });
  const back = await measure(BODY);
  if (Math.abs(back.scrollLeft) < Math.abs(down.scrollLeft)) {
    report.pass('גלגלת מעלה חוזרת אחורה', `${down.scrollLeft} → ${back.scrollLeft}`);
  } else {
    report.fail('גלגלת מעלה חוזרת אחורה', `נשאר ב-${back.scrollLeft}`);
  }

  /* -------------------------------------------------------------- */
  /* 4 — בקצה: לא נתקעים, וגם לא גוררים את הדף                        */
  /* -------------------------------------------------------------- */
  await park(BODY, 0);
  await wheel(start.x, start.y, { deltaY: -NOTCH });
  const atStart = await measure(BODY);
  if (atStart.scrollLeft === 0 && atStart.pageScroll === 0) {
    report.pass('קצה ההתחלה יציב', 'הרצועה נשארה בהתחלה, והדף לא זז');
  } else {
    report.fail(
      'קצה ההתחלה יציב',
      `רצועה ${atStart.scrollLeft}, גלילת דף ${atStart.pageScroll}`,
    );
  }

  /* -------------------------------------------------------------- */
  /* 5 — Ctrl+גלגלת נשאר של הדפדפן (זום)                              */
  /* -------------------------------------------------------------- */
  await park(BODY, 0);
  await wheel(start.x, start.y, { deltaY: NOTCH, modifiers: 2 });
  const zoomed = await measure(BODY);
  if (zoomed.scrollLeft === 0) {
    report.pass('Ctrl+גלגלת אינו גולל', 'הרצועה לא זזה');
  } else {
    report.fail('Ctrl+גלגלת אינו גולל', `הרצועה זזה ל-${zoomed.scrollLeft}`);
  }

  /* -------------------------------------------------------------- */
  /* 6 — `deltaX` נשאר של הדפדפן, ונמדד                               */
  /* -------------------------------------------------------------- */
  await park(BODY, 0);
  /* לתוך הגלישה: ב-RTL זהו `deltaX` שלילי, וב-LTR חיובי. */
  await wheel(start.x, start.y, { deltaX: start.direction === 'rtl' ? -120 : 120 });
  const sideways = await measure(BODY);
  if (sideways.scrollLeft !== 0) {
    report.pass('מחווה אופקית נגללת בלי שנתערב', `הדפדפן הזיז ל-${sideways.scrollLeft}`);
  } else {
    report.partial(
      'מחווה אופקית נגללת בלי שנתערב',
      'הדפדפן לא הזיז — הציר האופקי אינו מטופל אצלנו בכוונה, וזו השורה שתגלה אם צריך',
    );
  }

  /* -------------------------------------------------------------- */
  /* 7 — קינון: הגלריה קודם, והרצועה כשנגמרה                          */
  /* -------------------------------------------------------------- */
  /* הגלריה יושבת בקצה השני של הרצועה; בלי לגלול אליה היא מחוץ למסך. */
  await park(BODY, start.direction === 'rtl' ? -start.overflow : start.overflow);
  const gallery = await measure(GALLERY);
  if (!gallery || !gallery.onScreen) {
    report.skip('קינון גלריה-ברצועה', 'הגלריה אינה על המסך בחלון הזה');
  } else if (gallery.overflow <= 1) {
    report.skip('קינון גלריה-ברצועה', 'הגלריה נכנסת כולה — אין בה מה לגלול');
  } else {
    await park(GALLERY, 0);
    const ribbonAtEnd = (await measure(BODY)).scrollLeft;
    await wheel(gallery.x, gallery.y, { deltaY: NOTCH });
    const inner = await measure(GALLERY);
    const outer = await measure(BODY);

    if (inner.scrollLeft !== 0 && outer.scrollLeft === ribbonAtEnd) {
      report.pass('הגלגלת מעל הגלריה גוללת את הגלריה', `גלריה ${inner.scrollLeft}, רצועה לא זזה`);
    } else {
      report.fail(
        'הגלגלת מעל הגלריה גוללת את הגלריה',
        `גלריה ${inner.scrollLeft}, רצועה ${ribbonAtEnd} → ${outer.scrollLeft}`,
      );
    }

    /* הגלריה בהתחלה וגלגול אחורה: אין לה לאן, וזה אמור להמשיך לרצועה. */
    await park(GALLERY, 0);
    const before = (await measure(BODY)).scrollLeft;
    await wheel(gallery.x, gallery.y, { deltaY: -NOTCH });
    const chained = await measure(BODY);
    if (Math.abs(chained.scrollLeft) < Math.abs(before)) {
      report.pass('כשנגמרה הגלריה, הגלגול ממשיך לרצועה', `${before} → ${chained.scrollLeft}`);
    } else {
      report.fail('כשנגמרה הגלריה, הגלגול ממשיך לרצועה', `הרצועה נשארה ב-${chained.scrollLeft}`);
    }
  }

  /* -------------------------------------------------------------- */
  /* 8 — לשוניות הרצועה, אם הן גולשות בחלון הזה                       */
  /* -------------------------------------------------------------- */
  const strip = await measure('.word-tab-strip');
  if (!strip || strip.overflow <= 1) {
    report.skip('לשוניות הרצועה נגללות', 'הלשוניות נכנסות כולן בחלון הזה');
  } else {
    await park('.word-tab-strip', 0);
    await wheel(strip.x, strip.y, { deltaY: NOTCH });
    const moved = await measure('.word-tab-strip');
    if (moved.scrollLeft !== 0) {
      report.pass('לשוניות הרצועה נגללות', `0 → ${moved.scrollLeft}`);
    } else {
      report.fail('לשוניות הרצועה נגללות', 'הפס לא זז');
    }
  }

  const noise = (await app.log()).filter((line) => !line.startsWith('warn:'));
  if (noise.length) console.log('לוג הדף:', noise.slice(0, 5).join(' | '));
} finally {
  report.print();
  app.close();
}
