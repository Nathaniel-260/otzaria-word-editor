/**
 * התיקונים שהבייטים עוברים בדרך **החוצה**, אחרי שהמנוע כתב את המסמך ולפני
 * שהם נכתבים לקובץ. הצד הנכנס הוא `docx-preflight.ts`, ושניהם יושבים על אותו
 * קורא וכותב zip (`docx-parts.ts`).
 *
 * שני תיקונים, כל אחד בחלק שלו:
 *   - `docx-neutral-mark.ts` — תו ניטרלי שסוגר פסקה עברית מקבל RLM אחריו, בכל
 *     חלק שיש בו פסקאות (`CONTENT_PARTS`).
 *   - `docx-numbering-ids.ts` — לכל הגדרת מספור nsid משלה, ב-`numbering.xml`.
 *
 * שניהם **מוסיפים בלבד**: הראשון תו חסר-רוחב בתוך `<w:t>`, והשני ערך של מאפיין
 * אחד. אף אחד מהם אינו נוגע בתכונת עיצוב — ההנמקה, עם המדידה שפסלה את הגישה
 * הקודמת, בהערת הפתיחה של `docx-neutral-mark.ts`.
 */
import { CONTENT_PARTS, rewriteDocxXmlParts, type Bytes } from './docx-parts';
import { uniqueNumberingIds } from './docx-numbering-ids';
import { markNeutralParagraphEnds } from './docx-neutral-mark';

/** הספרה אופציונלית, בדיוק כמו ב-`CONTENT_PARTS` — זה אותו שם חלק. */
const NUMBERING_PART = /^word\/numbering\d*\.xml$/i;

/** הבייטים המתוקנים, או `null` כשאין מה לתקן. */
export function postflightDocx(bytes: Bytes): Promise<Bytes | null> {
  return rewriteDocxXmlParts(
    bytes,
    (name) => CONTENT_PARTS.test(name),
    (xml, name) => {
      let next = markNeutralParagraphEnds(xml) ?? xml;
      if (NUMBERING_PART.test(name)) next = uniqueNumberingIds(next) ?? next;
      return next === xml ? null : next;
    },
  );
}
