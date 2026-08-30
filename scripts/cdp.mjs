/**
 * נהיגה בדפדפן דרך CDP, בשביל השערים שאי אפשר לבדוק ב-jsdom: הם דורשים
 * `file://` אמיתי, workers אמיתיים ומנוע DOCX אמיתי.
 *
 * למה לא `--dump-dom`: הוא ממתין לאירוע ה-load, וברגע שמנוע ה-DOCX עולה האירוע
 * הזה אינו מגיע — הדפדפן נתלה (נמדד). `--virtual-time-budget` נתקע מול
 * ה-workers מאותה סיבה. CDP מאפשר לשאול את הדף מה קורה בו בזמן שהוא חי.
 *
 * מימוש מינימלי מעל ה-WebSocket וה-fetch המובנים של Node. אין תלות חדשה — כלי
 * בדיקה שמביא איתו עץ תלויות הוא כלי שיירקב.
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const CHROME =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** ניקוי שלא מפיל את השער — הוא לא מה שנבדק. */
export function discard(path) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* תיקיית פרופיל שנשארה ב-tmp אינה סיבה להכשיל בדיקה */
  }
}

export function requireChrome() {
  if (existsSync(CHROME)) return;
  console.error(`לא נמצא דפדפן ב-${CHROME}. הגדירו CHROME=<נתיב>`);
  process.exit(1);
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP: החיבור נכשל')), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const settle = pending.get(message.id);
    if (!settle) return;
    pending.delete(message.id);
    settle(message);
  });

  return {
    send(method, params) {
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    /** מריצה ביטוי בדף ומחזירה את הערך. `await` בביטוי נתמך. */
    async evaluate(expression) {
      const response = await this.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      const result = response.result?.result;
      if (response.result?.exceptionDetails) {
        throw new Error(`CDP: הביטוי זרק — ${result?.description ?? 'ללא פירוט'}`);
      }
      return result?.value;
    },
    close: () => socket.close(),
  };
}

/**
 * פותחת דפדפן על `fileUrl` ומחזירה חיבור CDP + `close` שסוגר הכול.
 * פרופיל נפרד לכל קריאה: דפדפן שנהרג ממשיך לכתוב לתיקייה שלו לרגע.
 */
export async function openPage(fileUrl, { port = Number(process.env.CDP_PORT ?? 9333), label = '0' } = {}) {
  const profile = join(tmpdir(), `otzaria-word-cdp-${label}`);
  discard(profile);

  const chrome = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',

      /* ארבעת הדגלים שמתחת נוספו אחרי מדידה, ולא כ„היגיינה”.
       *
       * ## התופעה
       *
       * שערים דיווחו „הדף לא הגיב תוך 45 שניות” — 16 צעדים בשער אחד — ותקיעות
       * של `Input.dispatchMouseEvent` „אחרי סדרה ארוכה של פעולות”. שתיהן לא
       * דטרמיניסטיות: אותו תרחיש בדיוק נחסם ב-1 מתוך 4 ריצות, ובמשכים שונים
       * (9.7s / 10.1s / 15.6s).
       *
       * ## מה שנמדד, וזה מה שהכריע
       *
       * `PerformanceObserver` על `longtask` הותקן בדף לפני שהאפליקציה קמה.
       * בחסימה של 9.7 שניות נרשמה **משימה ארוכה אחת של 112ms — בעלייה, לא
       * בחסימה** — והערמה נשארה שטוחה על 54MB. אילו הקוד שלנו היה חוסם, המשימה
       * הייתה נרשמת כשהיא נגמרת (והדף אכן חזר). כלומר ה-renderer לא קיבל מעבד,
       * ולא היה כאן לולאה שלנו ולא לחץ זיכרון.
       *
       * ## למה דווקא אלה
       *
       * שלושת הראשונים מכבים את ההרדמה של renderer שאינו „נראה” — וב-headless
       * שום דבר אינו נראה. הרביעי הוא ההתאמה הישירה לתקיעת הקלט: Chrome חונק
       * IPC מ-renderer ששולח הרבה הודעות, וזה בדיוק הפרופיל של שער שמזריק
       * מאות אירועי עכבר ומקלדת ברצף.
       *
       * הם משפיעים על סביבת המדידה בלבד. מה שהם **אינם** עושים הוא להסתיר באג:
       * חסימה שנגרמת מקוד שלנו תמשיך להירשם כמשימה ארוכה, וזה מה ש-
       * file-freeze-qa בודק כדי להבדיל בין השניים.
       *
       * ## וכמה הם באמת עזרו — כדי שאיש לא יניח שהם פתרו את זה
       *
       * `home-font-qa` הורץ פעמיים על אותה מכונה, לפני ואחרי:
       *
       *   | | לפני | אחרי |
       *   |---|---|---|
       *   | תקיעות קלט בלוג | 18 | 8 |
       *   | שלבים תקועים | 4 | 4 |
       *   | שורות עוברות | 12 | 12 |
       *
       * כלומר הם מחצו את התסמין ו**לא** החזירו ולו שלב אחד. ההרעבה נשארה.
       * הם נשמרים כי הם זולים, סטנדרטיים לאוטומציה ב-headless, ומדידים —
       * ולא כי הם תיקנו את הבעיה. מי שמחפש את הכיסוי שאבד צריך לחפש במקום
       * אחר: המכונה עצמה, או ניסיון חוזר לצעד שנתקע. */
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      fileUrl,
    ],
    { stdio: 'ignore' },
  );

  const close = () => {
    chrome.kill('SIGKILL');
    discard(profile);
  };

  try {
    let targets = null;
    for (let i = 0; i < 60 && !targets; i++) {
      // שני המארחים ולא רק `127.0.0.1`: ב-Windows Chrome קושר את יציאת ה-CDP
      // ל-`::1` בלבד, ופנייה ל-IPv4 נכשלת בסירוב חיבור — הבדיקה נראתה כאילו
      // הדפדפן לא עלה בכלל.
      for (const host of ['127.0.0.1', '[::1]']) {
        try {
          const response = await fetch(`http://${host}:${port}/json/list`);
          const list = await response.json();
          const pages = list.filter((t) => t.type === 'page' && t.url.startsWith('file://'));
          if (pages.length) {
            targets = pages;
            break;
          }
        } catch {
          /* המארח הבא, ואם שניהם נכשלו — סבב נוסף אחרי המתנה */
        }
      }
      if (!targets) await sleep(250);
    }
    if (!targets) throw new Error('CDP לא נפתח');

    const cdp = await connect(targets[0].webSocketDebuggerUrl);
    return {
      cdp,
      close() {
        cdp.close();
        close();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
