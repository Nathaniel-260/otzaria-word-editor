/**
 * איחוד ריצות שאין ביניהן שום הבדל, לפני שהמנוע רואה את המסמך.
 *
 * ## למה
 *
 * Word מפצל טקסט לריצות גם כשהעיצוב אחיד: כל שמירה מסמנת את מה שנכתב בה
 * במזהה עריכה משלה (`w:rsidR`, `w:rsidRPr`), וכל סימון של שגיאת כתיב
 * (`<w:proofErr/>`) חותך את הריצה שהוא יושב בה. מסמך שנערך לאורך זמן מגיע כך
 * לעשרות ריצות לפסקה, שכולן נראות אותו דבר.
 *
 * המנוע משלם על כל ריצה בכל הקשה. דווח (10.2026) על מסמך של משתמש — 42
 * פסקאות, 1,217 ריצות ו-270 `proofErr` — שבו הקלדה רצופה הייתה „איטית עד כדי
 * לא שמיש”: האותיות נערמו והופיעו יחד. ביסקציה על אותו מסמך: האיחוד כאן (264
 * ריצות) הוא מה שמשנה; הסרת `proofErr` לבדה לא שינתה דבר. מספרי הזמנים
 * פנימיים — רישיון המנוע אוסר לפרסם מדידות שלו.
 *
 * ## מה מאוחד, ובדיוק מה
 *
 * שתי ריצות סמוכות מתאחדות רק כשכל התנאים מתקיימים:
 *
 * - שתיהן ריצות WordprocessingML (`wordPrefix`), לא `m:r` של נוסחה ולא `a:r`.
 * - בכל אחת יש לכל היותר `rPr` אחד, ו**בדיוק** `t` אחד, ושום ילד אחר. ריצה
 *   עם טאב, שבירה, הפניה להערה, `lastRenderedPageBreak` או טקסט מחוק אינה
 *   נוגעת — היא נשארת כמות שהיא, והשכנות שלה אינן מתאחדות דרכה.
 * - ה-`rPr` של שתיהן זהה **תו-בתו**. אין כאן השוואה סמנטית של עיצוב: מה ששונה
 *   במחרוזת נשאר נפרד, גם אם היה מוצג אותו דבר.
 * - המאפיינים על התג `r` עצמו הם מזהי עריכה בלבד (`rsid*`). כל מאפיין אחר
 *   עוצר.
 * - בין הריצות יש רק רווחים ו-`<w:proofErr …/>`. סימנייה, הערת XML, תחילת
 *   הערה (`commentRangeStart`), `ins`/`del` — כל דבר אחר באמצע עוצר.
 *
 * ## מה זה עושה לקובץ שיישמר
 *
 * המנוע מייצא מהמודל שלו, ולכן מה שנמסר לו כאן — כולל `proofErr` ו-
 * `w:proofState` — הוא מה שעשוי לצאת בשמירה. שני דברים יוצאים מהמסמך:
 *
 * - **מזהי העריכה** של הריצות שאוחדו (נשמר זה של הראשונה). הם משמשים את
 *   „השוואת מסמכים” של Word לשיוך שינויים לשמירה; על מסמך שנפתח ונשמר בתוסף
 *   השיוך הזה ממילא אינו מדויק.
 * - **`proofErr` שהיה בין הריצות האלה.** זה **כן** נראה, אם לא מטפלים בו:
 *   Word אינו בודק איות מחדש במסמך ש-`w:proofState` שלו אומר „clean” — הוא
 *   סומך על הסימונים השמורים. נמדד ב-Word על מסמך אמיתי: אחרי ההסרה ירד מספר
 *   שגיאות האיות המסומנות ב-יותר ממחצית. לכן מי שמסיר כאן סימון קורא גם
 *   ל-`markProofingDirty` על `settings.xml` (docx-preflight.ts), ו-Word בודק
 *   מחדש בפתיחה.
 *
 * ## רווחים
 *
 * `w:t` בלי `xml:space="preserve"` מאבד את הרווחים שבקצותיו — אלא אם אלמנט
 * אב הצהיר `preserve`, שהוא תכונה עוברת בירושה ב-XML. הריצה המאוחדת נכתבת
 * תמיד עם `preserve`, ולכן ריצה בלי `preserve` שיש רווח בקצה הטקסט שלה **אינה
 * מתאחדת**: קיצוץ היה מוחק רווח שאב שמר, והשארה הייתה מוסיפה רווח ש-Word לא
 * הציג. בקורפוס של 600 מסמכי Word המקרה לא הופיע אף פעם.
 *
 * ## `]]>`
 *
 * `>` גלוי מותר בטקסט XML, אבל הרצף `]]>` אסור. ריצה שנגמרת ב-`]]` וריצה
 * שמתחילה ב-`>` יוצרות אותו בהדבקה, ולכן ה-`>` שבו נכתב כ-`&gt;`.
 */
import { TOKEN_SOURCE, skippedCloser, wordPrefix } from './docx-parts';

