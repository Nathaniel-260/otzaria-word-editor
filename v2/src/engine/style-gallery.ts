/**
 * גלריית הסגנונות של המסמך.
 *
 * למה לא רשימה קשיחה בקומפוננטה, כפי שהיה: רשימה של שישה סגנונות בקוד אינה
 * יודעת מה יש **במסמך**. `ui.styles` חושף בדיוק את מה ש-Word מציג בלשונית
 * „בית” — `getQuickGallery()` הוא ה-Quick Styles של המסמך הפתוח, לפי
 * `w:qFormat`, בסדר של Word, עם השמות **כפי שהם במסמך**. במסמך עברי אלה השמות
 * העבריים; הרשימה הקשיחה תרגמה שישה מזהים אנגליים ולכל השאר לא הייתה תשובה,
 * וסגנון מותאם של המשתמש לא הופיע בגלריה בכלל.
 *
 * הקטלוג נפתר **אסינכרונית** אחרי פתיחת המסמך (`status: 'pending'` עד ההתייצבות
 * הראשונה), ולכן קריאה חד-פעמית ברגע הפתיחה מחזירה רשימה ריקה. זו הסיבה
 * ש-`observeStyleGallery` היא הדרך שהמעטפת אמורה להשתמש בה, ולא `readStyleGallery`
 * לבדה — בלי הרשמה הגלריה קופאת על מה שהיה זמין בשנייה הראשונה.
 *
 * נכשלת סגור: כל מצב שבו המנוע אינו יכול לענות — מצב תצוגה, עורך מבוסס worker,
 * עורך שעוד לא נטען, גרסה בלי `styles` — מחזיר את רשת הביטחון (`FALLBACK_STYLES`).
 * הרשימה הזאת נשארת בקוד **לא** כמקור אמת אלא כדי שגלריה ריקה לא תוצג למשתמש:
 * ששת המזהים שבה הם סגנונות בסיס של Word, והפקודה `linked-style` מקבלת אותם
 * גם כשהקטלוג לא נקרא.
 *
 * הטיפוסים נגזרים מ-`BorrowedSuperDocUI['styles']` ואינם מועתקים לכאן, מאותה
 * סיבה שב-engine/search.ts: כך החוזה הוא של המנוע, והוא נשבר ב-typecheck אם
 * המנוע ישתנה. `StyleGalleryHost` מרשה `Partial` בכוונה — superdoc עצמו קורא
 * למשטח הזה בהגנה (`this.ui?.styles?.getQuickGallery?.()`), כי הוא אינו קיים
 * בכל מצב עורך.
 */
import type { BorrowedSuperDocUI } from 'superdoc';
import type { StyleCatalogItem } from 'superdoc/ui';

/** ה-handle של המנוע, כפי שהוא מוצהר על `SuperDocUI.styles`. */
type StylesHandle = BorrowedSuperDocUI['styles'];

/** ה-slice שהמנוע מחזיר. נגזר מה-handle כדי שלא תהיה כאן העתקה של החוזה. */
export type StylesSlice = ReturnType<StylesHandle['getSnapshot']>;

/** מה שנצרך מ-`superdoc.ui`. הכול אופציונלי — ראו הערת הראש. */
export interface StyleGalleryHost {
  styles?: Partial<StylesHandle> | null;
}

/* ------------------------------------------------------------------ */
/* הפריט שהגלריה מציגה                                                 */
/* ------------------------------------------------------------------ */

/**
 * תפקיד הסגנון בטיפוגרפיה של המסמך. הוא זה שקובע את **הצבע** של התצוגה
 * המקדימה, ולא הצבע שהמנוע מדווח: `preview.css` מביא את צבע הסגנון מהמסמך
 * (ב-Word ברירת המחדל של „כותרת 1” היא כחול כהה), והרצועה עשויה לשבת על משטח
 * כהה — צבע מסמך על משטח כהה הוא טקסט בלתי קריא. הצבע כאן הוא תפקיד מה-API
 * של אוצריא (`var(--color-*)`) ולכן מתהפך עם הערכת הנושא, והטיפוגרפיה — משקל,
 * נטייה, גופן — נלקחת מהמנוע.
 */
export type StyleRole = 'body' | 'heading' | 'subtle';

/** פריט אחד בגלריה, כבר מנורמל לתצוגה. */
export interface StyleGalleryItem {
  /** המזהה שנשלח לפקודה `linked-style`. */
  id: string;
  /** השם להצגה — מהמסמך, כשהוא זמין. */
  label: string;
  /** הטקסט בתוך הכרטיס. */
  previewText: string;
  /** טוקני CSS בטוחים לנושא. `style` בתגית מקבל אותם כמו שהם. */
  previewStyle: Readonly<Record<string, string>>;
}

/** מצב הגלריה כולה. */
export interface StyleGalleryState {
  items: readonly StyleGalleryItem[];
  /** הסגנון הפעיל בבחירה. `null` בבחירה מעורבת או כשאין תשובה. */
  activeId: string | null;
  /** `true` = הרשימה מהמסמך; `false` = רשת הביטחון. הקומפוננטה מכריעה לפיו למי להאמין לגבי `activeId`. */
  fromDocument: boolean;
}

