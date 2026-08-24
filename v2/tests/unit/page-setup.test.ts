/**
 * לשונית „פריסה”: מה **בדיוק** נשלח למנוע.
 *
 * הכפיל כאן אינו מקליט קריאות — הוא **מאמת** אותן ואז ממיר אותן ל-OOXML כפי
 * שהמנוע עושה. זו לא הקפדה מיותרת: `tests/unit/ribbon-commands.test.ts` הוא
 * הדוגמה ההפוכה — mock שמחזיר `true` לכל קריאה, וכך אישר בירוק payloads
 * שהמנוע דוחה. שני הכללים שהכפיל אוכף הם אלה שנמדדו במימוש
 * (`@superdoc/docx-engine`):
 *
 *   1. **הוולידציה**: `top/right/bottom/left/gutter/width/height/gap` חייבים
 *      להיות מספר סופי אי-שלילי, `count` מספר שלם חיובי, `paperSize` מחרוזת
 *      לא ריקה, וחייב להגיע לפחות שדה אחד. קלט פסול **זורק**, ואינו מחזיר
 *      קבלה — וזו הסיבה שהמודול עוטף כל קריאה ב-try.
 *   2. **ההמרה**: המנוע כותב `String(Math.round(value * 1440))`. כלומר ה-API
 *      מקבל אינצ'ים, וה-XML נמדד ב-twips. הבדיקות למטה משוות את ה-twips
 *      שנכתבו למספרים שנמדדו ב-`word/document.xml` של המסמך הריק של המנוע:
 *      `w:pgMar w:top="1440"` ו-`w:pgSz w:w="12240" w:h="15840"`.
 */
import { describe, expect, it } from 'vitest';
import {
  COLUMN_GAP_TWIPS,
  MARGIN_PRESETS,
  PAPER_SIZES,
  TWIPS_PER_INCH,
  applyColumns,
  applyMarginPreset,
  applyOrientation,
  applyPaperSize,
  type PageSetupDocumentApi,
  type PageSetupHost,
} from '../../src/engine/page-setup';

/** אותה בדיקה שהמנוע עושה על כל שדה מידה. */
function assertMeasure(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
}

function assertAnyOf(input: Record<string, unknown>, fields: string[], op: string): void {
  if (!fields.some((field) => input[field] !== undefined)) {
    throw new Error(`${op} requires at least one field.`);
  }
}

/** twips מהערך שנשלח, בדיוק כפי שהמנוע כותב אותם ל-XML. */
function toTwips(inches: number): number {
  return Math.round(inches * TWIPS_PER_INCH);
}

interface SectionXml {
  sectionId: string;
  pgMar: Record<string, number>;
  pgSz: { w?: number; h?: number; orient?: string; code?: string };
  cols: { num?: number; space?: number; equalWidth?: boolean };
}

interface FakeOptions {
  /** מזהי המקטעים במסמך. */
  sectionIds?: string[];
  /** מידות התחלה לכל מקטע, ב-twips. ברירת המחדל: Letter לאורך, כמו המסמך הריק. */
  startWidth?: number;
  startHeight?: number;
  /** קבלה חלופית — לבדיקת כשל, NO_OP, או הבטחה. */
  receipt?: () => unknown;
  /** להסיר פעולה מהחוזה, כדי לדמות גרסה שאינה מכירה אותה. */
  omit?: Array<'list' | 'setPageMargins' | 'setPageSetup' | 'setColumns'>;
  /** `list` שזורקת. */
  throwOnList?: boolean;
}

