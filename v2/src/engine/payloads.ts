/**
 * חוזה ה-payload של פקודות המנוע.
 *
 * למה מודול נפרד ולא ליטרל באתר הקריאה: ה-payload שפקד שולח הוא **חוזה** מול
 * ולידטור בתוך superdoc, לא ארגומנט שמועבר כמו שהוא. הוולידטור נכשל **סגור** —
 * `buildInlineFormatInput` מחזיר `null` על ערך שאינו מוכר, וה-controller מחזיר
 * `false` בלי לגעת במסמך. כלומר `{ fontFamily: 'X' }` נראה סביר לחלוטין בקוד
 * ובבדיקה, ולא מחיל כלום.
 *
 * בדיוק זה קרה: `{ fontFamily }`, `{ fontSize }`, `{ color }` ו-`{ zoom }` —
 * ארבעה payloads שנבנו לפי שם השדה של הפקודה, ולא לפי מה שהמנוע מחלץ. הבדיקה
 * שאישרה אותם השוותה מול mock שרשם ארגומנטים, ולכן לא יכלה לתפוס את זה.
 * הפונקציות כאן טהורות דווקא כדי שבדיקת החוזה
 * (tests/contract/command-payloads.test.ts) תריץ **אותן** מול הוולידטורים
 * האמיתיים של החבילה, ולא מול מחרוזת מועתקת.
 *
 * מה שהמנוע מחלץ, כפי שנמדד ב-superdoc@2.8.0:
 *
 * | פקודה                     | מה שמגיע לוולידטור         | מה שהוא מקבל          |
 * |---------------------------|----------------------------|------------------------|
 * | font-family               | `buildInlineFormatInput`   | סקלר או `{ value }`    |
 * | font-size                 | + `normalizeFontSizePayload`| מספר, `'16pt'`, `{value}`|
 * | text-color/highlight-color| + `normalizeColorPayload`  | `'#RRGGBB'` / `null`   |
 * | zoom                      | `normalizeZoomPayload`     | **מספר** אחוזים בלבד   |
 * | text-align                | `unwrapScalar([alignment])` | גם `{ alignment }`    |
 * | line-height               | `unwrapScalar([lineHeight])`| גם `{ lineHeight }`   |
 * | linked-style              | `unwrapScalar([style])`     | גם `{ style }`        |
 *
 * שתי השורות האחרונות הן הסיבה שהמפתחות `alignment`/`lineHeight`/`style`
 * נשארים כפי שהם: `unwrapScalar` מכיר אותם בשמם. `fontFamily`, `fontSize`,
 * `color` ו-`zoom` אינם ברשימה של אף unwrap — ולכן הם היו כשל שקט.
 */

/** יישור פסקה, בערכים שהמנוע מנרמל אליהם. */
export type ParagraphAlignment = 'left' | 'center' | 'right' | 'justify';

/**
 * סולם הגדלים של Word. `growFontSize` נע עליו ולא ב-+2 עיוור, כי זה מה שהמשתמש
 * מכיר: 12 → 14 → 16 → 18 → 20 → 24, ולא 12 → 14 → 16 → 18 → 20 → 22.
 */
export const WORD_FONT_SIZES: readonly number[] = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72,
];

/**
 * הגודל שמסמך חדש נפתח בו. משמש כמקור אחרון לבורר הגודל וללחצני הגדל/הקטן,
 * כשהמנוע לא מדווח גודל בכלל (בחירה מעורבת, או מסמך שעוד לא נטען).
 */
export const DEFAULT_FONT_SIZE_PT = 12;

/** מרווח השורות שמסמך חדש נפתח בו. */
export const DEFAULT_LINE_HEIGHT = 1.5;

/**
 * `w:spacing/@w:line` נמדד ב-240ths של שורה: 240 = שורה בודדת, 360 = 1.5.
 * המנוע מנרמל מכפיל ל-240ths בעצמו; הקבוע כאן משמש לכיוון ההפוך, מהערך
 * שהמנוע מדווח אל המכפיל שהבורר מציג.
 */
export const TWENTIETHS_PER_LINE = 240;

/* ------------------------------------------------------------------ */
/* פענוח ערכים — משמש גם לקלט מהבורר וגם למה שהמנוע מדווח               */
/* ------------------------------------------------------------------ */

/**
 * שם גופן מערך שהמנוע דיווח או מבחירה בבורר. `null` = אין ערך שאפשר להחיל
 * (בחירה מעורבת מדווחת `undefined`, ומחרוזת ריקה נדחית על ידי המנוע).
 */
export function parseFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * גודל גופן בנקודות. מקבלת גם `'16pt'` (הצורה שה-v1 שלח וש-`fontSize` במסמך
 * עשוי לחזור בה) וגם `16` או `'16'` (הצורה שהמנוע מדווח, מ-`fontSizePt`).
 * חצאי נקודות נשמרים — המנוע מדווח 20.5 על טקסט כזה, ועיגול היה משנה אותו.
 */
export function parseFontSizePt(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.replace(/\s*pt$/i, '').trim()) : NaN;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * צבע ב-`#RRGGBB`. הצורה בלי `#` מתקבלת גם היא, כי המנוע מדווח את הצבע
 * שבמסמך והמסמך לא בהכרח כותב אותו עם `#`.
 */
