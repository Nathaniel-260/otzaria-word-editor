import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * ל-WebView2 של Windows אין תמיכה ב-<script type="module"> מ-file:// ,
 * ואוצריא טוענת תוסף ארוז בדיוק משם. ה-build יוצא IIFE בקובץ אחד, ולכן
 * תגית הסקריפט חייבת להיות קלאסית. במצב dev התגית נשארת module כדי
 * שה-HMR של Vite ימשיך לעבוד.
 *
 * ומעבר לכך: Vite מזריק את תגית הכניסה ל-`<head>`, וסקריפט קלאסי שם חוסם את
 * פריסת ה-HTML — כלומר ה-`<body>`, ובתוכו מסך הטעינה, אינו נפרס עד ששני
 * הבאנדלים (16MB יחד) נפרסו והורצו. זה בדיוק המסך הלבן שנמדד
 * ב-`scripts/startup-probe.mjs`: צביעה ראשונה ב-1619ms מ-`file://`, כולה
 * המתנה. שום דבר לא נכשל; פשוט לא היה מה לראות.
 *
 * לכן שתי התגיות מוסרות מה-HTML, ובמקומן נכנס טוען inline שמזריק אותן אחרי
 * הצביעה הראשונה — ומדווח למסך הטעינה בין השלבים. הצביעה ירדה ל-50ms.
 */
function deferredEntry(): Plugin {
  const WORKERS_SRC = './assets/engine-workers.js';
  const ENTRY = /[ \t]*<script\s+src="(\.\/assets\/app\.js)"><\/script>\n?/;

  return {
    name: 'otzaria-deferred-entry',
    apply: 'build',
    // אחרי inlineEngineWorkers: התגית שלו כבר בדף, וכאן היא מוסרת יחד עם
    // תגית הכניסה ומוחלפת בטוען.
    enforce: 'post',

    transformIndexHtml(html) {
      const classic = html.replace(/\s+type="module"/g, '').replace(/\s+crossorigin/g, '');

      const match = classic.match(ENTRY);
      if (!match) {
        // בלי התגית אין מה לדחות, ותוסף בלי app.js הוא מסך טעינה לנצח.
        throw new Error(
          'לא נמצאה תגית הכניסה assets/app.js ב-index.html — ' +
            'ייתכן ש-entryFileNames או צורת ההזרקה של Vite השתנו.',
        );
      }

      const withoutTags = classic
        .replace(ENTRY, '')
        .replace(new RegExp(`[ \\t]*<script src="${WORKERS_SRC.replace(/[./]/g, '\\$&')}"></script>\\n?`), '');

      const loader = `    <script>
      /* טוען הכניסה.

         שני פריימים ואז הזרקה: הראשון מתזמן ציור, השני רץ אחרי שהוא הושלם —
         כלומר מסך הטעינה כבר על המסך כשהבאנדלים מתחילים להיפרס.

         ה-setTimeout אינו חגורה כפולה מיותרת: אוצריא עשויה להקים את ה-WebView
         של התוסף כשהוא עדיין אינו נראה, וב-Chromium requestAnimationFrame
         בדף מוסתר אינו נורה כלל. בלי השעון הזה תוסף שנפתח ברקע לא היה נטען
         לעולם. מי שמגיע ראשון מנצח; השני נבלע.

         „async = false” על אלמנט שמוזרק ב-JS הוא מה שמחזיק את סדר ההרצה:
         engine-workers.js מציב את __SUPERDOC_WORKER_SOURCES__, ו-app.js צורך
         אותו בהקמת המנוע. בלעדיו הדפדפן מריץ לפי סדר ההגעה — ואלה שני קבצים
         בגדלים שונים מאוד. ההורדה עצמה נשארת מקבילה, כי שתי התגיות נכנסות
         באותו tick. */
      (function () {
        var started = false;
        function load() {
          if (started) return;
          started = true;
          var splash = window.__otzariaSplash;
          [
            { src: '${WORKERS_SRC}', at: 22, text: 'טוען את מנוע המסמכים…' },
            { src: '${match[1]}', at: 55, text: 'מרכיב את הממשק…' }
          ].forEach(function (step) {
            var script = document.createElement('script');
            script.async = false;
            script.src = step.src;
            script.addEventListener('load', function () {
              if (splash) splash.set(step.at, step.text);
            });
            script.addEventListener('error', function () {
              if (splash) splash.fail('טעינת קוד התוסף נכשלה');
            });
            document.head.appendChild(script);
          });
        }
        requestAnimationFrame(function () {
          requestAnimationFrame(load);
        });
        setTimeout(load, 120);
      })();
    </script>
`;

      return withoutTags.replace('</body>', `${loader}  </body>`);
    },
  };
}