/**
 * רשת הביטחון. שישה סגנונות בסיס של Word עם התוויות העבריות שלהם — מה שהוצג
 * עד עכשיו תמיד, וממשיך להוצג כשהקטלוג אינו זמין.
 */
export const FALLBACK_STYLES: readonly { id: string; label: string; role: StyleRole }[] = [
  { id: 'Normal', label: 'רגיל', role: 'body' },
  { id: 'NoSpacing', label: 'ללא מרווח', role: 'body' },
  { id: 'Heading1', label: 'כותרת 1', role: 'heading' },
  { id: 'Heading2', label: 'כותרת 2', role: 'heading' },
  { id: 'Subtitle', label: 'כותרת משנה', role: 'subtle' },
  { id: 'Quote', label: 'ציטוט', role: 'subtle' },
];

/** הטקסט בכרטיס של סגנון גוף. „AaBbCc” הוא מה ש-Word מציג, ולכן מזוהה. */
const BODY_PREVIEW_TEXT = 'AaBbCc';

/**
 * המזהים שמקבלים תפקיד לא-גוף. המזהים של Word אנגליים ויציבים גם במסמך עברי
 * (`w:styleId`), ולכן הזיהוי עליהם ולא על השם המוצג — שהוא מתורגם ומשתנה.
 */
const HEADING_IDS = /^(heading[1-9]?|title)$/;
const SUBTLE_IDS = /^(subtitle|quote|intensequote|caption|footnotetext|endnotetext)$/;

/** התפקיד של פריט קטלוג. */
export function styleRole(id: string): StyleRole {
  const key = id.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (HEADING_IDS.test(key)) return 'heading';
  if (SUBTLE_IDS.test(key)) return 'subtle';
  return 'body';
}

/**
 * טוקני ה-CSS של תפקיד. גדלים בפיקסלים ולא ביחסיים: הכרטיס בגלריה גבוה 68
 * פיקסלים בדיוק, וגודל יחסי לגופן המשתמש היה שובר את הפריסה של הרצועה.
 */
const ROLE_STYLE: Record<StyleRole, Readonly<Record<string, string>>> = {
  body: { fontSize: '13px', fontWeight: '400', color: 'var(--color-on-surface)' },
  heading: { fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)' },
  subtle: { fontSize: '12px', fontStyle: 'italic', color: 'var(--color-on-surface-variant)' },
};

/**
 * מה שמותר לקחת מ-`preview.css`. רשימה סגורה ולא העברה גורפת: `preview.css`
 * הוא „small UI-safe CSS tokens” של המנוע, אבל UI-safe שם נמדד ביחס לגוף
 * המסמך — `color`, `background`, `margin` ו-`lineHeight` של סגנון מסמך היו
 * צובעים או מנפחים כרטיס ברצועה. הצבע מגיע מהתפקיד (ראו `StyleRole`).
 */
const SAFE_PREVIEW_KEYS = [
  'fontWeight',
  'fontStyle',
  'fontFamily',
  'fontVariant',
  'textDecoration',
  'textTransform',
  'letterSpacing',
] as const;

/** גבולות גודל התצוגה המקדימה, בפיקסלים. „כותרת 1” היא 16 נקודות במסמך. */
const PREVIEW_MIN_PX = 11;
const PREVIEW_MAX_PX = 16;

/** גודל בסיס להמרת יחידות יחסיות. אותו 13px של סגנון הגוף בכרטיס. */
const PREVIEW_BASE_PX = 13;

/**
 * גודל התצוגה המקדימה, מוקטן לגבולות הכרטיס. בלי ההקטנה כותרת של 32 נקודות
 * (Title) הייתה בולעת את הכרטיס ואת שאר הגלריה איתו.
 */
export function clampPreviewFontSize(raw: string | number | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  const match = /^(-?\d*\.?\d+)\s*(px|pt|em|rem|%)?$/.exec(text);
  if (!match) return undefined;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const unit = match[2] ?? 'px';
  const px =
    unit === 'pt' ? (value * 4) / 3
    : unit === 'em' || unit === 'rem' ? value * PREVIEW_BASE_PX
    : unit === '%' ? (value / 100) * PREVIEW_BASE_PX
    : value;

  const clamped = Math.min(PREVIEW_MAX_PX, Math.max(PREVIEW_MIN_PX, Math.round(px)));
  return `${clamped}px`;
}

/**
 * טוקני התצוגה של פריט: התפקיד כבסיס, ומעליו הטיפוגרפיה של המנוע כשהיא זמינה
 * (`preview.available`). כך „כותרת 1” מוצגת במשקל ובגופן שבמסמך, ולא בניחוש.
 */
export function previewStyleFor(item: StyleCatalogItem): Readonly<Record<string, string>> {
  const style: Record<string, string> = { ...ROLE_STYLE[styleRole(item.id)] };
  const css = item.preview?.available ? item.preview.css : undefined;
  if (!css || typeof css !== 'object') return style;

  for (const key of SAFE_PREVIEW_KEYS) {
    const value = css[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text !== '') style[key] = text;
  }

  const size = clampPreviewFontSize(css.fontSize);
  if (size) style.fontSize = size;

  return style;
}

