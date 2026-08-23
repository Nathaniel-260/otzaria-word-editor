אני:
האם יש חבילת js שמחקה באופן מושלם את word של microsoft?
הביאו לי את [https://github.com/apache/openoffice](https://github.com/apache/openoffice) - אבל זה בכלל לא js... אני רוצה משהו שיטען אצל הלקוח באמצעות js/ts/html, בכדי ליצור תוסף לאוצריא.
לתיעוד מערכת התוספים של אוצריא, ראה:
[https://github.com/Otzaria/otzaria/tree/dev/docs/plugin-sdk](https://github.com/Otzaria/otzaria/tree/dev/docs/plugin-sdk)

הai:
כן. **יש כיום פתרון שמתאים מאוד למה שאתה מחפש — SuperDoc**. אבל חשוב לדייק: אין ספריית JS שמחקה *באופן מושלם* את Microsoft Word על כל ההתנהגויות והפינות של DOCX. אפילו SuperDoc מגדירים תאימות import/export ל־DOCX כתחום שהם ממשיכים לשפר. ([GitHub][1])

### האפשרויות הרלוונטיות

| פתרון                            | רץ כולו אצל הלקוח |    DOCX אמיתי |          צריך שרת | התאמה לתוסף אוצריא    |
| -------------------------------- | ----------------: | ------------: | ----------------: | --------------------- |
| **SuperDoc**                     |           ✅ JS/TS |             ✅ |                 ❌ | **מצוינת**            |
| **ZetaJS + ZetaOffice**          |       ✅ JS + WASM | ✅ LibreOffice |                 ❌ | אפשרי, אבל כבד ומסובך |
| **Apryse WebViewer DOCX Editor** |         ✅ JS/WASM |             ✅ |                 ❌ | מצוין, מסחרי          |
| **ONLYOFFICE**                   |                 ❌ |             ✅ | ✅ Document Server | לא מתאים              |
| docx.js וכד'                     |                 ✅ | ✅ יצירה/שינוי |                 ❌ | לא עורך Word מלא      |

## 1. הבחירה שלי: **SuperDoc**

זה למעשה בדיוק סוג הפרויקט שחיפשת:

* כתוב ב־TypeScript.
* עובד ב־Vanilla JS וגם React/Vue/Angular/Svelte.
* נטען בתוך דף HTML.
* **לא דורש שרת** — מנוע ה־DOCX רץ בדפדפן.
* עובד ישירות עם OOXML/DOCX ולא ממיר את המסמך קודם ל־HTML.
* תומך בעימוד, עמודים, sections, headers/footers, טבלאות, הערות, Track Changes ועוד.
* יכול לקבל מסמך כ־URL, `File` או `Blob` ולייצא בחזרה DOCX. ([GitHub][1])

עקרונית השימוש נראה בערך כך:

```ts
import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const editor = new SuperDoc({
  selector: '#editor',
  toolbar: '#toolbar',
  document: '/document.docx',
  documentMode: 'editing',
});
```

מבחינת **עברית ו־RTL**, המצב כיום טוב יותר ממה שהיה בעבר: במאי 2026 הושלמה תמיכה מפורשת בכיוון פסקה RTL/LTR, כולל round-trip של `<w:bidi>` אל DOCX ובחזרה, והיא סומנה כמשוחררת בגרסה הרגילה.

כלומר, עבור אוצריא, **זה המועמד הראשון שהייתי בודק בפועל**.

---

# 2. ומה שמעניין במיוחד: הוא מתחבר יפה ל־Plugin SDK של אוצריא

בדקתי את התיעוד שהפנית אליו. תוסף אוצריא הוא ממילא HTML/CSS/JS שרץ בתוך WebView מוגן, כך שארכיטקטונית SuperDoc מתאים בדיוק לסביבה הזו.

אוצריא כבר מספקת:

```js
const result = await Otzaria.call('fs.pickUserFile', {
  title: 'בחר מסמך Word',
  extensions: ['docx']
});
```

וה־API מחזיר:

```js
{
  token,
  url,
  name,
  size
}
```

כאשר ה־`url` הוא URL מקומי שה־WebView יכול לקרוא ישירות, בלי להעביר את הבייטים של המסמך דרך גשר ה־JS.

ומכיוון ש־SuperDoc יודע לקבל **URL**, אפשר עקרונית לעשות:

```js
const picked = await Otzaria.call('fs.pickUserFile', {
  title: 'בחר מסמך Word',
  extensions: ['docx']
});

if (!picked.success || picked.data.cancelled) return;

const editor = new SuperDoc({
  selector: '#editor',
  toolbar: '#toolbar',
  document: picked.data.url,
  documentMode: 'editing'
});
```

וזה בדיוק הכיוון שהייתי בוחר.

בנוסף, אפשר לשמור את ה־`token` של אוצריא, ובהפעלה הבאה לקבל URL מקומי חדש באמצעות `fs.resolveFileUrl`.

---

## אבל יש שתי בעיות באוצריא שצריך לפתור

### א. `type="module"` ב־WebView2

זה חשוב מאוד.

בתיעוד אוצריא עצמו כתוב שב־Windows, כאשר התוסף נטען מ־`file://`, WebView2 **לא תומך ב־`<script type="module">`**.

SuperDoc מוצג בתיעוד בדרך כלל כ־ES module:

```js
import { SuperDoc } from 'superdoc';
```

לכן לא הייתי מכניס את `node_modules` לתוסף ומנסה לייבא אותו בזמן ריצה.

במקום זאת:

```text
src/
  main.ts

        ↓ Vite/esbuild/Rollup

dist/
  index.html
  editor.js
  editor.css
```

ולבנות את `editor.js` כ־**bundle קלאסי יחיד, IIFE/UMD**, בלי `type="module"`.

כל SuperDoc וה־dependencies שלו ייארזו בתוך התוסף, ולכן **לא תהיה שום תלות באינטרנט**. זה גם מתאים למודל האבטחה של אוצריא, שבו תוסף יכול לקרוא את הקבצים שבתיקייה שלו, בעוד גישה לקבצים חיצוניים ולרשת מוגבלת.

---

### ב. הבעיה האמיתית היא דווקא **שמירת DOCX**

SuperDoc יכול לייצא את המסמך הערוך בחזרה כ־DOCX/Blob. ([docs.superdoc.dev][2])

אבל בתיעוד הנוכחי של אוצריא אני רואה APIs כגון:

```text
fs.pickUserFile
fs.resolveFileUrl
fs.readTextFile
fs.revokeFile
fs.extractZip
fs.deleteFile
```

ואני **לא רואה API שמאפשר לתוסף לכתוב קובץ בינארי חדש למיקום שהמשתמש בוחר**, כגון:

```text
fs.saveUserFile
```

או:

```text
fs.writeUserFile
```

לכן אם המטרה היא עורך Word אמיתי בתוך אוצריא, הייתי מוסיף ל־Plugin SDK משהו בסגנון:

```js
await Otzaria.call('fs.saveUserFile', {
  suggestedName: 'document.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...
});
```

או API שנותן URL/stream לכתיבה. זה שינוי קטן יחסית בצד המארח, אבל הוא יהפוך את מערכת התוספים להרבה יותר שימושית.

---

# ומה עם LibreOffice בתוך JS?

יש דווקא פרויקט מאוד מעניין שלא הייתי פוסל:

**ZetaJS + ZetaOffice**.

זה לא “חיקוי” של LibreOffice — זה **LibreOffice/Writer עצמו שמקומפל ל־WebAssembly**, ו־ZetaJS מאפשר לשלוט עליו ב־JavaScript דרך UNO. הם מציגים אפילו דוגמה של Office suite מלא בתוך הדפדפן שנראה ומתנהג כמו גרסת הדסקטופ. ([GitHub][3])

כלומר:

```text
LibreOffice C++
      ↓
 Emscripten
      ↓
 WebAssembly
      ↓
 Browser/WebView
      ↑
   ZetaJS
      ↑
 JavaScript
```

זה הפתרון שהכי קרוב רעיונית ל־**“תכניס לי Microsoft Word/LibreOffice ממש לתוך HTML”**.

אבל יש לו בעיה רצינית אצלך: גרסת LibreOffice WASM דורשת מהשרת להחזיר:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

ותשתית ה־WASM משתמשת ב־threads. ([GitHub][4])

בתוסף אוצריא שנטען מקבצים מקומיים בתוך WebView זה כבר הרבה יותר מסובך. ייתכן שתוכל לשנות את מארח ה־WebView של אוצריא כדי לתמוך בכך, אבל **לא הייתי מתחיל משם**.

---

## ONLYOFFICE — לא

ONLYOFFICE נראה מאוד כמו Word ואף עשוי לתת חוויה קרובה יותר מבחינת UI, אבל הוא לא מה שאתה מחפש.

ה־JS שאתה מכניס לדף הוא רק הלקוח:

```html
<script src="https://documentserver/.../api.js"></script>
```

והעורך עצמו מתחבר ל־**ONLYOFFICE Document Server**. ([api.onlyoffice.com][5])

Document Server הוא מערכת שרת של ממש, עם שירותי עריכה והמרה ותלויות משלו. ([ONLYOFFICE - Cloud Office Applications][6])

לכן לתוסף אוצריא עצמאי/offline — הייתי מוריד אותו מהרשימה.

---

## ויש אפשרות מסחרית חזקה: Apryse

**Apryse WebViewer DOCX Editor** עושה גם הוא עריכת DOCX מלאה בצד הלקוח, ללא Office וללא backend. המסמך נטען ונערך בתוך הדפדפן עצמו. ([apryse-docs][7])

מבחינה טכנית הוא מתאים לאוצריא מאוד.

החיסרון: זה SDK מסחרי, בעוד SuperDoc זמין בקוד פתוח תחת AGPLv3 לצד רישיון מסחרי. ([GitHub][1])

צריך כמובן לבדוק את השלכות AGPL על אופן ההפצה שאתה מתכנן לפני שילוב SuperDoc בפרויקט.

---

# השורה התחתונה

**לא הייתי משתמש ב־Apache OpenOffice בכלל לצורך הזה.**

אם הייתי בונה עכשיו תוסף “Word לאוצריא”, הייתי הולך כך:

1. **SuperDoc** כמנוע DOCX.
2. TypeScript + Vite/esbuild.
3. אורז את SuperDoc כולו בתוך `.otzplugin` — ללא CDN וללא אינטרנט.
4. Build סופי ל־JS שאינו `type="module"`.
5. `fs.pickUserFile` של אוצריא → URL מקומי → SuperDoc.
6. מוסיף ל־Otzaria Plugin SDK API קטן ל־**Save/Write של קובץ בינארי**.
7. בודק במיוחד מסמכי Word עבריים מורכבים: RTL, ניקוד, הערות שוליים, טבלאות, headers, מספרי עמודים, סגנונות ומעברי מקטע.

**SuperDoc הוא כרגע בעיניי ההתאמה הטובה ביותר לדרישה הספציפית שלך.** ZetaJS מעניין מאוד אם המטרה היא להכניס למעשה את LibreOffice Writer כולו לתוך אוצריא, אבל הוא פתרון כבד ומורכב בהרבה. ([GitHub][1])

אם המטרה שלך היא **לא רק לפתוח DOCX חיצוניים, אלא ממש ליצור “מעבד תמלילים” מובנה באוצריא**, יש עוד כמה נקודות משמעותיות שכדאי לבדוק ב־SuperDoc — בעיקר הערות שוליים, ניקוד עברי, RTL מעורב, משוואות, שדות Word ותאימות round-trip. במקרה הזה הייתי עושה לו בדיקת תאימות מסודרת מול 10–15 מסמכי Word עבריים מורכבים לפני שמחליטים סופית.

[1]: https://github.com/superdoc/docx-editor?utm_source=chatgpt.com "GitHub - superdoc/docx-editor: 🦋️ SuperDoc - Modern DOCX Editor and Agent SDK · GitHub"
[2]: https://docs.superdoc.dev/?utm_source=chatgpt.com "SuperDoc documentation | SuperDoc"
[3]: https://github.com/allotropia/zetajs?utm_source=chatgpt.com "GitHub - allotropia/zetajs: JS wrapper for ZetaOffice in the browser · GitHub"
[4]: https://github.com/LibreOffice/core/blob/master/static/README.wasm.md "core/static/README.wasm.md at master · LibreOffice/core · GitHub"
[5]: https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/inline-editors/?utm_source=chatgpt.com "Inline editors | ONLYOFFICE"
[6]: https://helpcenter.onlyoffice.com/docs/installation/docs-community-install-windows.aspx?utm_source=chatgpt.com "Installing ONLYOFFICE Docs for Windows on a local server"
[7]: https://docs.apryse.com/web/samples/showcase-demo-office-editor?utm_source=chatgpt.com "MS Office Editor - JavaScript client-side - Sample Code - WebViewer | Apryse documentation"


אני:
לגבי שמירת קבצים, והapi - אני אטפל.
לגבי SuperDoc - כתבו לי ש: ״**המנוע רינדור ויצאו שלא אסור בהפצה ללא רשיון**\
**והתצוגה שלו (מסביב לדף) די בסיסית״**
בדוק לעומק!!!!

הai:
כן. בדקתי את זה לעומק, ואני צריך **לתקן את ההמלצה הקודמת שלי על SuperDoc**. מי שכתב לך את ההערה לגבי הרישוי זיהה בעיה אמיתית, והיא משמעותית מאוד במקרה של תוסף אוצריא.

## 1. הרישוי: הבעיה אמיתית

הבלבול נובע מכך ש־SuperDoc עצמו עדיין מוצג ב־GitHub כ־AGPL-3.0. אבל ב־SuperDoc v2 המצב בפועל הוא כזה:

```text
SuperDoc
├── עורך / UI / קוד ציבורי       → AGPL-3.0
└── @superdoc/docx-engine        → רישיון קנייני
```

וה־`superdoc` הנוכחי תלוי **ישירות** ב־`@superdoc/docx-engine`. זה מופיע במפורש ב־`package.json`:

גם קובץ ה־NOTICE שלהם אומר במפורש ש־SuperDoc 2 תלוי בחבילת `@superdoc/docx-engine`, ושלה יש רישיון נפרד.

וזה לא עניין היסטורי ישן: הרישיון הקנייני הנוכחי של המנוע הוא מתאריך **14 ביולי 2026**. במסמך הרשמי הם אומרים מפורשות שהקוד הפתוח של SuperDoc הוא AGPL, אבל **DOCX Engine הוא proprietary ואינו Open Source**. ([docs.superdoc.dev][1])

### ומה אסור?

סעיף 3.1(d) הוא הבעיה המרכזית. הוא אוסר בין היתר להפיץ מחדש, לפרסם מחדש, למכור, לתת ברישיון משנה או בדרך אחרת להפוך את חומרי המנוע לזמינים לצד שלישי. ([docs.superdoc.dev][1])

כלומר במקרה שלנו:

```text
npm install superdoc
        ↓
@superdoc/docx-engine נכנס כתלות
        ↓
Vite / esbuild מכניס אותו ל-bundle
        ↓
ה-bundle נכנס ל-.otzplugin
        ↓
המשתמש מוריד את התוסף
```

זו בדיוק **הפצה של המנוע לצד שלישי**.

לכן תוסף `.otzplugin` עצמאי שמכיל את SuperDoc v2 + המנוע שלו **לא יכול, לפי הרישיון הרגיל שמפורסם כעת, להיות מופץ כך בחינם למשתמשים**.

וזה נכון גם אם:

* אוצריא עצמה קוד פתוח;
* התוסף יהיה AGPL;
* תפרסם את כל קוד המקור שלך;
* לא תגבה כסף;
* הכול ירוץ אופליין.

ה־AGPL של החלק הפתוח לא מעניק לך זכויות הפצה על `@superdoc/docx-engine`. SuperDoc עצמם אומרים ששני הרכיבים מורשים בנפרד. ([docs.superdoc.dev][1])

---

## 2. וזה לא רק “מנוע export” אופציונלי

כאן הייתי מדייק את מה שכתבו לך.

לא נכון לחשוב:

```text
SuperDoc החינמי
+
Exporter מסחרי אופציונלי
```

אלא יותר:

```text
SuperDoc v2 UI / integration
             │
             ▼
 @superdoc/docx-engine
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
   Read    Render    Edit
                       │
                       ▼
                     DOCX
```

SuperDoc עצמם מתארים את המנוע כמשהו שקורא, מרנדר, עורך וכותב DOCX. ([docs.superdoc.dev][2])

כלומר אי אפשר לומר: “לא צריך export, אז נוריד את הרכיב המסחרי”. המנוע הקנייני הוא כיום חלק ליבה של v2.

וזה מגובה שוב ברמה הטכנית: החבילה `superdoc` עצמה מכריזה על:

```json
"dependencies": {
  "@superdoc/docx-engine": "..."
}
```

---

## 3. אז למה בכלל הם כותבים “AGPL”?

כי **הקוד הציבורי של SuperDoc** אכן AGPL. הרישיון הראשי בריפו הוא AGPLv3.

אבל הם יצרו למעשה מודל של:

> מעטפת/עורך פתוח + מנוע מסמכים סגור.

לכן להסתכל רק על ה־badge ב־GitHub ולראות:

> License: AGPL-3.0

זה מטעה לצורך ההחלטה שלנו.

ה־NOTICE הנוכחי שלהם נכתב בדיוק כדי להבהיר את ההפרדה הזאת.

---

# 4. כמה עולה האפשרות החוקית?

האתר שלהם מציג כרגע:

| מסלול      |            מחיר | שימוש                              |
| ---------- | --------------: | ---------------------------------- |
| Community  |            חינם | Testing and personal use           |
| Business   | **$6,000 לשנה** | production document experience אחד |
| Enterprise |        לפי הסכם | שימושים רחבים יותר                 |

הם מציינים במפורש שה־Business מיועד לשילוב SuperDoc ב־production, בדפדפן, בשרת או בשניהם. ([SuperDoc][3])

אבל יש כאן נקודה חשובה:

**גם אם משלמים $6,000, אני לא הייתי מניח אוטומטית שזה נותן זכות להכניס את המנוע ל־`.otzplugin` ולהפיץ אותו לכל משתמשי אוצריא.**

הרישיון הקנייני עצמו עדיין כולל איסור redistribution. הוא אומר שהסכם מסחרי/Order Form יכול להגדיר את ה־licensed scope. ([docs.superdoc.dev][1])

לכן במקרה כזה הייתי דורש מהם בכתב ניסוח בסגנון:

> May we bundle `@superdoc/docx-engine` inside a self-hosted desktop application/plugin distributed to end users?

עד שאין תשובה מפורשת חיובית — לא הייתי מסתמך על מסלול Business.

---

# 5. ומה לגבי הטענה שה־UI “די בסיסי”?

גם כאן יש אמת.

**SuperDoc לא נותן לך Microsoft Word בדפדפן.**

הוא נותן עורך מסמכים מוצלח עם UI מובנה, אבל לא מעטפת Office מלאה.

המבנה הטיפוסי שלו הוא בערך:

```text
┌──────────────────────────────────────────┐
│ Bold | Italic | Font | Size | Align ... │
├──────────────────────────────────────────┤
│                                          │
│                 דף                       │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ Comments / Review וכו'                   │
└──────────────────────────────────────────┘
```

ולא:

```text
File  Home  Insert  Draw  Design  Layout  References  Review  View
─────────────────────────────────────────────────────────────────
Clipboard │ Font │ Paragraph │ Styles │ Editing │ ...
─────────────────────────────────────────────────────────────────
                       Ruler
─────────────────────────────────────────────────────────────────
                         דף
```

כלומר אין כאן out-of-the-box חיקוי מלא של:

* Ribbon של Word;
* לשוניות Home / Insert / Layout / References / Review וכו';
* Backstage/File;
* קבוצות פקדים של Office;
* חלוניות Word השונות;
* status bar מלא;
* כל מאות אפשרויות הממשק של Word.

SuperDoc עצמם למעשה מכירים בכיוון הזה: במאי 2026 הם פרסמו **“Bring your own UI”** ומתארים במפורש מצב שבו SuperDoc יושב כמנוע מאחורי ממשק שהאפליקציה שלך בונה בעצמה. ([SuperDoc][4])

אפילו מדריך ה־Quickstart שלהם מציג שלוש אפשרויות: להשתמש ב־UI המובנה, להחליף חלקים ממנו, או להפעיל `ui: false` ולבנות את כל המעטפת בעצמך. ([docs.superdoc.dev][5])

---

## 6. מצד שני — ה־UI בסיסי, אבל היכולת שמתחתיו לא בסיסית

וזה הבדל חשוב.

SuperDoc מספק API ציבורי שמאפשר לבנות ממשק הרבה יותר עשיר מה־toolbar שהם נותנים.

לדוגמה, כרגע קטלוג הפקודות כולל בין היתר:

`Bold`, `Italic`, `Underline`, `Strikethrough`, גופן, גודל גופן, Undo/Redo, רשימות ושינויי Track Changes.

יש גם צבע טקסט, highlighting, יישור, line height, styles ועוד.

ויש אפילו פעולות של תמונות, תוכן עניינים, יצירת טבלאות, הוספה/מחיקה של שורות ועמודות, merge/split cells, ruler ו־formatting marks.

ה־UI המותאם מקבל גם state חי של הפקודה — לדוגמה האם Bold זמין והאם הטקסט המסומן כבר מודגש — כך שלא צריך לחפור ב־DOM כדי לבנות toolbar משלך. ([docs.superdoc.dev][6])

אז טכנית אפשר לבנות:

```text
┌────────────── Word-like Ribbon ────────────────┐
│ קובץ │ בית │ הוספה │ פריסה │ הפניות │ סקירה │
├────────────────────────────────────────────────┤
│ [B][I][U] Arial 12 │ יישור │ רשימות │ סגנונות │
└────────────────────────────────────────────────┘
                         │
                         ▼
                 SuperDoc canvas
```

וזה יכול להיראות כמעט בדיוק כפי שאנחנו רוצים.

אבל **אנחנו נהיה אלה שבונים את הממשק הזה**.

---

# 7. לכן שתי הטענות שקיבלת — במבחן המציאות

| הטענה                                                 | מסקנה                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| “מנוע הרינדור והיצוא אסור בהפצה ללא רישיון”           | **בעיקרון נכון.** מדויק יותר: מנוע ה־DOCX של v2 הוא קנייני ואסור redistribution לפי הרישיון העצמאי |
| “המעטפת סביב הדף די בסיסית”                           | **נכון.** היא פונקציונלית, אבל אינה Word/Ribbon מלא                                                |
| אפשר לבנות UI משלנו?                                  | **כן, ובצורה טובה מאוד**                                                                           |
| זה פותר את בעיית הרישוי?                              | **לא**                                                                                             |
| אפשר להפיץ `superdoc` v2 ארוז בתוך תוסף אוצריא חינמי? | **לא הייתי עושה זאת ללא היתר מפורש מ־SuperDoc**                                                    |

---

## 8. ומה עם SuperDoc v1?

יש כאן כיוון שראוי לבדיקה נפרדת.

לפני v2 הייתה סדרת **SuperDoc v1 / legacy**, וההפרדה החדשה של `@superdoc/docx-engine` היא התפתחות מאוחרת. התיעוד הנוכחי עצמו מדגיש ש־v2 נבחר לפי גרסת החבילה ושאין runtime switch בין v1 ל־v2. ([docs.superdoc.dev][7])

ייתכן שגרסת v1 האחרונה, `1.46.x`, הייתה עדיין implementation פתוח לחלוטין תחת AGPL ולא השתמשה במנוע הקנייני החדש.

**אבל אני לא קובע זאת עדיין.** צריך לבדוק את ה־tarball המדויק של גרסת v1, את כל dependencies שלו ואת הרישיון שהיה בתוקף באותו release. וגם אם הוא חוקי להפצה, צריך לבדוק כמה הוא נופל מ־v2 ברינדור DOCX, עברית, RTL, footnotes וכו'.

### המסקנה שלי כרגע

אם הדרישה היא:

> **תוסף אוצריא חינמי, self-contained, עובד אופליין ונשלח כ־`.otzplugin` לכל משתמש**

אז **אני מוריד כרגע את SuperDoc v2 מהמקום הראשון ברשימה**. בעיית הרישוי היא blocker אמיתי, לא הערה שולית.

מבחינת טכנולוגיה הוא דווקא מתאים מאוד; מבחינת UI אפשר לבנות Ribbon משלנו. אבל אין טעם להשקיע בזה אם בסוף אי אפשר להפיץ את המנוע.

הבדיקה הבאה שהייתי עושה היא רחבה יותר: לחפש מחדש מהתחלה מנועים תחת תנאי סף קשיחים — **100% client-side, HTML/JS/WASM, DOCX אמיתי, import+edit+export, הפצה חופשית בתוך התוסף, offline, עברית/RTL, הערות שוליים וטבלאות**, ולכלול גם בדיקה מדויקת של **SuperDoc v1** ושל **LibreOffice WASM/ZetaJS**.

[1]: https://docs.superdoc.dev/resources/docx-engine-license/ "SuperDoc DOCX Engine Proprietary License | SuperDoc"
[2]: https://docs.superdoc.dev/start/what-superdoc-does/?utm_source=chatgpt.com "What SuperDoc does | SuperDoc"
[3]: https://www.superdoc.dev/?utm_source=chatgpt.com "SuperDoc – Modern DOCX editor and Agent SDK"
[4]: https://www.superdoc.dev/changelog/2026-05-01-bring-your-own-ui?utm_source=chatgpt.com "Bring your own UI — SuperDoc Changelog"
[5]: https://docs.superdoc.dev/editor/quickstart/?utm_source=chatgpt.com "Editor quickstart | SuperDoc"
[6]: https://docs.superdoc.dev/editor/custom-ui/controller-setup/?utm_source=chatgpt.com "Custom UI controller setup | SuperDoc"
[7]: https://docs.superdoc.dev/editor/?utm_source=chatgpt.com "Editor overview | SuperDoc"


אני:
האם יש להם תכנית חינם לעמותות, או לקוד פתוח?

הai:
לפי המידע הרשמי העדכני שלהם, **לא מצאתי מסלול חינמי ייעודי לעמותות/מלכ"רים**. גם בעמוד התמחור וגם בתיעוד הרישוי אין כרגע אזכור ל־nonprofit, charity או הנחת עמותות. ([SuperDoc][1])

לקוד פתוח יש לכאורה מסלול **Community – Free**, והם אפילו כותבים שהוא מיועד ל־“open source software builders, hobbyists, and tinkerers”. אבל יש הסתייגות משמעותית: באותו עמוד הם מגדירים את ה־scope שלו כ־**Testing and personal use**, בעוד שימוש ב־production מתחיל במסלול Business של $6,000 לשנה. ([SuperDoc][2])

וזה חשוב במיוחד אצלך בגלל `@superdoc/docx-engine`: הרישיון שלו אומר ששימוש production/commercial מותר רק אם יש הסכם/מסלול/Order Form שמעניק זאת במפורש, ובמקביל אוסר redistribution של המנוע לצד שלישי. ([docs.superdoc.dev][3])

לכן המצב שאני רואה כרגע הוא:

* **עמותה:** אין תוכנית חינם מפורסמת שמצאתי.
* **פרויקט קוד פתוח:** יש Community Free, אבל **לא ברור שהוא מאפשר הפצה production של תוסף כמו אוצריא**, ובוודאי שהרישיון של ה־DOCX Engine יוצר בעיית redistribution.
* הם כן מזמינים לפנות אליהם ישירות בשאלות רישוי, כך שייתכן שהם נותנים **חריג/רישיון ללא עלות או בהנחה לפרויקט OSS/עמותה**, פשוט לא מפרסמים תוכנית כזו. ([docs.superdoc.dev][4])

במקרה של אוצריא, לדעתי **בהחלט שווה לפנות אליהם**: זה פרויקט קוד פתוח, לא מסחרי, והבקשה מאוד מוגדרת — רשות להפיץ את SuperDoc/DOCX Engine כחלק מתוסף חינמי.

אם תרצה, אני יכול עכשיו **למצוא את כתובת/טופס הפנייה המדויק שלהם ולנסח מייל קצר באנגלית שלא נשמע AI**, שבו נבקש במפורש רישיון חינמי ל־Otzaria + זכות redistribution בתוך `.otzplugin`.

[1]: https://www.superdoc.dev/ "SuperDoc – Modern DOCX editor and Agent SDK"
[2]: https://www.superdoc.dev/?utm_source=chatgpt.com "SuperDoc – Modern DOCX editor and Agent SDK"
[3]: https://docs.superdoc.dev/resources/docx-engine-license/ "SuperDoc DOCX Engine Proprietary License | SuperDoc"
[4]: https://docs.superdoc.dev/resources/license/?utm_source=chatgpt.com "Licensing | SuperDoc"


אני:
זה משהו מאוד מאוד לא ברור... הם מגדירים את עצמם כקוד פתוח, הקהילה (שמאוד לא אוהבת קוד קנייני) תורמת להם pr's
זה משהו מאוד מאוד לא ברור...
הם מגדירים את עצמם כקוד פתוח, הקהילה (שמאוד לא אוהבת קוד קנייני) תורמת להם pr's

אני רוצה שתבדוק לעומק האם יש פרוייקטים פתוחים שמתבססים עליהם, וזמינים בגיטהאב (אולי אפשר לחפש בגיטהאב לפי הimport ש/ל החבילה הקנייינית).
זה יוכיח לנו אם הם מתנגדים או לא.


הai:
כן. החיפוש הזה שינה את התמונה בצורה משמעותית.

המסקנה שלי עכשיו היא שצריך **לתקן את הניסוח הקודם שלי**: לא נכון לומר בפשטות ש־“SuperDoc v2 אסור להפצה בלי רישיון מסחרי”. מהמקורות הרשמיים ומהשימושים שמצאתי עולה ש־SuperDoc **בהחלט מתכוונים לאפשר שימוש אמיתי בפרויקטי קוד פתוח תחת AGPL**. הבעיה המצומצמת שנותרה היא: האם מותר לפרויקט כזה **לארוז בעצמו את קבצי `@superdoc/docx-engine` בתוך artifact אופליין שמופץ למשתמשים** — וזה עדיין לא כתוב בצורה מספיק ברורה.

## מה מצאתי בפועל

| מקרה                                |  SuperDoc | מה עושים עם המנוע                                               |    מופץ בפועל? | ערך כראיה                                    |
| ----------------------------------- | --------: | --------------------------------------------------------------- | -------------: | -------------------------------------------- |
| `crs48/superdoc-timeline`           | **2.5.1** | מעתיקים פיזית את Workers של `@superdoc/docx-engine` ל־`public/` | ✅ GitHub Pages | **חזקה מאוד טכנית**                          |
| `franciscolir/superdoc-editor-docx` | **2.3.0** | engine מופיע כתלות קניינית ב־lockfile                           |     קוד ציבורי | בינונית                                      |
| משתמש production ב־Issue #3869      | **2.3.0** | v2 engine בפרודקשן                                              |              ✅ | חזקה לכך ש־SuperDoc מודעים לשימוש production |
| `novadominion/superdoc-host`        |    1.46.1 | אין engine החדש                                                 |       ✅ Vercel | לא רלוונטי ל־v2                              |
| SuperDoc עצמם                       |        v2 | מפרידים את engine מה־bundle וטוענים אותו מ־jsDelivr             |              ✅ | **הראיה החשובה ביותר למדיניות**              |

### 1. `superdoc-timeline` — הממצא הכי מעניין

זה בדיוק כמעט הניסוי שהצעת.

הפרויקט `crs48/superdoc-timeline` הוא repository ציבורי שנוצר באוגוסט 2026, ומשתמש ב:

```json
"superdoc": "2.5.1"
```

אבל החלק המעניין הרבה יותר הוא סקריפט הבנייה שלהם. הם **מחפשים במפורש**:

```text
node_modules/@superdoc/docx-engine/dist/assets
```

ומעתיקים משם את שלושת קבצי ה־Web Worker:

```text
browser-worker-entry-...
collaboration-worker-entry-...
review-index-worker-entry-...
```

לתוך:

```text
public/superdoc-workers/
```

כלומר הם לא רק עושים `npm install`; הם ממש **לוקחים artifacts מהחבילה הקניינית ומכניסים אותם להפצה שלהם**.

והם לא עושים זאת לצורכי development בלבד. ה־GitHub Action שלהם:

```text
pnpm install
pnpm build
→ upload dist
→ deploy GitHub Pages
```

וה־README אומר מפורשות:

> SuperDoc’s Web Workers are self-hosted.

ומתאר שה־Workers מועתקים ל־`public/superdoc-workers` כדי שיימצאו תחת כתובת GitHub Pages **ב־production**.

זה מאוד קרוב למה שאנחנו רוצים לעשות:

```text
אצלם:
@superdoc/docx-engine
        ↓
העתקת Workers
        ↓
dist/
        ↓
GitHub Pages

אצלנו:
@superdoc/docx-engine
        ↓
bundle / העתקת Workers
        ↓
.otzplugin
        ↓
מחשב המשתמש
```

זה הממצא החזק ביותר שמצאתי נגד הפרשנות המחמירה שנתתי קודם.

[superdoc-timeline ב-GitHub](https://github.com/crs48/superdoc-timeline?utm_source=chatgpt.com)

**אבל:** ל־repository הזה אין LICENSE מזוהה ב־GitHub. כלומר הוא “קוד ציבורי”, אבל אי אפשר להשתמש בעצם קיומו כהוכחה משפטית שהפעולה מאושרת.

אפילו יותר מעניין: ה־README שלו אומר בחלק הרישוי שה־frontend “unencumbered”.

זה אומר לפחות שמפתח רציני שהשקיע לא מעט בעבודה עם v2 **הבין שהדבר מותר**. זה עדיין לא אומר ש־SuperDoc אישרו לו את הפרשנות.

---

## 2. מצאתי עוד פרויקט ציבורי שבאמת משתמש ב־v2

`franciscolir/superdoc-editor-docx`, שנוצר ב־31 ביולי 2026.

ה־`package.json` שלו:

```json
"dependencies": {
  "superdoc": "^2.3.0"
}
```

וה־lockfile מראה במפורש:

```text
superdoc 2.3.0
license: AGPL-3.0

└── @superdoc/docx-engine 0.2.0
    license: SEE LICENSE IN DOCX-ENGINE-LICENSE.md
```

כלומר קיימים בפועל repositories ציבוריים חדשים שמתקינים את הצירוף:

```text
AGPL SuperDoc
+
Proprietary DOCX Engine
```

[superdoc-editor-docx ב-GitHub](https://github.com/franciscolir/superdoc-editor-docx?utm_source=chatgpt.com)

אבל גם כאן אין license מזוהה ל־repository עצמו, ולכן זו לא הוכחה מספקת בפני עצמה.

---

# 3. ויש ראיה חזקה יותר: SuperDoc מודעים לשימוש v2 ב־production

מצאתי Issue רשמי שלהם מאוגוסט 2026 שבו משתמש חיצוני כותב במפורש:

> Production observation (`superdoc@2.3.0`, v2 engine integration...)

והוא מתאר מערכת production אמיתית שמריצה מסמכים משפטיים גדולים ב־v2.

SuperDoc לא הגיבו לו “אתה משתמש בזה בלי רישיון”, אלא maintainer שלהם:

* הודה לו על הדיווח;
* ניתח איתו את הבעיה;
* ביקש traces ומסמכי בדיקה;
* והעניין נכנס למערכת Linear הפנימית של SuperDoc.

זה מוכיח ש־SuperDoc **בוודאי לא מתייחסים ל־v2 כאל משהו שמותר רק לשחק איתו מקומית**.

אבל יש הסתייגות: אין לנו דרך לדעת אם אותו משתמש production מחזיק רישיון מסחרי. לכן זה מוכיח awareness ושימוש production, לא “חינם לכולם”.

---

# 4. אבל המקור הרשמי של SuperDoc עצמם הוא אפילו יותר משמעותי

עמוד הרישוי שלהם אומר כרגע, בלי הסתייגות של “personal use only”:

> “Choose the license that matches how you distribute and operate your application.”

ולגבי Open Source:

> “Use the open-source license when your application can meet the AGPLv3 requirements.”

([SuperDoc][1])

זה ניסוח מאוד משמעותי.

הם לא אומרים:

```text
AGPL = development only
Commercial = production
```

אלא:

```text
אם האפליקציה שלך יכולה לעמוד ב-AGPL
        ↓
השתמש ברישיון Open Source

אם אינך רוצה / יכול לעמוד ב-AGPL
        ↓
Commercial
```

זה בדיוק מודל dual-license קלאסי.

וגם מדריך ה־v2 הרשמי אומר:

```bash
pnpm add superdoc
```

ואז:

> “For production, pin the exact version…”

כלומר הם ממש מדריכים משתמשי v2 איך לעבוד ב־**production** עם חבילת `superdoc`. ([SuperDoc][2])

לכן אני כבר **לא מקבל** את הפרשנות ש־AGPL/Community הוא רק playground ולא יכול לשמש תוכנת קוד פתוח production.

---

# 5. וה־PRs שהזכרת — אתה צודק גם בזה

זה לא repository שבו החברה זורקת מעטפת חסרת משמעות לקהילה.

ב־`CONTRIBUTING.md` הנוכחי הם מזמינים במפורש PRs ל־v2, ומציינים היכן לשנות:

* Visual rendering
* Style resolution
* Editing behavior
* **DOCX import and export**
* main editor
* React wrapper

והם אומרים:

```text
Open contributions against main for the current V2 editor.
```

זאת אומרת שהקהילה באמת תורמת לחלקים מרכזיים מאוד.

וזה מחזק את הטענה שלך: יהיה מודל מוזר מאוד אם החברה תגיד לקהילה:

> תכתבו לנו rendering, layout, DOCX import/export ו־editor בקוד פתוח,

אבל:

> אסור לכם להשתמש בפרויקט שאתם עצמכם תורמים לו בשום פרויקט פתוח אמיתי.

וזה גם לא תואם את עמוד הרישוי הרשמי שלהם, שאומר במפורש להשתמש ב־AGPL כאשר האפליקציה יכולה לעמוד בו. ([SuperDoc][1])

---

# אז מה לעזאזל אומר רישיון ה־Engine?

כאן נמצאת הבעיה האמיתית.

מצד אחד הוא אומר:

> `Authorized Use` כולל שימוש ב־DOCX Engine כתלות של SuperDoc, כולל עם קוד SuperDoc תחת AGPL, ל־“other use permitted under the AGPLv3”.

ובהמשך אפילו:

> בלי הסכם מסחרי, מותר להתקין ולהשתמש ב־DOCX Engine כתלות של SuperDoc לשימושים המותרים תחת AGPL.

([SuperDoc][3])

וזה נשמע בדיוק כאילו:

```text
Otzaria Plugin
      ↓
AGPL
      ↓
SuperDoc AGPL
      ↓
DOCX Engine dependency
      ↓
מותר
```

והם גם מבהירים:

> building Customer-authored applications and integrations powered by DOCX Engine ... is permitted within Authorized Use.

([SuperDoc][3])

**אבל אז מגיע 3.1(d):**

אסור:

> Redistribute, republish, mirror ... or otherwise make the DOCX Engine Materials available to any third party.

([SuperDoc][3])

ושני המשפטים האלו לא יושבים טוב ביחד כאשר מדובר באפליקציה Client-side.

---

# 6. ואז מצאתי משהו שמסביר איך SuperDoc עצמם פותרים את הסתירה בדפדפן

זה בעיניי אחד הממצאים החשובים ביותר.

בגרסת ה־CDN של SuperDoc הם **בכוונה לא מכניסים את ה־DOCX Engine לתוך `superdoc.min.js`**.

במקום זאת הקוד שלהם עושה בזמן ריצה:

```js
https://cdn.jsdelivr.net/npm/@superdoc/docx-engine@VERSION
```

וטוען משם:

```text
dist-cdn/docx-engine.es.js
dist-cdn/style.css
```

ויש להם אפילו בדיקת build מיוחדת בשם:

```text
audit-cdn-separation
```

שנכשלת אם:

* worker של המנוע נכנס ל־SuperDoc bundle;
* רישיון המנוע נכנס ל־SuperDoc bundle;
* engine code עצמו נבלע בתוך `superdoc.min.js`.

ובסוף היא מדפיסה:

```text
SuperDoc CDN loads the exact separate DOCX Engine package
```

כלומר ההפרדה בין:

```text
SuperDoc AGPL
```

לבין:

```text
DOCX Engine proprietary
```

היא **מכוונת מאוד**.

---

# וזה משנה את הניתוח של אוצריא

באתר רגיל אפשר לעשות:

```text
האפליקציה שלי
   │
   ├── SuperDoc AGPL
   │
   └── בזמן ריצה:
          ↓
     jsDelivr
          ↓
     @superdoc/docx-engine
```

במקרה כזה בעל האתר לא בהכרח “redistributes” בעצמו את חבילת המנוע; המשתמש מקבל אותה מה־distribution הרשמי של החבילה.

אבל אצלנו רוצים:

```text
editor.otzplugin
│
├── superdoc.js
├── docx-engine.js
├── document-worker.js
├── collaboration-worker.js
└── ...
```

ואז להוריד את ה־`.otzplugin`.

כאן אנחנו בעצמנו ממש:

```text
copy
     +
package
     +
deliver to third party
```

וזה הרבה יותר קרוב מילולית ל־`redistribute`.

לכן **זו הנקודה היחידה שעוד מטרידה אותי**.

---

# אבל `superdoc-timeline` עושה בדיוק את זה!

וכאן חוזרים לממצא הכי חשוב.

הוא לא מסתפק ב־CDN.

הוא ממש עושה:

```js
await copyFile(
    join("@superdoc/docx-engine/dist/assets", worker),
    "public/superdoc-workers/document.js"
);
```

ואז GitHub Pages מפיץ את הקובץ.

כלומר לפחות מפתח אחד כבר עושה בפומבי את **אותו סוג redistribution שאנחנו שוקלים**.

זה משמעותי מאוד.

אבל אין לי עדיין את חוליית ההוכחה האחרונה:

> “SuperDoc יודעים שהוא עושה זאת, ובירכו/אישרו את זה.”

אותה לא מצאתי.

---

## לכן המסקנה שלי השתנתה

הייתי מדרג עכשיו את הדברים כך:

| שאלה                                                                | מסקנה                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| האם SuperDoc מתנגדים לפרויקטי OSS שמשתמשים ב־v2?                    | **לא. כמעט בוודאות ההפך.**                                                       |
| האם AGPL מיועד רק לפיתוח/בדיקות?                                    | **לא נראה כך בכלל.** המסמכים הרשמיים אומרים להשתמש בו אם האפליקציה עומדת ב־AGPL. |
| האם קיימים פרויקטים ציבוריים שמשתמשים ב־v2 + engine?                | **כן.**                                                                          |
| האם קיימת הפצה ציבורית שמעתיקה בפועל קבצי engine?                   | **כן — `superdoc-timeline`.**                                                    |
| האם SuperDoc מעודדים PRs אפילו לליבת rendering/import/export של v2? | **כן.**                                                                          |
| האם יש הוכחה רשמית שמותר להכניס engine לתוך artifact אופליין שמופץ? | **עדיין לא.**                                                                    |
| האם אני עדיין עומד מאחורי “אסור להפיץ SuperDoc v2 ללא רישיון”?      | **לא. הניסוח הזה היה קטגורי מדי.**                                               |
| מה בדיוק נשאר לא ברור?                                              | **redistribution של קבצי ה־engine עצמם בתוך `.otzplugin` אופליין.**              |

ובעיניי יש סבירות ממשית שהכוונה שלהם בסעיף האוסר redistribution היא בעצם:

> אסור להפיץ/למכור/לארוז מחדש את **המנוע כמוצר עצמאי**, אבל מותר שהוא יגיע כחלק מאפליקציית SuperDoc AGPL.

הבעיה היא שהנוסח הנוכחי של 3.1(d) רחב יותר מזה: הוא אומר גם “otherwise make … available to any third party”, ורק בסוף מזכיר standalone package. ([SuperDoc][3])

לכן אני לא רוצה להסיק את החריג הזה מהאוויר.

### מה יסגור את הנושא לחלוטין

צריך מהם תשובה לשאלה אחת מאוד צרה:

> Under the AGPL/open-source path, may an AGPL-licensed desktop application redistribute the **unmodified `@superdoc/docx-engine` browser bundle and worker assets inside its offline installer/plugin**, solely as a dependency of SuperDoc, while preserving all proprietary license and copyright notices?

ואני הייתי מוסיף:

> The end-user environment has no Internet access, so loading the engine from jsDelivr at runtime is not an option.

אם התשובה היא **Yes** — מבחינתי SuperDoc v2 חוזר מיד להיות מועמד רציני מאוד לתוסף אוצריא, והסוגיה של $6,000 כמעט יורדת מהשולחן.

אם תרצה, השלב הבא שכדאי לי לעשות הוא **לא לנסח מייל עדיין**, אלא לחפש עוד יותר ממוקד: Issues/Discussions/Discord mirrors/PRs של SuperDoc עם המילים `redistribute`, `self-host`, `AGPL`, `desktop`, `Electron`, `Tauri`, `workers`, ולנסות למצוא **משפט מפורש מאחד המפתחים שלהם** שעונה בדיוק על השאלה הזו.

[1]: https://docs.superdoc.dev/resources/license/ "Licensing | SuperDoc"
[2]: https://docs.superdoc.dev/editor/quickstart/ "Editor quickstart | SuperDoc"
[3]: https://docs.superdoc.dev/resources/docx-engine-license/ "SuperDoc DOCX Engine Proprietary License | SuperDoc"

אני:
אני רוצה לבנות poc לבנתיים, בהנחה שאקבל תשובה חיובית (אני בטוח בכך...)
אם נניח שהם יכתבו שזה מותר, זה אומר שאין לי שום הגבלה בייבוא, נכון?


הai:
כן — **לצורך ה־POC אתה יכול כבר עכשיו להתקדם**. הרישיון הנוכחי של `@superdoc/docx-engine` מתיר במפורש התקנה ושימוש לצורכי evaluation, development ו-testing, כל עוד הוא משמש כתלות של SuperDoc. ([SuperDoc][1])

ואם הם יענו ב־Issue תשובה מפורשת בסגנון:

> Yes, an AGPL/open-source project may use SuperDoc v2 and bundle/redistribute `@superdoc/docx-engine` as part of the application/plugin.

אז מבחינתי **בעיית הרישוי הספציפית שלנו נפתרת**: נוכל להתקין את `superdoc`, לבנות אותו לתוך התוסף, לכלול את ה־engine וה־workers הדרושים ולעשות תוסף אופליין שמופץ למשתמשים — בכפוף ל־AGPL ולתנאי המנוע. עמוד הרישוי שלהם ממילא אומר שמסלול הקוד הפתוח מיועד לאפליקציות שיכולות לעמוד בדרישות AGPL. ([SuperDoc][2])

אבל לא הייתי אומר “אין **שום** הגבלה”. עדיין נשארות כמה מגבלות של המנוע הקנייני: אסור לשנות/לפרק/לעשות reverse engineering למנוע, להסיר notices, להשתמש בו כדי לפתח מנוע מתחרה וכדומה. ([SuperDoc][1])

ויש עוד הבחנה טכנית חשובה: הייתי **מייבא בקוד את `superdoc`**, למשל:

```ts
import { SuperDoc } from 'superdoc';
```

ולא בונה את התוסף סביב:

```ts
import ... from '@superdoc/docx-engine';
```

כי הרישיון הנוכחי מעניק שימוש ב־DOCX Engine **“solely as a dependency of SuperDoc”**. ([SuperDoc][1])
כלומר המנוע יכול להיות ארוז אצלנו כדי ש־SuperDoc יעבוד אופליין, אבל עדיף שלא נשתמש ישירות ב־API הפנימי שלו אלא אם הם יאשרו גם זאת במפורש.

### ולמעשה, ל־POC אין צורך לחכות לתשובה

אפשר כבר עכשיו לבנות אותו כך:

**Otzaria plugin → SuperDoc v2 → DOCX Engine**, הכול מקומי ואופליין.

רק **לא לפרסם/להפיץ את ה־`.otzplugin` לציבור** עד שנקבל מהם את ההבהרה לגבי redistribution.

אם תרצה, אני יכול עכשיו לעבור ל־Work ולבנות את ה־POC עצמו כתוסף אוצריא בסיסי: פתיחת DOCX → הצגה ועריכה ב־SuperDoc, עם כל dependencies וה־workers מקומיים בתוך התוסף.

[1]: https://docs.superdoc.dev/resources/docx-engine-license/?utm_source=chatgpt.com "SuperDoc DOCX Engine Proprietary License | SuperDoc"
[2]: https://docs.superdoc.dev/resources/license/?utm_source=chatgpt.com "Licensing | SuperDoc"


אני:
חפש לעומק: האם יש מישהו שבנה ui יפה בסגנון word?
צרפתי לך קבצים של מישהו שכבר בנה ״וורד לאוצריא״, באיזו חבילה הוא משתמש?
הui שלו נחמד, יחסית... לא מספיק טוב, אבל בסיסי+

הai:
כן. עברתי גם על הקבצים שצירפת וגם על פרויקטים ציבוריים נוספים. יש כאן מסקנה די ברורה: **לא צריך להמציא את ממשק ה־Word מאפס**, אבל גם לא מצאתי כרגע פרויקט SuperDoc v2 שנותן לנו Ribbon של Word ברמה גבוהה ומוכן להדבקה.

## קודם כול: במה משתמש "וורד לאוצריא" שצירפת?

התשובה המפתיעה היא: **הוא לא משתמש בחבילת עורך טקסט אמיתית בכלל.**

זה לא SuperDoc, לא TipTap, לא ProseMirror, לא CKEditor, לא TinyMCE ולא Quill.

ליבת העריכה שלו היא פשוט `contentEditable` של הדפדפן:

```js
pg.contentEditable = 'true';
pg.dir = 'rtl';
pg.innerHTML = html;
```



והפקודות של Bold, Italic, יישור, גופן וכו' מבוססות על ה־API הישן של הדפדפן:

```js
document.execCommand(...)
document.queryCommandState(...)
```



אפילו Format Painter שלו בנוי ידנית באמצעות `queryCommandState()` ואחר כך `execCommand()` עבור bold/italic/underline וכו'.

כל ה־Ribbon המרשים יחסית שאתה רואה — **נכתב ידנית ב־HTML/CSS/JS**. יש שם Title Bar, לשוניות קובץ/בית/הוספה/פריסה/הפניות/תצוגה/עיצוב/סקירה, Ribbon groups, חלונית ניווט, status bar, comments, track changes וכו'.

### ומהן שתי הספריות שכן נמצאות שם?

רק:

**JSZip 3.10.1** — לפתיחה/טיפול במבנה ZIP של DOCX.

ו־**Mammoth** — כ־fallback להמרת DOCX ל־HTML.

אבל אפילו Mammoth אינו המנגנון הראשי בגרסה ששלחת. המחבר כבר כתב importer משלו: הוא פותח את ה־DOCX באמצעות JSZip, קורא ידנית את `word/document.xml`, את `styles.xml`, `numbering.xml`, relationships ותמונות וממיר אותם ל־HTML.

רק אם ה־parser העצמאי נכשל הוא נופל ל־Mammoth.

גם הייצוא הפוך נכתב כמעט כולו ידנית: הוא בונה בעצמו `document.xml`, `styles.xml`, `settings.xml`, relationships ו־`[Content_Types].xml`, ואז יוצר DOCX.

כלומר המבנה הוא:

```text
UI:
HTML + CSS + JavaScript שנכתב ידנית
             │
             ▼
Editor:
contentEditable + document.execCommand()
             │
      ┌──────┴──────┐
      ▼             ▼
DOCX import      DOCX export
JSZip +          HTML → OOXML
parser עצמי      שנכתב ידנית
      │
      └─ fallback → Mammoth
```

זה גם מסביר למה **ה־UI דווקא נראה לא רע**, בעוד שעומק התאימות ל־Word לעולם יהיה מוגבל יחסית. הוא בעצם בנה מיני־Word בעצמו.

ה־manifest אכן מגדיר אותו כ־"עורך מסמכים בסגנון Word", גרסה 1.3.5, ולא מצביע על שום framework/editor חיצוני.

---

# מה מצאתי בחיפוש אחר UI טוב יותר

אלה הממצאים הרלוונטיים ביותר:

| פרויקט                           | מנוע               | UI דמוי Word                     | אפשר לקחת ממנו?      | הערכה שלי                   |
| -------------------------------- | ------------------ | -------------------------------- | -------------------- | --------------------------- |
| **Herramienta_Optimizacion_PBM** | SuperDoc **v1**    | טוב, מודרני                      | רישיון לא ברור       | ⭐⭐⭐⭐                        |
| **LocalOffice**                  | TipTap/ProseMirror | Ribbon אמיתי: Home/Insert/Layout | **AGPL**, כן         | ⭐⭐⭐⭐⭐                       |
| **Canvas Editor**                | מנוע Canvas משלו   | סביבת Word מלאה מאוד             | **MIT**, כן          | ⭐⭐⭐⭐½                       |
| **ONLYOFFICE web-apps**          | ONLYOFFICE         | UI Office מלא ומלוטש             | AGPL, אבל מסובך מאוד | ⭐⭐⭐⭐⭐ חזותית                |
| SuperDoc v2 official custom UI   | SuperDoc v2        | בסיסי למדי                       | כן                   | ⭐⭐ כ־UI, ⭐⭐⭐⭐⭐ כחיבור למנוע |

## 1. הדבר הכי קרוב שמצאתי ל־SuperDoc + UI נורמלי

זה הפרויקט:

[Herramienta_Optimizacion_PBM ב־GitHub](https://github.com/T0m4s1n/Herramienta_Optimizacion_PBM?utm_source=chatgpt.com)

יש בו ממש קובץ בשם:

```text
frontend/components/editor/EditorSuperDocRibbon.tsx
```

והוא כולל Ribbon שנכתב במיוחד סביב SuperDoc. הוא משתמש ב־React, Lucide icons וממשק כחול בסגנון Office.

הוא כולל Undo/Redo, גופן, גודל, Bold/Italic/Underline/Strike, צבע, Highlight, יישור, Lists, Indent, Line Height, Images, Links וטבלאות. אפילו בורר הטבלה בנוי כגריד 10×10 בסגנון Word.

בנוסף יש לו `EditorWorkspaceHeader.tsx`, עם תפריטי File/Edit/View/Insert/Format/Tools/Table/Help, חלון shortcuts, ייצוא DOCX/HTML/Markdown/PDF, כותרת מסמך ומצבי שמירה.

**אבל מצאתי פרט חשוב:** הוא לא v2.

ה־`package.json` שלו קובע:

```json
"superdoc": "^1.32.0",
"@superdoc-dev/react": "^1.3.0"
```

לכן אפשר בהחלט ללמוד ממנו **איך צריך להיראות הממשק**, אבל לא להעתיק את שכבת החיבור שלו למנוע ולצפות שהיא תעבוד ב־v2. SuperDoc עצמם אומרים שב־v2 ה־`headless-toolbar` הישן הוסר והדרך החדשה היא `superdoc.ui` ו־`superdoc/ui/react`. ([SuperDoc][1])

ויש בעיה נוספת: ל־repository הזה לא זיהיתי רישיון פתוח. לכן לא הייתי מעתיק ממנו קוד ממש ללא אישור. אפשר בהחלט להשתמש בו כרפרנס.

---

# 2. הממצא שהכי מוצא חן בעיניי עבורנו: LocalOffice

זה לדעתי **הבסיס הכי שימושי שמצאתי עבור ה־UI שלנו**:

[LocalOffice ב־GitHub](https://github.com/Anon5T4R/LocalOffice?utm_source=chatgpt.com)

המחבר מגדיר אותו במפורש כעורך עם:

> “Ribbon estilo Word/OnlyOffice”

וה־stack שלו הוא React + TypeScript + TipTap/ProseMirror. הפרויקט כולו AGPL-3.0. ([GitHub][2])

יותר חשוב: בניגוד ל"וורד לאוצריא", ה־Ribbon שלו **כבר מפורק בצורה נקייה לקומפוננטות**:

```text
src/editor/ribbon/
├── Ribbon.tsx
├── HomeTab.tsx
├── InsertTab.tsx
├── LayoutTab.tsx
├── Btn.tsx
└── shared.ts
```

`Ribbon.tsx` עצמו מנהל לשוניות נפרדות Home / Insert / Layout ומרכיב את הקומפוננטה המתאימה לכל אחת.

ו־HomeTab כבר מכיל כמעט את מה שאנחנו צריכים: Undo/Redo, Styles/Headings, בחירת גופן, גודל, Bold/Italic/Underline/Strike, Superscript/Subscript, צבע טקסט, Highlight, יישורים, Indent, Lists, Blockquote, Format Painter ו־Clear formatting.

הבעיה היחידה היא שהפעולות כרגע עושות למשל:

```ts
editor.chain().focus().toggleBold().run()
```

כי המנוע הוא TipTap.

אצלנו פשוט מחליפים את **שכבת הפעולות**, לא את ה־UI:

```ts
SuperDoc:
superdoc.ui.commands.executeAsync('bold')
```

וה־state מגיע מה־controller של SuperDoc v2.

לדעתי זה הרבה פחות עבודה מאשר לכתוב Ribbon חדש.

---

# 3. Canvas Editor — עוד מקור UI מצוין

[Hufe921/canvas-editor ב־GitHub](https://github.com/Hufe921/canvas-editor?utm_source=chatgpt.com)

זה פרויקט רציני בהרבה ממה שחשבתי בתחילה: כ־5,000 כוכבים, TypeScript, רישיון MIT, ומוצהר במפורש כעורך שמיועד ל־**Word-like document experiences**. הוא לא משתמש ב־`contentEditable` אלא מצייר את המסמך בעצמו ב־Canvas/SVG, ולכן יש לו pagination אמיתי, headers/footers, page numbers, margins, TOC, tables, comments, rulers וכו'. ([GitHub][2])

יש לו גם plugin רשמי ל־DOCX, אבל אני **לא ממליץ להחליף בגללו את SuperDoc**: יש דיווחים פתוחים על אובדן עיצוב ב־import/export של Word, בדיוק הבעיה שאנחנו רוצים להימנע ממנה. ([GitHub][3])

אבל מבחינת **UI/UX**, יש שם הרבה מה ללמוד וניתן להשתמש בקוד MIT.

---

# 4. ויש כמובן את ה־UI האמיתי של ONLYOFFICE

זה ממצא ששווה לדעת עליו:

[ONLYOFFICE/web-apps](https://github.com/ONLYOFFICE/web-apps?utm_source=chatgpt.com)

זה לא clone מקרי — זה ממש **כל ה־frontend של ONLYOFFICE Document Editor ו־Desktop Editors**. כלומר ה־Ribbon, התפריטים, החלוניות, דיאלוגים וכו'. הפרויקט AGPL-3.0. ([GitHub][4])

מבחינת רמת UI זה כמובן גבוה מאוד.

אבל אני **לא ממליץ לקחת ממנו את ה־Ribbon כבסיס ראשוני**. הקוד עצום ומחובר עמוק ל־SDK ולמבנה הפנימי של ONLYOFFICE. נבלה יותר זמן בחילוץ התצוגה מהמנוע מאשר בבניית Ribbon משלנו.

כן הייתי משתמש בו כ־**reference design**: איך בנויים tabs, groups, contextual tabs, status bar, rulers, dialogs וכו'.

---

# ומה SuperDoc עצמם נותנים לנו כיום?

דווקא כאן יש חדשות טובות מבחינת הארכיטקטורה.

ב־v2 הם תומכים רשמית ב:

```ts
new SuperDoc({
    ...
    ui: false
})
```

כלומר: **אל תציג בכלל את ה־UI שלהם; תן לי רק את משטח המסמך והמנוע**.

למרות `ui:false`, ה־`superdoc.ui`, ה־Document API וכל יכולות העריכה ממשיכים לעבוד. ([SuperDoc][5])

בדוגמה הרשמית הנוכחית שלהם הם ממש מראים `ui:false`, ואז שולטים ב־Bold מבחוץ באמצעות `superdoc.ui.commands`.

כלומר SuperDoc v2 **בנוי בדיוק לסוג הארכיטקטורה שאנחנו צריכים**.

---

# לכן הייתי בונה את ה־POC בצורה קצת שונה ממה שחשבנו קודם

לא:

```text
SuperDoc
└── ה-UI הבסיסי של SuperDoc
```

אלא:

```text
                 ┌──────────────────────────┐
                 │   UI בסגנון Microsoft   │
                 │          Word            │
                 │                          │
                 │  Ribbon / Tabs / Status  │
                 │  Nav / Review / Dialogs  │
                 └────────────┬─────────────┘
                              │
                        superdoc.ui
                              │
                 ┌────────────▼─────────────┐
                 │       SuperDoc v2        │
                 │                          │
                 │   DOCX Canvas / Engine   │
                 │   Pagination / OOXML     │
                 │   Tables / Footnotes     │
                 │   Headers / TrackChanges │
                 └──────────────────────────┘
```

ובעיניי השילוב הטוב ביותר הוא:

**בסיס ויזואלי/מבני:** `LocalOffice`
**רפרנס נוסף:** ה־Ribbon של `Herramienta_Optimizacion_PBM`
**מנוע:** SuperDoc v2
**דברים ייחודיים לאוצריא:** לקחת מ"וורד לאוצריא" ששלחת — למשל לשונית אוצריא, RTL מלא, חלונית ניווט, status bar, בחירת גופני מערכת, האינטגרציה עם theme של אוצריא וכו'.

וזה חשוב: ה־UI של "וורד לאוצריא" ששלחת **לא צריך להיזרק**. הוא כבר פתר לא מעט החלטות UX שימושיות בעברית. פשוט צריך להוציא מתוכו את החלק הלא נכון — `contentEditable + execCommand + HTML↔OOXML` — ולהחליף את מרכז המסמך ב־SuperDoc.

### השורה התחתונה

לא מצאתי כרגע **"Microsoft Word clone UI for SuperDoc v2" מוכן ומלוטש** שאפשר פשוט להתקין.

אבל כן מצאתי מספיק חומר כדי שלא נצטרך לעצב אותו מאפס. הייתי לוקח את **ה־Ribbon הקומפוננטי של LocalOffice**, משדרג אותו ויזואלית לכיוון Word 365, ומחבר כל פקד ל־`superdoc.ui` החדש. זה נראה לי מסלול הרבה יותר טוב מאשר להמשיך את ה־UI הידני מתוך התוסף ששלחת — ובוודאי טוב יותר מה־UI המובנה של SuperDoc.

[1]: https://docs.superdoc.dev/editor/migrate-from-v1/overview/?utm_source=chatgpt.com "Migrate from v1 | SuperDoc"
[2]: https://github.com/Hufe921/canvas-editor?utm_source=chatgpt.com "GitHub - Hufe921/canvas-editor: A Canvas/SVG-based rich text editor · GitHub"
[3]: https://github.com/Hufe921/canvas-editor-plugin?utm_source=chatgpt.com "GitHub - Hufe921/canvas-editor-plugin: plugins for canvas-editor · GitHub"
[4]: https://github.com/ONLYOFFICE/web-apps?utm_source=chatgpt.com "GitHub - ONLYOFFICE/web-apps: The frontend for ONLYOFFICE Document Server which builds the program interface · GitHub"
[5]: https://docs.superdoc.dev/editor/quickstart/?utm_source=chatgpt.com "Editor quickstart | SuperDoc"


אני:
הם ענו:
[https://github.com/superdoc/docx-editor/issues/3927#issuecomment-5383145303](https://github.com/superdoc/docx-editor/issues/3927#issuecomment-5383145303)
לא הבנתי מה התשובה...


הai:
**הם ענו תשובה חיובית וברורה מאוד.** למעשה, הם אישרו בדיוק את המקרה שלך.

## מה הם אומרים בפשטות

מותר לך ליצור **תוסף קוד פתוח לאוצריא תחת AGPLv3**, להשתמש ב־SuperDoc v2, ולכלול בתוך התוסף גם את:

* `@superdoc/docx-engine`
* קבצי ה־Worker שלו
* קובצי CSS ונכסי runtime נוספים שהמנוע דורש
* כל מה שנדרש כדי שהתוסף יעבוד אופליין

אין צורך לשלם על רישיון מסחרי, כל עוד התוסף עומד בתנאי AGPLv3 והמנוע משמש רק כחלק מ־SuperDoc.

במילים אחרות, המבנה הבא מותר:

```text
word-for-otzaria.otzplugin
├── קוד התוסף שלך
├── SuperDoc v2
├── @superdoc/docx-engine
├── Web Workers של המנוע
├── CSS ונכסי runtime
└── מסמכי הרישוי הנדרשים
```

## הם אפילו אישרו במפורש את שיטת ההפצה

אתה שאלת על `superdoc-timeline`, שמעתיק את קובצי ה־Worker של המנוע לתיקיית `public` ומפיץ אותם עם האפליקציה. הם כתבו במפורש שהפעולה הזאת **מותרת** כאשר היא נעשית כחלק מהפעלת SuperDoc v2.

לכן אין הבדל עקרוני בין:

```text
public/superdoc-workers/
```

באתר, לבין:

```text
assets/superdoc-workers/
```

בתוך תוסף אוצריא אופליין.

## מה התנאים?

### 1. התוסף צריך לעמוד ב־AGPLv3

הדרך הבטוחה היא:

* לפרסם את כל קוד המקור של התוסף.
* לתת לתוסף רישיון AGPLv3.
* לכלול את קובצי ההגדרות והבנייה הדרושים ליצירת התוסף.
* לא להסתפק בפרסום קוד חלקי כאשר הקוד המופץ שונה ממנו.
* לציין את SuperDoc ואת רישיונו.

אין צורך להפוך את `@superdoc/docx-engine` עצמו לקוד פתוח — אין לך ממילא את קוד המקור שלו. הוא נשאר רכיב קנייני מורשה שמצורף כתלות של SuperDoc.

### 2. המנוע חייב לשמש רק כתלות של SuperDoc

זה מותר:

```ts
import { SuperDoc } from 'superdoc';
```

ו־SuperDoc משתמש במנוע מאחוריו.

זה גם מותר:

```text
להעתיק את קובצי ה-Worker של @superdoc/docx-engine
לתוך חבילת התוסף כדי ש-SuperDoc יעבוד אופליין
```

לעומת זאת, לא כדאי לבנות את הקוד שלך כך:

```ts
import { SomeInternalEngineApi } from '@superdoc/docx-engine';
```

ולהשתמש במנוע כמוצר עצמאי או כמנוע ישיר שאינו כפוף ל־SuperDoc.

## מה אסור?

אסור לך:

* להפיץ את `@superdoc/docx-engine` כחבילה עצמאית.
* ליצור ממנו מוצר נפרד שאינו SuperDoc.
* לשנות את המנוע הקנייני.
* לבצע לו reverse engineering.
* להציג אותו כחבילה שלך.
* להשתמש בו ישירות בלי SuperDoc.
* לבנות אפליקציה סגורה שאינה מקיימת AGPL בלי לקנות רישיון מסחרי.

הם הסבירו שהאיסור על “redistribution” מתייחס להפצה עצמאית של המנוע, **לא** לצירוף קובצי המנוע הנחוצים בתוך אפליקציית SuperDoc.

## האם אוצריא כולה חייבת להפוך ל־AGPL?

התשובה שלהם אינה קובעת זאת. היא מתייחסת ל־“application or plugin using SuperDoc under AGPLv3”. במקרה שלך, המסלול הזהיר הוא:

```text
אוצריא
└── תוסף וורד נפרד
    ├── AGPLv3
    ├── קוד מקור ציבורי
    ├── SuperDoc AGPLv3
    └── DOCX Engine כתלות מורשית
```

מכיוון שהתוסף הוא חבילה נפרדת שמותקנת במערכת התוספים, יש בסיס טוב להתייחס אליו כיחידה בעלת רישיון משלה. התגובה שלהם אף מזכירה במפורש **plugin**, ולכן הם ידעו שהשאלה אינה רק על אפליקציה עצמאית. השאלה ב־Issue ביקשה מפורשות אישור להפצת המנוע כחלק מאפליקציה או תוסף, כולל Worker assets, והתשובה הייתה חיובית.

## המשמעות המעשית עבורך

אפשר להתקדם עם ה־POC וגם להפוך אותו אחר כך לתוסף מופץ:

```text
✅ SuperDoc v2
✅ @superdoc/docx-engine
✅ אריזה מקומית ואופליין
✅ הכללת Workers בתוך .otzplugin
✅ הפצה למשתמשי אוצריא
✅ שימוש ללא רישיון מסחרי
✅ התאמת UI משלך בסגנון Word
```

בתנאי ש:

```text
✅ התוסף מפורסם ומופץ בהתאם ל-AGPLv3
✅ המנוע משמש רק כחלק מ-SuperDoc
❌ לא משנים או משתמשים במנוע בפני עצמו
```

זו לא תשובה מתחמקת. זו **הרשאה מפורשת** להפיץ את SuperDoc v2 ואת נכסי המנוע הנדרשים בתוך תוסף קוד פתוח. הם גם הבהירו שרישיון מסחרי נדרש רק כאשר בונים מוצר קנייני ולא רוצים לקיים את AGPLv3.
