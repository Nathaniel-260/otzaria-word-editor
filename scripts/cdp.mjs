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
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
/**
 * האם מישהו כבר מחזיק את היציאה.
 *
 * שני המארחים, ומאותה סיבה שהלולאה למטה בודקת את שניהם: ‏Chrome קושר
 * ל-IPv4 או ל-IPv6 לפי המערכת, ודפדפן זר שמחזיק רק את אחד מהם עדיין יכול
 * להיענות לבקשות שלנו.
 */
async function portHolder(port) {
  for (const host of ['127.0.0.1', '[::1]']) {
    try {
      const response = await fetch(`http://${host}:${port}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return host;
    } catch {
      /* אין שם דבר, וזה המצב התקין */
    }
  }
  return null;
}

export async function openPage(fileUrl, { port = Number(process.env.CDP_PORT ?? 9333), label = '0' } = {}) {
  const profile = join(tmpdir(), `otzaria-word-cdp-${label}`);
  discard(profile);

  /*
   * היציאה חייבת להיות פנויה **לפני** שמריצים, וזה לא הידור.
   *
   * דפדפן שנשאר מריצה קודמת — Ctrl+C באמצע שער, סקריפט שמת לפני `close()` —
   * ממשיך להחזיק אותה; ה-Chrome החדש אינו מצליח לקשור אותה, ו-`/json/list`
   * מחזיר את הדפים של הישן. אם הדף הישן נושא את אותה כתובת (וזה בדיוק מה
   * שקורה כשמפילים את **אותו** שער ומריצים אותו שוב), כל סינון לפי כתובת
   * נצמד אליו — והשער מודד dist ישן ומדווח ירוק על באג קיים. נמדד, פעמיים.
   *
   * ההמתנה הקצרה היא לדפדפן שנסגר ברגע זה ועדיין לא שחרר את השקע.
   */
  for (let i = 0; i < 12; i++) {
    if (!(await portHolder(port))) break;
    if (i === 11) {
      throw new Error(
        `CDP: יציאה ${port} תפוסה בידי דפדפן אחר — כנראה נשאר מריצה קודמת. ` +
          'הריצו `pkill -f otzaria-word-cdp`, או הגדירו CDP_PORT אחר.',
      );
    }
    await sleep(250);
  }

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
    /*
     * הדף שנפתח כאן, ולא „דף כלשהו ב-`file://`”.
     *
     * ## הכשל שזה סוגר, ולמה הוא מהגרועים
     *
     * היציאה קבועה (9333). דפדפן שנשאר מריצה קודמת — שער שנקטע, סקריפט שמת
     * לפני `close()` — ממשיך להחזיק אותה, ה-Chrome החדש **אינו מצליח לקשור
     * אותה**, ו-`/json/list` מחזיר את הדפים של הדפדפן **הישן**. הסינון שהיה
     * כאן קיבל כל דף `file://`, ולכן השער נצמד לדף של הריצה הקודמת: קוד ישן,
     * dist ישן — ומדד אותו בשקט.
     *
     * זה קרה בפועל, ובכיוון הכי מסוכן: הפרה אמיתית שהוזרקה למקור ונבנתה
     * נמדדה כ„0 title בדף”, כלומר **שער ירוק על באג קיים**. אין תסמין: אין
     * שגיאה, אין אזהרה, והמספרים נראים סבירים.
     *
     * ## הכתובת המלאה, ולא שם הקובץ
     *
     * ב-macOS ‏`/tmp` הוא קישור סמלי ל-`/private/tmp`, ו-Chrome מדווח את
     * הכתובת המפורשת — ולכן ההשוואה היא אחרי `realpath` משני הצדדים.
     * שם הקובץ לבדו אינו מספיק: `/tmp/mainclean/dist/tooltip-tmp.html`
     * ו-`/tmp/pr16wt/dist/tooltip-tmp.html` הם אותו basename, וזו בדיוק
     * ההשוואה main-מול-ענף שמריצים כשבודקים ששער נופל על הקוד הישן.
     */
    const wanted = pathToFileURL(realpathSync(fileURLToPath(fileUrl))).href;
    let targets = null;
    let strangers = 0;
    for (let i = 0; i < 60 && !targets; i++) {
      // שני המארחים ולא רק `127.0.0.1`: ב-Windows Chrome קושר את יציאת ה-CDP
      // ל-`::1` בלבד, ופנייה ל-IPv4 נכשלת בסירוב חיבור — הבדיקה נראתה כאילו
      // הדפדפן לא עלה בכלל.
      for (const host of ['127.0.0.1', '[::1]']) {
        try {
          const response = await fetch(`http://${host}:${port}/json/list`);
          const list = await response.json();
          const pages = list.filter((t) => t.type === 'page' && t.url.startsWith('file://'));
          const mine = pages.filter((t) => t.url === wanted);
          strangers = pages.length - mine.length;
          if (mine.length) {
            targets = mine;
            break;
          }
        } catch {
          /* המארח הבא, ואם שניהם נכשלו — סבב נוסף אחרי המתנה */
        }
      }
      if (!targets) await sleep(250);
    }
    if (!targets) {
      throw new Error(
        strangers > 0
          ? `CDP: ביציאה ${port} יש דפדפן אחר עם ${strangers} דפים, ואין בו ${wanted}. ` +
            'כנראה נשאר מריצה קודמת — `pkill -f otzaria-word-cdp`, או CDP_PORT אחר.'
          : 'CDP לא נפתח',
      );
    }

    const cdp = await connect(targets[0].webSocketDebuggerUrl);

    /*
     * הדף קיים — אבל הוא עדיין לא נקרא.
     *
     * הלולאה שלמעלה מחכה שיופיע **יעד** מסוג `page` בכתובת `file://`, וזה קורה
     * ברגע ש-Chrome פותח לשונית — לפני שהוא פרס שורה אחת של ה-HTML. מי שקורא
     * ל-`evaluate` מיד מקבל `document.body` ריק, וכל `querySelector` מחזיר
     * `null`.
     *
     * זה לא היה תיאורטי: `scripts/ruler-check.mjs` מדד מיד, קיבל `null` על
     * `.doc-ruler`, ונפל ב-`Cannot read properties of null`. נמדד — באותו דף
     * בדיוק, מיד: גוף ריק; אחרי 1.5 שניות: 20 מספרים ו-8,390 תווי CSS. זו
     * תחרות, ולכן היא גם מנצחת במכונה אחת ומפסידה באחרת — הצורה הגרועה ביותר
     * של כשל.
     *
     * ההמתנה כאן ולא בכל קורא: ארבעה סקריפטים (ruler-check, zoom-center-probe,
     * zoom-qa, zoom-stale-qa) מייבאים `openPage` בלי `sleep` בכלל, כלומר אף
     * אחד מהם אינו מוגן. השאר „פתרו” את זה בהמתנה קבועה משלהם, שהיא ניחוש.
     *
     * `complete` ולא `interactive`: הוא כולל את תת-המשאבים, ושער הסרגל תלוי
     * בגופן הארוז — רוחב הספרה הוא חלק ממה שהוא מודד.
     *
     * ויוצאים בשקט כשנגמר התקציב, ולא בשגיאה: הבטחה של „הדף מוכן” שנשברת
     * צריכה להיכשל אצל מי שמודד, עם מה שהוא מודד, ולא כאן — דף שאינו מגיע
     * ל-`complete` הוא עדיין דף שאפשר לשאול אותו שאלות.
     */
    for (let waited = 0; waited < 15_000; waited += 100) {
      if ((await cdp.evaluate('document.readyState')) === 'complete') break;
      await sleep(100);
    }

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
