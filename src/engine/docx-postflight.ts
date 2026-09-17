/**
 * התיקונים שהבייטים עוברים בדרך **החוצה**, אחרי שהמנוע כתב את המסמך ולפני
 * שהם נכתבים לקובץ. הצד הנכנס הוא `docx-preflight.ts`, ושניהם יושבים על אותו
 * קורא וכותב zip (`docx-parts.ts`).
 *
 * שני תיקונים, כל אחד בחלק שלו:
 *   - `docx-run-direction.ts` — ריצות עבריות מקבלות `w:rtl`, בכל חלק שיש בו
 *     תכונות ריצה (`CONTENT_PARTS`).
 *   - `docx-numbering-ids.ts` — לכל הגדרת מספור nsid משלה, ב-`numbering.xml`.
 */
import { CONTENT_PARTS, rewriteDocxXmlParts, type Bytes } from './docx-parts';
import { uniqueNumberingIds } from './docx-numbering-ids';
import { markRtlRuns } from './docx-run-direction';

const NUMBERING_PART = /^word\/numbering\.xml$/i;

/** הבייטים המתוקנים, או `null` כשאין מה לתקן. */
export function postflightDocx(bytes: Bytes): Promise<Bytes | null> {
  return rewriteDocxXmlParts(
    bytes,
    (name) => CONTENT_PARTS.test(name),
    (xml, name) => {
      let next = markRtlRuns(xml) ?? xml;
      if (NUMBERING_PART.test(name)) next = uniqueNumberingIds(next) ?? next;
      return next === xml ? null : next;
    },
  );
}
