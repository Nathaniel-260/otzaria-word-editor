/**
 * בורר הגופן ובורר הגודל — מצב אחד לשני המקומות שמציגים אותם.
 *
 * ## למה זה יצא מ-`HomeTab.vue`
 *
 * הפקדים האלה מופיעים עכשיו גם בתפריט הלחצן הימני, ופקד שמחזיק מצב משלו
 * במקום השני הוא פקד שמשקר באחד מהם. המצב כאן אינו „הערך שהמנוע מדווח” — זה
 * ממילא משותף דרך ה-`CommandAdapter` — אלא **שתי שכבות הזיכרון** שסביבו:
 *
 * 1. „האחרון שידענו”, שנדרש מפני שהמנוע מדווח `undefined` גם על בחירה מעורבת
 *    וגם על רגע שבו הוא עוד לא פתר את הבחירה. בורר שמתרוקן בכל תנועת סמן הוא
 *    גרוע מבורר שמציג את הערך האחרון שכן ידענו.
 * 2. „מה שנבחר וטרם נענה”, שנדרש כדי שבחירה שהמסמך דחה תיעלם מהמסך.
 *
 * שתיהן היו `ref` מקומי בלשונית „בית”. תפריט הקשר שנפתח היה מקבל עותק טרי
 * שלהן, ולכן בדיוק ברגע שהמנוע אינו מדווח ערך — כלומר מיד אחרי שהתפריט הזיז
 * את הסמן — הוא היה מציג „Assistant 12” בזמן שהרצועה מציגה את גופן המסמך.
 * זה גם ההפך הגמור ממה שהמשתמש ביקש: שמה שלמעלה יהיה גם למטה.
 *
 * ## ולמה הזרקה ולא סינגלטון במודול
 *
 * מצב ברמת המודול נשמר גם בין הרכבה להרכבה, כלומר בין בדיקה לבדיקה: לשונית
 * שהוחלפה או בדיקה שהחילה גופן היו מזהמות את מי שבא אחריהן. `FONT_MEMORY`
 * נוצר פעם אחת במעטפת (`App.vue`) ומוזרק, ומי שמורכב בלעדיו — בדיקת רכיב,
 * או רצועה שעולה לפני המעטפת — מקבל זיכרון פרטי חדש. אותה תבנית בדיוק של
 * `useFontOptions`.
 */
