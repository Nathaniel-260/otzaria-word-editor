/**
 * אפשרויות הגופן שהבוררים מציגים.
 *
 * למה לא רשימה קשיחה בקומפוננטה, כפי שהיה: רשימה קשיחה אינה יודעת מה יש
 * **במסמך**. ב-superdoc@2.8.0 `ui.fonts` מרכיב את האפשרויות מהגופנים שהמסמך
 * הפתוח משתמש בהם ומדביק עליהם ברירות מחדל (`composeFontFamilyOptions`), ולכן
 * מסמך שנכתב ב-Aptos או ב-Cambria מציג אותם בראש הבורר — בדיוק כמו Word.
 * רשימה קשיחה הציגה עשרה שמות שאין להם קשר למסמך, ובחירה בגופן שהמסמך משתמש
 * בו הייתה אפשרית רק אם ניחשנו אותו מראש.
 *
 * מה שהמנוע **אינו** יכול לדעת: הגופן שנארז עם התוסף (`styles/fonts.ts`)
 * וגופני העברית שאוצריא מזריקה לסביבה. הם מותקנים אחרי שהמנוע בנה את הרשימה
 * שלו, ולכן הם נשמרים כאן ותמיד עומדים בראש — משתמש שפותח מסמך עברי צריך
 * למצוא את Frank Ruhl בשורה הראשונה, לא אחרי Verdana.
 *
 * הצורה של `ui` מוגדרת כאן מבנית ולא מיובאת: הבדיקה מעבירה כפיל, ומימוש של
 * `FontsHandle` המלא בכפיל היה מחייב גם את שלושת מסלולי ה-subscription שאין
 * להם קשר לאפשרויות.
 */
import type { FontFamilyOption, FontSizeOption } from 'superdoc/ui';
import { WORD_FONT_SIZES } from './payloads';

/** מה שהבוררים ב-Ribbon מציגים. */
export interface FontOptions {
  families: readonly FontFamilyOption[];
  sizes: readonly FontSizeOption[];
}

/** ה-slice שהמנוע מדווח. שני השדות אופציונליים — נקרא בהגנה. */
export interface FontsSliceLike {
  options?: readonly FontFamilyOption[];
  sizeOptions?: readonly FontSizeOption[];
}

/** מה שנצרך מ-`superdoc.ui`. הכול אופציונלי: גרסה בלי `fonts` נופלת בחן. */
export interface FontOptionsSource {
  fonts?: {
    getFamilyOptions?: () => readonly FontFamilyOption[];
    getSizeOptions?: () => readonly FontSizeOption[];
    observe?: (listener: (slice: FontsSliceLike) => void) => () => void;
  };
}

/**
 * הגופנים שלנו. Assistant נארז עם התוסף ולכן זמין בכל פלטפורמה; השאר מוזרקים
 * על ידי אוצריא. `previewFamily` הוא מה שמאפשר לבורר להציג כל שם בגופן שלו,
 * כמו ב-Word.
 */
export const OTZARIA_FONT_FAMILIES: readonly FontFamilyOption[] = [
  { value: 'Assistant', label: 'Assistant', previewFamily: "'Assistant', sans-serif" },
  { value: 'FrankRuhlCLM', label: 'Frank Ruhl', previewFamily: "'FrankRuhlCLM', serif" },
  { value: 'TaameyDavidCLM', label: 'David', previewFamily: "'TaameyDavidCLM', serif" },
  { value: 'Rubik', label: 'Rubik', previewFamily: "'Rubik', sans-serif" },
  { value: 'Shofar', label: 'Shofar', previewFamily: "'Shofar', serif" },
  { value: 'NotoRashiHebrew', label: 'Rashi', previewFamily: "'NotoRashiHebrew', serif" },
];

/**
 * גופני הלטינית שהיו ברשימה הקשיחה. נשארים כזנב אחרי אפשרויות המנוע: Aptos
 * ו-Segoe UI אינם ברירות המחדל של המנוע, ובלעדיהם הגופן של Word 365 ושל
 * Windows היו נעלמים מהבורר.
 */
export const LATIN_FONT_FAMILIES: readonly FontFamilyOption[] = [
  { value: 'Aptos', label: 'Aptos', previewFamily: "'Aptos', sans-serif" },
  { value: 'Segoe UI', label: 'Segoe UI', previewFamily: "'Segoe UI', sans-serif" },
  { value: 'Times New Roman', label: 'Times New Roman', previewFamily: "'Times New Roman', serif" },
  { value: 'Arial', label: 'Arial', previewFamily: 'Arial, sans-serif' },
];

