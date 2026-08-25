# פערים שנמדדו במנוע — ומה לא נשלח בגללם

המסמך הזה קיים כדי שאיש לא יחקור שוב את מה שכבר נמדד. כל שורה כאן היא
תוצאה של הרצה ב-Chrome אמיתי מול ה-`dist` הארוז, ולא קריאה של טיפוסים.

**הכלל שנגזר מכל אלה:** `available: true` בקטלוג היכולות ו-`success: true`
בקבלה **אינם הוכחה שהפעולה עובדת**. פעולה שכותבת קוד שדה של Word חייבת
אימות מול תיעוד Word, ורצוי גם מול ה-docx המיוצא.

המתכון למדידה נמצא בסוף `docs/spike.md` ובקוד: `scripts/cdp.mjs`.

## פעולות שמדווחות הצלחה וכותבות מסמך שבור

### `crossRefs.insert` — הפניה מקושרת
נמדד פעמיים, בשני סבבים בלתי תלויים, על 9 סוגי תצוגה ו-6 סוגי יעד. קוד
השדה שנכתב:

    REF SDXREF kind=bookmark;value=%7B%22kind%22%3A%22bookmark%22...%7D;display=pageNumber

האסימון שאחרי `REF` הוא `SDXREF` ולא שם הסימנייה, ולכן Word יציג „שגיאה!
מקור ההפניה לא נמצא”. גם המנוע עצמו אינו פותר אותו: `resolvedText` נשאר
ריק אחרי `rebuild` בכל הצירופים. הפניה לסימנייה שאינה קיימת מחזירה
`success: true`.

**לא נשלח.** מה שכן נשלח: `crossRefs.list` תופס שדות `REF` שנוצרו ב-Word,
ו-`rebuild` עליהם מחשב באמת.

### `authorities.entries.insert` — סימון ציטוט לטבלת מקורות
ה-`instruction` שנכתב:

    TA "בראשית א, א" \s "בר׳ א א" \c 1

ל-`TA` של Word **אין ארגומנט כללי**; התחביר הוא `{ TA [switches] }`,
והציטוט הארוך מגיע רק מ-`\l`. כלומר Word יקרא שדה בלי ציטוט ארוך, והערך
יופיע ריק בטבלה. אומת בשלוש שכבות: `entries.get`, ה-docx המיוצא עצמו
(`<w:fldSimple w:instr="TA &quot;בראשית א, א&quot; ...">`), והבנאי במנוע —
תבנית קשיחה שאין בה מסלול שפולט `\l`.

בנוסף אין שום בריחה של גרשיים: `longCitation` שמכיל `"` נכתב כמות שהוא
ומייצר גרשיים מקוננים, עם `success: true`.

### `index.entries.insert` — השדה `subEntry`
`{text:'אבות', subEntry:'יצחק'}` כותב `XE "אבות" \s "יצחק"`, ו-`\s` אינו
מתג של `XE` ב-Word (המתגים: `\b \f \i \r \t \y`).

**נעקף:** הצורה הקנונית `XE "אבות:יצחק"` עובדת, והמנוע מפרק אותה נכון
בחזרה. המודול שולח תמיד אותה ולעולם לא את `subEntry`.

### `bibliography.configure` — סגנון הביבליוגרפיה
הקריאה עובדת בצד אחד ושבורה בצד שני, ושניהם נמדדו באותו קובץ מיוצא.
הסגנון **כן** מגיע למקום הנכון: `configure({style:'Chicago'})` כתב
`<b:Sources SelectedStyle="/CHICAGO.XSL" StyleName="Chicago" Version="16">`,
ואחד עשר השמות הקנוניים ממופים נכון. אבל אותה קריאה כותבת גם ל-instruction:

    BIBLIOGRAPHY \sdStyle "Chicago"

`\sdStyle` אינו מתג של Word — המתגים המתועדים לשדה `BIBLIOGRAPHY` הם `\l`
ו-`\f` — ואין דרך לבקש את הראשון בלי השני.

גם המסלול השני כותב אותו: `bibliography.insert({style:'Chicago'})` מייצר
את אותו `BIBLIOGRAPHY \sdStyle "Chicago"` (נמדד). כלומר אין קריאה שמכניסה
ביבליוגרפיה עם סגנון ובלי המתג הלא-מתועד.

