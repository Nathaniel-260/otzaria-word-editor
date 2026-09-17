/**
 * `<w:rtl/>` על ריצות עבריות — בדרך **החוצה**, אחרי שהמנוע כתב את המסמך.
 *
 * ## מה שדווח
 *
 * „הנקודה שבסוף הפסקה מוצגת בתחילת השורה”. המשתמש כתב משפט עברי בעורך, שמר,
 * ופתח ב-Word — והנקודה הסוגרת מצוירת צמודה לשוליים הימניים, כלומר לפני המילה
 * הראשונה.
 *
 * ## השורש
 *
 * `w:rtl` (ECMA-376 §17.3.2.30) אומרת ל-Word שתווי הריצה הם כתב מורכב. תו
 * **ניטרלי** — נקודה, פסיק, סוגר — בריצה שאין בה ההצהרה נפתר כשמאל-לימין, ולכן
 * Word מציב אותו בקצה ההתחלה של הפסקה. `<w:bidi/>` ברמת הפסקה אינו מכסה את זה:
 * הוא קובע את כיוון הפסקה, לא את הטיפול בתווי הריצה.
 *
 * המנוע אינו כותב את ההצהרה. **נמדד** על קובץ אמיתי של משתמש: הפסקה שהוא הקליד
 * ב-Word נשמרה עם `rPr: rFonts, strike, color, rtl`, והפסקה שהמנוע שלנו כתב
 * באותו קובץ — `rPr: strike, color`. הריצה שמחזיקה את הנקודה היא בדיוק זו
 * שההצהרה חסרה בה. דווח למעלה:
 * <https://github.com/superdoc/docx-editor/issues/4011>.
 *
 * **ואימות A/B מבוקר,** אותה פסקה פעמיים עם `<w:bidi/>` בשתיהן ו-`<w:rtl/>` רק
 * באחת, שיוצא ל-PDF מ-Word ונקרא ממפעילי מיקום הטקסט בזרם התוכן: הפסקה עם
 * ההצהרה מציירת את הנקודה בקצה השמאלי; זו שבלעדיה מוסיפה קטע ציור ב-x=519.5,
 * צמוד לשוליים הימניים שב-523.3 — הנקודה בתחילת השורה.
 *
 * ## למה זה לא נראה בעורך עצמו
 *
 * הדפדפן פותר כיוון **מהתווים** (UBA), ולא מההצהרה. אותו קובץ בדיוק נראה תקין
 * אצלנו ושבור ב-Word, ולכן אין שום מדידה בתוך העורך שיכולה לתפוס את זה — רק
 * פתיחה ב-Word.
 *
 * ## מה שחייב לנסוע יחד: מראת הכתב המורכב
 *
 * ברגע שריצה מסומנת `rtl`, Word קורא את ההדגשה מ-`w:bCs`, את הנטייה מ-`w:iCs`,
 * את הגודל מ-`w:szCs` ואת הגופן מ-`w:rFonts w:cs`. **נמדד מה המנוע כותב:**
 *
 * | הפעולה | ה-`rPr` שיוצא |
 * |---|---|
 * | Ctrl+B | `<w:b/>` |
 * | Ctrl+I | `<w:i/>` |
 * | גודל 18 | `<w:sz w:val="36"/>` |
 * | גופן David | `<w:rFonts w:ascii="David" w:hAnsi="David"/>` |
 *
 * כלומר הצד הלטיני בלבד. סימון `rtl` לבדו היה מתקן את הנקודה ומעלים בו-ברגע את
 * ההדגשה, הנטייה, הגודל והגופן ב-Word. לכן ההשלמה אינה תוספת אלא חלק מהתיקון,
 * והיא חלה **רק על הריצות שסומנו** — ריצה לטינית נשארת לטינית לגמרי.
 *
 * ## הכלל שנבחר, ולמה
 *
 * ריצה שיש בה אות עברית ואין בה אות לטינית — מסומנת. ריצה שכולה ניטרלית —
 * נקודה שהיא ריצה בפני עצמה, וזה **המקרה שדווח** — יורשת את הכיוון של השכן
 * החזק הקרוב ביותר בפסקה, קודם אחורה ואז קדימה. זה מה ש-Word עצמו עושה
 * בהקלדה, שם הכיוון נקבע לפי המקלדת שהייתה פעילה כשהתו הוקלד.
 *
 * ### ריצה שיש בה שתיהן — מפוצלת
 *
 * „מילה Word בעברית.” שהוקלדה בעורך יוצאת כריצה **אחת**. גרסה קודמת השאירה
 * אותה בלי הצהרה, ו-Word הציג אותה **הפוכה**: ‏„.בעברית Word מילה” — הנקודה
 * בתחילת השורה וגם סדר המילים (נמדד ב-PDF מ-Word). סימון הריצה כולה מתקן את
 * הסדר אבל מחיל את גופן הכתב המורכב על המילה הלטינית (נמדד: Arial במקום
 * Aptos). לכן הריצה מפוצלת לפי כיוון — עברית עם `w:rtl` והמראה, לטינית כפי
 * שהייתה — וזה בדיוק מה ש-Word עצמו כותב כשמקלידים אותו משפט. גם זה נמדד:
 * שלוש ריצות מציגות את המשפט נכון, עם הגופן הלטיני במקומו.
 *
 * הכיוון של כל תו בריצה כזו נקבע לפי UBA, ברמת הפסקה כולה ולא רק הריצה:
 * ספרה הולכת אחרי החזק שלפניה (W7, N1), ותו ניטרלי בין שני כיוונים שונים —
 * או בקצה הפסקה — מקבל את כיוון הפסקה (N2). „הרווח שאחרי Word” הוא הדוגמה:
 * שיוך שלו ללטינית היה מצייר אותו בצד הלא נכון של המילה.
 *
 * פיצול נעשה רק בריצה **פשוטה** — `rPr` וטקסט, בלי טאב, שבירה, שדה או ציור —
 * ורק כשאין ב-`rPr` שלה `rPrChange` (מזהה השינוי היה משוכפל) או הצהרת `rtl`
 * קיימת. בכל מקרה אחר הריצה נשארת כפי שהייתה, כמו קודם.
 *
 * ריצה שכבר **מצהירה** `w:rtl` — בכל ערך — אינה מקבלת הצהרה שנייה; ההצהרה של
 * מי שכתב את הקובץ גוברת. אבל אם ההצהרה שלו דולקת, המראה כן מוחלת עליה: משתמש
 * שהדגיש ריצה עברית קיימת קיבל ממנו `w:b` בלבד, וזו בדיוק ההדגשה שנעלמת.
 *
 * ## סדר האיברים
 *
 * ‏`w:rtl` נכתב במקומו לפי הסכמה של `CT_RPr` (ECMA-376 §17.3.2.28): **לפני**
 * `cs`, `em`, `lang`, `eastAsianLayout`, `specVanish`, `oMath` ו-`rPrChange`,
 * ולא סתם לפני הסוגר. Word 16 סובל גם את הסדר ההפוך (נמדד), אבל צרכן שמאמת
 * מול הסכמה אינו חייב.
 *
 * ## למה על הבייטים ולא במודל
 *
 * `format.apply({ inline: { rtl: true } })` עובד — נמדד — אבל הוא **מוטציה
 * במסמך**: צעד היסטוריה, דגל „לא נשמר”, וציור מחדש, בכל שמירה ושמירה. תיקון
 * על הבייטים שיוצאים אינו נוגע במה שהמשתמש רואה ואינו מזיז לו את ה-undo. זו גם
 * אותה נקודה שבה `docx-preflight.ts` מתקן את הכיוון הנכנס, ואותו קורא zip
 * משרת את שניהם.
 *
 * ## הכלל: לתקן, ולא לחסום
 *
 * כמו בכיוון הנכנס — כל כשל בדרך מחזיר את המקור כמות שהוא. שמירה שנכשלת היא
 * נזק גדול בהרבה מנקודה בצד הלא נכון.
 */
