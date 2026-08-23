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
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await response.json();
        const pages = list.filter((t) => t.type === 'page' && t.url.startsWith('file://'));
        if (pages.length) targets = pages;
      } catch {
        await sleep(250);
      }
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
