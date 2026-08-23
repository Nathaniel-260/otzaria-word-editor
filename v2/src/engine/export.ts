/**
 * ייצוא המסמך הפעיל ל-DOCX.
 *
 * `triggerDownload: false` — התוסף מקבל את ה-Blob ומחליט מה לעשות בו.
 * ההורדה האוטומטית של SuperDoc אינה מסלול שמירה אמין, ובעיקר אינה בסיס
 * ל-autosave.
 */
import type { SuperDoc } from 'superdoc';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function exportDocx(superdoc: SuperDoc): Promise<Blob> {
  const blob = await superdoc.export({ exportType: ['docx'], triggerDownload: false });
  if (!(blob instanceof Blob)) throw new Error('הייצוא לא החזיר קובץ');
  return blob;
}

/** מוסיף סיומת docx אם חסרה, ומנקה תווים שאינם חוקיים בשם קובץ. */
export function docxFileName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'מסמך';
  return /\.docx$/i.test(clean) ? clean : `${clean}.docx`;
}
