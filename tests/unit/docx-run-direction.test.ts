/**
 * הבאג שהבדיקות כאן שומרות עליו: „הנקודה שבסוף הפסקה מוצגת בתחילת השורה”.
 * המנוע כותב ריצות עבריות בלי `<w:rtl/>`, ו-Word — שקובע כיוון לפי ההצהרה ולא
 * לפי התווים — מציב תו ניטרלי בקצה ההתחלה של הפסקה. השלמת ההצהרה היא התיקון.
 *
 * מכאן שלוש חובות, והשלישית היא זו שקשה:
 *
 * 1. **הריצה העברית אכן מסומנת** — ובראשן הריצה שכולה נקודה, שהיא המקרה
 *    שדווח: המנוע מפצל את סימן הפיסוק לריצה משלו.
 * 2. **מראת הכתב המורכב נוסעת יחד** — `bCs`/`iCs`/`szCs`/`rFonts@cs`. בלעדיה
 *    התיקון מחליף באג אחד בארבעה: ריצה שסומנה `rtl` מאבדת ב-Word את ההדגשה,
 *    הנטייה, הגודל והגופן, מפני ש-Word קורא אותם מהצד המורכב.
 * 3. **מה שאין לגעת בו** — ריצה לטינית, קוד שדה, `rPr` של סימן
 *    הפסקה, `rPr` שבתוך `rPrChange` (היסטוריה של שינוי מסומן), והצהרה מפורשת
 *    של מי שכתב את הקובץ.
 */
import { describe, it, expect } from 'vitest';
import { markRtlRuns } from '../../src/engine/docx-run-direction';

