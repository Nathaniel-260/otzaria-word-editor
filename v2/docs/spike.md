# יומן שלב 0

מטרת השלב: להוכיח ששרשרת SuperDoc v2 + מנוע ה־DOCX + ה־workers חיה בתוסף
**ארוז** ב־WebView של אוצריא, לפני שנבנה ממשק מעליה. שערי ההחלטה:
[../../docs/word-plugin-implementation-plan.md](../../docs/word-plugin-implementation-plan.md) §6.

תאריך: 23.8.2026 · `superdoc@2.8.0` · `@superdoc/docx-engine@0.7.0`

---

## תוצאה בשורה אחת — נבדק ב־Chrome/macOS; Windows/WebView2 ממתין

המנוע עובד מן האריזה גם מ־`file://`, אחרי שה־workers נטענים כ־workers קלאסיים:
`onReady` תוך 485ms, עריכה, ייצוא DOCX, אפס שגיאות.

**שער A לא עבר.** כל המדידות כאן הן ב־Google Chrome headless על macOS, על
תיקיית `dist` מוגשת ישירות — לא בתוסף ארוז, לא ב־WebView2 ולא בתוך אוצריא.
זו אינדיקציה חזקה ולא הוכחה, ולפי התכנית השער עובר רק כשהתוסף **הארוז** פועל
ב־Windows.

מה שהשער חוסם, ומה שלא:

- **חסום:** אינטגרציית שמירה ב־`v2/`, ה־Ribbon, וכל הפצה.
- **לא חסום:** PR הכתיבה ב־SDK של אוצריא, שנבנה **בכוונה מוקדם** — הוא במאגר
  אחר, עומד בזכות עצמו, ובלעדיו לא ניתן לממש שמירה אחרי שהשער ייסגר. הוא נבדק
  שם בבדיקות משלו ואינו תלוי בשער הזה.

> הבהרת מונח: „אריזה” במסמך הזה היא פלט `npm run build` — `v2/dist` — ולא
> קובץ `.otzplugin` מותקן. בהקשר שער A, „התוסף הארוז” הוא תמיד `.otzplugin`
> מותקן באוצריא; הרצת `dist` מ־`file://` אינה סוגרת את השער.

> **תיקון לגרסה קודמת של המסמך הזה.** קודם נכתב כאן שמ־`file://` אין צורה
> שעובדת, ושנדרש שינוי בצד אוצריא. זה היה שגוי, ובביקורת נתפס: המסקנה נשענה
> על ההנחה שקוד ה־worker חייב להיטען כ־module. הוא לא — ראו §3.

---

## 1. מה נבנה

| רכיב | קובץ |
|---|---|
| עטיפת ה־SDK, latch של `plugin.boot` | `src/host/otzaria-client.ts` |
| ערכת נושא → CSS variables | `src/host/theme.ts` |
| בורר קבצים של אוצריא | `src/host/files.ts` |
| הורדת קובץ (זמני, שלב 0 בלבד) | `src/host/download.ts` |
| stub לפיתוח בדפדפן | `src/host/dev-stub.ts` |
| הקמת המנוע ב־`ui: false` | `src/engine/create-editor.ts` |
| Workers כ־blob URLs | `src/engine/workers.ts` |
| registry הפקודות ובדיקת יכולות | `src/engine/capabilities.ts` |
| הרצת פקודות ותרגום כשל לעברית | `src/engine/command-adapter.ts` |
| החלפת מסמך אטומית | `src/sessions/editor-swap.ts` |
| ייצוא DOCX | `src/engine/export.ts` |
| מעטפת השלב | `src/main.ts` |
| שער אוטומטי על ה־dist | `scripts/check-dist.mjs` |

## 2. תיקוני חוזה מול ה־spike הקודם