import { SKIPPED_SPANS, TOKEN_SOURCE, isOn, valueOf } from './docx-parts';

/**
 * אותיות חזקות מימין לשמאל: הבלוק העברי, הערבי, הסורי, והצורות המוצגות.
 *
 * הבלוק כולו ולא טווח האותיות בלבד — ריצה שכולה ניקוד או טעמים אינה קיימת
 * במסמך אמיתי, ואילו הייתה, „עברית” הוא הסיווג הנכון עבורה.
 */
const RTL_STRONG = /[֐-׿؀-ۿ܀-ݏ߀-ࣿיִ-﷿ﹰ-﻿]/;

/** אותיות חזקות משמאל לימין: לטינית על הרחבותיה, יוונית וקירילית. */
const LTR_STRONG = /[A-Za-zÀ-ʯͰ-ϿЀ-ӿ]/;

/** ספרות „אירופיות” (EN ב-UBA): חלשות, והכיוון שלהן נגזר מהסביבה. */
const EUROPEAN_DIGIT = /[0-9０-９]/;

/** מה שבא **אחרי** `w:rtl` ב-`CT_RPr`. `w:rtl` נכתב לפני הראשון שבהם. */
const AFTER_RTL = new Set(['cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange']);

/** הכיוון שנגזר מתוכן הריצה. */
type RunDirection = 'rtl' | 'ltr' | 'mixed' | 'neutral';