/** הפריטים כפי שהגלריה מציגה אותם. פריט בלי מזהה שמיש נשמט ולא מוצג ריק. */
export function toGalleryItems(
  items: readonly StyleCatalogItem[] | undefined,
): readonly StyleGalleryItem[] {
  const out: StyleGalleryItem[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (id === '' || seen.has(id)) continue;
    // `quickGallery` כבר מסונן, אבל `getCatalog` עם view אחר אינו — ופריט
    // מוסתר בגלריה של Word אינו מוצג.
    if (item.visibility?.effectivelyHidden) continue;
    seen.add(id);

    const label = typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim() : id;
    const role = styleRole(id);
    out.push({
      id,
      label,
      // Word מציג את השם עצמו בכרטיס של כותרת, ו„AaBbCc” בכרטיס של סגנון גוף.
      previewText: role === 'body' ? BODY_PREVIEW_TEXT : label,
      previewStyle: previewStyleFor(item),
    });
  }

  return out;
}

/** רשת הביטחון, בצורת מצב גלריה. */
export function fallbackStyleGallery(): StyleGalleryState {
  return {
    items: FALLBACK_STYLES.map(({ id, label, role }) => ({
      id,
      label,
      previewText: role === 'body' ? BODY_PREVIEW_TEXT : label,
      previewStyle: { ...ROLE_STYLE[role] },
    })),
    activeId: null,
    fromDocument: false,
  };
}

/**
 * המצב מתוך slice של המנוע. `status: 'pending'` עם גלריה ריקה הוא המסלול
 * האמיתי בשנייה שאחרי פתיחת המסמך, ולכן הוא נופל לרשת הביטחון ולא לרשימה
 * ריקה — הגלריה נראית עובדת עד שהקטלוג מתייצב, ואז מתחלפת.
 */
export function toGalleryState(slice: StylesSlice | null | undefined): StyleGalleryState {
  const items = toGalleryItems(slice?.quickGallery);
  if (items.length === 0) return fallbackStyleGallery();

  return {
    items,
    // בחירה שפורסת כמה סגנונות אינה מסמנת כרטיס: Word מציג גלריה בלי בחירה,
    // ולא את הסגנון של הפסקה הראשונה כאילו הוא של כולן.
    activeId: slice?.mixedSelection ? null : (slice?.activeParagraphStyleId ?? null),
    fromDocument: true,
  };
}

/** קריאה בהגנה: מתודה חסרה או זורקת אינה סיבה להפיל את הרצועה. */
function safeRead<T>(read: (() => T) | undefined): T | undefined {
  if (typeof read !== 'function') return undefined;
  try {
    return read();
  } catch (error) {
    console.warn('[otzaria-word] קריאת גלריית הסגנונות מהמנוע נכשלה', error);
    return undefined;
  }
}

/**
 * המצב ברגע זה. `getSnapshot` הוא המסלול הראשי — הוא מביא את הגלריה ואת
 * הסגנון הפעיל בקריאה אחת. `getQuickGallery`/`getActiveParagraphStyle` הם
 * מסלול גיבוי לגרסה שחושפת רק אותם.
 */
export function readStyleGallery(ui: StyleGalleryHost | null | undefined): StyleGalleryState {
  const handle = ui?.styles;
  if (!handle) return fallbackStyleGallery();

  const slice = safeRead(handle.getSnapshot?.bind(handle));
  if (slice) {
    const state = toGalleryState(slice);
    if (state.fromDocument) return state;
  }

  const items = toGalleryItems(safeRead(handle.getQuickGallery?.bind(handle)));
  if (items.length === 0) return fallbackStyleGallery();

  const active = safeRead(handle.getActiveParagraphStyle?.bind(handle));
  return {
    items,
    activeId: active?.mixed ? null : (active?.styleId ?? null),
    fromDocument: true,
  };
}

/**
 * מאזינה לגלריה. `observe` של המנוע יורה מיד עם ה-snapshot הנוכחי ואז על כל
 * שינוי, ולכן אין צורך בקריאה נפרדת לפניה — וזה מה שמכסה את המסלול האמיתי:
 * הקטלוג נפתר אחרי הפתיחה, וההרשמה היא מה שמביא אותו למסך.
 *
 * מחזירה disposer גם כשאין `observe`, כדי שאתר הקריאה לא יצטרך להבחין.
 */
export function observeStyleGallery(
  ui: StyleGalleryHost | null | undefined,
  listener: (state: StyleGalleryState) => void,
): () => void {
  const handle = ui?.styles;
  const observe = handle?.observe;

  if (typeof observe !== 'function') {
    listener(readStyleGallery(ui));
    return () => {};
  }

  try {
    const off = observe.call(handle, (slice) => listener(toGalleryState(slice)));
    return typeof off === 'function' ? off : () => {};
  } catch (error) {
    console.warn('[otzaria-word] האזנה לגלריית הסגנונות נכשלה', error);
    listener(readStyleGallery(ui));
    return () => {};
  }
}
