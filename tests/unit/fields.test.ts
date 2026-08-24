/**
 * שדות: מספר עמוד, מספר העמודים, תאריך ועדכון.
 *
 * שלוש טענות שהמודול עומד או נופל עליהן, ולכן הן עיקר מה שנמדד כאן:
 *
 * 1. **ה-`instruction` שנשלח הוא קוד השדה של Word, מילה במילה.** מחרוזת
 *    שגויה אינה שגיאה במנוע — היא שדה שגוי במסמך של המשתמש, ולכן היא נבדקת
 *    כאן על התו.
 * 2. **השדה נכנס בסמן, ומיד מחושב.** `fields.insert` מכניס תוצאה ריקה
 *    ו-`fields.rebuild` הוא שמחשב אותה; בלי הקריאה השנייה המשתמש רואה מקום
 *    ריק.
 * 3. **כשל של ה-rebuild אינו כשל של ההכנסה.** השדה כבר במסמך, והודעת כשל על
 *    פעולה שהצליחה היא רעש.
 */
import { describe, expect, it } from 'vitest';
import {
  emptyFieldsState,
  insertDate,
  insertPageCount,
  insertPageNumber,
  readFieldsState,
  rebuildAllFields,
  FIELD_INSTRUCTIONS,
  type FieldsHost,
} from '../../src/engine/fields';

interface Call {
  op: string;
  input?: unknown;
}

interface FakeOptions {
  /** מה `fields.list` מחזיר כ-`items` — עמוד, לא בהכרח כל המסמך. */
  fields?: readonly { address?: unknown; instruction?: string }[];
  /** `total` של `DiscoveryOutput`. `undefined` = גרסה שאינה חושפת אותו. */
  total?: number;
  /** קבלה שנכשלת, לפי שם הפעולה. */
  failures?: Record<string, { code: string; message?: string }>;
  /** פעולות שזורקות. */
  throws?: readonly string[];
  /** מסלולים שאינם קיימים בפאסדה — גרסת מנוע שאין לה את היכולת. */
  missing?: readonly string[];
  /** מה `selection.current` מדווח. `null` = אין קטע שאפשר לפעול עליו. */
  blockId?: string | null;
  /** הקבלה של `fields.insert` תחזיר את הכתובת הזאת. `null` = בלי כתובת כלל. */
  insertedField?: unknown;
}

function fakeEngine(options: FakeOptions = {}) {
  const calls: Call[] = [];
  const missing = new Set(options.missing ?? []);
  const throwing = new Set(options.throws ?? []);
  const failures = options.failures ?? {};

  function route<T>(op: string, impl: (input: unknown) => T): ((input: unknown) => T) | undefined {
    if (missing.has(op)) return undefined;
    return (input: unknown) => {
      calls.push({ op, input });
      if (throwing.has(op)) throw new Error('boom');
      return impl(input);
    };
  }

  const receipt = (op: string): { success: boolean; failure?: { code: string; message?: string } } =>
    failures[op] ? { success: false, failure: failures[op] } : { success: true };

  const blockId = options.blockId === undefined ? 'block-1' : options.blockId;
  const selectionTarget = {
    kind: 'text',
    segments: blockId ? [{ blockId, range: { start: 3, end: 3 } }] : [],
  };

  const doc = {
    selection: {
      current: route('selection.current', () => ({ empty: true, target: selectionTarget })),
    },
    fields: {
      // הכפיל מכבד `limit`/`offset` ולא מחזיר את אותו עמוד לנצח: `list` הוא
      // `DiscoveryOutput`, ו„עדכן שדות” שואב ממנו עמוד אחר עמוד. כפיל שמתעלם
      // מהעמוד היה מאשר בירוק גם מימוש שרץ על העמוד הראשון בלבד.
      list: route('fields.list', (input) => {
        const all = options.fields ?? [];
        const query = (input ?? {}) as { limit?: number; offset?: number };
        const offset = query.offset ?? 0;
        const end = query.limit === undefined ? undefined : offset + query.limit;
        return {
          items: all.slice(offset, end),
          ...(options.total === undefined ? {} : { total: options.total }),
        };
      }),
      insert: route('fields.insert', () => {
        const result = receipt('fields.insert');
        if (!result.success) return result;
        const field =
          options.insertedField === undefined
            ? { kind: 'field', blockId: 'block-1', occurrenceIndex: 0, nestingDepth: 0 }
            : options.insertedField;
        return field === null ? result : { ...result, field };
      }),
      rebuild: route('fields.rebuild', () => receipt('fields.rebuild')),
    },
  };

  const host = { activeEditor: { doc } } as unknown as FieldsHost;
  const ops = (): string[] => calls.map((call) => call.op);
  const inputs = (op: string): unknown[] =>
    calls.filter((call) => call.op === op).map((call) => call.input);

  return { host, calls, ops, inputs };
}

