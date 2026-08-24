/**
 * ברירות המחדל של מסמך חדש. הבדיקה כאן היא על **מה נשלח למנוע** ועל הדיווח;
 * שההחלה אכן עובדת במנוע האמיתי נבדק ב-`npm run check:rtl` על ה-dist.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  applyHebrewDocumentDefaults,
  type DefaultsDocumentApi,
} from '../../src/engine/document-defaults';

function fakeDoc(overrides: Partial<DefaultsDocumentApi> = {}) {
  const calls: Array<{ op: string; input: unknown }> = [];
  const doc: DefaultsDocumentApi = {
    blocks: {
      list: () => Promise.resolve({ blocks: [{ nodeId: 'p1', nodeType: 'paragraph' }] }),
    },
    sections: {
      list: () => Promise.resolve({ items: [{ address: { kind: 'section', sectionId: 's0' } }] }),
      setSectionDirection: (input) => {
        calls.push({ op: 'sections.setSectionDirection', input });
        return { success: true };
      },
    },
    styles: {
      apply: (input) => {
        calls.push({ op: 'styles.apply', input });
        return { success: true };
      },
    },
    format: {
      paragraph: {
        setDirection: (input) => {
          calls.push({ op: 'format.paragraph.setDirection', input });
          return { success: true };
        },
      },
    },
    ...overrides,
  };
  return { doc, calls, host: { activeEditor: { doc } } };
}

describe('applyHebrewDocumentDefaults', () => {
  it('מחילה שלוש שכבות: docDefaults, מקטע ופסקה', async () => {
    const { host, calls } = fakeDoc();

    const report = await applyHebrewDocumentDefaults(host);

    expect(report.failures).toEqual([]);
    expect(report.applied).toEqual(['docDefaults', 'section', 'paragraph']);
    expect(calls.map((call) => call.op)).toEqual([
      'styles.apply',
      'sections.setSectionDirection',
      'format.paragraph.setDirection',
    ]);
  });

  it('ברירת המחדל של הגלריה היא w:bidi בערוץ הפסקה', async () => {
    // זו השכבה שקובעת לכל פסקה שתיווצר, ולכן היא זו שעונה על „מסמך חדש
    // נפתח מימין לשמאל” — ולא רק הפסקה הראשונה.
    const { host, calls } = fakeDoc();

    await applyHebrewDocumentDefaults(host);

    expect(calls[0]!.input).toEqual({
      target: { scope: 'docDefaults', channel: 'paragraph' },
      patch: { rightToLeft: true },
    });
  });

  it('אינה מבקשת יישור מפורש — preserve ולא matchDirection', async () => {
    // נמדד על המנוע: `matchDirection` כותב alignment: 'left' בפסקה RTL, כלומר
    // יישור פיזי לשמאל. `w:bidi` בלי `w:jc` הוא מה ש-Word עושה, והטקסט נצמד
    // לימין מעצמו.
    const { host, calls } = fakeDoc();

    await applyHebrewDocumentDefaults(host);

    const paragraph = calls.find((call) => call.op === 'format.paragraph.setDirection');
    expect(paragraph!.input).toEqual({
      target: { kind: 'block', nodeType: 'paragraph', nodeId: 'p1' },
      direction: 'rtl',
      alignmentPolicy: 'preserve',
    });
  });

  it('מדווחת על קבלה שנכשלה, עם הקוד של המנוע', async () => {
    const { host } = fakeDoc({
      styles: {
        apply: () => ({ success: false, failure: { code: 'DOCUMENT_READONLY' } }),
      },
    });

    const report = await applyHebrewDocumentDefaults(host);

    expect(report.failures).toEqual(['ברירת המחדל של הגלריה נכשלה (DOCUMENT_READONLY)']);
    // שכבה שנכשלה אינה עוצרת את השאר: מקטע ופסקה עדיין הוחלו.
    expect(report.applied).toEqual(['section', 'paragraph']);
  });

  it('אינה זורקת כשפעולה במנוע זורקת', async () => {
    // כשל בכיווניות אינו סיבה להפיל פתיחת מסמך.
    const { host } = fakeDoc({
      sections: {
        list: () => {
          throw new Error('boom');
        },
      },
    });

    const report = await applyHebrewDocumentDefaults(host);

    expect(report.failures).toEqual(['כיווניות המקטע שגתה: boom']);
    expect(report.applied).toEqual(['docDefaults', 'paragraph']);
  });

  it('מדווחת כשהמנוע אינו חושף Document API', async () => {
    const report = await applyHebrewDocumentDefaults({ activeEditor: null });

    expect(report.applied).toEqual([]);
    expect(report.failures).toEqual(['המנוע אינו חושף את ה-Document API']);
  });

  it('מדווחת על פעולה שאינה קיימת בגרסת המנוע', async () => {
    // גרסה עתידית שתסיר פעולה לא תיפול בשקט.
    const { host } = fakeDoc({ styles: {} });

    const report = await applyHebrewDocumentDefaults(host);

    expect(report.failures).toEqual(['ברירת המחדל של הגלריה אינה נתמכת במנוע']);
  });

  it('סובלת קבלה סינכרונית וקבלה כהבטחה', async () => {
    // הפאסדה בדפדפן א-סינכרונית, ואותו קוד רץ גם מול מימוש סינכרוני.
    const { host } = fakeDoc({
      styles: { apply: () => Promise.resolve({ success: true }) },
    });

    const report = await applyHebrewDocumentDefaults(host);

    expect(report.failures).toEqual([]);
  });

  it('אינה נוגעת במנוע יותר מפעם אחת לכל שכבה', async () => {
    const apply = vi.fn(() => ({ success: true }));
    const { host } = fakeDoc({ styles: { apply } });

    await applyHebrewDocumentDefaults(host);

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