/** סיווג תו אחד: חזק ימין-לשמאל, חזק שמאל-לימין, ספרה, או ניטרלי. */
type CharClass = 'R' | 'L' | 'EN' | 'N';

/**
 * שינוי אחד ב-XML: הכנסה (`end === at`) או החלפה של `[at, end)`.
 * מיקומים הם היסטים ב-XML המקורי.
 */
interface Edit {
  at: number;
  end: number;
  text: string;
}

/** מה שנאסף על ה-`rPr` החיה של ריצה. מיקומים הם היסטים ב-XML המקורי. */
interface RunProps {
  /** מיקום `<w:rPr>` הפותח. */
  openAt: number;
  /** מיקום `</w:rPr>` הסוגר. */
  closeAt: number;
  /** מיד אחרי `</w:rPr>`. */
  closeEnd: number;
  /** האיבר הראשון שחייב לבוא אחרי `w:rtl`, או `null` — ואז הסוגר. */
  rtlAt: number | null;
  /** הקידומת של ה-`rPr`, כדי שהאיברים שייכתבו יישאו את אותה. */
  prefix: string;
  /** סוף התג של `b`, כדי ש-`bCs` ייכתב מיד אחריו לפי סדר הסכמה. */
  boldEnd: number | null;
  boldOn: boolean;
  hasBoldCs: boolean;
  italicEnd: number | null;
  italicOn: boolean;
  hasItalicCs: boolean;
  sizeEnd: number | null;
  sizeVal: string | null;
  hasSizeCs: boolean;
  /** המקום שלפני סוגר התג של `rFonts` — לשם נכנס המאפיין `w:cs`. */
  fontsAttrsEnd: number | null;
  fontsAscii: string | null;
  hasFontCs: boolean;
  /** מה ש-`w:rtl` מצהירה, או `null` כשאינה שם. */
  declaredRtl: boolean | null;
  /** יש בה `rPrChange` — היסטוריה של שינוי מסומן, עם מזהה משלה. */
  hasChange: boolean;
}