describe('הכנסת שדה', () => {
  it('„מספר עמוד” שולח `PAGE` גולמי בסמן, ומחשב את התוצאה מיד', async () => {
    const engine = fakeEngine();

    expect(await insertPageNumber(engine.host)).toEqual({ ok: true });

    expect(engine.inputs('fields.insert')).toEqual([
      {
        at: { kind: 'text', segments: [{ blockId: 'block-1', range: { start: 3, end: 3 } }] },
        instruction: 'PAGE',
        mode: 'raw',
      },
    ]);
    // ה-rebuild מקבל את הכתובת שהקבלה החזירה, ולא את `at` — שתי כתובות בשני
    // מודלים שונים, והחלפה ביניהן הייתה חריגת `INVALID_INPUT`.
    expect(engine.inputs('fields.rebuild')).toEqual([
      { target: { kind: 'field', blockId: 'block-1', occurrenceIndex: 0, nestingDepth: 0 } },
    ]);
  });

  it('„מספר העמודים” שולח `NUMPAGES`, ו„תאריך” שולח `DATE` עם מתג הפורמט', async () => {
    // המתג הוא העיקר כאן. `DATE` עירום נמדד במנוע האמיתי ומחזיר `2026-08-24` —
    // ISO לועזי, ואפילו יום אחורה (UTC). `DATE \\@ "dd/MM/yyyy"` נמדד באותה
    // הרצה ומחזיר `25/08/2026`. הפירוט המלא בהערת הפתיחה של engine/fields.ts.
    const count = fakeEngine();
    expect(await insertPageCount(count.host)).toEqual({ ok: true });
    expect((count.inputs('fields.insert')[0] as { instruction: string }).instruction).toBe(
      'NUMPAGES',
    );

    const date = fakeEngine();
    expect(await insertDate(date.host)).toEqual({ ok: true });
    expect((date.inputs('fields.insert')[0] as { instruction: string }).instruction).toBe(
      'DATE \\@ "dd/MM/yyyy"',
    );
  });

  it('שלושת הקודים הם בדיוק קודי השדות של Word', () => {
    // הקבוע הזה הוא מה שנכתב לתוך המסמך. שינוי בו הוא שינוי בקובץ שהמשתמש
    // ישמור, ולכן הוא ננעל כאן ולא רק בעקיפין דרך אתרי הקריאה.
    expect(FIELD_INSTRUCTIONS).toEqual({
      pageNumber: 'PAGE',
      pageCount: 'NUMPAGES',
      date: 'DATE \\@ "dd/MM/yyyy"',
    });
  });

  it('אין סמן במסמך: אין קריאה למנוע, ויש הודעה שאומרת מה לעשות', async () => {
    const engine = fakeEngine({ blockId: null });

    expect(await insertPageNumber(engine.host)).toEqual({
      ok: false,
      message:
        'הוספת מספר העמוד נכשלה: יש ללחוץ בגוף המסמך, על שורת טקסט שיש בה תו אחד לפחות, ואז להוסיף את השדה',
      reason: 'no-selection',
    });
    expect(engine.ops()).not.toContain('fields.insert');
  });

  it('קבלה שנכשלה מתורגמת לעברית, ואין rebuild על שדה שלא נכנס', async () => {
    const engine = fakeEngine({
      failures: { 'fields.insert': { code: 'PRECONDITION_FAILED' } },
    });

    expect(await insertDate(engine.host)).toEqual({
      ok: false,
      message: 'הוספת התאריך נכשלה: המסמך אינו במצב שמאפשר את הפעולה',
      reason: 'PRECONDITION_FAILED',
    });
    expect(engine.ops()).not.toContain('fields.rebuild');
  });

  it('`fields.insert` חסר בפאסדה: „אינו זמין בגרסה זו”', async () => {
    const engine = fakeEngine({ missing: ['fields.insert'] });

    expect(await insertPageCount(engine.host)).toEqual({
      ok: false,
      message: 'הוספת מספר העמודים נכשלה: אינו זמין בגרסה זו',
      reason: 'command-unsupported',
    });
  });

  it('חריגה מהמנוע הופכת להודעה ולא נזרקת החוצה', async () => {
    const engine = fakeEngine({ throws: ['fields.insert'] });

    expect(await insertPageNumber(engine.host)).toEqual({
      ok: false,
      message: 'הוספת מספר העמוד נכשלה: boom',
      reason: 'threw',
    });
  });

  it('rebuild שנכשל אחרי הכנסה מוצלחת אינו הופך אותה לכשל', async () => {
    // השדה **במסמך**. הוא ייראה בעדכון הבא, וכשל כאן היה מלמד את המשתמש
    // להתעלם מהודעות.
    const failing = fakeEngine({ failures: { 'fields.rebuild': { code: 'INTERNAL_ERROR' } } });
    expect(await insertPageNumber(failing.host)).toEqual({ ok: true });

    const throwing = fakeEngine({ throws: ['fields.rebuild'] });
    expect(await insertPageNumber(throwing.host)).toEqual({ ok: true });

    const missing = fakeEngine({ missing: ['fields.rebuild'] });
    expect(await insertPageNumber(missing.host)).toEqual({ ok: true });
  });

  it('קבלה בלי כתובת שדה: ההכנסה הצליחה, ואין rebuild על `undefined`', async () => {
    const engine = fakeEngine({ insertedField: null });

    expect(await insertPageNumber(engine.host)).toEqual({ ok: true });
    expect(engine.ops()).not.toContain('fields.rebuild');
  });

  it('אין Document API כלל: „המסמך עדיין נטען”', async () => {
    expect(await insertDate(null)).toEqual({
      ok: false,
      message: 'הוספת התאריך נכשלה: המסמך עדיין נטען',
      reason: 'document-api-unavailable',
    });
  });
});

