/**
 * איחוד הריצות משנה את המסמך שיישמר, ולכן החובה כאן כפולה: לאחד את מה שזהה,
 * ו**לא לגעת** בכל מה שאינו בדיוק טקסט באותו עיצוב — טאב, הפניה להערה, שינוי
 * מסומן, סימנייה, הערת XML, נוסחה. רוב הבדיקות כאן הן מהסוג השני.
 */
import { describe, it, expect } from 'vitest';
import { markProofingDirty, mergeFragmentedRuns } from '../../src/engine/docx-run-merge';

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const doc = (body: string, prefix = 'w') =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${prefix}:document xmlns:${prefix}="${NS}"><${prefix}:body><${prefix}:p>${body}</${prefix}:p></${prefix}:body></${prefix}:document>`;
const DAVID = '<w:rPr><w:rFonts w:cs="David"/><w:rtl/></w:rPr>';
const BOLD = '<w:rPr><w:b/><w:bCs/><w:rFonts w:cs="David"/><w:rtl/></w:rPr>';
const run = (text: string, props = DAVID, attrs = ' w:rsidRPr="00AB5FA5"') =>
  `<w:r${attrs}>${props}<w:t xml:space="preserve">${text}</w:t></w:r>`;

describe('mergeFragmentedRuns', () => {
  it('מאחדת ריצות סמוכות בעיצוב זהה, ושומרת את המאפיינים של הראשונה', () => {
    const out = mergeFragmentedRuns(
      doc(run('גיטין ', DAVID, ' w:rsidR="001"') + run('דף ', DAVID, ' w:rsidR="002"') + run('פב')),
    );
    expect(out).toBe(doc(`<w:r w:rsidR="001">${DAVID}<w:t xml:space="preserve">גיטין דף פב</w:t></w:r>`));
  });

  it('מדלגת על `proofErr` שבין הריצות — זה מה שפיצל אותן', () => {
    const out = mergeFragmentedRuns(
      doc(run('א') + '<w:proofErr w:type="spellStart"/>' + run('ב') + '<w:proofErr w:type="spellEnd"/>' + run('ג')),
    );
    expect(out).toContain('<w:t xml:space="preserve">אבג</w:t>');
    expect(out).not.toContain('proofErr');
  });

  it('עיצוב שונה נשאר בריצה נפרדת, והקבוצות משני צדיו מתאחדות כל אחת לעצמה', () => {
    const out = mergeFragmentedRuns(doc(run('א') + run('ב') + run('ג', BOLD) + run('ד', BOLD) + run('ה')));
    expect(out).toBe(
      doc(
        `<w:r w:rsidRPr="00AB5FA5">${DAVID}<w:t xml:space="preserve">אב</w:t></w:r>` +
          `<w:r w:rsidRPr="00AB5FA5">${BOLD}<w:t xml:space="preserve">גד</w:t></w:r>` +
          run('ה'),
      ),
    );
  });

  it('ריצות בלי `rPr` בכלל מתאחדות זו עם זו, ולא עם ריצה שיש לה', () => {
    const plain = (t: string) => `<w:r><w:t>${t}</w:t></w:r>`;
    const out = mergeFragmentedRuns(doc(plain('א') + plain('ב') + run('ג')));
    expect(out).toBe(doc(`<w:r><w:t xml:space="preserve">אב</w:t></w:r>` + run('ג')));
  });

  it('`rPr` ששונה רק בכתיבה נחשב שונה — אין כאן השוואה סמנטית', () => {
    const other = '<w:rPr><w:rtl/><w:rFonts w:cs="David"/></w:rPr>';
    expect(mergeFragmentedRuns(doc(run('א') + run('ב', other)))).toBeNull();
  });

  it('ריצה בלי preserve שיש רווח בקצה שלה אינה מתאחדת — לא מקצצים ולא מוסיפים', () => {
    expect(mergeFragmentedRuns(doc(`<w:r><w:t>א </w:t></w:r><w:r><w:t>ב</w:t></w:r>`))).toBeNull();
    expect(mergeFragmentedRuns(doc(`<w:r><w:t>א</w:t></w:r><w:r><w:t>\tב</w:t></w:r>`))).toBeNull();
  });

  it('גם רווח שכתוב כהפניית תו בקצה נחשב רווח (ממצא QA)', () => {
    for (const edge of ['&#32;', '&#x9;', '&#X20;', '&#0010;', '&#xD;']) {
      expect(mergeFragmentedRuns(doc(`<w:r><w:t>א${edge}</w:t></w:r><w:r><w:t>ב</w:t></w:r>`)), edge).toBeNull();
    }
    // הפניה שאינה רווח, או רווח-הפניה באמצע — מתאחדים כרגיל.
    expect(mergeFragmentedRuns(doc(`<w:r><w:t>א&#1488;</w:t></w:r><w:r><w:t>ב</w:t></w:r>`))).toContain('א&#1488;ב');
    expect(mergeFragmentedRuns(doc(`<w:r><w:t>א&#32;ג</w:t></w:r><w:r><w:t>ב</w:t></w:r>`))).toContain('א&#32;גב');
  });

  it('preserve שהוצהר על אב נשמר: הרווח שבין המילים אינו נמחק (ממצא QA)', () => {
    const xml =
      `<w:document xmlns:w="${NS}"><w:body><w:p xml:space="preserve">` +
      `<w:r><w:t>a </w:t></w:r><w:r><w:t>b</w:t></w:r></w:p></w:body></w:document>`;
    const out = mergeFragmentedRuns(xml);
    expect(out === null || out.includes('a b')).toBe(true);
  });

  it('הדבקה שיוצרת `]]>` כותבת את ה-`>` כישות (ממצא QA)', () => {
    const out = mergeFragmentedRuns(doc(run('c]]') + run('>d')))!;
    expect(out).toContain('<w:t xml:space="preserve">c]]&gt;d</w:t>');
    expect(out).not.toContain(']]>');
  });

  it('רווחים עם preserve נשמרים, וישויות נשארות ישויות', () => {
    const out = mergeFragmentedRuns(doc(run('א &amp; ') + run(' &lt;ב&gt;')));
    expect(out).toContain('<w:t xml:space="preserve">א &amp;  &lt;ב&gt;</w:t>');
  });

  it('אינה מחזירה דבר כשאין מה לאחד', () => {
    expect(mergeFragmentedRuns(doc(run('א')))).toBeNull();
    expect(mergeFragmentedRuns(doc(run('א') + run('ב', BOLD)))).toBeNull();
  });

  describe('מה שאסור לגעת בו', () => {
    const cases: [string, string][] = [
      ['טאב בתוך הריצה', `<w:r>${DAVID}<w:tab/><w:t>ב</w:t></w:r>`],
      ['שבירת שורה', `<w:r>${DAVID}<w:br/><w:t>ב</w:t></w:r>`],
      ['הפניה להערת שוליים', `<w:r>${DAVID}<w:footnoteReference w:id="1"/></w:r>`],
      ['שני `w:t` באותה ריצה', `<w:r>${DAVID}<w:t>ב</w:t><w:t>ג</w:t></w:r>`],
      ['טקסט מחוק', `<w:r>${DAVID}<w:delText>ב</w:delText></w:r>`],
      ['`lastRenderedPageBreak`', `<w:r>${DAVID}<w:lastRenderedPageBreak/><w:t>ב</w:t></w:r>`],
      ['מאפיין שאינו מזהה עריכה על הריצה', `<w:r w:customAttr="x">${DAVID}<w:t>ב</w:t></w:r>`],
      ['מאפיין על `w:t` שאינו preserve', `<w:r>${DAVID}<w:t w:foo="1">ב</w:t></w:r>`],
      ['הערת XML בתוך הריצה', `<w:r>${DAVID}<!-- x --><w:t>ב</w:t></w:r>`],
      ['טקסט בין ילדי הריצה', `<w:r>${DAVID}זבל<w:t>ב</w:t></w:r>`],
    ];
    for (const [label, middle] of cases) {
      it(`${label}: הריצה נשארת, והשכנות אינן מתאחדות דרכה`, () => {
        expect(mergeFragmentedRuns(doc(run('א') + middle + run('ג')))).toBeNull();
      });
    }

    const separators: [string, string][] = [
      ['סימנייה', '<w:bookmarkStart w:id="0" w:name="x"/>'],
      ['תחילת הערה', '<w:commentRangeStart w:id="0"/>'],
      ['הערת XML', '<!-- הערה -->'],
      ['טקסט', 'זבל'],
    ];
    for (const [label, separator] of separators) {
      it(`${label} בין הריצות עוצרת את האיחוד`, () => {
        expect(mergeFragmentedRuns(doc(run('א') + separator + run('ב')))).toBeNull();
      });
    }

    it('ריצות של שינוי מסומן מתאחדות רק בתוך אותו `w:ins`, לא דרך הגבול שלו', () => {
      const ins = (body: string) => `<w:ins w:id="1" w:author="x">${body}</w:ins>`;
      expect(mergeFragmentedRuns(doc(run('א') + ins(run('ב'))))).toBeNull();
      expect(mergeFragmentedRuns(doc(ins(run('א') + run('ב'))))).toBe(
        doc(ins(`<w:r w:rsidRPr="00AB5FA5">${DAVID}<w:t xml:space="preserve">אב</w:t></w:r>`)),
      );
    });

    it('`w:rPrChange` בתוך ה-rPr נשמר כמחרוזת — ומתאחד רק עם זהה', () => {
      const changed = '<w:rPr><w:b/><w:rPrChange w:id="1" w:author="x"><w:rPr/></w:rPrChange></w:rPr>';
      expect(mergeFragmentedRuns(doc(run('א', changed) + run('ב', changed)))).toContain(
        `${changed}<w:t xml:space="preserve">אב</w:t>`,
      );
      expect(mergeFragmentedRuns(doc(run('א', changed) + run('ב', '<w:rPr><w:b/></w:rPr>')))).toBeNull();
    });

    it('ריצות של נוסחה (`m:r`) אינן ריצות Word', () => {
      const math = `<m:oMath xmlns:m="m"><m:r><m:t>x</m:t></m:r><m:r><m:t>y</m:t></m:r></m:oMath>`;
      expect(mergeFragmentedRuns(doc(math))).toBeNull();
    });

    it('בלי הצהרת מרחב השמות של Word אין פעולה', () => {
      const xml = `<w:document xmlns:w="ns"><w:body><w:p>${run('א')}${run('ב')}</w:p></w:body></w:document>`;
      expect(mergeFragmentedRuns(xml)).toBeNull();
    });

    it('ריצות בשתי פסקאות אינן מתאחדות', () => {
      const xml = doc(run('א') + `</w:p><w:p>` + run('ב'));
      expect(mergeFragmentedRuns(xml)).toBeNull();
    });
  });

  it('קידומת שאינה `w` נקראת מההצהרה', () => {
    const r = (t: string) => `<x:r><x:t>${t}</x:t></x:r>`;
    expect(mergeFragmentedRuns(doc(r('א') + r('ב'), 'x'))).toBe(doc(`<x:r><x:t xml:space="preserve">אב</x:t></x:r>`, 'x'));
  });

  it('הטקסט כולו נשמר על מסמך גדול, ומספר הריצות יורד', () => {
    let body = '';
    let expected = '';
    for (let i = 0; i < 2000; i++) {
      const t = `מילה${i} `;
      body += run(t, i % 7 === 0 ? BOLD : DAVID, ` w:rsidR="${String(i).padStart(8, '0')}"`);
      body += i % 3 === 0 ? '<w:proofErr w:type="spellStart"/>' : '';
      expected += t;
    }
    const out = mergeFragmentedRuns(doc(body))!;
    const text = [...out.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    expect(text).toBe(expected);
    expect(out.match(/<w:r[\s>]/g)!.length).toBeLessThan(700);
  });
});