/** ריצה אחת בפסקה. */
interface RunRecord {
  /** מיקום `<w:r …>`. */
  start: number;
  /** מיד אחרי `<w:r …>` — שם נכנסת `rPr` חדשה, שחייבת להיות הבן הראשון. */
  afterOpen: number;
  /** מיד אחרי `</w:r>`, או `-1` כל עוד הריצה פתוחה. */
  end: number;
  prefix: string;
  /** הטקסט של הריצה כפי שהוא ב-XML — ישויות כמו `&amp;` עדיין מקודדות. */
  raw: string;
  /** ריצה שיש בה `instrText` היא קוד שדה, ולעולם אינה מסומנת. */
  fieldCode: boolean;
  props: RunProps | null;
  /** עומק ה-`rPr` בתוך הריצה. 1 = העיצוב החי; 2 ומעלה = `rPrChange`. */
  propsDepth: number;
  /** מיקום פתיחת `<w:t>` שנפתחה ועדיין לא נסגרה. */
  textFrom: number | null;
  /** עומק האיברים שאינם `rPr` ואינם `t`. */
  childDepth: number;
  /** רק `rPr` וטקסט — ריצה שמותר לפצל. */
  simple: boolean;
}

/** פסקה אחת: הריצות שנפתחו בה, והכיוון שלה. */
interface ParagraphRecord {
  runs: RunRecord[];
  /** `<w:bidi/>` דולק ב-`pPr` שלה. */
  rtl: boolean;
}

function newRun(start: number, afterOpen: number, prefix: string): RunRecord {
  return {
    start,
    afterOpen,
    end: -1,
    prefix,
    raw: '',
    fieldCode: false,
    props: null,
    propsDepth: 0,
    textFrom: null,
    childDepth: 0,
    simple: true,
  };
}

function newProps(prefix: string, openAt: number): RunProps {
  return {
    openAt,
    closeAt: -1,
    closeEnd: -1,
    rtlAt: null,
    prefix,
    boldEnd: null,
    boldOn: false,
    hasBoldCs: false,
    italicEnd: null,
    italicOn: false,
    hasItalicCs: false,
    sizeEnd: null,
    sizeVal: null,
    hasSizeCs: false,
    fontsAttrsEnd: null,
    fontsAscii: null,
    hasFontCs: false,
    declaredRtl: null,
    hasChange: false,
  };
}

/**
 * מאפיין לפי שם, בלי להיות נעול על קידומת — כמו `valueOf` של `w:val`, ומאותו
 * טעם. קבוצה 1 — מרכאות כפולות; קבוצה 2 — בודדות.
 */
function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`\\s(?:[\\w.-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes);
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * ערך שנקרא ממאפיין וייכתב לתוך מאפיין חדש במרכאות כפולות.
 *
 * רק `"` מוחלף: מה שנקרא הוא הטקסט הגולמי שבין המרכאות, כלומר כבר מוגן —
 * `&amp;` שנקרא כך וייכתב כך הוא אותו ערך בדיוק. גרש כפול יכול להופיע בו רק
 * כשהמקור היה במרכאות בודדות, וזה המקרה היחיד שצריך הגנה.
 */