/** סולם הגדלים של Word, בצורת אפשרויות בורר. */
export const FALLBACK_FONT_SIZES: readonly FontSizeOption[] = WORD_FONT_SIZES.map((size) => ({
  value: String(size),
  label: String(size),
}));

/** שם הגופן שמזוהה עם ערך — ההשוואה חסרת רגישות לאותיות, כמו במנוע. */
function familyKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * מיזוג בסדר קבוע: שלנו, של המנוע, ואז זנב הלטינית. כפילויות נופלות לפי הערך
 * ולא לפי התווית, כי המנוע והרשימה שלנו נותנים לאותו גופן תוויות שונות
 * (`TaameyDavidCLM` מול „David”), ורק הערך הוא מה שנשלח לפקודה.
 */
export function mergeFontFamilies(
  engineOptions: readonly FontFamilyOption[] | undefined,
): readonly FontFamilyOption[] {
  const merged: FontFamilyOption[] = [];
  const seen = new Set<string>();

  for (const option of [...OTZARIA_FONT_FAMILIES, ...(engineOptions ?? []), ...LATIN_FONT_FAMILIES]) {
    const value = typeof option?.value === 'string' ? option.value.trim() : '';
    if (value === '') continue;
    const key = familyKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      value,
      label: typeof option.label === 'string' && option.label.trim() !== '' ? option.label : value,
      previewFamily: option.previewFamily ?? value,
    });
  }

  return merged;
}

/**
 * גדלים: איחוד של מה שהמנוע מציע עם סולם Word, ממוין כמספרים. מיון לפי
 * מחרוזת היה מציב את 8 אחרי 72.
 */
export function mergeFontSizes(
  engineOptions: readonly FontSizeOption[] | undefined,
): readonly FontSizeOption[] {
  const byValue = new Map<number, FontSizeOption>();

  for (const option of [...(engineOptions ?? []), ...FALLBACK_FONT_SIZES]) {
    const parsed = Number.parseFloat(String(option?.value ?? ''));
    if (!Number.isFinite(parsed) || parsed <= 0 || byValue.has(parsed)) continue;
    byValue.set(parsed, {
      value: String(option.value),
      label: typeof option.label === 'string' && option.label.trim() !== '' ? option.label : String(option.value),
    });
  }

  return [...byValue.entries()].sort((a, b) => a[0] - b[0]).map(([, option]) => option);
}

/** מה שמוצג לפני שיש מסמך פתוח, וגם אם `ui.fonts` אינו זמין בכלל. */
export function fallbackFontOptions(): FontOptions {
  return { families: mergeFontFamilies(undefined), sizes: mergeFontSizes(undefined) };
}

/** קריאה בהגנה: גרסת מנוע בלי `fonts` מחזירה את הרשימה שלנו, לא חריגה. */
function safeRead<T>(read: (() => T) | undefined): T | undefined {
  if (typeof read !== 'function') return undefined;
  try {
    return read();
  } catch (error) {
    console.warn('[otzaria-word] קריאת אפשרויות הגופן מהמנוע נכשלה', error);
    return undefined;
  }
}

/** האפשרויות ברגע זה, ממוזגות. */
export function readFontOptions(ui: FontOptionsSource | null | undefined): FontOptions {
  const fonts = ui?.fonts;
  return {
    families: mergeFontFamilies(safeRead(fonts?.getFamilyOptions?.bind(fonts))),
    sizes: mergeFontSizes(safeRead(fonts?.getSizeOptions?.bind(fonts))),
  };
}

/**
 * מאזינה לאפשרויות. `observe` של המנוע יורה מיד עם ה-snapshot הנוכחי ואז על
 * כל שינוי, ולכן אין צורך בקריאה נפרדת לפניה. בלי האזנה הבורר היה קופא על
 * האפשרויות של הרגע שבו המסמך נפתח — והמנוע פותר את גופני המסמך אחרי זה.
 *
 * מחזירה disposer גם כשאין `observe`, כדי שאתר הקריאה לא יצטרך להבחין.
 */
export function observeFontOptions(
  ui: FontOptionsSource | null | undefined,
  listener: (options: FontOptions) => void,
): () => void {
  const fonts = ui?.fonts;
  const observe = fonts?.observe;

  if (typeof observe !== 'function') {
    listener(readFontOptions(ui));
    return () => {};
  }

  try {
    return observe.call(fonts, (slice) => {
      listener({
        families: mergeFontFamilies(slice?.options),
        sizes: mergeFontSizes(slice?.sizeOptions),
      });
    });
  } catch (error) {
    console.warn('[otzaria-word] האזנה לאפשרויות הגופן נכשלה', error);
    listener(readFontOptions(ui));
    return () => {};
  }
}
