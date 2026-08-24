/**
 * בדיקת היסוד שכל הפקדים החדשים נשענים עליו.
 *
 * מה שנבדק כאן הוא ההתנהגות שהמודול נכתב בשבילה: **נכשל סגור**. כל תשובה
 * חלקית, חסרה, זרוקה או שאינה אובייקט חייבת להסתיים ב-`false` עם סיבה — כי
 * `true` בטעות אחת כאן מחזיר בדיוק את התקלה שהתוסף סבל ממנה: כפתור שנראה
 * עובד ואינו עובד.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DOC_CAPABILITY_QUESTIONS,
  readDocCapabilities,
  type CapabilitiesHost,
  type DocCapabilityQuestion,
} from '../../src/engine/doc-capabilities';

/** מפה מלאה שכל מה שהממשק שואל עליו זמין בה. */
function fullCapabilities() {
  return {
    global: {
      trackChanges: { enabled: true },
      comments: { enabled: true },
      lists: { enabled: true },
      dryRun: { enabled: true },
      history: { enabled: true },
    },
    operations: {
      'sections.setPageMargins': { available: true },
      'sections.setPageSetup': { available: true },
      'sections.setColumns': { available: true },
      'sections.setSectionDirection': { available: true },
      'sections.setBreakType': { available: true },
      'sections.setPageBorders': { available: true },
      'format.vertAlign': { available: true },
      'footnotes.insert': { available: true },
      'format.paragraph.setFlowOptions': { available: true },
      insert: { available: true },
      'create.image': { available: true },
      'hyperlinks.insert': { available: true },
      'create.sectionBreak': { available: true },
      'create.tableOfContents': { available: true },
      'create.table': { available: true },
      'headerFooters.parts.create': { available: true },
      'sections.setTitlePage': { available: true },
      'sections.setOddEvenHeadersFooters': { available: true },
      'headerFooters.refs.setLinkedToPrevious': { available: true },
      'fields.insert': { available: true },
      'fields.rebuild': { available: true },
      'comments.create': { available: true },
      'clipboard.serializeSelection': { available: true },
      'clipboard.insert': { available: true },
      delete: { available: true },
      'ranges.resolve': { available: true },
    },
  };
}

function hostWith(get: () => unknown): CapabilitiesHost {
  return { activeEditor: { doc: { capabilities: { get: get as never } } } };
}