/** ריצה שאפשר לאחד: איפה היא, ומה שצריך כדי לכתוב אותה מחדש. */
interface SimpleRun {
  start: number;
  end: number;
  /** מאפייני התג `r`, כפי שנכתבו (כולל הרווח המוביל). */
  attributes: string;
  /** ה-`rPr` כולו, מחרוזת גולמית; ריק כשאין. */
  props: string;
  /** הטקסט כפי שהוא ב-XML (ישויות כמו `&amp;` נשארות ישויות). */
  text: string;
}

/** מאפיינים שמותרים על ריצה שמתאחדת: מזהי עריכה, ורווחים. */
const RSID_ONLY = /^(?:\s+[\w.-]+:rsid\w*\s*=\s*(?:"[^"]*"|'[^']*'))*\s*$/;

/** `xml:space="preserve"` בדיוק, או שום מאפיין. כל מאפיין אחר על `t` עוצר. */
const PRESERVE = /^\s+xml:space\s*=\s*(?:"preserve"|'preserve')\s*$/;

/**
 * רווח של XML (לא של Unicode) בקצה הטקסט — מה שנקצץ בלי preserve. גם כשהוא
 * כתוב כהפניית תו (`&#32;`, `&#x9;`): Word מקצץ גם אותו (ממצא QA, נבדק ב-Word).
 */
const SPACE_CHAR = String.raw`(?:[ \t\r\n]|&#(?:0*(?:32|9|10|13)|[xX]0*(?:20|9|[aA]|[dD]));)`;
const XML_EDGE_SPACE = new RegExp(`^${SPACE_CHAR}|${SPACE_CHAR}$`);

/**
 * `document.xml` (או הערות שוליים, כותרות…) עם ריצות זהות מאוחדות, או `null`
 * כשאין מה לאחד.
 */
export function mergeFragmentedRuns(xml: string): string | null {
  const prefix = wordPrefix(xml);
  if (prefix === null) return null;
  // חיפוש מחרוזת לפני הסריקה: חלק בלי שתי ריצות אינו יכול להתאחד.
  const runOpen = `<${prefix}:r`;
  const first = xml.indexOf(runOpen);
  if (first < 0 || xml.indexOf(runOpen, first + runOpen.length) < 0) return null;

  const between = new RegExp(
    `^(?:\\s|<${prefix}:proofErr\\b(?:[^>"']|"[^"]*"|'[^']*')*/>)*$`,
  );
  const runs = collectSimpleRuns(xml, prefix);

  let out = '';
  let copiedTo = 0;
  let merged = 0;
  for (let i = 0; i < runs.length; ) {
    let j = i;
    while (
      j + 1 < runs.length &&
      runs[j + 1].props === runs[i].props &&
      between.test(xml.slice(runs[j].end, runs[j + 1].start))
    ) {
      j += 1;
    }
    if (j > i) {
      const group = runs.slice(i, j + 1);
      out += xml.slice(copiedTo, group[0].start);
      out +=
        `<${prefix}:r${group[0].attributes}>${group[0].props}` +
        `<${prefix}:t xml:space="preserve">${group
          .map((run) => run.text)
          .join('')
          .split(']]>')
          .join(']]&gt;')}</${prefix}:t>` +
        `</${prefix}:r>`;
      copiedTo = group[group.length - 1].end;
      merged += group.length - 1;
    }
    i = j + 1;
  }
  if (merged === 0) return null;
  return out + xml.slice(copiedTo);
}

/** מספר הריצות שנחסכו, לשורת היומן. */
export function countRuns(xml: string): number {
  const prefix = wordPrefix(xml);
  if (prefix === null) return 0;
  return xml.match(new RegExp(`<${prefix}:r[\\s>]`, 'g'))?.length ?? 0;
}

/**
 * כל הריצות במסמך שמתאימות לאיחוד, לפי הסדר. ריצה שאינה מתאימה אינה נכנסת
 * לרשימה, ולכן הבדיקה של מה שבין שתי ריצות סמוכות ברשימה (`between`) נכשלת
 * עליה — היא יושבת ביניהן כתג שאינו `proofErr`.
 */
function collectSimpleRuns(xml: string, prefix: string): SimpleRun[] {
  const runs: SimpleRun[] = [];
  const token = new RegExp(TOKEN_SOURCE.source, 'g');

  /** הריצה הפתוחה כרגע, או `null` מחוץ לריצה. */
  let run: {
    start: number;
    attributes: string;
    ok: boolean;
    props: string | null;
    text: string | null;
    /** עומק אלמנטים בתוך הריצה. 0 = ילדים ישירים. */
    depth: number;
    /** איפה התחיל ה-`rPr` הפתוח, כשהוא הילד הנוכחי. */
    propsStart: number;
    /** איפה נגמר התג הקודם — כדי לוודא שבין ילדים יש רק רווחים. */
    lastEnd: number;
  } | null = null;

  for (let match = token.exec(xml); match; match = token.exec(xml)) {
    const closer = skippedCloser(match[0]);
    if (closer !== undefined) {
      const end = xml.indexOf(closer, token.lastIndex);
      // הערה שאינה נסגרת: מה שאחריה אינו אמין. מה שכבר נאסף לפניה בטוח.
      if (end < 0) break;
      // הערה או CDATA בתוך ריצה: לא מאחדים אותה.
      if (run) run.ok = false;
      token.lastIndex = end + closer.length;
      continue;
    }

    const [, closing, tagPrefix, name, rawAttributes] = match;
    const selfClosing = rawAttributes.endsWith('/');
    const attributes = selfClosing ? rawAttributes.slice(0, -1) : rawAttributes;
    const ours = tagPrefix === prefix;

    if (!run) {
      if (ours && name === 'r' && !closing && !selfClosing) {
        run = {
          start: match.index,
          attributes,
          ok: RSID_ONLY.test(attributes),
          props: null,
          text: null,
          depth: 0,
          propsStart: -1,
          lastEnd: token.lastIndex,
        };
      }
      continue;
    }

    // בין ילדים ישירים של הריצה מותרים רק רווחים.
    if (run.depth === 0 && xml.slice(run.lastEnd, match.index).trim() !== '') run.ok = false;

    if (run.depth === 0 && closing && ours && name === 'r') {
      if (run.ok && run.text !== null) {
        runs.push({
          start: run.start,
          end: token.lastIndex,
          attributes: run.attributes,
          props: run.props ?? '',
          text: run.text,
        });
      }
      run = null;
      continue;
    }

    if (run.depth === 0 && !closing) {
      if (ours && name === 'rPr' && run.props === null && run.text === null) {
        if (selfClosing) {
          run.props = match[0];
        } else {
          run.propsStart = match.index;
          run.depth = 1;
        }
      } else if (ours && name === 't' && !selfClosing && run.text === null) {
        // הטקסט הוא כל מה שעד הסוגר הבא; אם יש שם תג, הערה או CDATA — לא מאחדים.
        const close = `</${prefix}:t>`;
        const end = xml.indexOf(close, token.lastIndex);
        const raw = end < 0 ? null : xml.slice(token.lastIndex, end);
        const preserved = attributes !== '' && PRESERVE.test(attributes);
        if (
          raw === null ||
          raw.includes('<') ||
          (attributes !== '' && !preserved) ||
          (!preserved && XML_EDGE_SPACE.test(raw))
        ) {
          run.ok = false;
        } else {
          run.text = raw;
          token.lastIndex = end + close.length;
        }
      } else {
        // כל ילד אחר — טאב, שבירה, הפניה, טקסט מחוק, `rPr` שני — הריצה נשארת.
        run.ok = false;
        if (!selfClosing) run.depth = 1;
      }
      run.lastEnd = token.lastIndex;
      continue;
    }

    // בתוך ילד: רק עומק נספר. סגירה בעומק 1 מחזירה לרמת הילדים הישירים.
    if (closing) {
      run.depth -= 1;
      if (run.depth === 0) {
        if (run.propsStart >= 0) {
          run.props = xml.slice(run.propsStart, token.lastIndex);
          run.propsStart = -1;
        }
        run.lastEnd = token.lastIndex;
      }
      // סגירה בלי פתיחה (מסמך קטוע): לא יורדים מתחת לאפס, והריצה אינה מאוחדת.
      if (run.depth < 0) {
        run.depth = 0;
        run.ok = false;
      }
    } else if (!selfClosing) {
      run.depth += 1;
    }
  }
  return runs;
}

/** מאפייני `w:proofState` שערכם „clean” — מה שגורם ל-Word לסמוך על הסימונים. */
const CLEAN_PROOF_ATTRIBUTE = /(\s[\w.-]+:(?:spelling|grammar)\s*=\s*)(["'])clean\2/g;

/**
 * `settings.xml` שבו `w:proofState` אומר ל-Word לבדוק איות ודקדוק מחדש, או
 * `null` כשאין מה לשנות (אין `proofState`, או שאינו „clean”).
 *
 * נקרא רק כשהאיחוד הסיר `proofErr` ממסמך — ראו „מה זה עושה לקובץ שיישמר”
 * למעלה. `dirty` הוא הערך שהסכמה מגדירה ל„הבדיקה אינה מעודכנת”; Word בודק
 * מחדש ומחליף את הסימונים.
 */
export function markProofingDirty(xml: string): string | null {
  const prefix = wordPrefix(xml);
  if (prefix === null || !xml.includes('proofState')) return null;
  const token = new RegExp(TOKEN_SOURCE.source, 'g');
  for (let match = token.exec(xml); match; match = token.exec(xml)) {
    const closer = skippedCloser(match[0]);
    if (closer !== undefined) {
      const end = xml.indexOf(closer, token.lastIndex);
      if (end < 0) return null;
      token.lastIndex = end + closer.length;
      continue;
    }
    const [, closing, tagPrefix, name] = match;
    if (closing || tagPrefix !== prefix || name !== 'proofState') continue;
    const tag = match[0];
    const dirty = tag.replace(CLEAN_PROOF_ATTRIBUTE, '$1$2dirty$2');
    if (dirty === tag) return null;
    return xml.slice(0, match.index) + dirty + xml.slice(token.lastIndex);
  }
  return null;
}