**לא נשלח פקד סגנון.** בלעדיו כל קוד שדה שנכתב הוא קנוני, והסגנון נשאר
ברירת המחדל שגם Word מתחיל בה (APA).

### `citations.insert` עם יותר ממקור אחד
שני מקורות כותבים `CITATION src-a;src-b` (נמדד גם ב-docx). תחביר ריבוי
המקורות של Word הוא המתג `\m`: `{ CITATION Tag1 \m Tag2 }`. אסימון אחד
שמחבר שני תגים בנקודה ופסיק אינו tag קיים.

**נעקף:** המודול שולח תמיד מקור אחד, וגם הממשק מאפשר רק אחד.

### `citations.sources.remove` על מקור מצוטט
מחזיר `success: true`, מוחק את המקור, ומשאיר את שדה ה-`CITATION` מצביע
לתג שכבר אינו קיים — כלומר בדיוק המסמך השבור של `crossRefs`, רק שכאן
אנחנו אלה שיוצרים אותו.

**נעקף:** `removeCitationSource` סופר את הציטוטים דרך `citations.list`
ומסרב, ומדווח כמה מהם מחזיקים במקור.

## פעולות שבולעות קלט בשקט

בכל אלה המנוע מחזיר `success: true` על ערך שאינו בחוזה, אינו חוקי, או
אינו נכתב כלל. **כל ולידציה חייבת לשבת אצלנו, לפני הקריאה.**

| פעולה | מה נבלע |
|---|---|
| `toc.configure` | `tabLeader` (גם `'zigzag'`), `rightAlignPageNumbers`, `includePageNumbers` |
| `index.configure` | `columns` של 0 / 1- / 2.5, שדה שאינו בחוזה, `letterRange:{from:'zigzag'}` → `\p "zigzag-9"` |
| `authorities.configure` | `tabLeader:'zigzag'` → `\l "zigzag"`, שדה שאינו בחוזה |
| `authorities.entries.insert` | `category` של `99`, `0`, `2.5`, `'zigzag'` ואפילו `'פסוקים'` — כולם נכתבים גולמית ל-`\c` |
| `index.insert` | `\c 99` — מעל התקרה של Word (4) |
| `toc.markEntry` | `\l 12` — מעל התקרה של Word (9) |
| `fields.insert` | `DATE \* HEBREW` — מתג לוח השנה נבלע לגמרי |
| `citations.sources.insert` | `fields: {}`, `title: ''`, `title: '   '`, `type: 'zigzag'`, ושדה שאינו בחוזה — כולם `success: true` ונכתבים לקובץ |
| `citations.bibliography.configure` | `style: 'zigzag'` → `SelectedStyle="/zigzag.XSL"`, גיליון סגנון שאינו קיים |

## מתג שכן עובד

`fields.insert` עם `DATE \@ "dd/MM/yyyy"` — מתג תמונת-הפורמט **מפורש**
כהלכה, ומתקן גם היסט של יום שיש ב-`DATE` העירום (הוא ISO ב-UTC).

## מה שכן נכתב נכון — ציטוטים

זו הקבוצה הראשונה מאז הסימניות שעברה גם את שכבת ה-docx בלי הסתייגות, ולכן
היא רשומה כאן במפורש: לא כל מה שהמנוע כותב שבור.

- המקורות יושבים ב-`customXml/item1.xml` כ-`<b:Sources>` בסכימת OOXML,
  עם `itemProps1.xml` שמצהיר על ה-`schemaRef`, רלציה מ-`document.xml.rels`
  ו-`Override` ב-`[Content_Types].xml`. זה בדיוק המקום של „נהל מקורות”
  ב-Word.
- `<w:fldSimple w:instr="CITATION src-…">` וה-`<b:Tag>` שלצידו **זהים**.
  כלומר Word יפתור את הציטוט — ההפך מ-`REF SDXREF` ומ-`TA` בלי `\l`.
- העברית עוברת שלמה בכל השדות: `שו״ת הרמב״ם`, `בן מימון`, `תתקצ״ה`,
  `מוסד הרב קוק`, `ירושלים`.
- הביבליוגרפיה נבנית **מלאה כבר ביצירה**, ו-`rebuild` באמת אוסף מקור
  שנוסף אחריה (`sourceCount` 2 → 3) וגם עריכה של מקור קיים.