/** מסמך מינימלי סביב גוף נתון. */
const doc = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:body>${body}</w:body></w:document>`;

/** פסקה עם `w:bidi`, סביב ריצות נתונות. */
const para = (runs: string): string => `<w:p><w:pPr><w:bidi/></w:pPr>${runs}</w:p>`;

/** ריצה אחת: `rPr` אופציונלית וטקסט. */
const run = (text: string, rPr = ''): string =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;

/** כמה `<w:rtl/>` יש בפלט. */
const rtlCount = (xml: string): number => (xml.match(/<w:rtl\s*\/>/g) ?? []).length;

describe('סימון ריצות עבריות', () => {
  it('ריצה עברית בלי rPr מקבלת rPr עם ההצהרה', () => {
    const out = markRtlRuns(doc(para(run('שלום'))));
    expect(out).not.toBeNull();
    expect(out).toContain('<w:r><w:rPr><w:rtl/></w:rPr><w:t');
  });

  it('ריצה עברית עם rPr מקבלת את ההצהרה בסופה', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:color w:val="FF0000"/>'))));
    expect(out).toContain('<w:rPr><w:color w:val="FF0000"/><w:rtl/></w:rPr>');
  });

  it('ריצה שכולה נקודה אחרי ריצה עברית מסומנת — זה המקרה שדווח', () => {
    const out = markRtlRuns(doc(para(run('שלום') + run('.'))));
    expect(rtlCount(out ?? '')).toBe(2);
  });

  it('ריצה ניטרלית לפני ריצה עברית מסומנת גם היא', () => {
    const out = markRtlRuns(doc(para(run('(') + run('שלום'))));
    expect(rtlCount(out ?? '')).toBe(2);
  });

  it('ריצה לטינית ונקודה שאחריה אינן נוגעות', () => {
    expect(markRtlRuns(doc(para(run('hello') + run('.')) + para(run('שלום'))))).toContain(
      '<w:r><w:t xml:space="preserve">hello</w:t></w:r><w:r><w:t xml:space="preserve">.</w:t></w:r>',
    );
  });

  it('ריצה עברית עם „&” מסומנת — הישות אינה אותיות לטיניות', () => {
    // `&amp;` בטקסט הגולמי הוא שלוש אותיות לטיניות. בלי פענוח, הריצה סווגה
    // כמעורבת ולא סומנה כלל.
    const out = markRtlRuns(doc(para(run('שלום &amp; עולם.'))));
    expect(out).toContain('<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">שלום &amp; עולם.</w:t></w:r>');
  });

  it('ריצה שכולה קוד שדה אינה מסומנת', () => {
    const body = para(`<w:r><w:instrText>PAGE</w:instrText></w:r>` + run('שלום'));
    expect(rtlCount(markRtlRuns(doc(body)) ?? '')).toBe(1);
  });

  it('מסמך בלי עברית אינו נוגע כלל', () => {
    expect(markRtlRuns(doc(para(run('hello world'))))).toBeNull();
  });

  it('פסקה שכולה ניטרלית אינה מסומנת', () => {
    expect(markRtlRuns(doc(para(run('...')) + para(run('שלום'))))).toContain(
      '<w:r><w:t xml:space="preserve">...</w:t></w:r>',
    );
  });
});

describe('מראת הכתב המורכב', () => {
  it('הדגשה מקבלת bCs מיד אחריה', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:b/>'))));
    expect(out).toContain('<w:b/><w:bCs/>');
  });

  it('הדגשה מכובה אינה מקבלת bCs', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:b w:val="0"/>'))));
    expect(out).not.toContain('bCs');
  });

  it('bCs שכבר קיימת אינה מוכפלת', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:b/><w:bCs/>'))));
    expect((out?.match(/bCs/g) ?? []).length).toBe(1);
  });

  it('נטייה מקבלת iCs', () => {
    expect(markRtlRuns(doc(para(run('שלום', '<w:i/>'))))).toContain('<w:i/><w:iCs/>');
  });

  it('גודל מקבל szCs באותו ערך', () => {
    expect(markRtlRuns(doc(para(run('שלום', '<w:sz w:val="36"/>'))))).toContain(
      '<w:sz w:val="36"/><w:szCs w:val="36"/>',
    );
  });

  it('גופן לטיני מועתק ל-w:cs בתוך אותו תג', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:rFonts w:ascii="David" w:hAnsi="David"/>'))));
    expect(out).toContain('<w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>');
  });

  it('w:cs שכבר קיים אינו נדרס', () => {
    const rPr = '<w:rFonts w:ascii="David" w:cs="Narkisim"/>';
    expect(markRtlRuns(doc(para(run('שלום', rPr))))).toContain(rPr);
  });

  it('ארבע התכונות יחד, בסדר שהמנוע כותב אותן', () => {
    const rPr = '<w:rFonts w:ascii="David" w:hAnsi="David"/><w:sz w:val="36"/><w:i/><w:b/>';
    const out = markRtlRuns(doc(para(run('שלום', rPr)))) ?? '';
    expect(out).toContain('w:cs="David"');
    expect(out).toContain('<w:sz w:val="36"/><w:szCs w:val="36"/>');
    expect(out).toContain('<w:i/><w:iCs/>');
    expect(out).toContain('<w:b/><w:bCs/>');
    expect(out).toContain('<w:rtl/></w:rPr>');
  });
});

describe('מה שאין לגעת בו', () => {
  it('הצהרה מפורשת אינה מוכפלת, אבל המראה כן מושלמת', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:b/><w:rtl/>'))));
    expect(rtlCount(out ?? '')).toBe(1);
    expect(out).toContain('<w:b/><w:bCs/>');
  });

  it('הצהרה מכובה אינה נהפכת ואינה גוררת מראה', () => {
    expect(markRtlRuns(doc(para(run('שלום', '<w:b/><w:rtl w:val="0"/>'))))).toBeNull();
  });

  it('rPr שבתוך rPrChange היא היסטוריה, וההצהרה נכנסת לעיצוב החי בלבד', () => {
    const rPr =
      '<w:rPr><w:b/><w:rPrChange w:id="1" w:author="a"><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr>';
    const out = markRtlRuns(doc(para(`<w:r>${rPr}<w:t>שלום</w:t></w:r>`))) ?? '';
    expect(rtlCount(out)).toBe(1);
    // ההיסטוריה נשארה כפי שהייתה: הנטייה שבתוכה לא קיבלה iCs.
    expect(out).toContain('<w:rPr><w:i/></w:rPr></w:rPrChange>');
    expect(out).toContain('<w:b/><w:bCs/>');
  });

  it('rPr של סימן הפסקה אינה מקבלת הצהרה', () => {
    const body = `<w:p><w:pPr><w:bidi/><w:rPr><w:b/></w:rPr></w:pPr>${run('שלום')}</w:p>`;
    const out = markRtlRuns(doc(body)) ?? '';
    expect(rtlCount(out)).toBe(1);
    expect(out).toContain('<w:pPr><w:bidi/><w:rPr><w:b/></w:rPr></w:pPr>');
  });

  it('סימן הפסקה של תיבת טקסט אינו נחשב ה-rPr של הריצה שעוטפת אותה', () => {
    // הריצה החיצונית עברית ולכן תסומן. `pPr/rPr` של הפסקה שבתוך התיבה יושבת
    // **בתוכה**, ובלי זיהוי של `pPr` ההצהרה הייתה נכתבת לתוך סימן הפסקה
    // הפנימי במקום על הריצה עצמה.
    const inner = `<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>${run('hello')}</w:p>`;
    const body = `<w:p><w:r><w:t>שלום</w:t><w:drawing><w:txbxContent>${inner}</w:txbxContent></w:drawing></w:r></w:p>`;
    const out = markRtlRuns(doc(body)) ?? '';
    expect(out).toContain('<w:r><w:rPr><w:rtl/></w:rPr><w:t>שלום</w:t>');
    expect(out).toContain('<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>');
  });

  it('ריצה בתוך תיבת טקסט נפתרת בפסקה שלה, ולא בזו שעוטפת אותה', () => {
    const inner = `<w:p>${run('שלום')}</w:p>`;
    const body = para(`<w:r><w:drawing><w:txbxContent>${inner}</w:txbxContent></w:drawing></w:r>` + run('hello'));
    const out = markRtlRuns(doc(body)) ?? '';
    // רק הריצה הפנימית עברית; החיצונית אינה נושאת טקסט, והלטינית שלצדה לא תסומן.
    expect(rtlCount(out)).toBe(1);
    expect(out).toContain('<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">שלום</w:t></w:r>');
  });

  it('ריצה שיושבת בתוך הערה אינה קיימת', () => {
    // ההערה **בתוך** הפסקה, ולא לצדה: סורק שאינו בולע הערות היה מוסיף את
    // הריצה המדומה לרשימת הריצות של הפסקה הזאת ומסמן אותה. הערה שיושבת ישירות
    // ב-`body` אינה בודקת דבר, מפני שאין פסקה פתוחה שתאסוף אותה.
    const body = para(`<!-- ${run('שלום')} -->` + run('hello'));
    expect(markRtlRuns(doc(body))).toBeNull();
  });

  it('הרצה שנייה על הפלט אינה משנה דבר', () => {
    const once = markRtlRuns(doc(para(run('שלום', '<w:b/><w:sz w:val="36"/>') + run('.'))));
    expect(once).not.toBeNull();
    expect(markRtlRuns(once as string)).toBeNull();
  });
});

/** הריצות של הפסקה הראשונה: הטקסט של כל אחת, והאם היא מוצהרת `rtl`. */
function runsOf(xml: string): { text: string; rtl: boolean; rPr: string }[] {
  const paragraph = xml.match(/<w:p>[\s\S]*?<\/w:p>/)?.[0] ?? '';
  return (paragraph.match(/<w:r>[\s\S]*?<\/w:r>/g) ?? []).map((r) => ({
    text: (r.match(/<w:t[^>]*>([^<]*)<\/w:t>/) ?? [])[1] ?? '',
    rtl: /<w:rtl\/>/.test(r),
    rPr: (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) ?? [''])[0],
  }));
}

const ltrPara = (runs: string): string => `<w:p>${runs}</w:p>`;

describe('ריצה מעורבת מפוצלת לפי כיוון', () => {
  it('„מילה Word בעברית.” — שלוש ריצות, והלטינית נשארת לטינית', () => {
    // זה מה שהעורך כותב, ונמדד שבורי ב-Word: סדר המילים הפוך והנקודה בתחילת
    // השורה. שלוש הריצות האלה נמדדו מוצגות נכון, עם הגופן הלטיני במקומו.
    const out = markRtlRuns(doc(para(run('מילה Word בעברית.')))) ?? '';
    expect(runsOf(out)).toEqual([
      { text: 'מילה ', rtl: true, rPr: '<w:rPr><w:rtl/></w:rPr>' },
      { text: 'Word', rtl: false, rPr: '' },
      { text: ' בעברית.', rtl: true, rPr: '<w:rPr><w:rtl/></w:rPr>' },
    ]);
  });

  it('העיצוב נשמר בכל הקטעים, והמראה רק בעבריים', () => {
    const out = markRtlRuns(doc(para(run('שלום world', '<w:b/><w:sz w:val="28"/>')))) ?? '';
    expect(runsOf(out)).toEqual([
      { text: 'שלום ', rtl: true, rPr: '<w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/><w:rtl/></w:rPr>' },
      { text: 'world', rtl: false, rPr: '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr>' },
    ]);
  });

  it('תכונות התג של הריצה משוכפלות לכל הקטעים', () => {
    const body = para(`<w:r w:rsidR="00AB12"><w:t xml:space="preserve">שלום world</w:t></w:r>`);
    const out = markRtlRuns(doc(body)) ?? '';
    expect(out.match(/<w:r w:rsidR="00AB12">/g)).toHaveLength(2);
  });

  it('ספרות הולכות אחרי העברית שלפניהן, והרווח שאחריהן — אחרי כיוון הפסקה', () => {
    const out = markRtlRuns(doc(para(run('פרק 12 about')))) ?? '';
    expect(runsOf(out).map(({ text, rtl }) => [text, rtl])).toEqual([
      ['פרק 12 ', true],
      ['about', false],
    ]);
  });

  it('ספרות אחרי לטינית — לטיניות', () => {
    const out = markRtlRuns(doc(para(run('שלום ver 2 סוף')))) ?? '';
    expect(runsOf(out).map(({ text, rtl }) => [text, rtl])).toEqual([
      ['שלום ', true],
      ['ver 2', false],
      [' סוף', true],
    ]);
  });

  it('בפסקה משמאל לימין הניטרליים שבין הכיוונים הולכים עם הפסקה', () => {
    const out = markRtlRuns(doc(ltrPara(run('abc שלום def.')))) ?? '';
    expect(runsOf(out).map(({ text, rtl }) => [text, rtl])).toEqual([
      ['abc ', false],
      ['שלום', true],
      [' def.', false],
    ]);
  });

  it('w:bidi של sectPr שבתוך pPr אינו כיוון הפסקה', () => {
    const body = `<w:p><w:pPr><w:sectPr><w:bidi/></w:sectPr></w:pPr>${run('abc שלום.')}</w:p>`;
    const out = markRtlRuns(doc(body)) ?? '';
    expect(runsOf(out).map(({ text, rtl }) => [text, rtl])).toEqual([
      ['abc ', false],
      ['שלום', true],
      ['.', false],
    ]);
  });

  it('ישויות מפוענחות לסיווג ומקודדות מחדש בפלט', () => {
    const out = markRtlRuns(doc(para(run('מילה A&amp;B סוף')))) ?? '';
    expect(out).toContain('<w:t xml:space="preserve">A&amp;B</w:t>');
    expect(runsOf(out).map(({ text, rtl }) => [text, rtl])).toEqual([
      ['מילה ', true],
      ['A&amp;B', false],
      [' סוף', true],
    ]);
  });

  it('נקודה בריצה משלה אחרי ריצה מעורבת יורשת מהתו שבקצה שלה', () => {
    const out = markRtlRuns(doc(para(run('מילה Word בעברית') + run('.')))) ?? '';
    const runs = runsOf(out);
    expect(runs[runs.length - 1]).toEqual({ text: '.', rtl: true, rPr: '<w:rPr><w:rtl/></w:rPr>' });
  });

  it('ריצה עם טאב אינה מפוצלת', () => {
    const body = para(`<w:r><w:t>שלום</w:t><w:tab/><w:t>world</w:t></w:r>`);
    expect(markRtlRuns(doc(body))).toBeNull();
  });

  it('ריצה עם rPrChange אינה מפוצלת — המזהה היה משוכפל', () => {
    const rPr = '<w:b/><w:rPrChange w:id="7" w:author="a"><w:rPr/></w:rPrChange>';
    expect(markRtlRuns(doc(para(run('שלום world', rPr))))).toBeNull();
  });

  it('ריצה מעורבת שכבר מצהירה rtl אינה מפוצלת, אבל המראה מושלמת', () => {
    const out = markRtlRuns(doc(para(run('שלום world', '<w:b/><w:rtl/>')))) ?? '';
    expect(runsOf(out)).toHaveLength(1);
    expect(out).toContain('<w:b/><w:bCs/><w:rtl/>');
  });

  it('ריצה מעורבת שמצהירה rtl מכובה אינה נוגעת', () => {
    expect(markRtlRuns(doc(para(run('שלום world', '<w:rtl w:val="0"/>'))))).toBeNull();
  });

  it('הרצה שנייה על פלט מפוצל אינה משנה דבר', () => {
    const once = markRtlRuns(doc(para(run('מילה Word בעברית.', '<w:i/>'))));
    expect(once).not.toBeNull();
    expect(markRtlRuns(once as string)).toBeNull();
  });
});

describe('סדר האיברים ב-rPr', () => {
  it('w:rtl נכתב לפני w:lang', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:b/><w:lang w:bidi="he-IL"/>'))));
    expect(out).toContain('<w:b/><w:bCs/><w:rtl/><w:lang w:bidi="he-IL"/></w:rPr>');
  });

  it('w:rtl נכתב לפני w:em ו-w:cs', () => {
    expect(markRtlRuns(doc(para(run('שלום', '<w:em w:val="dot"/>'))))).toContain('<w:rtl/><w:em w:val="dot"/>');
    expect(markRtlRuns(doc(para(run('שלום', '<w:cs/>'))))).toContain('<w:rtl/><w:cs/>');
  });

  it('w:rtl נכתב לפני w:rPrChange, ולא אחרי ההיסטוריה', () => {
    const rPr = '<w:b/><w:rPrChange w:id="1" w:author="a"><w:rPr><w:i/></w:rPr></w:rPrChange>';
    const out = markRtlRuns(doc(para(run('שלום', rPr))));
    expect(out).toContain('<w:b/><w:bCs/><w:rtl/><w:rPrChange');
  });

  it('szCs לפני rtl כשהם נופלים באותו מקום', () => {
    const out = markRtlRuns(doc(para(run('שלום', '<w:sz w:val="36"/><w:lang w:val="he-IL"/>'))));
    expect(out).toContain('<w:sz w:val="36"/><w:szCs w:val="36"/><w:rtl/><w:lang w:val="he-IL"/>');
  });
});

