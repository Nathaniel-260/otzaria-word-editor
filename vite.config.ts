import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * ל-WebView2 של Windows אין תמיכה ב-<script type="module"> מ-file:// ,
 * ואוצריא טוענת תוסף ארוז בדיוק משם. ה-build יוצא IIFE בקובץ אחד, ולכן
 * תגית הסקריפט חייבת להיות קלאסית. במצב dev התגית נשארת module כדי
 * שה-HMR של Vite ימשיך לעבוד.
 */
function classicScript(): Plugin {
  return {
    name: 'otzaria-classic-script',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s+type="module"/g, '').replace(/\s+crossorigin/g, '');
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

      this.emitFile({
        type: 'asset',
        fileName: 'assets/engine-workers.js',
        source: `window.__SUPERDOC_WORKER_SOURCES__ = ${JSON.stringify(sources)};\n`,
      });
    },

    transformIndexHtml(html) {
      // חייב להיטען לפני app.js — נצרך בזמן הקמת המנוע. ההזרקה היא לפני
      // הסקריפט הראשון שיש לו src, ולא לפני ה-`<script` הראשון: ה-latch של
      // plugin.boot הוא סקריפט inline ב-head, וחייב להישאר ראשון — 5MB של
      // worker שנטענים לפניו הם עיכוב שאין בו צורך.
      return html.replace(
        /<script([^>]*\bsrc=)/,
        '<script src="./assets/engine-workers.js"></script>\n    <script$1',
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), classicScript(), inlineEngineWorkers()],
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