| מה היה | מה נמדד | מה נעשה |
|---|---|---|
| `createSuperDocUI` אחרי `new SuperDoc` | המופע כבר מחזיק controller ומחזיר אותו ב־`superdoc.ui`, בטיפוס `BorrowedSuperDocUI` = `Omit<SuperDocUI,'destroy'>` | ה־controller נלקח מ־`onReady` payload; `destroy` הוא רק `superdoc.destroy()` |
| הרשמה ל־`plugin.boot` אחרי `await` | האירוע נורה פעם אחת; `on` של ה־SDK הוא `addEventListener` בלי replay, ואין `getBootInfo` | latch בזמן טעינת המודול, ישירות על `window` |
| „50 פקודות בקטלוג” כרשימה | `BUILT_IN_COMMAND_IDS` הציבורי = 16 מזהים; `COMMAND_CATALOG` אינו ציבורי | registry שלנו (47) + בדיקת חוזה מול המנוע |
| `<input type="file">` | — | `fs.pickUserFile`, וה־url נמסר ל־`Config.document` |
| פס עליון 48px | `DESIGN_GUIDE.md` קובע 56px / 44px ורקע `surfaceContainerHigh` | תוקן, כולל שמות הטוקנים המחייבים |
| `minAppVersion: 0.9.97` | גרסת אוצריא בפועל 0.9.96 — התוסף לא היה מותקן | `0.9.94`, הגרסה שבה נוספו ה־`fs.*` שבשימוש |

## 3. שער A — ה־workers

מנוע ה־DOCX יוצר את ה־worker שלו כ־`new Worker(url, { type: 'module' })`, בכל
13 מקומות הקריאה, כולל במסלול של `workerUrls`. כל שילוב נמדד בפועל ב־Chromium
(Google Chrome headless, macOS) על האריזה האמיתית:

| origin של הדף | צורת ה־worker | תוצאה |
|---|---|---|
| `file://` | blob:, **קלאסי** | **עובד** — `onReady` תוך 485ms, ייצוא Blob |
| `http://127.0.0.1` | blob:, קלאסי | עובד — `onReady` תוך 470–477ms |
| `file://` | blob:, module | נכשל: `module-load-failed` |
| `file://` | data:, module | עובד עקרונית, אבל חסום בגודל |
| `http://127.0.0.1` | ה־URL היחסי של המנוע (בלי הטמעה) | נכשל: `module-load-failed` |

שלוש מסקנות שקובעות קוד:

1. **`workerUrls` הוא חובה, לא אופטימיזציה.** ה־build הוא IIFE (WebView2 אינו
   טוען מודולים מ־`file://`), ובו `import.meta.url` אינו מצביע לקובץ ה־JS —
   ולכן ה־URL היחסי שהמנוע בונה לבד ל־worker אינו נפתר גם מ־origin תקין.
2. **מ־`file://` module worker נחסם.** ה־origin שם opaque. נמדד גם על workers
   מינימליים: blob־קלאסי עובד, blob־module נכשל, data־module עובד — אבל ה־URL
   של data חסום סביב 2MB (1.4MB עובר, 2.7MB נכשל) וה־worker של המסמך הוא
   4.45MB. כלומר data אינו מסלול.
3. **worker קלאסי מ־blob עובד, וזה מה שיש לנו.** Vite מפיק את ה־workers כ־IIFE
   (`worker.format`), ובקוד המוטמע אין `import`/`export` ואין `import.meta` —
   כלומר הוא תואם־קלאסי. מה שמנע את הטעינה היה האופציה, לא הקוד.

### הפתרון: `asClassicWorker`

`src/engine/workers.ts` עוטף את בנאי ה־`Worker` ומסיר `type: 'module'` — אבל רק
ל־blob URLs שאנחנו עצמנו בנינו; כל URL אחר עובר לבנאי המקורי בדיוק כפי שהתקבל.
זו עטיפה של API של הדפדפן, ולא שינוי של המנוע או של ה־workers שלו: הם נטענים
בייט־בבייט כמו שהם, כפי שהרישיון דורש.

ההנחה שהקוד תואם־קלאסי אינה נשארת הנחה, כי כשל שלה פירושו תוסף ארוז שלא פותח
מסמכים:

- ה־build נופל אם הקוד המוטמע מכיל חתימת ESM (`inlineEngineWorkers`).
- `npm run check:dist` פורס את ה־JSON, מריץ `node --check` על כל תפקיד בנפרד
  ובודק אותו מול אותן חתימות. עד לתיקון הזה הוא בדק רק את שורת ההשמה העוטפת
  ולא את 4.9MB שבאמת נטענים.
- בדיקת יחידה מאמתת שהעטיפה מסירה את האופציה ל־URL שלנו, ולא נוגעת בכל השאר.

### מה זה מבטל

בגרסה קודמת של המסמך נכתב שנדרש שינוי בצד אוצריא — הגשת תיקיית התוסף מ־
`http://127.0.0.1` — כתנאי מוקדם לשער A. **הדרישה הזאת מבוטלת.** האריזה עובדת
מ־`file://` כמו שהיא, ואין צורך לגעת בשרת ה־loopback, ב־mime types או במסלול
הטעינה של ה־WebView. זה גם חוסך את תופעת הלוואי שהשינוי היה גורר: כל `fetch`
של כל תוסף היה מתחיל לשאת `Origin: http://127.0.0.1:PORT` במקום `null`.

## 4. שער B — גדלים וזמנים

מדידות על ה־build הנוכחי (`npm run build`, macOS):

| מה | ערך |
|---|---|
| `dist/assets/app.js` | 10.20MB (3.13MB gzip) |
| `dist/assets/engine-workers.js` | 4.90MB |
| `dist/index.html` + `manifest.json` | ~1KB |
| `dist/third-party/` | 68KB |
| `dist/fonts/` (Segoe UI, 4 פנים) | 3.25MB |
| סה"כ `dist/` | 18.42MB |
| ZIP של `dist/` | 6.15MB (12 קבצים) |
| `.otzplugin` בפועל, לפני הוספת הגופן | **4.32MB, 8 קבצים** |
| boot עד `onReady`, מסמך ריק, `file://` | 485ms |
| boot עד `onReady`, מסמך ריק, `http://` | 470–477ms (שתי הרצות) |
| `superdoc.export()` על מסמך ריק | ~200ms, מחזיר Blob |
| DOM של המסמך אחרי `onReady` | ~23.8KB |
| `onReady` בשרת הפיתוח (לא ארוז) | 4.3 שניות |

worker השיתופיות (5.53MB באריזה) מושמט: התוסף אופליין וללא הרשאת רשת ולכן הוא
לעולם לא נטען. שני הנשארים, כפי ש־`check:dist` מדפיס אותם: המסמך 4.45MB,
review-index 0.31MB.

הגופן הארוז הוא 3.25MB לא־דחוסים ו־1.84MB בתוך ה־ZIP. ה־`.otzplugin` עצמו לא
נארז מחדש אחרי הוספתו; המספר הצפוי הוא ~6.16MB ב־12 קבצים, לפי ה־ZIP.

מה שלא נמדד: peak memory ומסמך של 50 עמודים — שניהם דורשים את הריצה על
Windows (§5). גודל ה־`.otzplugin` **כן** נמדד (4.32MB, ראו הטבלה). כל המדידות
כאן הן ב־Chromium על macOS; WebView2 הוא Chromium, אך זו אינה הוכחה — ראו
[spike-windows.md](spike-windows.md).

## 5. מה עוד לא נעשה

- [x] „שמור” ו„שמור בשם” מול API הכתיבה — מומשו
  (`src/sessions/save-coordinator.ts`) ואומתו מקצה לקצה מ־`file://` עם stub של
  ה-Host: ייצוא, `beginBinaryWrite`, PUT, `commit`. `<a download>` נשאר
  כ„ייצוא” נפרד.
- [ ] „שמור” מול אוצריא אמיתית. ה-API קיים רק בענף
  `docs/plugin-sdk-type-accuracy` של אוצריא; `minAppVersion` הועלה ל־0.9.97
  לפי ההנחה שזו הגרסה שתכיל אותו, **ויש לאמת את המספר כשהיא תשוחרר**. עד אז
  התוסף אינו מותקן על גרסה יציבה.