describe('markProofingDirty', () => {
  const settings = (inner: string) => `<w:settings xmlns:w="${NS}">${inner}</w:settings>`;

  it('„clean” הופך ל-„dirty” בשני המאפיינים, ושאר התג נשמר', () => {
    expect(markProofingDirty(settings('<w:zoom w:percent="100"/><w:proofState w:spelling="clean" w:grammar="clean"/>'))).toBe(
      settings('<w:zoom w:percent="100"/><w:proofState w:spelling="dirty" w:grammar="dirty"/>'),
    );
  });

  it('מאפיין אחד „clean” ומרכאות בודדות', () => {
    expect(markProofingDirty(settings(`<w:proofState w:grammar='clean'/>`))).toBe(settings(`<w:proofState w:grammar='dirty'/>`));
  });

  it('אין מה לשנות: אין proofState, או שכבר dirty', () => {
    expect(markProofingDirty(settings('<w:zoom w:percent="100"/>'))).toBeNull();
    expect(markProofingDirty(settings('<w:proofState w:spelling="dirty"/>'))).toBeNull();
  });

  it('אינו כותב בתוך הערת XML', () => {
    const xml = settings('<!-- <w:proofState w:spelling="clean"/> -->');
    expect(markProofingDirty(xml)).toBeNull();
  });
});
