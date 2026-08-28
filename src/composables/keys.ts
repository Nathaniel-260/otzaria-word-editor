/**
 * מפתחות ה-provide/inject של המעטפת.
 *
 * `InjectionKey` מטופס ולא מחרוזת: מפתח מוקלד שגוי הוא באג שקט — הפקד עולה,
 * ה-inject נופל לברירת המחדל, והכפתור פשוט לא עושה כלום. עם המפתחות האלה
 * ה-typecheck תופס אותו.
 */
import type { InjectionKey, Ref } from 'vue';
import type { CommandAdapter, CommandOutcome } from '../engine/command-adapter';
import type { FontOptions } from '../engine/font-options';
import type { StyleGalleryState } from '../engine/style-gallery';
import type { ReadoutSelection } from '../engine/readout-hold';

/** האדפטר של ה-session הפעיל. `null` עד שיש מסמך פתוח. */
export const COMMAND_ADAPTER: InjectionKey<Ref<CommandAdapter | null>> = Symbol('commandAdapter');

/**
 * מי שיודע להציג הודעה למשתמש. ה-adapter מחזיר תוצאה עם הודעה בעברית, אבל עד
 * עכשיו כל 38 אתרי הקריאה ב-Ribbon עשו `void cmd.run()` וזרקו אותה — כלומר
 * שלוש טבלאות התרגום ב-command-adapter.ts היו קוד מת, וכשל פקודה נראה למשתמש
 * כמו כפתור שבור. ההזרקה הזאת היא מה שמחזיר אותן למסך בלי לגעת באתרי הקריאה.
 */
export const COMMAND_REPORTER: InjectionKey<CommandReporter> = Symbol('commandReporter');

/** מקבלת את תוצאת הפקודה. נקראת גם בהצלחה, כדי שנוכל לנקות הודעה קודמת. */
export type CommandReporter = (outcome: CommandOutcome, commandId: string) => void;

/**
 * אפשרויות הגופן של המסמך הפתוח (`ui.fonts` דרך engine/font-options.ts).
 *
 * מפתח **צר** בכוונה, ולא ה-`ui` הגולמי: התכנית (§4) קובעת שכל מה שקומפוננטה
 * רואה עובר דרך שכבה שאפשר לבדוק. `ui` בקומפוננטה היה פותח לה את כל 20
 * ה-handles של ה-controller, כולל מסלולי mutation שאין להם קשר לבורר גופן.
 */
export const FONT_OPTIONS: InjectionKey<Ref<FontOptions>> = Symbol('fontOptions');

/**
 * גלריית הסגנונות של המסמך הפתוח (`ui.styles` דרך engine/style-gallery.ts).
 *
 * מפתח נפרד ולא הרחבה של `FONT_OPTIONS`, ומאותו טעם צר: הגלריה היא הקטלוג
 * **של המסמך**, נפתרת אסינכרונית אחרי הפתיחה, ורק מי שמנהל את ה-session יודע
 * מתי להירשם ומתי לשחרר. הקומפוננטה רואה מצב קריא בלבד.
 */
export const STYLE_GALLERY: InjectionKey<Ref<StyleGalleryState>> = Symbol('styleGallery');

/**
 * מצב הבחירה כפי שהחזקת החיווי צריכה אותו (`ui.selection` דרך
 * engine/readout-hold.ts).
 *
 * מפתח נפרד ולא הרחבה של `COMMAND_ADAPTER`, מאותו טעם צר כמו שני המפתחות
 * שמעליו: האדפטר הוא „הרץ פקודה, ותן לי את מצבה”, והבחירה היא עובדה על
 * המסמך שכל הפקדים חולקים. הזרקה אחת ולא מנוי לכל פקד — 38 מנויים ל-
 * `ui.selection` על אותו slice היו 38 עותקים של אותה תשובה.
 */
export const READOUT_SELECTION: InjectionKey<Ref<ReadoutSelection>> = Symbol('readoutSelection');