- [x] אריזה עם `otzaria pack-plugin` וקבלת הוולידטור — **עבר**. `dart run
  tool/plugins/package_plugin.dart` קורס בקומפילציה של חבילת אוצריא
  (`_FfiUseSiteTransformer`, באג של ה־SDK המותקן, לא קשור לתוסף), ולכן ה־CLI
  הורץ דרך `flutter test` שמקמפל באותו pipeline שעובד. התוצאה: `exit 0`,
  8 קבצים, 4.32MB, `✓ העיצוב תואם לתיעוד (DESIGN_GUIDE)`, בלי אזהרות הרשאה
  או גרסה. הערה: ולידציית העיצוב סורקת קובצי `*.css` ובלוקי `<style>`, וה־CSS
  שלנו מוטמע ב־`app.js` — כלומר מה שעבר הוא בדיקות ה־HTML (`dir="rtl"`,
  `lang="he"`) והמניפסט, לא כללי ה־CSS.
- [ ] הכול על Windows / WebView2 — ראו [spike-windows.md](spike-windows.md).
- [ ] פתיחת DOCX עברי אמיתי, ניקוד וטעמים, ומסמך של 50 עמודים.
- [ ] ייצוא ופתיחה ב־Microsoft Word.
- [ ] ולידציית העיצוב של האריזה על ה־CSS שלנו. הערה: הוולידטור סורק קובצי
  `*.css` ובלוקי `<style>`, ו־Vite מטמיע את ה־CSS שלנו לתוך `app.js` — כלומר
  בפועל הוא כנראה לא יסרוק אותו בכלל. הקוד עומד בכללים בכל זאת.
- [ ] בדיקה שהעטיפה הקלאסית של ה־worker עובדת גם ב־WebView2, לא רק ב־Chrome.

## 6. דברים שנמדדו והם רלוונטיים לשלבים הבאים

- **החלפה אינה מובטחת.** נמדד על מסמך חי מ־`file://`: `search.available` הוא
  `true`, `canReplace` הוא `true`, ו־`open()` מחזיר `{ ok: true }` — אבל
  `replace('b')` ו־`replaceAll('b')` החזירו
  `{ ok: false, reason: 'operation-unavailable' }`. המסמך היה ריק ולא הייתה
  התאמה פעילה, ולכן המדידה אינה מפרידה בין „לא מומש” ל„אין מה להחליף”.
  במקביל, אוצר ה־reasons של החבילה מתעד `replace-unsupported` כ„until replace
  ships”. בשתי הקריאות: 2.0 היא חיפוש בלבד, והחלפה היא capability gate
  (תכנית §11) שנבדק על מסמך עם טקסט והתאמה פעילה לפני שמבטיחים אותו.
- **הגופן הארוז נטען מ־`file://`.** `@font-face` עם `url('./fonts/segoeui.ttf')`
  מוזרק בזמן ריצה (`src/styles/fonts.ts`), ולא דרך קובץ CSS: `url()` שעובר את
  פותר הנכסים של Vite נשען ב־build IIFE על `import.meta.url` שאינו קיים, וקובץ
  CSS נפרד היה נסרק בוולידציית העיצוב ונפסל על `font-family` שאינו
  `var(--font-*)` — היא אינה מחריגה `@font-face`.
  נמדד על ה־build הארוז מ־`file://`: `document.fonts.size === 4`,
  ו־`document.fonts.load()` החזיר פנים אחת לכל אחד מארבעת המשקלים.
  **`document.fonts.check()` אינו עדות** — הוא החזיר `true` גם בדף בקרה בלי שום
  `@font-face`, על מכונה שאין בה Segoe UI. מה שמפריד הוא מדידת רוחב על canvas:
  `'Segoe UI', serif` נתן 215.57px מול 185.35px ל־serif, ובדף הבקרה שני
  המספרים היו זהים (185.35px) — כלומר הגליפים אכן מגיעים מהקובץ הארוז.
  השער עצמו הוא [../scripts/font-check.html](../scripts/font-check.html) —
  הוא טוען את ה־`app.js` הארוז, ולכן בודק את ההצהרה של הקוד ולא העתק שלה:
  ```bash
  npm run build && cp scripts/font-check.html dist/
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
    --virtual-time-budget=15000 --dump-dom "file://$PWD/dist/font-check.html"
  ```