describe('rebuildAllFields', () => {
  it('מחשבת מחדש כל שדה שיש לו כתובת, ומדלגת על שדה בלעדיה', async () => {
    const engine = fakeEngine({
      fields: [
        { address: { kind: 'field', blockId: 'b1', occurrenceIndex: 0, nestingDepth: 0 } },
        { instruction: 'PAGE' },
        { address: { kind: 'field', blockId: 'b2', occurrenceIndex: 0, nestingDepth: 0 } },
      ],
    });

    expect(await rebuildAllFields(engine.host)).toEqual({ ok: true });
    expect(engine.inputs('fields.rebuild')).toEqual([
      { target: { kind: 'field', blockId: 'b1', occurrenceIndex: 0, nestingDepth: 0 } },
      { target: { kind: 'field', blockId: 'b2', occurrenceIndex: 0, nestingDepth: 0 } },
    ]);
  });

  it('מסמך בלי שדות הוא הצלחה שקטה', async () => {
    const engine = fakeEngine({ fields: [] });

    expect(await rebuildAllFields(engine.host)).toEqual({ ok: true });
    expect(engine.ops()).not.toContain('fields.rebuild');
  });

  it('`NO_OP` על שדה שכבר מעודכן אינו כשל', async () => {
    const engine = fakeEngine({
      fields: [{ address: { kind: 'field' } }],
      failures: { 'fields.rebuild': { code: 'NO_OP' } },
    });

    expect(await rebuildAllFields(engine.host)).toEqual({ ok: true });
  });

  it('כשל עוצר בשדה הראשון ואינו חוזר על אותה הודעה', async () => {
    const engine = fakeEngine({
      fields: [{ address: { kind: 'field', blockId: 'b1' } }, { address: { kind: 'field', blockId: 'b2' } }],
      failures: { 'fields.rebuild': { code: 'PRECONDITION_FAILED' } },
    });

    expect(await rebuildAllFields(engine.host)).toEqual({
      ok: false,
      message: 'עדכון השדות נכשל: המסמך אינו במצב שמאפשר את הפעולה',
      reason: 'PRECONDITION_FAILED',
    });
    expect(engine.inputs('fields.rebuild')).toHaveLength(1);
  });

  it('`fields.rebuild` חסר בפאסדה: „אינו זמין בגרסה זו”', async () => {
    const engine = fakeEngine({ missing: ['fields.rebuild'] });

    expect(await rebuildAllFields(engine.host)).toEqual({
      ok: false,
      message: 'עדכון השדות נכשל: אינו זמין בגרסה זו',
      reason: 'command-unsupported',
    });
  });

  /**
   * הבדיקה שמגנה על מסמך גדול: `list` מחזיר עמוד, ו„עדכן שדות” שרץ על העמוד
   * הראשון בלבד היה משאיר שדות לא מעודכנים **ומדווח הצלחה** — כשל שקט שאיש
   * לא היה מבחין בו עד שמישהו פותח את הקובץ ב-Word.
   */
  it('שואב את כל העמודים, ולא רק את הראשון', async () => {
    const fields = Array.from({ length: 250 }, (_, index) => ({ address: { fieldId: `f${index}` } }));
    const engine = fakeEngine({ fields, total: fields.length });

    expect(await rebuildAllFields(engine.host)).toEqual({ ok: true });

    expect(engine.inputs('fields.rebuild')).toHaveLength(250);
    // שני עמודים: 200 ואז 50. עמוד אחד היה מעדכן 200 שדות ומדווח „הצלחה”.
    expect(engine.inputs('fields.list')).toEqual([
      { limit: 200, offset: 0 },
      { limit: 200, offset: 200 },
    ]);
  });

  it('חריגה מ-`fields.list` הופכת להודעה', async () => {
    const engine = fakeEngine({ throws: ['fields.list'] });

    expect(await rebuildAllFields(engine.host)).toEqual({
      ok: false,
      message: 'עדכון השדות נכשל: boom',
      reason: 'threw',
    });
  });
});

