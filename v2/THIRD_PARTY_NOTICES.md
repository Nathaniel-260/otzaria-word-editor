# הודעות רישוי של רכיבי צד שלישי

התוסף עצמו מופץ תחת [AGPL-3.0](../LICENSE). המסמך הזה מפרט את הרכיבים
שנארזים לתוך ה־`.otzplugin` ואת חובות הרישוי שלהם. העתקים של נוסחי הרישיון
נארזים תחת `third-party/` בתוך החבילה עצמה, לא רק במאגר.

## superdoc 2.8.0 — AGPL-3.0

- מקור: <https://github.com/superdoc/docx-editor>
- רישיון: AGPL-3.0 (`third-party/SUPERDOC-LICENSE.txt`)
- הודעה: `third-party/SUPERDOC-NOTICE.txt`

זו הסיבה שהתוסף כולו AGPL-3.0, שהמקור מפורסם, ושהמקור המפורסם זהה לבינארי
המופץ.

## @superdoc/docx-engine 0.7.0 — קנייני

מנוע ה־DOCX אינו קוד פתוח. הוא נמשך כתלות של `superdoc` ונארז לתוך החבילה
(כולל קוד ה־Workers שמוטמע ב־`assets/engine-workers.js`).

- רישיון: DOCX Engine Proprietary License Agreement
  (`third-party/DOCX-ENGINE-LICENSE.md`, גרסה 2026-07-14)
- הודעה: `third-party/DOCX-ENGINE-NOTICE.md`
- Copyright © 2026 Harbour Enterprises, Inc., d/b/a SuperDoc

סעיף 3.1(d) ברישיון אוסר redistribution. מפתחי SuperDoc אישרו במפורש
ב־[issue #3927](https://github.com/superdoc/docx-editor/issues/3927#issuecomment-5383145303)
שתוסף קוד פתוח תחת AGPLv3 רשאי לארוז ולהפיץ את המנוע, ה־Workers ונכסי ה־runtime
שלו בתוך חבילה אופליין, ללא רישיון מסחרי; האיסור מכוון להפצת המנוע כחבילה
עצמאית.

חובות מעשיות שהקוד מחויב להן:

- מייבאים `superdoc` בלבד. אין import ישיר ל־`@superdoc/docx-engine` ואין
  שימוש בנתיב פנימי שאינו export ציבורי של החבילה.
- אין לשנות, לפרק, לעשות deobfuscate או reverse engineering למנוע — כולל
  בעזרת כלי AI. אין לקרוא את קוד המנוע כדי להסיק ממנו מימוש.
- סעיף 3.1(c): אין להסיר או להסתיר הודעות רישוי, banners או markers. באנר
  הרישוי של המנוע חייב לשרוד את הבנייה; `npm run check:dist` מאמת זאת.
- אין להשתמש במנוע כדי לפתח מוצר מתחרה או מימוש חלופי.
- אין להעלות את חבילת המנוע למערכות AI של צד שלישי.

## Segoe UI 5.71 — גופן קנייני של Microsoft ⚠️

נארז תחת `fonts/` (4 קבצים, 3.3MB) ומוצהר כ־`@font-face` ב־`src/styles/fonts.ts`.
הסיבה הטכנית: מסמכי DOCX שנכתבו ב־Word קוראים לגופנים של Word, ו־`Segoe UI`
אינו קיים ב־macOS ובלינוקס — בלעדיו העימוד שהמשתמש רואה אינו העימוד שיראה
ב־Word. מדריך העיצוב של ה־SDK אומר שאין צורך לארוז גופנים, אבל מה שאוצריא
מזריקה הוא גופן הקריאה שנבחר בהגדרות בלבד, לא גופני מסמכים.

מה שנמדד בקבצים עצמם (`name` ו־`OS/2`):

- Copyright © 2025 Microsoft Corporation. All Rights Reserved.
  לוגיקת ה־OpenType לעברית: © 2003 & 2007 Ralph Hancock & John Hudson.
- Segoe הוא סימן מסחרי של Microsoft.
- נוסח הרישיון בקובץ: *"Microsoft supplied font. You may use this font to
  create, display, and print content as permitted by the license terms or terms
  of use, of the Microsoft…"* — כלומר השימוש נגזר מרישיון של מוצר Microsoft
  ואינו רישיון עצמאי.
- `fsType = 8` (Editable embedding) — מתיר **הטמעה במסמך**, ואינו רישיון להפצה
  של קובץ הגופן בתוך חבילת תוכנה.
- כיסוי: לפנים הרגילה, ל־Semibold ול־Bold יש עברית מלאה עם ניקוד (88 מתווים
  בבלוק העברי). לפנים הנטויה (`segoeuii.ttf`) **אין עברית כלל**.

⚠️ **סטטוס רישוי — פתוח.** בשונה משאר מה שבמסמך הזה, אין כאן היתר הפצה: Segoe UI
מורשה עם Windows/Office, והפצתו בתוך `.otzplugin` ציבורי אינה מכוסה. לפני פרסום
לחנות יש לבחור אחד מאלה:

1. להסיר את הגופן ולהסתמך על גופני המערכת (המסמך ייראה שונה מ־Word ב־macOS
   ולינוקס);
2. להחליף בגופן חופשי מטרית־תואם — [Selawik](https://github.com/microsoft/Selawik)
   הוא התחליף ש־Microsoft עצמה שחררה ל־Segoe UI תחת SIL OFL, אך **אין בו
   עברית**, ולכן הוא פותר רק את הטקסט הלטיני;
3. לקבל אישור מ־Microsoft.

הקוד תומך בשלוש האפשרויות: `SEGOE_UI_FACES` ב־`src/styles/fonts.ts` היא הרשימה
היחידה, ו־`FONT_FILES` ב־`scripts/check-dist.mjs` הוא השער שמאמת שההצהרה
והקבצים אינם יוצאים מסינכרון.

## רכיבי MIT שנארזים

נכנסים לחבילה דרך התלויות של superdoc ושל הממשק. הודעות הרישוי שלהם נאספות
אוטומטית לסוף `assets/app.js` בבנייה (`esbuild.legalComments: 'eof'`):

| רכיב | גרסה שנמדדה | רישיון |
|---|---|---|
| vue (ו-`@vue/*`) | 3.5.41 | MIT |
| pinia | 3.0.4 | MIT |

הרשימה נמדדת מהפלט, לא מהצהרה: `grep '@license' v2/dist/assets/app.js` מציג את
מה שנארז בפועל. אם תיווסף תלות עם רישיון שאינו MIT/BSD/ISC — יש לתעד אותה כאן
לפני פרסום.

## קוד שהועתק ממאגרים אחרים

אין. הממשק נכתב מאפס. מקורות שהיוו השראה חזותית בלבד מתועדים ב־
[../docs/word-plugin-implementation-plan.md](../docs/word-plugin-implementation-plan.md) §3.3.
אם בעתיד יועתק קוד ממשי ממאגר AGPL/MIT — יש להוסיף אותו כאן עם קישור, קומיט,
רישיון ורשימת הקבצים המושפעים.