- **`pdf.workerSrc` נופל ל־CDN:** המחרוזת `cdnjs.cloudflare.com/…/pdf.worker`
  קיימת בבאנדל (בונה URL, לא מבצע בקשה) ומגיעה מ־`modules.pdf`. אין לגעת
  בייצוא/תצוגת PDF בלי להגדיר worker מקומי. `check:dist` מדפיס את האזהרה הזאת.
- **`SuperDocUIState` אינו כולל `search` ו־`tables`:** גישה אליהם רק דרך
  ה־handles, לא דרך `ui.select`.
- **ה־union של `OtzariaMethod` היה חסר את כל `fs.*`** (וגם `ui.pickFolder`,
  `library.getTree`, `library.resolveCategoryPaths`) אף שהוולידטור מכיר אותם.
  ההעתק ב־`src/types/` כאן כבר מעודכן.
  לדיוק: זה **לא** גרם לכשל typecheck בקוד שלנו — `OtzariaGlobal.call` מקבל
  `OtzariaMethod | string`, ולכן קריאה במחרוזת עוברת. מה שנפגע הוא מי שמקליד
  את המזהה כ־`OtzariaMethod` או בונה ממנו מפתחות. השלמת ה־union (ענף
  `docs/plugin-sdk-type-accuracy` באוצריא) היא השלמת תיעוד לצרכנים הטיפוסיים.
  אכיפת טיפוסים אמיתית — overloads לכל מתודה עם payload ותוצאה, וטסטי טיפוסים —
  היא החלטת SDK נפרדת ועלולה לשבור תאימות; אין לגלוש אליה כאן.
- **`app.runMode` אינו נשלח ב־boot של דף גלוי** (רק ברקע), ו־`buildNumber` לא
  נשלח כלל; לעומת זאת `language` ו־`devMode` נשלחים. הטיפוס תוקן במאגר אוצריא
  לתאר את המצב בפועל.

## 7. איך מריצים

```bash
cd v2
npm ci
npm run verify        # typecheck + tests + build + check:dist
npm run dev           # שרת פיתוח על http://localhost:5173
```

### לבדוק בדפדפן, בלי אוצריא

`npm run dev` ואז לפתוח את `http://localhost:5173`. ה-stub שב-`host/dev-stub.ts`
מדמה את ה-Host: בורר קבצים אמיתי, מסלול הכתיבה המלא (begin → PUT → commit),
`storage` על localStorage, ודיאלוגי אישור. „שמור בשם” **מוריד** את ה-DOCX, כך
שאפשר לפתוח את התוצר ב-Word ולבדוק round-trip.

מה שה-stub אינו מדמה: כתיבה אטומית לדיסק, הרשאות, וה-WebView. ורענון הדף מאבד
את ה-blob של הקובץ שנבחר — כלומר הוא מריץ בדיוק את המסלול של „הקובץ הוזז”.

### לבדוק באוצריא אמיתית על macOS

ה-origin שם הוא http (שרת הפיתוח), ולכן ה-workers עובדים והמנוע נטען. זה בודק
את התוסף מול ה-Host האמיתי — כולל API הכתיבה — ולא מחליף את שער Windows:
WKWebView הוא WebKit, ו-WebView2 הוא Chromium.

```bash
# אוצריא מהענף שמכיל את API הכתיבה
cd /path/to/otzaria && git checkout docs/plugin-sdk-type-accuracy
flutter build macos --debug
open build/macos/Build/Products/Debug/אוצריא.app
```

באוצריא: פאנל התוספים → „טעינה מ-localhost” → `http://localhost:5173`.

`npm run check:dist` הוא השער האוטומטי: אין `<script type="module">`, כל נכס
שה־HTML מפנה אליו קיים מקומית, ה־workers נטענים לפני `app.js`, כל קובץ JS עובר
`node --check`, ובאנר הרישוי של מנוע ה־DOCX נמצא בקבצים שנושאים את הקוד שלו.
