/**
 * שער בדיקת האיות התורנית, על ה-dist הארוז ב-Chrome אמיתי.
 *
 * ארבע טענות, וכל אחת היא דבר שהיה נשבר בשקט:
 *
 *   1. **עצלות** — הנכס של המילון (1.3MB) אינו נטען עד שמדליקים. אם מישהו
 *      יחזיר אותו ל-`import`, Vite יבלע אותו לתוך `assets/app.js` והבדיקה
 *      הזאת היא היחידה שתראה זאת: הכול ימשיך לעבוד, רק לאט יותר לכולם.
 *   2. **דיוק** — מילה תורנית אינה מסומנת, ומילת ג'יבריש כן. בדיקת איות
 *      שמסמנת הכול היא בדיוק מה שהמילון הזה נבנה כדי למנוע.
 *   3. **„הוסף למילון”** — לחיצה ימנית על מילה מסומנת מציעה להוסיף אותה,
 *      והסימון נעלם.
 *   4. **מחיר** — זמן טעינה, זמן מדידה חוזרת, וגידול הזיכרון. המספרים
 *      נדפסים כעדות; הסף חוסם רק מה שכבר לא ניתן לחיות איתו.
 */
import { openApp, createReport, sleep } from './harness.mjs';

/** תקרות: מה שמעליהן כבר נראה למשתמש כתקיעה, ולא כמדידה איטית. */
const MAX_LOAD_MS = 3_000;
const MAX_RESCAN_MS = 25;

const report = createReport('שער בדיקת איות תורנית', { strict: true });
const app = await openApp({ name: 'spellcheck', port: Number(process.env.QA_PORT ?? 9362) });

/** פסקה תורנית עם שתי מילים שאינן במילון בשום צורה. */
const PARAGRAPH =
  'ועיין בתוספות שכתב הרא"ש דהא דאמרינן בגמרא ותירצו דהמדובר בשעת הדחק ' +
  'ויש לעיין בשולחן ערוך כדעת הרמ"א ובמשנה ברורה זזזזזז חחחחחח ';