export function parseColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return null;
}

/**
 * מכפיל מרווח שורות. המנוע מנרמל מכפיל ל-240ths, ולכן ערך גדול מ-10 הוא
 * 240ths שצריך לחלק — וערך קטן ממנו הוא כבר מכפיל. אותו גבול שהמנוע עצמו
 * משתמש בו (`normalizeLineHeightPayload`), כדי ששתי ההמרות יסכימו.
 *
 * הערה: ב-superdoc@2.8.0 `line-height` הוא פקודת פסקה **בלי** `value` במצב
 * הפקד — נמדד ש-`routedCommandValue` מחזיר `undefined` עבורה. כלומר הכיוון
 * הזה אינו בשימוש כרגע, והוא כאן כדי שברגע שהמנוע יתחיל לדווח ערך, הבורר
 * ישקף אותו בלי שינוי נוסף.
 */
export function parseLineHeight(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.trim()) : NaN;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw <= 10) return raw;
  return Math.round((raw / TWENTIETHS_PER_LINE) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* בניית payload                                                       */
/* ------------------------------------------------------------------ */

/**
 * `font-family`. סקלר ולא `{ fontFamily }`: ה-spec הוא `value-string`,
 * ו-`buildInlineFormatInput` מחלץ `payload.value` או את ה-payload עצמו —
 * מפתח בשם השדה נשאר אובייקט, ואובייקט אינו string.
 */
export function fontFamilyPayload(family: string): string | null {
  return parseFontFamily(family);
}

/**
 * `font-size`. מספר ולא `{ fontSize }`: ה-spec הוא `value-number`, והחילוץ
 * מגיע ל-`Number({ fontSize: '16pt' })` — כלומר `NaN`, כלומר כשל סגור.
 */
export function fontSizePayload(size: number | string): number | null {
  return parseFontSizePt(size);
}

/**
 * `text-color` / `highlight-color`. `{ value }` בכוונה ולא סקלר: זה המסלול
 * היחיד שמאפשר גם ניקוי — המנוע מתעד `if (value === null) return { target,
 * value: null }` כמסלול הניקוי, ומחרוזת ריקה נדחית שם במפורש.
 */
export function colorPayload(hex: string | null): { value: string | null } {
  if (hex === null) return { value: null };
  return { value: parseColor(hex) };
}

/**
 * `zoom`. אחוזים כמספר: `instanceCommandPayloadIsValid` דורש
 * `typeof payload === 'number'` אחרי הנרמול, ולכן `{ zoom: 1 }` נופל שם עוד
 * לפני `SuperDoc.setZoom`.
 *
 * מתחת ל-5% מוחזרת הצורה `'3%'`: `normalizeZoomPayload` מפרש מספר בטווח
 * `0..5` כשבר מדור v1 ומכפיל אותו ב-100, ולכן `3` היה הופך ל-300%. עם `%`
 * מפורש הוא מכבד את הערך כאחוזים.
 */
export function zoomPayload(percent: number): number | string | null {
  if (!Number.isFinite(percent) || percent <= 0) return null;
  return percent > 5 ? percent : `${percent}%`;
}

/**
 * `line-height`. המפתח `lineHeight` נשאר — `unwrapScalar` מכיר אותו בשמו,
 * וזו פקודה שעבדה. הפונקציה כאן כדי שכל בניית payload תהיה במקום אחד ותהיה
 * נבדקת מול אותו ולידטור.
 */
export function lineHeightPayload(multiplier: number): { lineHeight: number } | null {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  return { lineHeight: multiplier };
}

/** `text-align`. המפתח `alignment` מוכר ל-`unwrapScalar`. */
export function alignmentPayload(alignment: ParagraphAlignment): { alignment: ParagraphAlignment } {
  return { alignment };
}

/** `linked-style`. המפתח `style` מוכר ל-`unwrapScalar`. */
export function stylePayload(styleId: string): { style: string } | null {
  const trimmed = styleId.trim();
  return trimmed === '' ? null : { style: trimmed };
}

/* ------------------------------------------------------------------ */
/* סולם הגדלים                                                         */
/* ------------------------------------------------------------------ */

/**
 * הגודל הבא בסולם של Word. גודל שאינו בסולם (למשל 20.5, שהמנוע מדווח על טקסט
 * כזה) עולה לערך הבא **מעליו** ולא ב-+2, וגודל בקצה נשאר בו: 72 הוא הגדול
 * ביותר בבורר, והחזרת 76 הייתה מציגה בבורר ערך שאינו בו.
 */
export function grownFontSize(current: number): number {
  const next = WORD_FONT_SIZES.find((size) => size > current);
  return next ?? WORD_FONT_SIZES[WORD_FONT_SIZES.length - 1];
}

/** הגודל הקודם בסולם. 8 הוא הקטן ביותר בבורר ולכן הוא הרצפה. */
export function shrunkFontSize(current: number): number {
  const smaller = WORD_FONT_SIZES.filter((size) => size < current);
  return smaller.length > 0 ? smaller[smaller.length - 1] : WORD_FONT_SIZES[0];
}