- `citations.insert` על `sourceId` שאינו קיים מוחזר `TARGET_NOT_FOUND`,
  ו-`bibliography.rebuild` על מזהה של פסקה רגילה גם הוא. הכתובות מאומתות
  ואינן נבלעות.
- `bibliography.remove` מפיל את הבלוק כולו ואינו משאיר פסקה — ההפך מתוכן
  העניינים.

## מלכודות מבניות

- **כתובות אינן בהכרח ייחודיות.** שתי טבלאות תוכן עניינים עם אותו
  `instruction` מקבלות את **אותו** `nodeId`, גם ב-`toc.list` וגם
  ב-`blocks.list` — ה-hash נגזר מה-`instruction`. `toc.remove` על הפריט
  השני מוחק את הראשון. במפתח ובטבלת מקורות אין כפילות כזאת.
- **תוכן עניינים אינו בלוק אחד.** הראשון `tableOfContents` והשאר פסקאות
  בסגנון `TOC1…TOC9`; `remove` מוחק את הראשון בלבד ומשאיר את השאר על
  המסך עם `success: true`. במפתח ובטבלת מקורות ההסרה נקייה.
- **אין מיון ואין מספרי עמודים במפתח.** הערכים מופיעים בסדר הסימון, בלי
  כותרות אותיות, למרות `\h "A"`. Word ממיין וממספר בפתיחה.
- **אין דרך למצוא ביבליוגרפיה דרך `blocks`.** ל-`citations.bibliography`
  אין `list`, ו-`blocks.list` מציג את הבלוק כ-`nodeType: 'paragraph'` רגילה.
  הדרך היחידה היא `fields.list`, שמחזיר `fieldType: 'BIBLIOGRAPHY'` ואת
  `address.blockId` — וכתובת שנבנתה ממנו מניעה `get`/`rebuild`/`remove`.
  זה גם מה שמאפשר לעבוד על ביבליוגרפיה שנוצרה ב-Word.
- **`citations.insert` דורש יעד מכווץ.** טווח חוזר `INVALID_TARGET`
  („requires a collapsed text target”), וסמן **בתוך** שדה קיים חוזר
  `CAPABILITY_UNAVAILABLE` („text-range-in-field”).
- **`citations.sources.update` הוא `Partial` אמיתי.** נמדד בשני הכיוונים:
  patch **בלי** `year` השאיר את `תש״ף` שבמסמך כמו שהיה, ו-patch עם
  `year: ''` מחק אותו. כלומר השמטה משמרת ומחרוזת ריקה מוחקת — וטופס עריכה
  שמשמיט שדה שהמשתמש רוקן מייצר „הצלחה מדומה”: `{ok:true}` בלי הודעה,
  והערך חוזר ברענון הבא. מי ששולח patch חייב להחליט לכל שדה מה משמעות
  הריקון אצלו.
- **תצוגת הציטוט אינה מתרעננת אחרי עריכת המקור.** כותרת שהשתנתה מתעדכנת
  בביבליוגרפיה אחרי `rebuild`, אבל הטקסט שבתוך שדה ה-`CITATION` נשאר
  הישן עד `citations.update` על אותו ציטוט. Word מחשב מחדש בפתיחה.
- **מחבר בלי `last` מפיל את המנוע** ב-`TypeError` גולמי ולא בקבלה:
  „Cannot read properties of undefined (reading 'trim')”.
- **אין API להזזת הסמן בין stories.** `doc.selection` הוא קריאה בלבד, ולכן
  אי אפשר להעביר את הסמן אל גוף הכותרת העליונה או אל הכותרת התחתונה.
- **`selection.current` אינו מדווח מקטע**, ואין מיפוי ציבורי סמן→מקטע.
  לכן פעולות מקטע חלות על כל המקטעים.
- **`activeEditor.view` הוא `null` ב-headless** — אי אפשר למדוד שם שום דבר
  שדורש מיקוד בעורך.

## פעולות שהמנוע מסמן כלא-זמינות

`create.image`, `images.delete`, `images.replaceSource`, `hyperlinks.patch`
— `OPERATION_UNAVAILABLE`. אין לבנות עליהן פקד פעיל.