try {
  /* 1. עצלות ------------------------------------------------------- */
  const beforeLoad = await app.js(
    "JSON.stringify({ global: typeof window.__OTZARIA_TORAH_DICTIONARY__, tags: document.querySelectorAll('script[src*=\"torah-dictionary\"]').length })",
  );
  console.log('לפני ההדלקה:', beforeLoad);
  JSON.parse(beforeLoad).global === 'undefined'
    ? report.pass('המילון אינו נטען כל עוד הבדיקה כבויה')
    : report.fail('המילון נטען בעלייה', beforeLoad);

  /* המסמך: אותה פסקה שוב ושוב, כדי שיהיה מה למדוד ------------------- */
  const built = await app.js(`(async () => {
    const doc = window.__otzariaEditor.superdoc.activeEditor.doc;
    const listed = await doc.blocks.list({ includeText: true });
    const first = listed.blocks[0];
    await doc.replace({
      target: { kind: 'selection',
        start: { kind: 'text', blockId: first.nodeId, offset: 0 },
        end: { kind: 'text', blockId: first.nodeId, offset: (first.text || '').length } },
      text: new Array(6).fill(${JSON.stringify(PARAGRAPH)}).join(''),
    });
    return 'ok';
  })()`);
  console.log('בניית המסמך:', built);
  await sleep(1_500);

  /* 2. הדלקה, ומה נמדד --------------------------------------------- */
  await app.tab('סקירה');
  const startedAt = Date.now();
  const clicked = await app.click('בדיקת איות');
  clicked ? report.pass('נמצא המתג „בדיקת איות” ונלחץ') : report.fail('המתג „בדיקת איות” לא נמצא');

  let marks = 0;
  for (let waited = 0; waited < MAX_LOAD_MS + 5_000; waited += 250) {
    await sleep(250);
    marks = Number(await app.js("document.querySelectorAll('.spelling-layer__mark').length"));
    if (marks > 0) break;
  }
  const loadMs = Date.now() - startedAt;
  console.log(`טעינה עד לסימון הראשון: ${loadMs}ms, ${marks} סימונים`);

  marks > 0 ? report.pass('הסימון מצויר', `${marks} מילים`) : report.fail('לא צויר אף סימון');
  loadMs <= MAX_LOAD_MS
    ? report.pass('זמן הטעינה סביר', `${loadMs}ms`)
    : report.fail('טעינת המילון איטית מדי', `${loadMs}ms > ${MAX_LOAD_MS}ms`);

  const loaded = await app.js(
    "JSON.stringify({ chars: (window.__OTZARIA_TORAH_DICTIONARY__ || '').length, tags: document.querySelectorAll('script[src*=\"torah-dictionary\"]').length })",
  );
  console.log('אחרי ההדלקה:', loaded);
  JSON.parse(loaded).tags === 1
    ? report.pass('הנכס נמשך פעם אחת בלבד')
    : report.fail('הנכס נמשך יותר מפעם אחת', loaded);

  /* 3. דיוק --------------------------------------------------------- */
  const marked = JSON.parse(
    await app.js(`(() => {
      const seen = new Set();
      for (const el of document.querySelectorAll('.spelling-layer__mark')) {
        const box = el.getBoundingClientRect();
        seen.add(Math.round(box.left) + 'x' + Math.round(box.top));
      }
      return JSON.stringify({ boxes: seen.size });
    })()`),
  );
  console.log('מלבנים ייחודיים:', marked.boxes);
  marked.boxes === marks
    ? report.pass('כל סימון במקום משלו — אין ציור כפול')
    : report.fail('שני סימונים על אותו מלבן', `${marked.boxes} ייחודיים מתוך ${marks}`);

  // שש חזרות של הפסקה × שתי מילות ג'יבריש; העמודים שמחוץ לחלון אינם נסרקים,
  // ולכן זה רף תחתון ולא שוויון.
  marks >= 12
    ? report.pass('כל המילים שאינן במילון סומנו', `${marks} ≥ 12`)
    : report.fail('חסרים סימונים', `${marks} < 12`);
  marks <= 24
    ? report.pass('מילים תורניות לא סומנו', `${marks} ≤ 24`)
    : report.fail('סומנו מילים תורניות מוכרות', `${marks} > 24`);

  /* 4. מחיר --------------------------------------------------------- */
  /**
   * חסם עליון על המדידה שהשכבה עושה בכל פריים: אותו מעבר בדיוק — TreeWalker,
   * קיבוץ לפי תגיות inline, ו-`Range` **לכל מילה עברית** — בעוד שבפועל טווח
   * נבנה רק למילים שאינן במילון (‏~5%). מה שנמדד כאן גדול לכן פי כמה ממה
   * שקורה באמת, וזה מכוון: שער שמודד את המקרה הקל אינו שער.
   */
  const cost = JSON.parse(
    await app.js(`(() => {
      const host = window.__otzariaEditor.ui.viewport.getHost();
      const layer = document.querySelector('.spelling-layer');
      if (!host || !layer) return JSON.stringify({ error: 'no-host' });
      const INLINE = new Set(['SPAN','A','B','STRONG','I','EM','U','S','SUB','SUP','MARK','CODE','FONT']);
      const WORD = /[\u05D0-\u05EA][\u05D0-\u05EA'"]*/g;

      function pass() {
        const reference = layer.getBoundingClientRect();
        let words = 0, rects = 0;
        for (const page of host.querySelectorAll('[data-page-index]')) {
          const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
          let parts = [], text = '', group = null, node;
          const flush = () => {
            WORD.lastIndex = 0;
            let match;
            while ((match = WORD.exec(text))) {
              words++;
              let from = null, to = null;
              for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i];
                if (to === null && match.index + match[0].length >= part.offset) to = { node: part.node, at: match.index + match[0].length - part.offset };
                if (match.index >= part.offset) { from = { node: part.node, at: match.index - part.offset }; break; }
              }
              if (!from || !to) continue;
              const range = document.createRange();
              try { range.setStart(from.node, from.at); range.setEnd(to.node, to.at); } catch { continue; }
              const list = range.getClientRects();
              for (let i = 0; i < list.length; i++) {
                const r = list[i];
                if (r.width > 0 && r.height > 0) { void (r.left - reference.left); rects++; }
              }
            }
            parts = []; text = '';
          };
          while ((node = walker.nextNode())) {
            const value = node.nodeValue || '';
            if (!value) continue;
            let owner = node.parentElement;
            while (owner && owner !== page && INLINE.has(owner.tagName)) owner = owner.parentElement;
            if (owner !== group) { flush(); group = owner; }
            parts.push({ node, offset: text.length });
            text += value;
          }
          flush();
        }
        return { words, rects };
      }

      pass();
      const t0 = performance.now();
      let last;
      for (let i = 0; i < 10; i++) last = pass();
      const perPass = (performance.now() - t0) / 10;
      return JSON.stringify({
        perPassMs: +perPass.toFixed(2),
        words: last.words,
        rects: last.rects,
        heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      });
    })()`),
  );
  console.log('מדידה חוזרת:', JSON.stringify(cost));
  cost.perPassMs >= 0 && cost.perPassMs <= MAX_RESCAN_MS
    ? report.pass('המדידה החוזרת זולה', `${cost.perPassMs}ms ל-${cost.words} מילים`)
    : report.fail('המדידה החוזרת יקרה מדי', `${cost.perPassMs}ms > ${MAX_RESCAN_MS}ms`);

  /* 5. „הוסף למילון” ------------------------------------------------ */
  const markBox = JSON.parse(
    await app.js(`(() => {
      const el = document.querySelector('.spelling-layer__mark');
      if (!el) return 'null';
      const b = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(b.left + b.width / 2), y: Math.round(b.top - 6) });
    })()`),
  );

  if (!markBox) {
    report.fail('אין סימון ללחוץ עליו');
  } else {
    await app.cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: markBox.x, y: markBox.y, button: 'right', buttons: 2, clickCount: 1,
    });
    await app.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: markBox.x, y: markBox.y, button: 'right', buttons: 0, clickCount: 1,
    });
    await sleep(600);

    const items = JSON.parse(
      await app.js(`(() => {
        const menu = document.querySelector('[role="menu"]');
        if (!menu) return 'null';
        return JSON.stringify(Array.prototype.map.call(menu.querySelectorAll('button'), (b) => (b.textContent || '').trim()));
      })()`),
    );
    console.log('פריטי התפריט:', JSON.stringify(items));

    const add = Array.isArray(items) ? items.find((label) => label.startsWith('הוסף את')) : null;
    if (!add) {
      report.fail('„הוסף למילון” אינו בתפריט על מילה מסומנת', JSON.stringify(items));
    } else {
      report.pass('„הוסף למילון” מוצע על מילה מסומנת', add);
      const before = marks;
      // `clickMenu` של המסגרת מכוון לתפריטי הרצועה (`.ribbon-menu__popover`),
      // ותפריט ההקשר הוא כרטיס אחר — לכן לחיצה לפי מלבן הפריט עצמו.
      const itemBox = JSON.parse(
        await app.js(`(() => {
          const menu = document.querySelector('[role="menu"]');
          for (const button of menu.querySelectorAll('button')) {
            if (!(button.textContent || '').trim().startsWith('הוסף את')) continue;
            const b = button.getBoundingClientRect();
            return JSON.stringify({ x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) });
          }
          return 'null';
        })()`),
      );
      await app.clickAt(itemBox.x, itemBox.y);
      await sleep(1_500);
      const after = Number(await app.js("document.querySelectorAll('.spelling-layer__mark').length"));
      console.log(`סימונים לפני: ${before}, אחרי ההוספה: ${after}`);
      after < before
        ? report.pass('הסימון נעלם אחרי ההוספה למילון', `${before} ⟵ ${after}`)
        : report.fail('הסימון נשאר אחרי ההוספה', `${before} ⟵ ${after}`);
    }
  }

  /* 6. כיבוי -------------------------------------------------------- */
  await app.escape();
  await app.tab('סקירה');
  await app.click('בדיקת איות');
  await sleep(800);
  const off = Number(await app.js("document.querySelectorAll('.spelling-layer__mark').length"));
  off === 0 ? report.pass('כיבוי מוחק את כל הסימונים') : report.fail('נשארו סימונים אחרי כיבוי', String(off));

  console.log('לוג הדף:', JSON.stringify(await app.log()));
} finally {
  app.close();
}

process.exit(report.print() > 0 ? 1 : 0);