function fakeEngine(options: FakeOptions = {}) {
  const ids = options.sectionIds ?? ['s0'];
  const omit = new Set(options.omit ?? []);
  const calls: Array<{ op: string; input: Record<string, unknown> }> = [];

  const xml = new Map<string, SectionXml>(
    ids.map((sectionId) => [
      sectionId,
      {
        sectionId,
        pgMar: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        pgSz: { w: options.startWidth ?? 12240, h: options.startHeight ?? 15840 },
        cols: { space: 720 },
      },
    ]),
  );

  function sectionOf(input: Record<string, unknown>): SectionXml {
    const target = input.target as { kind?: string; sectionId?: string } | undefined;
    if (!target || target.kind !== 'section' || typeof target.sectionId !== 'string') {
      throw new Error('target must be a section address.');
    }
    const found = xml.get(target.sectionId);
    if (!found) throw new Error('INVALID_TARGET');
    return found;
  }

  const receipt = options.receipt;

  const sections: NonNullable<PageSetupDocumentApi['sections']> = {};

  if (!omit.has('list')) {
    sections.list = () => {
      if (options.throwOnList) throw new Error('boom');
      return Promise.resolve({
        items: ids.map((sectionId, index) => {
          const current = xml.get(sectionId)!;
          return {
            address: { kind: 'section', sectionId },
            index,
            // המנוע מחזיר את המידות ב-Document API; היחס הוא מה שמשמש לזיהוי „לרוחב”.
            pageSetup: {
              width: (current.pgSz.w ?? 0) / TWIPS_PER_INCH,
              height: (current.pgSz.h ?? 0) / TWIPS_PER_INCH,
            },
          };
        }),
      });
    };
  }

  if (!omit.has('setPageMargins')) {
    sections.setPageMargins = (input) => {
      const raw = input as unknown as Record<string, unknown>;
      calls.push({ op: 'sections.setPageMargins', input: raw });
      const section = sectionOf(raw);
      assertAnyOf(raw, ['top', 'right', 'bottom', 'left', 'gutter'], 'sections.setPageMargins');
      for (const field of ['top', 'right', 'bottom', 'left', 'gutter']) {
        if (raw[field] !== undefined) {
          assertMeasure(raw[field], `sections.setPageMargins.${field}`);
          section.pgMar[field] = toTwips(raw[field] as number);
        }
      }
      return (receipt?.() ?? { success: true, section: raw.target }) as never;
    };
  }

  if (!omit.has('setPageSetup')) {
    sections.setPageSetup = (input) => {
      const raw = input as unknown as Record<string, unknown>;
      calls.push({ op: 'sections.setPageSetup', input: raw });
      const section = sectionOf(raw);
      assertAnyOf(raw, ['width', 'height', 'orientation', 'paperSize'], 'sections.setPageSetup');
      if (raw.width !== undefined) {
        assertMeasure(raw.width, 'sections.setPageSetup.width');
        section.pgSz.w = toTwips(raw.width as number);
      }
      if (raw.height !== undefined) {
        assertMeasure(raw.height, 'sections.setPageSetup.height');
        section.pgSz.h = toTwips(raw.height as number);
      }
      if (raw.paperSize !== undefined) {
        if (typeof raw.paperSize !== 'string' || raw.paperSize.trim() === '') {
          throw new Error('sections.setPageSetup.paperSize must be a non-empty string.');
        }
        section.pgSz.code = raw.paperSize;
      }
      if (raw.orientation !== undefined) {
        if (raw.orientation !== 'portrait' && raw.orientation !== 'landscape') {
          throw new Error('sections.setPageSetup.orientation must be portrait or landscape.');
        }
        section.pgSz.orient = raw.orientation;
        // ההחלפה שהמנוע עושה בעצמו כשהיחס אינו מתאים לכיוון המבוקש.
        const { w, h } = section.pgSz;
        if (typeof w === 'number' && typeof h === 'number') {
          if ((raw.orientation === 'landscape' && w <= h) || (raw.orientation === 'portrait' && w > h)) {
            section.pgSz.w = h;
            section.pgSz.h = w;
          }
        }
      }
      return (receipt?.() ?? { success: true, section: raw.target }) as never;
    };
  }

  if (!omit.has('setColumns')) {
    sections.setColumns = (input) => {
      const raw = input as unknown as Record<string, unknown>;
      calls.push({ op: 'sections.setColumns', input: raw });
      const section = sectionOf(raw);
      assertAnyOf(raw, ['count', 'gap', 'equalWidth'], 'sections.setColumns');
      if (raw.count !== undefined) {
        if (!Number.isInteger(raw.count) || (raw.count as number) <= 0) {
          throw new Error('sections.setColumns.count must be a positive integer.');
        }
        section.cols.num = raw.count as number;
      }
      if (raw.gap !== undefined) {
        assertMeasure(raw.gap, 'sections.setColumns.gap');
        section.cols.space = toTwips(raw.gap as number);
      }
      if (raw.equalWidth !== undefined) section.cols.equalWidth = raw.equalWidth as boolean;
      return (receipt?.() ?? { success: true, section: raw.target }) as never;
    };
  }

  const host: PageSetupHost = { activeEditor: { doc: { sections } } };
  return { host, calls, xml };
}