describe('readDocCapabilities', () => {
  it('עונה כן לכל השאלות כשהמנוע מדווח שהכול זמין', async () => {
    const report = await readDocCapabilities(hostWith(() => fullCapabilities()));

    expect(report.available).toBe(true);
    const denied = DOC_CAPABILITY_QUESTIONS.filter((q) => !report.can(q));
    expect(denied).toEqual([]);
  });

  it('שאלה זמינה אינה נושאת סיבה ואינה נושאת הסבר', async () => {
    const report = await readDocCapabilities(hostWith(() => fullCapabilities()));

    expect(report.reasons('canSetPageMargins')).toEqual([]);
    expect(report.explain('canSetPageMargins')).toBe('');
  });

  it('סובלת גם קריאה שמחזירה הבטחה — הפאסדה בדפדפן א-סינכרונית', async () => {
    const report = await readDocCapabilities(hostWith(() => Promise.resolve(fullCapabilities())));

    expect(report.available).toBe(true);
    expect(report.can('canInsertFootnote')).toBe(true);
  });

  it('קוראת ליכולות פעם אחת בלבד', async () => {
    // הדוח הוא תצלום. קריאה לכל שאלה הייתה מייצרת עשרות קריאות למנוע בכל
    // רינדור של הרצועה.
    const get = vi.fn(() => fullCapabilities());
    const report = await readDocCapabilities(hostWith(get));
    for (const question of DOC_CAPABILITY_QUESTIONS) report.can(question);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('אין Document API — הכול false עם DOCUMENT_API_UNAVAILABLE', async () => {
    for (const host of [
      null,
      undefined,
      {} as CapabilitiesHost,
      { activeEditor: null } as CapabilitiesHost,
      { activeEditor: { doc: null } } as CapabilitiesHost,
      { activeEditor: { doc: {} } } as CapabilitiesHost,
    ]) {
      const report = await readDocCapabilities(host);

      expect(report.available).toBe(false);
      for (const question of DOC_CAPABILITY_QUESTIONS) {
        expect(report.can(question), question).toBe(false);
        expect(report.reasons(question)).toEqual(['DOCUMENT_API_UNAVAILABLE']);
      }
      expect(report.explain('canSetPageMargins')).toBe('המסמך עדיין נטען');
    }
  });

  it('גרסה שאין בה `get` אינה מפילה ואינה מאשרת', async () => {
    const host = { activeEditor: { doc: { capabilities: {} } } } as CapabilitiesHost;

    const report = await readDocCapabilities(host);

    expect(report.available).toBe(false);
    expect(report.can('canSetColumns')).toBe(false);
  });

  it('קריאה שזורקת נכשלת סגור ואינה מפילה את הרצועה', async () => {
    const report = await readDocCapabilities(
      hostWith(() => {
        throw new Error('boom');
      }),
    );

    expect(report.available).toBe(false);
    expect(report.can('canSetPageMargins')).toBe(false);
  });

  it('הבטחה שנדחית נכשלת סגור', async () => {
    const report = await readDocCapabilities(hostWith(() => Promise.reject(new Error('boom'))));

    expect(report.available).toBe(false);
    expect(report.can('canSetPageMargins')).toBe(false);
  });

  it('תשובה שאינה אובייקט אינה תשובה', async () => {
    for (const value of [null, undefined, 'yes', 42, true]) {
      const report = await readDocCapabilities(hostWith(() => value));

      expect(report.available, String(value)).toBe(false);
      expect(report.can('canSetPageSetup')).toBe(false);
    }
  });

  it('מפה חלקית: פעולה שאינה בטבלה מקבלת OPERATION_UNAVAILABLE', async () => {
    // גרסה עתידית שתסיר פעולה תיראה בממשק ככפתור מנוטרל, לא ככפתור מת.
    const partial = fullCapabilities();
    delete (partial.operations as Record<string, unknown>)['sections.setColumns'];

    const report = await readDocCapabilities(hostWith(() => partial));

    expect(report.can('canSetColumns')).toBe(false);
    expect(report.reasons('canSetColumns')).toEqual(['OPERATION_UNAVAILABLE']);
    expect(report.explain('canSetColumns')).toBe('הפעולה אינה זמינה בגרסה הזאת של המנוע');
    // שאר השאלות לא נפגעו.
    expect(report.can('canSetPageMargins')).toBe(true);
  });

  it('namespace חסר: הערת שוליים מנוטרלת עם „אינו זמין בגרסה זו”', async () => {
    // `footnotes` הוא adapter אופציונלי בחוזה; כשהוא חסר המנוע מסמן את כל
    // הפעולות שלו NAMESPACE_UNAVAILABLE, וזה בדיוק הנוסח שהתכנית דורשת ב-§12.
    const raw = fullCapabilities();
    raw.operations['footnotes.insert'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canInsertFootnote')).toBe(false);
    expect(report.reasons('canInsertFootnote')).toEqual(['NAMESPACE_UNAVAILABLE']);
    expect(report.explain('canInsertFootnote')).toBe('אינו זמין בגרסה זו');
  });

  it('namespace הלוח חסר: „העתק” מנוטרל, ו„מחק” אינו נפגע', async () => {
    // `clipboard` הוא adapter אופציונלי בחוזה, בדיוק כמו `footnotes`. שתי
    // השאלות מופרדות כדי שמנוע כזה יוכל להשאיר „גזור” מנוטרל בלי לנטרל את
    // המחיקה עצמה — ולהיפך.
    const raw = fullCapabilities();
    raw.operations['clipboard.serializeSelection'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canCopySelection')).toBe(false);
    expect(report.explain('canCopySelection')).toBe('אינו זמין בגרסה זו');
    expect(report.can('canDeleteSelection')).toBe(true);
  });

  it('namespace הכותרות חסר: „כותרת עליונה” מנוטרל, והמתגים של `sections` לא', async () => {
    // `headerFooters` הוא namespace נפרד מ-`sections`, ומנוע שאין בו אותו
    // עדיין יודע „שונה בעמוד ראשון” — זו פעולה של `sections`. שתי השאלות
    // מופרדות בדיוק כדי שהפקדים לא ייכבו יחד בלי סיבה.
    const raw = fullCapabilities();
    raw.operations['headerFooters.parts.create'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;
    raw.operations['headerFooters.refs.setLinkedToPrevious'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canEditHeaderFooter')).toBe(false);
    expect(report.explain('canEditHeaderFooter')).toBe('אינו זמין בגרסה זו');
    expect(report.can('canLinkToPrevious')).toBe(false);
    expect(report.can('canSetTitlePage')).toBe(true);
    expect(report.can('canSetOddEvenHeaders')).toBe(true);
  });

  it('namespace השדות חסר: „מספר עמוד” ו„עדכן שדות” מנוטרלים יחד', async () => {
    // `fields` הוא namespace שלם, ומנוע שאין בו אותו אינו יודע לא להכניס שדה
    // ולא לחשב אותו מחדש. שתי השאלות עדיין נפרדות (ראו CAPABILITY_SPECS),
    // ולכן הבדיקה מוודאת ששתיהן נכבות — ולא שאחת גוררת את השנייה.
    const raw = fullCapabilities();
    raw.operations['fields.insert'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;
    raw.operations['fields.rebuild'] = {
      available: false,
      reasons: ['NAMESPACE_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canInsertField')).toBe(false);
    expect(report.explain('canInsertField')).toBe('אינו זמין בגרסה זו');
    expect(report.can('canRebuildFields')).toBe(false);
  });

  it('מנוע שיודע להכניס שדה ואינו יודע לחשב מחדש: גם ההכנסה מנוטרלת', async () => {
    // הבדיקה הזאת קיבעה קודם את ההפך — „ההכנסה נשארת פעילה” — מתוך הנחה שאין
    // לה תלות ב-`rebuild`. יש: `fields.insert` מכניס שדה עם תוצאה **ריקה**,
    // וה-rebuild הוא שמחשב אותה. בלעדיו המשתמש מקבל דיווח „בוצע” ורואה מקום
    // ריק במסמך. שדה שאי אפשר לראות אינו פיצ'ר, ולכן הכפתור מנוטרל עם הסבר.
    const raw = fullCapabilities();
    raw.operations['fields.rebuild'] = {
      available: false,
      reasons: ['OPERATION_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canInsertField')).toBe(false);
    expect(report.explain('canInsertField')).toBe('הפעולה אינה זמינה בגרסה הזאת של המנוע');
    expect(report.can('canRebuildFields')).toBe(false);
  });

  it('מנוע שיודע לחשב מחדש ואינו יודע להכניס: „עדכן שדות” נשאר פעיל', async () => {
    // זו הסיבה ששתי השאלות נשארו נפרדות אחרי שההכנסה נעשתה תלויה גם ב-rebuild:
    // הן אינן זהות. מסמך שכבר יש בו שדות עדיין ניתן לעדכון גם כשאי אפשר
    // להוסיף שדה חדש.
    const raw = fullCapabilities();
    raw.operations['fields.insert'] = {
      available: false,
      reasons: ['OPERATION_UNAVAILABLE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canInsertField')).toBe(false);
    expect(report.can('canRebuildFields')).toBe(true);
  });

  it('`available` שאינו בדיוק true אינו „כן”', async () => {
    // המנוע מחזיר boolean, אבל תשובה מ-worker שעברה סריאליזציה עלולה להגיע
    // כמחרוזת. „truthy” אינו „זמין”.
    const raw = fullCapabilities();
    raw.operations['sections.setPageMargins'] = { available: 'true' } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canSetPageMargins')).toBe(false);
  });

  it('דגל global כבוי חוסם גם כשהפעולה זמינה', async () => {
    // „תגובה חדשה” דורשת גם את הפעולה וגם את הדגל: הראשון אומר שהיא קיימת,
    // השני שהיא מאופשרת במסמך הזה.
    const raw = fullCapabilities();
    raw.global.comments = { enabled: false, reasons: ['COLLABORATION_ACTIVE'] } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canAddComment')).toBe(false);
    expect(report.reasons('canAddComment')).toEqual(['COLLABORATION_ACTIVE']);
    expect(report.can('canInsertFootnote')).toBe(true);
  });

  it('מעקב אחר שינויים נשען על הדגל הגלובלי בלבד', async () => {
    const raw = fullCapabilities();
    raw.global.trackChanges = { enabled: false } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canTrackChanges')).toBe(false);
    expect(report.reasons('canTrackChanges')).toEqual(['OPERATION_UNAVAILABLE']);
  });

  it('אין `global` ואין `operations` — הכול סגור, אבל ה-API עצמו זמין', async () => {
    const report = await readDocCapabilities(hostWith(() => ({})));

    expect(report.available).toBe(true);
    const allowed = DOC_CAPABILITY_QUESTIONS.filter((q) => report.can(q));
    expect(allowed).toEqual([]);
  });

  it('קוד סיבה שאיננו מכירים אינו מפיל ואינו מוצג כזבל', async () => {
    const raw = fullCapabilities();
    raw.operations['sections.setColumns'] = {
      available: false,
      reasons: ['SOME_FUTURE_CODE'],
    } as never;

    const report = await readDocCapabilities(hostWith(() => raw));

    expect(report.can('canSetColumns')).toBe(false);
    // הקוד הלא-מוכר נופל, ובמקומו נשארת סיבה גנרית עם הסבר בעברית.
    expect(report.reasons('canSetColumns')).toEqual(['OPERATION_UNAVAILABLE']);
    expect(report.explain('canSetColumns')).not.toBe('');
  });

  it('שאלה שאינה מוכרת מקבלת תשובה סגורה ולא undefined', async () => {
    const report = await readDocCapabilities(hostWith(() => fullCapabilities()));
    const bogus = 'canDoSomethingElse' as DocCapabilityQuestion;

    expect(report.can(bogus)).toBe(false);
    expect(report.explain(bogus)).toBe('המסמך עדיין נטען');
  });
});
