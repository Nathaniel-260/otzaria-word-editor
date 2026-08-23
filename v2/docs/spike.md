# יומן שלב 0

מטרת השלב: להוכיח ששרשרת SuperDoc v2 + מנוע ה־DOCX + ה־workers חיה בתוסף
**ארוז** ב־WebView של אוצריא, לפני שנבנה ממשק מעליה. שערי ההחלטה:
[../../docs/word-plugin-implementation-plan.md](../../docs/word-plugin-implementation-plan.md) §6.

תאריך: 23.8.2026 · `superdoc@2.8.0` · `@superdoc/docx-engine@0.7.0`

---

## תוצאה בשורה אחת

המנוע עובד מן האריזה גם מ־`file://`, אחרי שה־workers נטענים כ־workers קלאסיים:
`onReady` תוך 485ms, עריכה, ייצוא DOCX, אפס שגיאות. מה שנשאר לשער A הוא ההרצה
האמיתית על Windows/WebView2 עם `otzaria pack-plugin`.

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
| סה"כ `dist/` | 15.16MB |
| ZIP של `dist/` | 4.31MB |
| boot עד `onReady`, מסמך ריק, `file://` | 485ms |
| boot עד `onReady`, מסמך ריק, `http://` | 470–477ms (שתי הרצות) |
| `superdoc.export()` על מסמך ריק | ~200ms, מחזיר Blob |
| DOM של המסמך אחרי `onReady` | ~23.8KB |
| `onReady` בשרת הפיתוח (לא ארוז) | 4.3 שניות |

worker השיתופיות (5.53MB באריזה) מושמט: התוסף אופליין וללא הרשאת רשת ולכן הוא
לעולם לא נטען. שני הנשארים, כפי ש־`check:dist` מדפיס אותם: המסמך 4.45MB,
review-index 0.31MB.

מה שלא נמדד: peak memory, מסמך של 50 עמודים, וגודל `.otzplugin` אמיתי — כולם
דורשים את הריצה על Windows (§5). כל המדידות כאן הן ב־Chromium על macOS; WebView2
הוא Chromium, אך זו אינה הוכחה — ראו [spike-windows.md](spike-windows.md).

## 5. מה עוד לא נעשה

- [ ] אריזה עם `otzaria pack-plugin` וקבלת הוולידטור. לא ניתן להריץ על המכונה
  הזאת: `dart run tool/plugins/package_plugin.dart` קורס בקומפילציה של חבילת
  אוצריא (`_FfiUseSiteTransformer`, באג של ה־SDK המותקן) — לא קשור לתוסף.
- [ ] הכול על Windows / WebView2 — ראו [spike-windows.md](spike-windows.md).
- [ ] פתיחת DOCX עברי אמיתי, ניקוד וטעמים, ומסמך של 50 עמודים.
- [ ] ייצוא ופתיחה ב־Microsoft Word.
- [ ] ולידציית העיצוב של האריזה על ה־CSS שלנו. הערה: הוולידטור סורק קובצי
  `*.css` ובלוקי `<style>`, ו־Vite מטמיע את ה־CSS שלנו לתוך `app.js` — כלומר
  בפועל הוא כנראה לא יסרוק אותו בכלל. הקוד עומד בכללים בכל זאת.
- [ ] בדיקה שהעטיפה הקלאסית של ה־worker עובדת גם ב־WebView2, לא רק ב־Chrome.

## 6. דברים שנמדדו והם רלוונטיים לשלבים הבאים

- **חיפוש והחלפה:** `superdoc.ui.search` קיים ומכיל `replace`/`replaceAll`, אבל
  אוצר ה־reasons מכיל `replace-unsupported` עם הסבר מפורש: החלפה אינה חלק
  מהגזרה הראשונה של חיפוש ב־v2 והיא נכשלת סגור. שלב 4 בתכנית צריך להניח חיפוש
  בלבד, ולבדוק אם החלפה נתמכת בגרסה שתהיה בזמן המימוש.
- **`pdf.workerSrc` נופל ל־CDN:** המחרוזת `cdnjs.cloudflare.com/…/pdf.worker`
  קיימת בבאנדל (בונה URL, לא מבצע בקשה) ומגיעה מ־`modules.pdf`. אין לגעת
  בייצוא/תצוגת PDF בלי להגדיר worker מקומי. `check:dist` מדפיס את האזהרה הזאת.
- **`SuperDocUIState` אינו כולל `search` ו־`tables`:** גישה אליהם רק דרך
  ה־handles, לא דרך `ui.select`.
- **טיפוסי ה־SDK של אוצריא חסרו את כל `fs.*`** ב־union של `OtzariaMethod`, כך
  ש־`Otzaria.call('fs.pickUserFile', …)` נכשל ב־typecheck אף שה־API עובד. תוקן
  במאגר אוצריא (ענף `docs/plugin-sdk-type-accuracy`) והועתק לכאן. העטיפה שלנו
  ממשיכה לקבל `method: string` כי היא גנרית.
- **`app.runMode` אינו נשלח ב־boot של דף גלוי** (רק ברקע), ו־`buildNumber` לא
  נשלח כלל; לעומת זאת `language` ו־`devMode` נשלחים. הטיפוס תוקן במאגר אוצריא
  לתאר את המצב בפועל.

## 7. איך מריצים

```bash
cd v2
npm ci
npm run verify        # typecheck + tests + build + check:dist
npm run dev           # שרת פיתוח; באוצריא: פאנל תוספים → טעינה מ-localhost
```

`npm run check:dist` הוא השער האוטומטי: אין `<script type="module">`, כל נכס
שה־HTML מפנה אליו קיים מקומית, ה־workers נטענים לפני `app.js`, כל קובץ JS עובר
`node --check`, ובאנר הרישוי של מנוע ה־DOCX נמצא בקבצים שנושאים את הקוד שלו.