describe('readFieldsState', () => {
  it('מונה את שדות המסמך', async () => {
    const engine = fakeEngine({ fields: [{ address: {} }, { address: {} }, { address: {} }] });

    expect(await readFieldsState(engine.host)).toEqual({ count: 3 });
  });

  it('`total` גובר על אורך העמוד', async () => {
    // `fields.list` הוא `DiscoveryOutput`: `items` הוא עמוד תחת `limit`/`offset`,
    // ו-`total` הוא המספר במסמך. ספירת העמוד הייתה אומרת „2 שדות” במסמך של 40.
    const engine = fakeEngine({ fields: [{ address: {} }, { address: {} }], total: 40 });

    expect(await readFieldsState(engine.host)).toEqual({ count: 40 });
  });

  it('גרסה בלי `total` נופלת לאורך העמוד ולא לאפס', async () => {
    // מספר חלקי הוא עדיין מידע; אפס היה מכבה את „עדכן שדות” על מסמך שיש בו שדות.
    const engine = fakeEngine({ fields: [{ address: {} }, { address: {} }] });

    expect(await readFieldsState(engine.host)).toEqual({ count: 2 });
  });

  it('כשל של קריאה מחזיר „אין שדות” ואינו זורק', async () => {
    // ה-tooltip יאמר „אין מה לעדכן”, וזה עדיף על מספר שהומצא.
    expect(await readFieldsState(fakeEngine({ throws: ['fields.list'] }).host)).toEqual(
      emptyFieldsState(),
    );
    expect(await readFieldsState(fakeEngine({ missing: ['fields.list'] }).host)).toEqual({
      count: 0,
    });
    expect(await readFieldsState(null)).toEqual({ count: 0 });
  });
});
