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