import {
  computed,
  inject,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';
import { FONT_MEMORY, READOUT_SELECTION } from './keys';
import { useCommand } from './useCommand';
import { useFontOptions } from './useFontOptions';
import { createFontPreview } from './font-preview';
import { applyOptimistically, withCurrent, type PickerOption } from './picker-value';
import { ACTIVE_SUPERDOC } from '../engine/document-api';
import { captureRange, paintFamily } from '../engine/font-preview';
import { UNSETTLED_SELECTION } from '../engine/readout-hold';
import {
  DEFAULT_FONT_SIZE_PT,
  fontFamilyPayload,
  fontSizePayload,
  grownFontSize,
  parseFontFamily,
  parseFontSizeInput,
  parseFontSizePt,
  shrunkFontSize,
} from '../engine/payloads';

/**
 * מה שהבורר מציג לפני שהמנוע דיווח על גופן. Assistant הוא הגופן הארוז, כלומר
 * היחיד שבטוח קיים בכל פלטפורמה.
 */
export const DEFAULT_FONT_FAMILY = 'Assistant';

/** שתי שכבות הזיכרון של הבוררים. ראו הערת הראש. */
export interface FontMemory {
  /** מה שהמנוע דיווח לאחרונה. */
  family: Ref<string>;
  size: Ref<number>;
  /** מה שהמשתמש בחר וטרם קיבל תשובה. `null` = אין בקשה באוויר. */
  pendingFamily: Ref<string | null>;
  pendingSize: Ref<number | null>;
}

export function createFontMemory(): FontMemory {
  return {
    family: ref(DEFAULT_FONT_FAMILY),
    size: ref(DEFAULT_FONT_SIZE_PT),
    pendingFamily: ref<string | null>(null),
    pendingSize: ref<number | null>(null),
  };
}

/** מה שפקד רואה. הכול לקריאה — הכתיבה עוברת בפקודות. */
export interface FontControls {
  familyOptions: ComputedRef<readonly PickerOption[]>;
  sizeOptions: ComputedRef<readonly PickerOption[]>;
  /** הגופן המוצג. */
  family: ComputedRef<string>;
  /** הגודל המוצג, כמחרוזת של הבורר. „12” ולא „12.0”, אבל „20.5” נשמר. */
  size: ComputedRef<string>;
  familyEnabled: ComputedRef<boolean>;
  sizeEnabled: ComputedRef<boolean>;
  setFamily: (family: string) => void;
  setSize: (size: string) => void;
  /**
   * מה שהקלדה בתיבת הגודל מחילה. `null` = לא מספר, והתיבה חוזרת לגודל שבמסמך.
   *
   * מחרוזת ולא מספר מפני שזה מה שהפקד מדבר בו — הוא אינו יודע שמדובר בגדלים,
   * וההמרה חזרה למספר קורית ב-`setSize` יחד עם כל בחירה אחרת.
   */
  normalizeSize: (typed: string) => string | null;
  /** דרגה אחת על סולם הגדלים של Word, **מהערך של המנוע**. */
  grow: () => void;
  shrink: () => void;
  /**
   * תצוגה חיה: הסימון ברשימת הגופנים עבר לגופן הזה. `null` = אין סימון.
   *
   * הקטע המסומן במסמך נצבע בו אחרי השהיה קצרה, כך שרואים את הגופן בטקסט
   * האמיתי ולא רק בשם. ראו font-preview.ts (העיתוי) ו-engine/font-preview.ts
   * (המגע במסמך), כולל מה שמונע תצוגה על בחירה מעורבת.
   */
  hoverFamily: (family: string | null) => void;
  /** רשימת הגופנים נסגרה. `committed` = נבחר גופן, ולכן אין מה להחזיר. */
  endHoverFamily: (committed: boolean) => void;
}

export function useFontControls(): FontControls {
  // הצורה עם factory (`true`) ולא ערך ישיר: אחרת זיכרון נבנה בכל הרכבה גם
  // כשהמעטפת כן מספקת את המפתח.
  const memory = inject(FONT_MEMORY, createFontMemory, true);

  const familyCmd = useCommand('font-family');
  const sizeCmd = useCommand('font-size');

  /**
   * המופע הפעיל והבחירה — שניהם רק בשביל התצוגה החיה.
   *
   * ברירות מחדל שאינן מציגות דבר: קומפוננטה שמורכבת בלי המעטפת (בדיקת רכיב,
   * רצועה שעולה לפני שנפתח מסמך) מקבלת `null` ובחירה שלא התיישבה, ואז
   * `allowed` למטה מחזיר `false` — כלומר הבורר עובד בדיוק כמו קודם.
   */
  const host = inject(ACTIVE_SUPERDOC, () => shallowRef(null), true);
  const selection = inject(READOUT_SELECTION, () => shallowRef(UNSETTLED_SELECTION), true);

  /**
   * אפשרויות הגופן מהמנוע (`ui.fonts`), ממוזגות עם שלנו. ראו
   * engine/font-options.ts — רשימה קשיחה לא הייתה יודעת מה יש במסמך.
   */
  const { families, sizes } = useFontOptions();

  /**
   * `CommandState.value` הוא המקור לערך שהבורר מציג — לא ref מקומי. שלושת
   * הבוררים היו פעם refs שאותחלו לערך קשיח ולעולם לא התעדכנו: לחיצה על טקסט
   * ב-20pt השאירה „12” בתיבה, ו„הגדל גופן” חישב מהמספר השגוי הזה.
   */
  const engineFamily = computed(() => parseFontFamily(familyCmd.value.value));
  const engineSize = computed(() => parseFontSizePt(sizeCmd.value.value));

  // הזיכרון נכתב רק מדיווח שיש בו ערך — „מעורב” אינו מוחק אותו.
  watch(engineFamily, (value) => {
    if (value) memory.family.value = value;
  });
  watch(engineSize, (value) => {
    if (value) memory.size.value = value;
  });

  /**
   * סדר העדיפויות: מה שנבחר וטרם נענה, אחר כך מה שהמנוע מדווח, ולבסוף האחרון
   * שידענו. בקשה שנדחתה נעלמת מהשכבה הראשונה, ואז המסמך חוזר להיות מה שמוצג.
   */
  const family = computed(
    () => memory.pendingFamily.value ?? engineFamily.value ?? memory.family.value,
  );
  const sizePt = computed(() => memory.pendingSize.value ?? engineSize.value ?? memory.size.value);
  const size = computed(() => String(sizePt.value));

  const familyOptions = computed(() =>
    withCurrent(
      families.value.map((option) => ({
        value: option.value,
        label: option.label,
        preview: option.previewFamily,
        // הקיבוץ וכיסוי העברית נקבעים במיזוג ולא כאן — engine/font-options.ts.
        group: option.group,
        hebrew: option.hebrew,
      })),
      family.value,
    ),
  );

  const sizeOptions = computed(() =>
    withCurrent(
      sizes.value.map((option) => ({ value: option.value, label: option.label })),
      size.value,
    ),
  );

  // ה-payloads נבנים ב-engine/payloads.ts ולא כליטרל כאן: מה שנשלח לפקודה הוא
  // חוזה מול ולידטור בתוך המנוע, והוולידטור נכשל **סגור**.
  function setFamily(next: string): void {
    const payload = fontFamilyPayload(next);
    if (payload === null) return;
    void applyOptimistically(memory.pendingFamily, memory.family, payload, () =>
      familyCmd.run(payload),
    );
  }

  function applySize(pt: number): void {
    const payload = fontSizePayload(pt);
    if (payload === null) return;
    void applyOptimistically(memory.pendingSize, memory.size, payload, () => sizeCmd.run(payload));
  }

  function setSize(next: string): void {
    const pt = parseFontSizePt(next);
    if (pt !== null) applySize(pt);
  }

  function normalizeSize(typed: string): string | null {
    const pt = parseFontSizeInput(typed);
    return pt === null ? null : String(pt);
  }

  /**
   * הגופן שהמנוע מדווח, **בלי** ההחזקה של readout-hold ובלי הזיכרון.
   *
   * זו ההבחנה שהתצוגה החיה נשענת עליה: `family` למעלה מציג את „האחרון שידענו”
   * מפני שבורר שמתרוקן בכל תזוזת סמן גרוע מבורר מעופש — אבל **להחזיר** אפשר
   * רק גופן שבאמת נמצא במסמך עכשיו. `null` כאן פירושו „מעורב, או טרם נפתר”,
   * ובשני המצבים אין תצוגה חיה: צביעה משטחת בחירה מעורבת לגופן אחד, וההחזרה
   * לא הייתה יודעת להשיב את מה שהיה.
   */
  const rawFamily = computed(() => parseFontFamily(familyCmd.engineState.value.value));

  const preview = createFontPreview({
    allowed: () =>
      familyCmd.enabled.value &&
      selection.value.settled &&
      !selection.value.empty &&
      rawFamily.value !== null,
    origin: () => rawFamily.value,
    capture: () => captureRange(host.value),
    paint: (target, family) => paintFamily(host.value, target, family),
  });

  /**
   * רשת ביטחון: לשונית שהוחלפה או תפריט שנהרס בזמן שהתצוגה החיה על המסך אינם
   * אמורים להשאיר את הגופן שאיש לא בחר. בזרימה רגילה `end` כבר נקרא מהסגירה.
   */
  onUnmounted(() => preview.end(false));

  return {
    familyOptions,
    sizeOptions,
    family,
    size,
    familyEnabled: familyCmd.enabled,
    sizeEnabled: sizeCmd.enabled,
    setFamily,
    setSize,
    normalizeSize,
    grow: () => applySize(grownFontSize(sizePt.value)),
    shrink: () => applySize(shrunkFontSize(sizePt.value)),
    hoverFamily: preview.hover,
    endHoverFamily: preview.end,
  };
}
