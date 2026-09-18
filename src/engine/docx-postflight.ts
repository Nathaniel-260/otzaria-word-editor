/**
 * התיקונים שהבייטים עוברים בדרך **החוצה**, אחרי שהמנוע כתב את המסמך ולפני
 * שהם נכתבים לקובץ. הצד הנכנס הוא `docx-preflight.ts`, ושניהם יושבים על אותו
 * קורא וכותב zip (`docx-parts.ts`).
 *
 * שלושה תיקונים:
 *   - `docx-neutral-mark.ts` — תו ניטרלי שסוגר פסקה עברית מקבל RLM אחריו, בכל
 *     חלק שיש בו פסקאות (`CONTENT_PARTS`).
 *   - `docx-cs-mirror.ts` — ריצה שכבר מצהירה `w:rtl` מקבלת את מחסנית הכתב
 *     המורכב שהמנוע אינו כותב (`bCs`, `iCs`, `szCs`, `rFonts@cs`).
 *   - `docx-numbering-ids.ts` — לכל הגדרת מספור nsid משלה, ב-`numbering.xml`.
 *
 * שלושתם **מוסיפים בלבד**: תו חסר-רוחב בתוך `<w:t>`, איבר שחסר ב-`rPr` שכבר
 * ביקשה אותו, וערך של מאפיין אחד. אף אחד מהם אינו מוחק עיצוב ואינו מזיז בייט.
 *
 * ושניים מהם נוגעים באותה עובדה משתי קצותיה: המנוע אינו כותב `w:rtl`, ואינו
 * כותב את מחסנית הכתב המורכב. למה **להוסיף** `w:rtl` נפסל, ולמה **למלא** את
 * המחסנית על ריצה שכבר מצהירה אותו הוא דווקא חסום — שתי הערות הפתיחה של
 * `docx-neutral-mark.ts` ו-`docx-cs-mirror.ts`.
 */
import { CONTENT_PARTS, rewriteDocxXmlParts, type Bytes } from './docx-parts';
import { uniqueNumberingIds } from './docx-numbering-ids';
import { markNeutralParagraphEnds } from './docx-neutral-mark';
import { mirrorComplexScript } from './docx-cs-mirror';

/** הספרה אופציונלית, בדיוק כמו ב-`CONTENT_PARTS` — זה אותו שם חלק. */
const NUMBERING_PART = /^word\/numbering\d*\.xml$/i;

/** הבייטים המתוקנים, או `null` כשאין מה לתקן. */
export function postflightDocx(bytes: Bytes): Promise<Bytes | null> {
  return rewriteDocxXmlParts(
    bytes,
    (name) => CONTENT_PARTS.test(name),
    (xml, name) => {
      let next = markNeutralParagraphEnds(xml) ?? xml;
      next = mirrorComplexScript(next) ?? next;
      if (NUMBERING_PART.test(name)) next = uniqueNumberingIds(next) ?? next;
      return next === xml ? null : next;
    },
  );
}