describe('applyMarginPreset', () => {
  it('„רגיל” כותב 1440 twips בכל ארבעת הצדדים', async () => {
    // 1440 twips = אינץ' = 2.54 ס"מ, וזה בדיוק מה שנמדד ב-w:pgMar של המסמך
    // הריק של המנוע.
    const { host, xml } = fakeEngine();

    expect(await applyMarginPreset(host, 'normal')).toEqual({ ok: true });
    expect(xml.get('s0')!.pgMar).toEqual({ top: 1440, right: 1440, bottom: 1440, left: 1440 });
  });

  it('„צר” כותב 720, ו„רחב” 1440 לאורך ו-2880 בצדדים', async () => {
    const narrow = fakeEngine();
    expect(await applyMarginPreset(narrow.host, 'narrow')).toEqual({ ok: true });
    expect(narrow.xml.get('s0')!.pgMar).toEqual({ top: 720, right: 720, bottom: 720, left: 720 });

    const wide = fakeEngine();
    expect(await applyMarginPreset(wide.host, 'wide')).toEqual({ ok: true });
    expect(wide.xml.get('s0')!.pgMar).toEqual({ top: 1440, right: 2880, bottom: 1440, left: 2880 });
  });

  it('שולחת אינצ\'ים ולא twips', async () => {
    // זו הטעות שהבדיקה הזאת קיימת בשבילה: שליחת 1440 הייתה מייצרת
    // w:top="2073600" — שולי דף בגובה 36 מטר, בלי שום שגיאה מהמנוע.
    const { host, calls } = fakeEngine();

    await applyMarginPreset(host, 'normal');

    expect(calls[0]!.input).toEqual({
      target: { kind: 'section', sectionId: 's0' },
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
    });
  });

  it('כל preset בטבלה עובר את הוולידציה של המנוע', async () => {
    for (const preset of MARGIN_PRESETS) {
      const { host } = fakeEngine();
      expect(await applyMarginPreset(host, preset.id), preset.id).toEqual({ ok: true });
    }
  });

  it('preset שאינו קיים אינו נוגע במנוע', async () => {
    const { host, calls } = fakeEngine();

    const outcome = await applyMarginPreset(host, 'huge');

    expect(outcome.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('applyOrientation', () => {
  it('שולחת orientation בלבד — המנוע מחליף את המידות בעצמו', async () => {
    const { host, calls, xml } = fakeEngine();

    expect(await applyOrientation(host, 'landscape')).toEqual({ ok: true });
    expect(calls[0]!.input).toEqual({
      target: { kind: 'section', sectionId: 's0' },
      orientation: 'landscape',
    });
    // 12240×15840 (Letter לאורך) התהפך.
    expect(xml.get('s0')!.pgSz).toEqual({ w: 15840, h: 12240, orient: 'landscape' });
  });

  it('חזרה ל„לאורך” מחזירה את היחס', async () => {
    const { host, xml } = fakeEngine({ startWidth: 15840, startHeight: 12240 });

    await applyOrientation(host, 'portrait');

    expect(xml.get('s0')!.pgSz).toEqual({ w: 12240, h: 15840, orient: 'portrait' });
  });
});

describe('applyPaperSize', () => {
  it('A4 = 11906 × 16838 twips עם קוד נייר 9', async () => {
    const { host, xml } = fakeEngine();

    expect(await applyPaperSize(host, 'a4')).toEqual({ ok: true });
    expect(xml.get('s0')!.pgSz).toEqual({ w: 11906, h: 16838, code: '9' });
  });

  it('Letter = 12240 × 15840 twips עם קוד נייר 1', async () => {
    const { host, xml } = fakeEngine({ startWidth: 11906, startHeight: 16838 });

    expect(await applyPaperSize(host, 'letter')).toEqual({ ok: true });
    expect(xml.get('s0')!.pgSz).toEqual({ w: 12240, h: 15840, code: '1' });
  });

  it('המידות המדויקות נשמרות אף שהן נשלחות כשבר של אינץ\'', async () => {
    // 11906/1440 אינו מספר עגול; העיגול במנוע חייב להחזיר את ה-twips המקורי.
    const { calls, host } = fakeEngine();

    await applyPaperSize(host, 'a4');

    const input = calls[0]!.input;
    expect(Math.round((input.width as number) * TWIPS_PER_INCH)).toBe(11906);
    expect(Math.round((input.height as number) * TWIPS_PER_INCH)).toBe(16838);
  });

  it('במקטע שהוא לרוחב המידות מוחלפות, ואין סתירה בין orient למידות', async () => {
    // בלי ההחלפה היה נשאר w:orient="landscape" על דף שמידותיו לאורך.
    const { host, xml } = fakeEngine({ startWidth: 15840, startHeight: 12240 });

    await applyPaperSize(host, 'a4');

    expect(xml.get('s0')!.pgSz).toEqual({ w: 16838, h: 11906, code: '9' });
  });

  it('כל גודל בטבלה עובר את הוולידציה של המנוע', async () => {
    for (const size of PAPER_SIZES) {
      const { host } = fakeEngine();
      expect(await applyPaperSize(host, size.id), size.id).toEqual({ ok: true });
    }
  });

  it('גודל שאינו קיים אינו נוגע במנוע', async () => {
    const { host, calls } = fakeEngine();

    expect((await applyPaperSize(host, 'a3')).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('applyColumns', () => {
  it('שולחת count שלם, equalWidth ורווח של חצי אינץ\'', async () => {
    const { host, calls, xml } = fakeEngine();

    expect(await applyColumns(host, 2)).toEqual({ ok: true });
    expect(calls[0]!.input).toEqual({
      target: { kind: 'section', sectionId: 's0' },
      count: 2,
      gap: 0.5,
      equalWidth: true,
    });
    // 720 twips — הרווח שהמסמך הריק נושא ושWord קובע ב-presets.
    expect(xml.get('s0')!.cols).toEqual({ num: 2, space: COLUMN_GAP_TWIPS, equalWidth: true });
  });

  it('מספר עמודות שאינו שלם חיובי נעצר לפני המנוע', async () => {
    // הוולידציה במנוע **זורקת** על ערך כזה, ולא מחזירה קבלה.
    for (const count of [0, -1, 1.5, Number.NaN]) {
      const { host, calls } = fakeEngine();

      const outcome = await applyColumns(host, count);

      expect(outcome.ok, String(count)).toBe(false);
      expect(calls).toEqual([]);
    }
  });
});

describe('פתרון המקטע והדיווח', () => {
  it('מוחלת על כל מקטעי המסמך — כמו „החל על: כל המסמך” ב-Word', async () => {
    const { host, xml, calls } = fakeEngine({ sectionIds: ['s0', 's1', 's2'] });

    expect(await applyMarginPreset(host, 'narrow')).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    for (const id of ['s0', 's1', 's2']) {
      expect(xml.get(id)!.pgMar.top, id).toBe(720);
    }
  });

  it('מסמך בלי מקטעים מדווח ולא קורא לפעולה', async () => {
    const { host, calls } = fakeEngine({ sectionIds: [] });

    const outcome = await applyMarginPreset(host, 'normal');

    expect(outcome).toEqual({
      ok: false,
      message: 'שינוי השוליים ל„רגיל” נכשל: לא נמצא מקטע במסמך',
      reason: 'target-unresolved',
    });
    expect(calls).toEqual([]);
  });

  it('אין Document API — הודעה בעברית, לא חריגה', async () => {
    for (const host of [null, undefined, {}, { activeEditor: null }, { activeEditor: { doc: null } }]) {
      const outcome = await applyColumns(host as PageSetupHost, 2);

      expect(outcome).toEqual({
        ok: false,
        message: 'שינוי מספר העמודות ל-2 נכשל: המסמך עדיין נטען',
        reason: 'document-api-unavailable',
      });
    }
  });

  it('גרסה שאין בה את הפעולה מדווחת „אינה נתמכת”', async () => {
    const { host } = fakeEngine({ omit: ['setColumns'] });

    expect(await applyColumns(host, 3)).toEqual({
      ok: false,
      message: 'שינוי מספר העמודות ל-3 נכשל: הפעולה אינה נתמכת בגרסה הזאת של המנוע',
      reason: 'command-unsupported',
    });
  });

  it('גרסה שאין בה `sections.list` מדווחת ולא מנחשת מקטע', async () => {
    const { host } = fakeEngine({ omit: ['list'] });

    expect((await applyMarginPreset(host, 'normal')).ok).toBe(false);
  });

  it('קבלה שנכשלה מתורגמת לעברית עם ההקשר של הפעולה', async () => {
    const { host } = fakeEngine({
      receipt: () => ({ success: false, failure: { code: 'DOCUMENT_READONLY' } }),
    });

    expect(await applyMarginPreset(host, 'wide')).toEqual({
      ok: false,
      message: 'שינוי השוליים ל„רחב” נכשל: המסמך פתוח לקריאה בלבד',
      reason: 'DOCUMENT_READONLY',
    });
  });

  it('קוד כשל שאין לו תרגום מוצג עם ההסבר והקוד של המנוע', async () => {
    const { host } = fakeEngine({
      receipt: () => ({ success: false, failure: { code: 'WEIRD_CODE', message: 'nope' } }),
    });

    const outcome = await applyOrientation(host, 'landscape');

    expect(outcome).toEqual({
      ok: false,
      message: 'שינוי כיוון הדף ל„לרוחב” נכשל: nope (WEIRD_CODE)',
      reason: 'WEIRD_CODE',
    });
  });

  it('NO_OP אינה שגיאה — הערכים כבר מוגדרים', async () => {
    const { host } = fakeEngine({ receipt: () => ({ success: false, failure: { code: 'NO_OP' } }) });

    expect(await applyMarginPreset(host, 'normal')).toEqual({ ok: true });
  });

  it('פעולה שזורקת מדווחת ואינה מפילה את התוסף', async () => {
    const { host } = fakeEngine({
      receipt: () => {
        throw new Error('INVALID_INPUT: nope');
      },
    });

    const outcome = await applyColumns(host, 2);

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({
      message: 'שינוי מספר העמודות ל-2 נכשל: INVALID_INPUT: nope',
      reason: 'threw',
    });
  });

  it('`sections.list` שזורקת מדווחת ואינה מפילה את התוסף', async () => {
    const { host } = fakeEngine({ throwOnList: true });

    expect(await applyMarginPreset(host, 'normal')).toMatchObject({
      message: 'שינוי השוליים ל„רגיל” נכשל: boom',
      reason: 'threw',
    });
  });

  it('סובלת קבלה סינכרונית וקבלה כהבטחה', async () => {
    const sync = fakeEngine({ receipt: () => ({ success: true }) });
    expect(await applyMarginPreset(sync.host, 'normal')).toEqual({ ok: true });

    const async = fakeEngine({ receipt: () => Promise.resolve({ success: true }) });
    expect(await applyMarginPreset(async.host, 'normal')).toEqual({ ok: true });
  });

  it('כשל במקטע אחד עוצר ומדווח, ואינו נבלע', async () => {
    let call = 0;
    const { host, calls } = fakeEngine({
      sectionIds: ['s0', 's1', 's2'],
      receipt: () => (++call === 2 ? { success: false, failure: { code: 'LOCK_VIOLATION' } } : { success: true }),
    });

    const outcome = await applyMarginPreset(host, 'normal');

    expect(outcome).toMatchObject({ ok: false, reason: 'LOCK_VIOLATION' });
    expect(calls).toHaveLength(2);
  });
});