function quoteAttribute(raw: string): string {
  return raw.replace(/"/g, '&quot;');
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * הטקסט כפי שהוא נקרא. בלי זה `&amp;` נספר כשלוש אותיות לטיניות, וריצה עברית
 * שיש בה „&” סווגה כמעורבת ולא סומנה כלל.
 */
function decodeText(raw: string): string {
  return raw.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (whole, dec, hex, named) => {
    if (named) return NAMED_ENTITIES[named as string] ?? whole;
    const code = dec ? Number.parseInt(dec as string, 10) : Number.parseInt(hex as string, 16);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** טקסט לתוך `<w:t>`. */
function encodeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function charClass(ch: string): CharClass {
  if (RTL_STRONG.test(ch)) return 'R';
  if (LTR_STRONG.test(ch)) return 'L';
  if (EUROPEAN_DIGIT.test(ch)) return 'EN';
  return 'N';
}

/** סיווג הכיוון של ריצה לפי תוכנה. */
function classify(run: RunRecord): RunDirection {
  if (run.fieldCode) return 'ltr';
  const text = decodeText(run.raw);
  const rtl = RTL_STRONG.test(text);
  const ltr = LTR_STRONG.test(text);
  if (rtl && ltr) return 'mixed';
  if (rtl) return 'rtl';
  if (ltr) return 'ltr';
  return 'neutral';
}

/**
 * הכיוון של כל תו ברצף, לפי UBA (W7, N1, N2) — `true` = ימין-לשמאל.
 *
 * ספרה אחרי חזק לטיני היא לטינית, וכל ספרה אחרת פועלת כחזקה ימנית על
 * הניטרליים שלצידה. ניטרלי בין שני חזקים זהים מקבל את כיוונם; בין שונים, או
 * בקצה, — את כיוון הפסקה.
 */
function resolveChars(classes: readonly CharClass[], paragraphRtl: boolean): boolean[] {
  const edge: 'R' | 'L' = paragraphRtl ? 'R' : 'L';
  const strong: ('R' | 'L' | null)[] = [];
  let last: 'R' | 'L' = edge;
  for (const cls of classes) {
    if (cls === 'R' || cls === 'L') {
      last = cls;
      strong.push(cls);
    } else if (cls === 'EN') {
      strong.push(last === 'L' ? 'L' : 'R');
    } else {
      strong.push(null);
    }
  }

  const before: ('R' | 'L')[] = [];
  let previous: 'R' | 'L' = edge;
  for (const value of strong) {
    before.push(previous);
    if (value) previous = value;
  }

  const result: boolean[] = new Array(classes.length);
  let next: 'R' | 'L' = edge;
  for (let i = classes.length - 1; i >= 0; i -= 1) {
    const own = strong[i];
    result[i] = (own ?? (before[i] === next ? next : edge)) === 'R';
    if (own) next = own;
  }
  return result;
}

/** ההכנסות שריצה עברית אחת דורשת. ריק = אין מה לעשות בה. */
function insertsFor(run: RunRecord): Edit[] {
  const props = run.props;
  if (!props) {
    const p = run.prefix;
    return [{ at: run.afterOpen, end: run.afterOpen, text: `<${p}:rPr><${p}:rtl/></${p}:rPr>` }];
  }

  // הצהרה מפורשת מכובה — הכותב אמר „זו אינה עברית”, ואין לנו רשות להפוך אותה,
  // וגם לא להשלים מראה שנגזרת ממנה.
  if (props.declaredRtl === false) return [];

  const p = props.prefix;
  const out: Edit[] = [];
  const insert = (at: number, text: string) => out.push({ at, end: at, text });
  if (props.boldEnd !== null && props.boldOn && !props.hasBoldCs) insert(props.boldEnd, `<${p}:bCs/>`);
  if (props.italicEnd !== null && props.italicOn && !props.hasItalicCs) insert(props.italicEnd, `<${p}:iCs/>`);
  if (props.sizeEnd !== null && props.sizeVal !== null && !props.hasSizeCs) {
    insert(props.sizeEnd, `<${p}:szCs ${p}:val="${quoteAttribute(props.sizeVal)}"/>`);
  }
  if (props.fontsAttrsEnd !== null && props.fontsAscii !== null && !props.hasFontCs) {
    insert(props.fontsAttrsEnd, ` ${p}:cs="${quoteAttribute(props.fontsAscii)}"`);
  }
  // אחרון, ובכוונה: כשהוא נופל באותו מקום כמו `szCs` (למשל `<w:sz/><w:lang/>`),
  // הסדר כאן הוא הסדר שבקובץ — והמיון היציב שומר עליו.
  if (props.declaredRtl === null) insert(props.rtlAt ?? props.closeAt, `<${p}:rtl/>`);
  return out;
}

/** מחילה שינויים על מחרוזת. השינויים ממוינים, ואינם חופפים. */
function applyEdits(source: string, edits: readonly Edit[], offset = 0): string {
  const sorted = [...edits].sort((first, second) => first.at - second.at);
  const parts: string[] = [];
  let at = 0;
  for (const edit of sorted) {
    parts.push(source.slice(at, edit.at - offset), edit.text);
    at = edit.end - offset;
  }
  parts.push(source.slice(at));
  return parts.join('');
}

/** האם ריצה מעורבת מותרת לפיצול — ההסבר בהערת הפתיחה. */
function canSplit(run: RunRecord): boolean {
  if (!run.simple || run.fieldCode || run.end < 0 || run.textFrom !== null) return false;
  const props = run.props;
  return !props || (props.closeEnd >= 0 && props.declaredRtl === null && !props.hasChange);
}

/**
 * ריצה מעורבת כמה ריצות, אחת לכל קטע כיוון. `dirs` — הכיוון של כל תו.
 * `null` = אין פיצול.
 */
function splitRun(xml: string, run: RunRecord, text: string, dirs: readonly boolean[]): Edit | null {
  const chars = [...text];
  if (chars.length !== dirs.length || !canSplit(run)) return null;

  const segments: { text: string; rtl: boolean }[] = [];
  chars.forEach((ch, i) => {
    const last = segments[segments.length - 1];
    if (last && last.rtl === dirs[i]) last.text += ch;
    else segments.push({ text: ch, rtl: dirs[i]! });
  });
  if (segments.length < 2) return null;

  const p = run.prefix;
  const open = xml.slice(run.start, run.afterOpen);
  const props = run.props;
  const plain = props ? xml.slice(props.openAt, props.closeEnd) : '';
  const marked = props
    ? applyEdits(plain, insertsFor(run), props.openAt)
    : `<${p}:rPr><${p}:rtl/></${p}:rPr>`;

  const replacement = segments
    .map((segment) => {
      const rPr = segment.rtl ? marked : plain;
      return `${open}${rPr}<${p}:t xml:space="preserve">${encodeText(segment.text)}</${p}:t></${p}:r>`;
    })
    .join('');
  return { at: run.start, end: run.end, text: replacement };
}

/**
 * השינויים שפסקה אחת דורשת.
 *
 * ריצה ניטרלית יורשת מהשכן החזק הקרוב ביותר — קודם אחורה, ואם אין, קדימה.
 * שכן מעורב מוסר את הכיוון של התו שבקצה הקרוב שלו. פסקה שכולה ניטרלית אינה
 * מסומנת כלל: אין בה שום עדות לכיוון, וניחוש כאן היה משנה מסמכים לטיניים.
 */
function paragraphEdits(xml: string, paragraph: ParagraphRecord): Edit[] {
  const { runs } = paragraph;
  const kinds = runs.map(classify);
  const texts = runs.map((run) => (run.fieldCode ? '' : decodeText(run.raw)));

  let charDirs: boolean[][] = [];
  if (kinds.includes('mixed')) {
    const classes = texts.flatMap((text) => [...text].map(charClass));
    const resolved = resolveChars(classes, paragraph.rtl);
    let cursor = 0;
    charDirs = texts.map((text) => {
      const length = [...text].length;
      const part = resolved.slice(cursor, cursor + length);
      cursor += length;
      return part;
    });
  }

  /** הכיוון שריצה חזקה מוסרת לשכן ניטרלי. `null` = אין לה מה למסור. */
  const donor = (index: number, fromEnd: boolean): boolean | null => {
    const kind = kinds[index];
    if (kind === 'neutral') return null;
    if (kind !== 'mixed') return kind === 'rtl';
    const dirs = charDirs[index] ?? [];
    return dirs.length ? dirs[fromEnd ? dirs.length - 1 : 0]! : null;
  };

  const edits: Edit[] = [];
  runs.forEach((run, index) => {
    const kind = kinds[index];

    if (kind === 'mixed') {
      if (run.props?.declaredRtl === true) {
        edits.push(...insertsFor(run));
        return;
      }
      const split = splitRun(xml, run, texts[index]!, charDirs[index] ?? []);
      if (split) edits.push(split);
      return;
    }

    let rtl = kind === 'rtl';
    if (kind === 'neutral') {
      let inherited: boolean | null = null;
      for (let back = index - 1; back >= 0 && inherited === null; back -= 1) inherited = donor(back, true);
      for (let ahead = index + 1; ahead < runs.length && inherited === null; ahead += 1) {
        inherited = donor(ahead, false);
      }
      rtl = inherited === true;
    }
    if (rtl) edits.push(...insertsFor(run));
  });
  return edits;
}

/**
 * מסמנת ריצות עבריות ב-`<w:rtl/>`, משלימה את מראת הכתב המורכב, ומפצלת ריצות
 * מעורבות. `null` = אין מה לשנות.
 *
 * ## למה סורק ולא רגקס על `<w:r>…</w:r>`
 *
 * משלוש סיבות שכל אחת מהן לבדה מספיקה, וכולן נמדדות במסמכים אמיתיים:
 *
 * 1. **`rPr` מקננת.** `<w:rPr>…<w:rPrChange><w:rPr>…</w:rPr></w:rPrChange></w:rPr>`
 *    — רגקס לא-להוט קושר את הפתיחה החיצונית לסגירה הפנימית, כלומר כותב את
 *    ההצהרה לתוך ההיסטוריה של שינוי מסומן במקום לעיצוב החי.
 * 2. **ריצות מקננות.** תיבת טקסט היא `<w:r><w:drawing>…<w:txbxContent><w:p>
 *    <w:r>…` — ריצה בתוך פסקה בתוך ריצה. בלי מחסנית, הטקסט של הפנימית נספר
 *    לחיצונית והפסקה הפנימית נעלמת.
 * 3. **`rPr` של סימן הפסקה.** `<w:pPr><w:rPr>` אינה של שום ריצה. היא מזוהה כאן
 *    לפי היותה בתוך `pPr`, ולא לפי „אין ריצה פתוחה” — שכן בפסקה של תיבת טקסט
 *    יש ריצה פתוחה סביבה.
 *
 * הערות, CDATA והוראות עיבוד נבלעות שלמות, כמו ב-`docx-preflight.ts`: תג שנראה
 * כמו עיצוב בתוך הערה אינו עיצוב.
 */
export function markRtlRuns(xml: string): string | null {
  // חיפוש אחד לפני הסריקה: מסמך שאין בו אף אות עברית אינו נוגע לזה בכלל.
  if (!RTL_STRONG.test(xml)) return null;

  const edits: Edit[] = [];
  /** מחסנית הפסקאות — כל אחת והריצות שנפתחו בתוכה. */
  const paragraphs: ParagraphRecord[] = [];
  /** מחסנית הריצות, לטיפול בריצה שבתוך ריצה. */
  const runs: RunRecord[] = [];
  /** עומק `pPr`. כל עוד הוא מעל אפס, מה שנסרק אינו של ריצה. */
  let paraPropsDepth = 0;
  /** עומק האיברים בתוך `pPr` — `w:bidi` נקרא רק כבן ישיר שלה. */
  let paraPropsInner = 0;

  const token = new RegExp(TOKEN_SOURCE.source, 'g');
  for (let match = token.exec(xml); match; match = token.exec(xml)) {
    const closer = SKIPPED_SPANS.get(match[0]);
    if (closer !== undefined) {
      const end = xml.indexOf(closer, token.lastIndex);
      // הערה שאינה נסגרת: אין יותר תגים שאפשר לסמוך עליהם. מה שנאסף עד כאן
      // כולו מלפני ההערה, ולכן מוחל.
      if (end < 0) break;
      token.lastIndex = end + closer.length;
      continue;
    }

    const [, closing, prefix, name, attributes] = match;
    const selfClosing = attributes.endsWith('/');
    const run = runs[runs.length - 1];
    const paragraph = paragraphs[paragraphs.length - 1];

    if (name === 'pPr') {
      if (!selfClosing) paraPropsDepth += closing ? -1 : 1;
      if (paraPropsDepth < 0) paraPropsDepth = 0;
      if (paraPropsDepth <= 1 && !closing) paraPropsInner = 0;
      continue;
    }

    if (paraPropsDepth > 0) {
      // `w:bidi` של `sectPr` או של `pPrChange` אינו כיוון הפסקה.
      if (name === 'bidi' && !closing && paraPropsDepth === 1 && paraPropsInner === 0) {
        if (paragraph) paragraph.rtl = isOn(attributes);
      } else if (!selfClosing) {
        paraPropsInner = Math.max(0, paraPropsInner + (closing ? -1 : 1));
      }
      continue;
    }

    if (name === 'p' && !selfClosing) {
      if (closing) {
        const list = paragraphs.pop();
        if (list) edits.push(...paragraphEdits(xml, list));
      } else {
        paragraphs.push({ runs: [], rtl: false });
      }
      continue;
    }

    if (name === 'r' && !selfClosing) {
      if (closing) {
        if (run) run.end = token.lastIndex;
        runs.pop();
      } else {
        const record = newRun(match.index, token.lastIndex, prefix);
        runs.push(record);
        paragraph?.runs.push(record);
      }
      continue;
    }

    if (!run) continue;

    if (name === 'rPr' && !selfClosing) {
      if (closing) {
        if (run.propsDepth === 0) continue;
        run.propsDepth -= 1;
        if (run.propsDepth === 0 && run.props) {
          run.props.closeAt = match.index;
          run.props.closeEnd = token.lastIndex;
        }
      } else {
        run.propsDepth += 1;
        if (run.propsDepth === 1) run.props = newProps(prefix, match.index);
      }
      continue;
    }

    if (run.propsDepth > 0) {
      const props = run.props;
      if (!props || run.propsDepth !== 1 || closing) continue;
      const tagEnd = match.index + match[0].length;

      if (AFTER_RTL.has(name) && props.rtlAt === null) props.rtlAt = match.index;

      if (name === 'b') {
        props.boldEnd = tagEnd;
        props.boldOn = isOn(attributes);
      } else if (name === 'bCs') {
        props.hasBoldCs = true;
      } else if (name === 'i') {
        props.italicEnd = tagEnd;
        props.italicOn = isOn(attributes);
      } else if (name === 'iCs') {
        props.hasItalicCs = true;
      } else if (name === 'sz') {
        props.sizeEnd = tagEnd;
        props.sizeVal = valueOf(attributes);
      } else if (name === 'szCs') {
        props.hasSizeCs = true;
      } else if (name === 'rFonts') {
        // המקום שלפני סוגר התג: `/>` כשהוא סוגר את עצמו, ו-`>` כשלא.
        props.fontsAttrsEnd = tagEnd - (selfClosing ? 2 : 1);
        props.fontsAscii = attribute(attributes, 'ascii') ?? attribute(attributes, 'hAnsi');
        props.hasFontCs = attribute(attributes, 'cs') !== null;
      } else if (name === 'rtl') {
        props.declaredRtl = isOn(attributes);
      } else if (name === 'rPrChange') {
        props.hasChange = true;
      }
      continue;
    }

    if (name === 't') {
      if (selfClosing) continue;
      if (closing) {
        if (run.textFrom !== null) run.raw += xml.slice(run.textFrom, match.index);
        run.textFrom = null;
      } else {
        if (run.childDepth !== 0) run.simple = false;
        run.textFrom = token.lastIndex;
      }
      continue;
    }

    if (name === 'instrText') run.fieldCode = true;
    if (closing) {
      if (run.childDepth > 0) run.childDepth -= 1;
    } else {
      // כל בן ישיר שאינו `rPr` או `t` — טאב, שבירה, שדה, ציור — הופך את הריצה
      // לכזו שאין לפצל.
      if (run.childDepth === 0) run.simple = false;
      if (!selfClosing) run.childDepth += 1;
    }
  }

  // פסקה שלא נסגרה — מסמך קטוע. מה שנאסף בה תקף בדיוק כמו בפסקה שנסגרה.
  while (paragraphs.length > 0) {
    const list = paragraphs.pop();
    if (list) edits.push(...paragraphEdits(xml, list));
  }

  if (edits.length === 0) return null;
  // המיון היציב נדרש: בתוך אותה ריצה סדר ההכנסות נגזר מסדר האיברים ב-`rPr`,
  // והמנוע כותב אותם בסדר שלו (נמדד: `<w:rFonts/><w:sz/><w:i/><w:b/>`).
  return applyEdits(xml, edits);
}