/** איזה worker של המנוע ממופה לאיזה שדה ב-config.workerUrls של SuperDoc. */
const WORKER_ROLES: Array<{ match: string; role: 'document' | 'reviewIndex' | 'drop' }> = [
  { match: 'browser-worker-entry', role: 'document' },
  { match: 'review-index-worker-entry', role: 'reviewIndex' },
  // worker השיתופיות אינו נארז: התוסף עובד אופליין וללא הרשאת רשת, ולכן
  // הוא לעולם לא נטען — ו-5MB זה מחיר שאין סיבה לשלם.
  { match: 'collaboration-worker-entry', role: 'drop' },
];

/**
 * ה-workers של המנוע מוטמעים באריזה כמחרוזות, ובזמן ריצה נבנה מהן blob: URL
 * שנמסר ל-`config.workerUrls`.
 *
 * ההטמעה אינה אופציונלית: ה-build הוא IIFE, ובו `import.meta.url` אינו מצביע
 * לקובץ ה-JS — ולכן ה-URL היחסי שהמנוע בונה בעצמו ל-worker אינו נפתר, גם
 * מ-origin תקין (נמדד: אריזה בלי הטמעה נכשלת ב-module-load-failed גם ב-http).
 * המדידות המלאות, כולל למה blob ולא data:, ב-docs/spike.md §שער A.
 *
 * הפלט הוא `JSON.parse('…')` ולא אובייקט ליטרלי, וזה אינו סגנון: אלה 5MB
 * שהמנתח של JavaScript היה פורס כתחביר — ליטרל אחד ענק עם escaping — מול
 * מנתח JSON ייעודי שמקבל מחרוזת אחת. נמדד ב-scripts/startup-probe.mjs:
 * זמן ההרצה של הקובץ ירד בערך למחצית.
 */
function inlineEngineWorkers(): Plugin {
  return {
    name: 'otzaria-inline-engine-workers',
    apply: 'build',
    enforce: 'post',

    generateBundle(_options, bundle) {
      const sources: Record<string, string> = {};

      for (const [fileName, output] of Object.entries(bundle)) {
        const spec = WORKER_ROLES.find((w) => fileName.includes(w.match));
        if (!spec) continue;

        if (spec.role !== 'drop') {
          sources[spec.role] = output.type === 'chunk' ? output.code : String(output.source);
        }
        delete bundle[fileName];
      }

      const missing = WORKER_ROLES.filter((w) => w.role !== 'drop' && !(w.role in sources));
      if (missing.length) {
        // כשל שקט כאן פירושו תוסף ארוז שלא פותח מסמכים — עדיף להפיל את ה-build.
        this.error(
          `לא נמצאו קובצי worker של מנוע ה-DOCX: ${missing.map((m) => m.match).join(', ')}. ` +
            'ייתכן ששמות הנכסים השתנו בגרסת superdoc חדשה — יש לעדכן את WORKER_ROLES.',
        );
      }

      // מחרוזת JSON בתוך ליטרל JS: JSON.stringify פעמיים — הפנימי בונה את
      // ה-JSON, החיצוני הופך אותו למחרוזת JS חוקית עם כל ה-escaping.
      const payload = JSON.stringify(JSON.stringify(sources));
      this.emitFile({
        type: 'asset',
        fileName: 'assets/engine-workers.js',
        source: `window.__SUPERDOC_WORKER_SOURCES__ = JSON.parse(${payload});\n`,
      });
    },

    transformIndexHtml(html) {
      // התגית מוזרקת כאן, ו-deferredEntry (שרץ אחריו) מחליף אותה ואת תגית
      // הכניסה בטוען אחד. ההזרקה היא לפני הסקריפט הראשון שיש לו src, ולא לפני
      // ה-`<script` הראשון: ה-latch של plugin.boot הוא סקריפט inline ב-head
      // וחייב להישאר ראשון.
      return html.replace(
        /<script([^>]*\bsrc=)/,
        '<script src="./assets/engine-workers.js"></script>\n    <script$1',
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), inlineEngineWorkers(), deferredEntry()],
  worker: { format: 'iife' },

  // ברירת המחדל של Vite ב-build היא legalComments: 'none', והיא מוחקת את באנר
  // הרישוי של מנוע ה-DOCX. סעיף 3.1(c) ברישיון המנוע אוסר להסיר הודעות רישוי,
  // ולכן ההודעות נאספות לסוף הקובץ. check-dist.mjs מאמת שהן שם.
  esbuild: { legalComments: 'eof' },

  // בשרת הפיתוח אין הטמעת workers, והמנוע בונה את ה-URL שלהם יחסית למודול
  // שלו. אם ה-dep optimizer של Vite אורז את המנוע מחדש ל-node_modules/.vite/deps,
  // ה-URL היחסי מצביע לשם — ושם אין קובץ worker, כלומר המסמך לא נפתח בפיתוח.
  // החרגה מה-optimizer משאירה את המנוע במקומו, ואת ה-URL נפתר.
  optimizeDeps: { exclude: ['@superdoc/docx-engine'] },

  build: {
    target: 'es2020',
    assetsDir: 'assets',
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 12_000,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
