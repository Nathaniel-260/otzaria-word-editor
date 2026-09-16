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
 * ריצה שיש בה אות עברית ואין בה אות לטינית — מסומנת. ריצה שיש בה שתיהן אינה
 * מסומנת: סימון היה מחיל את גופן הכתב המורכב על החלק הלטיני שבה, וזה שינוי
 * אמיתי במסמך בשביל מקרה שאינו הדיווח. ריצה שכולה ניטרלית — נקודה שהיא ריצה
 * בפני עצמה, וזה **המקרה שדווח** — יורשת את הכיוון של השכן החזק הקרוב ביותר
 * בפסקה, קודם אחורה ואז קדימה. זה מה ש-Word עצמו עושה בהקלדה, שם הכיוון נקבע
 * לפי המקלדת שהייתה פעילה כשהתו הוקלד.
 *
 * ריצה שכבר **מצהירה** `w:rtl` — בכל ערך — אינה מקבלת הצהרה שנייה; ההצהרה של
 * מי שכתב את הקובץ גוברת. אבל אם ההצהרה שלו דולקת, המראה כן מוחלת עליה: משתמש
 * שהדגיש ריצה עברית קיימת קיבל ממנו `w:b` בלבד, וזו בדיוק ההדגשה שנעלמת.
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
import {
  CONTENT_PARTS,
  SKIPPED_SPANS,
  TOKEN_SOURCE,
  isOn,
  rewriteDocxXmlParts,
  valueOf,
  type Bytes,
} from './docx-parts';

/**
 * אותיות חזקות מימין לשמאל: הבלוק העברי, הערבי, הסורי, והצורות המוצגות.
 *
 * הבלוק כולו ולא טווח האותיות בלבד — ריצה שכולה ניקוד או טעמים אינה קיימת
 * במסמך אמיתי, ואילו הייתה, „עברית” הוא הסיווג הנכון עבורה.
 */
const RTL_STRONG = /[֐-׿؀-ۿ܀-ݏ߀-ࣿיִ-﷿ﹰ-﻿]/;

/** אותיות חזקות משמאל לימין: לטינית על הרחבותיה, יוונית וקירילית. */
const LTR_STRONG = /[A-Za-zÀ-ʯͰ-ϿЀ-ӿ]/;

/** הכיוון שנגזר מתוכן הריצה. */
type RunDirection = 'rtl' | 'ltr' | 'mixed' | 'neutral';

/** הכנסה אחת לתוך ה-XML: המקום, והטקסט שייכנס בו. */
interface Insert {
  at: number;
  text: string;
}

/** מה שנאסף על ה-`rPr` החיה של ריצה. מיקומים הם היסטים ב-XML המקורי. */
interface RunProps {
  /** מיקום `</w:rPr>` הסוגר. לשם נכנסת ההצהרה. */
  closeAt: number;
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
}

/** ריצה אחת בפסקה. */
interface RunRecord {
  /** מיד אחרי `<w:r …>` — שם נכנסת `rPr` חדשה, שחייבת להיות הבן הראשון. */
  afterOpen: number;
  prefix: string;
  /** הטקסט של הריצה, לסיווג הכיוון. */
  text: string;
  /** ריצה שיש בה `instrText` היא קוד שדה, ולעולם אינה מסומנת. */
  fieldCode: boolean;
  props: RunProps | null;
  /** עומק ה-`rPr` בתוך הריצה. 1 = העיצוב החי; 2 ומעלה = `rPrChange`. */
  propsDepth: number;
  /** מיקום פתיחת `<w:t>` שנפתחה ועדיין לא נסגרה. */
  textFrom: number | null;
}

function newRun(afterOpen: number, prefix: string): RunRecord {
  return { afterOpen, prefix, text: '', fieldCode: false, props: null, propsDepth: 0, textFrom: null };
}

