/**
 * ראשי תיבות: מיפוי `"א"א" → ["אי אפשר", "אמר אברהם", ...]`. המקור —
 * `Acronyms.json` הרשמי של אוצריא (13,105 ערכים במקור; 13,067 בנכס, אחרי
 * איחוד מפתחות מנוקדים — ר' scripts/acronyms-asset.ts).
 *
 * בניגוד ל-book-completion/static-completion, כאן אין "השלמת המשך" — הראשי
 * תיבות כבר הוקלד **במלואו** (עם הגרשיים), וההשלמה היא הפירוש שלו. לכן
 * ההתאמה היא שווה-ערך מדויק על המילה האחרונה שהוקלדה, לא prefix.
 *
 * פירוש יחיד לכל ר"ת בשלב זה: הראשון ברשימה (סדר המקור, לא מנוין מחדש).
 * מחזור בין פירושים נוספים — לא בסקופ הנוכחי.
 *
 * ## הנכס הוא אובייקט, לא מחרוזת
 *
 * `scripts/acronyms-asset.ts` מציב ב-`window` **ליטרל אובייקט**, ולכן הפענוח
 * כאן אינו `JSON.parse` אלא שימוש ישיר. הגרסה הקודמת ציפתה למחרוזת, קיבלה
 * אובייקט, והחזירה `null` בכל טעינה — כלומר ההשלמה כולה לא עבדה.
 */
import { normalizeWord } from './spellcheck';

/** מה שהנכס מציב ב-`window`. */
export type PackedAcronyms = Readonly<Record<string, readonly string[]>>;

/**
 * צורת ר"ת: אותיות עבריות, גרשיים אחד בתוך המילה, ואותיות אחריו. `acronyms-asset`
 * מאמת שכל מפתח במילון עונה עליה, ולכן מותר לסמוך עליה כשער לפני הטעינה.
 */
const ACRONYM_SHAPE = /^[א-ת]+"[א-ת]+$/;

export interface AcronymDictionary {
  /** הפירוש הראשון של `acronym`, או `null` אם אינו ר"ת מוכר. */
  lookup(acronym: string): string | null;
}

/**
 * האם המילה נראית ר"ת — מבחן זול שאינו נוגע במילון.
 *
 * זה השער שמונע הזרקת נכס של כמעט מגה-בייט אחרי כל מילה רגילה שההשלמה מהספר
 * לא מצאה לה המשך.
 */
export function looksLikeAcronym(word: string): boolean {
  return ACRONYM_SHAPE.test(normalizeWord(word));
}

export function createAcronymDictionary(packed: PackedAcronyms): AcronymDictionary {
  return {
    lookup(acronym: string): string | null {
      // מקלדת עברית מייצרת גרשיים טיפוגרפיים (U+05F4) והמילון נכתב בישרים —
      // אותו נרמול בדיוק שבדיקת האיות עושה, ומאותה סיבה.
      const expansions = packed[normalizeWord(acronym)];
      return Array.isArray(expansions) && expansions.length > 0 ? (expansions[0] ?? null) : null;
    },
  };
}
