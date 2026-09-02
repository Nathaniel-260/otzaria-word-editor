/**
 * התצוגה החיה של בורר הגופן — מה שהיא עושה **במסמך**.
 *
 * המשתמש מסמן קטע, פותח את רשימת הגופנים ועובר עליה; אחרי השהיה קצרה הקטע
 * המסומן נצבע בגופן שהסימון עומד עליו, וכך רואים איך הוא נראה בטקסט האמיתי
 * במקום לנחש משם. יציאה מהרשימה בלי לבחור מחזירה את הגופן שהיה.
 *
 * העיתוי — מה מחכה כמה, מה מתבטל, ומה נכנס לתור — אינו כאן אלא ב-
 * `composables/font-preview.ts`. כאן רק המגע במסמך.
 *
 * ## למה `format.apply` על טווח שנתפס, ולא פקודת `font-family`
 *
 * זו ההכרעה היחידה שיש בקובץ, והיא בטיחותית ולא סגנונית.
 *
 * פקודת `font-family` של הרצועה מחילה על **הבחירה הנוכחית**. לתצוגה חיה זה
 * מסלול שבור, וזה מסלול שקורה בפועל: המשתמש לוחץ בתוך המסמך כדי לצאת מהרשימה,
 * הלחיצה מזיזה את הבחירה, ורק **אחריה** מגיע ה-`blur` שסוגר את הרשימה ומבקש
 * להחזיר את הגופן שהיה. ההחזרה הייתה נוחתת על הטקסט שנבחר עכשיו — כלומר משנה
 * גופן בקטע שהמשתמש לא נגע בו בכלל.
 *
 * `doc.format.apply({ target, inline })` מקבל `SelectionTarget` מפורש. הטווח
 * נתפס פעם אחת בתחילת התצוגה, וכל צביעה — כולל ההחזרה — מכוונת אליו. בחירה
 * שזזה בינתיים אינה נוגעת לעניין.
 *
 * וזה גם אותו מסלול בדיוק: `font-family` מנותב במנוע ל-`format.fontFamily`,
 * ומפתח ה-inline שלו הוא `fontFamily` — אותו מפתח שנשלח כאן (נקרא מהמנוע:
 * `docRoute: "format.fontFamily", inline: { key: "fontFamily" }`). כלומר מה
 * שהתצוגה מראה הוא מה שהבחירה תחיל, ולא קירוב שלו.
 *
 * ## מה שהיא **אינה** פותרת: ההיסטוריה
 *
 * זו מוטציה אמיתית, ולכן היא נכנסת להיסטוריית הביטול. אין ב-API הציבורי דרך
 * לצבוע בלי לרשום צעד (`mutations.preview` הוא dry-run שמחזיר יעדים, ואינו
 * מצייר), ו-`activeEditor.view` — שבו אפשר היה לשלוח טרנזקציה עם
 * `addToHistory: false` — אינו חלק מהחוזה שהתוסף נשען עליו.
 *
 * מה שכן נעשה כדי לצמצם: השהיה לפני כל צביעה, דילוג על גופן שכבר מוצג, ותור
 * סדרתי — כלומר מעבר מהיר על הרשימה אינו מייצר צעד לכל שורה. ראו
 * `composables/font-preview.ts`.
 *
 * ## ומה שאינו מוצג כלל
 *
 * בחירה **מעורבת** (שתי משפחות בתוך הקטע) אינה מקבלת תצוגה חיה. הצביעה
 * משטחת את הקטע לגופן אחד, וההחזרה יודעת להחזיר גופן אחד בלבד — כלומר תצוגה
 * על קטע מעורב הייתה מוחקת מידע. הגבול הזה נאכף אצל הקורא (`use-font-controls`),
 * שם יושבת הידיעה „מה הגופן של הבחירה”.
 */
import type { SuperDoc } from 'superdoc';
import type { DocReceipt, MaybePromise } from './document-api';

/** מה שנקרא מ-`doc.selection.current()`. שני השדות אופציונליים — מגיע מהמנוע. */
interface SelectionInfoLike {
  empty?: boolean;
  selectionTarget?: unknown;
}

/**
 * החלק מ-`activeEditor.doc` שנצרך כאן. הכול אופציונלי: גרסת מנוע בלי
 * `format.apply` פשוט אינה מציגה תצוגה חיה, ואינה נופלת.
 */
export interface FontPreviewDocumentApi {
  selection?: {
    current?: () => MaybePromise<SelectionInfoLike | undefined>;
  };
  format?: {
    apply?: (input: { target: unknown; inline: Record<string, unknown> }) => MaybePromise<DocReceipt>;
  };
}

export interface FontPreviewHost {
  activeEditor?: { doc?: FontPreviewDocumentApi | null } | null;
}

export type FontPreviewTarget = SuperDoc | FontPreviewHost | null | undefined;

function docOf(host: FontPreviewTarget): FontPreviewDocumentApi | null {
  return (host as FontPreviewHost | null | undefined)?.activeEditor?.doc ?? null;
}

/**
 * תופסת את הטווח המסומן, למגע חוזר בו גם אחרי שהבחירה זזה.
 *
 * `null` בכל מצב שאינו „טווח מסומן שאפשר לצייר עליו”: סמן מכווץ, גרסה בלי
 * `selection.current`, קריאה שנכשלה. התצוגה החיה היא נוחות; היא לעולם אינה
 * מפילה דבר ואינה מדווחת למשתמש — כשל בה פירושו שלא מוצג דבר, וזה מצב תקין.
 */
export async function captureRange(host: FontPreviewTarget): Promise<unknown | null> {
  const current = docOf(host)?.selection?.current;
  if (typeof current !== 'function') return null;

  try {
    const info = await current();
    if (!info || info.empty === true || !info.selectionTarget) return null;
    return info.selectionTarget;
  } catch (error) {
    console.warn('[otzaria-word] תפיסת הטווח לתצוגה החיה של הגופן נכשלה', error);
    return null;
  }
}

/**
 * צובעת טווח שנתפס בגופן. `false` = לא נצבע, ואז הקורא יודע שאין מה להחזיר.
 *
 * `NO_OP` נחשב הצלחה, כמו בכל שאר המסלולים: „הגופן כבר היה זה” אינו כשל.
 */
export async function paintFamily(
  host: FontPreviewTarget,
  target: unknown,
  family: string,
): Promise<boolean> {
  const apply = docOf(host)?.format?.apply;
  if (typeof apply !== 'function' || target === null || target === undefined) return false;

  try {
    const receipt = await apply({ target, inline: { fontFamily: family } });
    return receipt?.success !== false || receipt?.failure?.code === 'NO_OP';
  } catch (error) {
    console.warn('[otzaria-word] צביעת התצוגה החיה של הגופן נכשלה', error);
    return false;
  }
}