function newProps(prefix: string): RunProps {
  return {
    closeAt: -1,
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

/** סיווג הכיוון של ריצה לפי תוכנה. */
function classify(run: RunRecord): RunDirection {
  if (run.fieldCode) return 'ltr';
  const rtl = RTL_STRONG.test(run.text);
  const ltr = LTR_STRONG.test(run.text);
  if (rtl && ltr) return 'mixed';
  if (rtl) return 'rtl';
  if (ltr) return 'ltr';
  return 'neutral';
}

/**
 * אילו מריצות הפסקה הן עבריות.
 *
 * ריצה ניטרלית יורשת מהשכן החזק הקרוב ביותר — קודם אחורה, ואם אין, קדימה.
 * פסקה שכולה ניטרלית אינה מסומנת כלל: אין בה שום עדות לכיוון, וניחוש כאן היה
 * משנה מסמכים לטיניים.
 */
function resolveDirections(runs: readonly RunRecord[]): boolean[] {
  const kinds = runs.map(classify);
  return kinds.map((kind, index) => {
    if (kind !== 'neutral') return kind === 'rtl';
    for (let back = index - 1; back >= 0; back--) {
      if (kinds[back] !== 'neutral') return kinds[back] === 'rtl';
    }
    for (let ahead = index + 1; ahead < kinds.length; ahead++) {
      if (kinds[ahead] !== 'neutral') return kinds[ahead] === 'rtl';
    }
    return false;
  });
}

/** ההכנסות שריצה עברית אחת דורשת. ריק = אין מה לעשות בה. */
function insertsFor(run: RunRecord): Insert[] {
  const props = run.props;
  if (!props) {
    const p = run.prefix;
    return [{ at: run.afterOpen, text: `<${p}:rPr><${p}:rtl/></${p}:rPr>` }];
  }

  // הצהרה מפורשת מכובה — הכותב אמר „זו אינה עברית”, ואין לנו רשות להפוך אותה,
  // וגם לא להשלים מראה שנגזרת ממנה.
  if (props.declaredRtl === false) return [];

  const p = props.prefix;
  const out: Insert[] = [];
  if (props.boldEnd !== null && props.boldOn && !props.hasBoldCs) {
    out.push({ at: props.boldEnd, text: `<${p}:bCs/>` });
  }
  if (props.italicEnd !== null && props.italicOn && !props.hasItalicCs) {
    out.push({ at: props.italicEnd, text: `<${p}:iCs/>` });
  }
  if (props.sizeEnd !== null && props.sizeVal !== null && !props.hasSizeCs) {
    out.push({ at: props.sizeEnd, text: `<${p}:szCs ${p}:val="${quoteAttribute(props.sizeVal)}"/>` });
  }
  if (props.fontsAttrsEnd !== null && props.fontsAscii !== null && !props.hasFontCs) {
    out.push({ at: props.fontsAttrsEnd, text: ` ${p}:cs="${quoteAttribute(props.fontsAscii)}"` });
  }
  if (props.declaredRtl === null) out.push({ at: props.closeAt, text: `<${p}:rtl/>` });
  return out;
}

/**
 * מסמנת ריצות עבריות ב-`<w:rtl/>` ומשלימה את מראת הכתב המורכב. `null` = אין מה
 * לשנות.
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

  const inserts: Insert[] = [];
  /** מחסנית הפסקאות — כל אחת והריצות שנפתחו בתוכה. */
  const paragraphs: RunRecord[][] = [];
  /** מחסנית הריצות, לטיפול בריצה שבתוך ריצה. */
  const runs: RunRecord[] = [];
  /** עומק `pPr`. כל עוד הוא מעל אפס, `rPr` אינה של ריצה. */
  let paraPropsDepth = 0;

  const collect = (list: readonly RunRecord[]): void => {
    const rtl = resolveDirections(list);
    list.forEach((run, index) => {
      if (rtl[index]) inserts.push(...insertsFor(run));
    });
  };

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

    if (name === 'pPr') {
      if (!selfClosing) paraPropsDepth += closing ? -1 : 1;
      if (paraPropsDepth < 0) paraPropsDepth = 0;
      continue;
    }

    if (name === 'p' && !selfClosing) {
      if (closing) {
        const list = paragraphs.pop();
        if (list) collect(list);
      } else {
        paragraphs.push([]);
      }
      continue;
    }

    if (name === 'r' && !selfClosing) {
      if (closing) {
        runs.pop();
      } else {
        const record = newRun(token.lastIndex, prefix);
        runs.push(record);
        paragraphs[paragraphs.length - 1]?.push(record);
      }
      continue;
    }

    if (!run) continue;

    if (name === 'rPr' && paraPropsDepth === 0 && !selfClosing) {
      if (closing) {
        if (run.propsDepth === 0) continue;
        run.propsDepth -= 1;
        if (run.propsDepth === 0 && run.props) run.props.closeAt = match.index;
      } else {
        run.propsDepth += 1;
        if (run.propsDepth === 1) run.props = newProps(prefix);
      }
      continue;
    }

    if (name === 'instrText') {
      run.fieldCode = true;
      continue;
    }

    if (name === 't' && !selfClosing) {
      if (closing) {
        if (run.textFrom !== null) run.text += xml.slice(run.textFrom, match.index);
        run.textFrom = null;
      } else {
        run.textFrom = token.lastIndex;
      }
      continue;
    }

    const props = run.props;
    if (!props || run.propsDepth !== 1 || closing) continue;
    const tagEnd = match.index + match[0].length;

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
    }
  }

  // פסקה שלא נסגרה — מסמך קטוע. מה שנאסף בה תקף בדיוק כמו בפסקה שנסגרה.
  while (paragraphs.length > 0) {
    const list = paragraphs.pop();
    if (list) collect(list);
  }

  if (inserts.length === 0) return null;

  // המיון נדרש: בתוך אותה ריצה סדר ההכנסות נגזר מסדר האיברים ב-`rPr`, והמנוע
  // כותב אותם בסדר שלו (נמדד: `<w:rFonts/><w:sz/><w:i/><w:b/>`). שני היסטים
  // זהים אינם אפשריים — כל הכנסה נתלית באיבר אחר.
  inserts.sort((first, second) => first.at - second.at);

  const parts: string[] = [];
  let at = 0;
  for (const insert of inserts) {
    parts.push(xml.slice(at, insert.at), insert.text);
    at = insert.at;
  }
  parts.push(xml.slice(at));
  return parts.join('');
}

/**
 * בייטי DOCX שבהם הריצות העבריות מסומנות, או `null` כשאין מה לסמן.
 *
 * מיוצאת בנפרד מ-`markRunDirection` כדי שאפשר יהיה לבדוק אותה בלי `Blob` —
 * היא כל מה שנוגע לארכיון.
 */
export function postflightDocx(bytes: Bytes): Promise<Bytes | null> {
  return rewriteDocxXmlParts(bytes, (name) => CONTENT_PARTS.test(name), markRtlRuns);
}
