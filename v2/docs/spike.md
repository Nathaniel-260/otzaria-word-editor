# יומן שלב 0

מטרת השלב: להוכיח ששרשרת SuperDoc v2 + מנוע ה־DOCX + ה־workers חיה בתוסף
**ארוז** ב־WebView של אוצריא, לפני שנבנה ממשק מעליה. שערי ההחלטה:
[../../docs/word-plugin-implementation-plan.md](../../docs/word-plugin-implementation-plan.md) §6.

תאריך: 23.8.2026 · `superdoc@2.8.0` · `@superdoc/docx-engine@0.7.0`

---

## תוצאה בשורה אחת

המנוע עובד — כשהדף נטען מ־origin. אוצריא טוענת תוסף ארוז מ־`file://`, ושם המנוע
**אינו יכול לעבוד בשום צורה**. שער A חסום בצד המארח, לא בצד התוסף.

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
| הרשמה ל־`plugin.boot` אחרי `await` | האירוע נורה פעם אחת, בלי replay ובלי `getBootInfo` | latch בזמן טעינת המודול, ישירות על `window` |
| „50 פקודות בקטלוג” כרשימה | `BUILT_IN_COMMAND_IDS` הציבורי = 16 מזהים; `COMMAND_CATALOG` אינו ציבורי | registry שלנו (47) + בדיקת חוזה מול המנוע |
| `<input type="file">` | — | `fs.pickUserFile`, וה־url נמסר ל־`Config.document` |
| פס עליון 48px | `DESIGN_GUIDE.md` קובע 56px / 44px ורקע `surfaceContainerHigh` | תוקן, כולל שמות הטוקנים המחייבים |
| `minAppVersion: 0.9.97` | גרסת אוצריא בפועל 0.9.96 — התוסף לא היה מותקן | `0.9.94`, הגרסה שבה נוספו ה־`fs.*` שבשימוש |

## 3. שער A — ה־workers

מנוע ה־DOCX יוצר את ה־worker שלו כ־`new Worker(url, { type: 'module' })`.
זה מצמצם את מרחב הפתרונות, וכל שילוב נמדד בפועל ב־Chromium (Google Chrome
headless, macOS 15.6) על האריזה האמיתית:

| origin של הדף | צורת ה־worker | תוצאה |
|---|---|---|
| `http://127.0.0.1` | blob: מקוד מוטמע | **עובד** — `onReady` תוך 470ms |
| `http://127.0.0.1` | ה־URL היחסי של המנוע (בלי הטמעה) | נכשל: `module-load-failed` |
| `file://` | blob: מקוד מוטמע | נכשל: `module-load-failed` |
| `file://` | data: מקוד מוטמע | נכשל — עובד עקרונית, אך חסום בגודל |

שתי מסקנות שקובעות קוד:

1. **`workerUrls` הוא חובה, לא אופטימיזציה.** ה־build הוא IIFE (WebView2 אינו
   טוען מודולים מ־`file://`), ובו `import.meta.url` אינו מצביע לקובץ ה־JS —
   ולכן ה־URL היחסי שהמנוע בונה לבד ל־worker אינו נפתר גם מ־origin תקין.
2. **מ־`file://` אין צורה שעובדת.** ה־origin שם opaque. נמדד בנפרד, על workers
   מינימליים: worker קלאסי מ־blob עובד, module worker מ־blob נכשל, module worker
   מ־data עובד — אבל ה־URL של data חסום סביב 2MB (1.4MB עובר, 2.7MB נכשל),
   וה־worker של המסמך הוא 4.67MB באריזה. אין גודל שנכנס.

### המשמעות: תנאי מוקדם בצד אוצריא

תוסף ארוז נטען `file://<installPath>/<entrypoint>`; אין virtual-host mapping ואין
הגשה של תיקיית התוסף. שרת ה־loopback הקיים (`plugin_file_server.dart`) מגיש
**קובץ בודד** שהמשתמש בחר, בנתיב `/f/<token>`, וטבלת ה־mime שלו אינה מכירה
`.js`/`.css`/`.wasm`. כלומר אין דרך לתוסף להיטען מ־origin.

לכן שער A דורש PR בצד אוצריא: הגשת תיקיית ההתקנה של התוסף מ־`http://127.0.0.1`
וטעינת ה־entrypoint משם. פירוט התכולה — בתכנית הראשית, סעיף „שלב Host”.

**בזמן שהתנאי הזה פתוח, הפיתוח אינו חסום:** במצב „טעינה מ־localhost” של אוצריא
(אייקון הגלובוס בפאנל הפיתוח) הדף נטען משרת הפיתוח, כלומר מ־origin תקין, והמנוע
עובד. נמדד על `npm run dev`: `onReady` תוך 4.3 שניות, DOM של 23KB, בלי שגיאות.
(4.3 שניות ולא 470ms מפני שבפיתוח המודולים אינם ארוזים.) שלבים 1–8 בתכנית
יכולים להתקדם שם במלואם. מה שחסום הוא **הפצה**.

תנאי אחד לכך, שנמצא בדרך הקשה: בפיתוח אין הטמעת workers, והמנוע בונה את ה־URL
של ה־worker יחסית למודול שלו — ואם ה־dep optimizer של Vite אורז את המנוע מחדש
אל `node_modules/.vite/deps`, ה־URL מצביע לשם, ושם אין קובץ worker. בלי
`optimizeDeps.exclude: ['@superdoc/docx-engine']` שרת הפיתוח נכשל באותה שגיאה
בדיוק כמו `file://` — `module-load-failed` — מסיבה שונה לגמרי. אין להסיר את
ההחרגה הזאת.

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
| boot עד `onReady`, מסמך ריק | 470–477ms (שתי הרצות) |
| `superdoc.export()` על מסמך ריק | ~200ms, מחזיר Blob |
| DOM של המסמך אחרי `onReady` | ~23.8KB |
| `onReady` בשרת הפיתוח (לא ארוז) | 4.3 שניות |

worker השיתופיות (5.53MB באריזה) מושמט: התוסף אופליין וללא הרשאת רשת ולכן הוא
לעולם לא נטען. שני הנשארים: המסמך 4.67MB, review-index 0.33MB.

מה שלא נמדד: peak memory, מסמך של 50 עמודים, וגודל `.otzplugin` אמיתי — כולם
דורשים את הריצה על Windows (§5).

## 5. מה עוד לא נעשה

- [ ] אריזה עם `otzaria pack-plugin` וקבלת הוולידטור. לא ניתן להריץ על המכונה
  הזאת: `dart run tool/plugins/package_plugin.dart` קורס בקומפילציה של חבילת
  אוצריא (`_FfiUseSiteTransformer`, באג של ה־SDK המותקן) — לא קשור לתוסף.
- [ ] הכול על Windows / WebView2 — ראו [spike-windows.md](spike-windows.md).
- [ ] פתיחת DOCX עברי אמיתי, ניקוד וטעמים, ומסמך של 50 עמודים.
- [ ] ייצוא ופתיחה ב־Microsoft Word.
- [ ] ולידציית העיצוב של האריזה על ה־CSS שלנו.

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
- **טיפוסי ה־SDK של אוצריא חסרים את כל `fs.*`** ב־union של `OtzariaMethod`.
  לכן העטיפה שלנו מקבלת `method: string`; אין לצמצם אותה ל־union.
- **`app.runMode` אינו נשלח ב־boot של דף גלוי** (רק ברקע), ו־`buildNumber` לא
  נשלח כלל, אף שהם בטיפוס.

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
