/**
 * חוזה ה-payload מול הוולידטורים **האמיתיים** של superdoc@2.8.0.
 *
 * למה לא mock, וזו הנקודה כולה: הבדיקה שקדמה לזאת
 * (tests/unit/ribbon-commands.test.ts) הריצה את ה-payloads שלנו מול
 * `executeAsync(id, payload) { calls.push({ id, payload }); return true; }`
 * ואז השוותה `calls` לאותם payloads. כלומר היא בדקה ש-JavaScript מעביר
 * ארגומנטים, ואישרה בירוק בדיוק את ארבעת ה-payloads שהמנוע דוחה. mock שמחזיר
 * `true` אינו מנוע.
 *
 * הוולידטורים אינם exports ציבוריים — הם פנימיים ל-chunk של החבילה — ולכן הם
 * **נחלצים מהמקור הארוז ומורצים כמו שהם**. זה לא העתקה של הלוגיקה: הקוד שרץ
 * כאן הוא הקוד שהחבילה שולחת. שינוי שלו בגרסה עתידית יפיל את הבדיקה בשתי
 * צורות — או שהחילוץ לא ימצא את הפונקציה, או שההתנהגות תשתנה — ובשניהם זה מה
 * שאנחנו רוצים לדעת.
 *
 * מה שלא נבדק כאן: מסלול ה-mutation עצמו (`doc.format.*`) והמצב במסמך. אלה
 * דורשים מנוע DOCX חי, ונבדקים באימות בדפדפן. מה שכן נבדק הוא בדיוק השלב
 * שנכשל בשקט — הוולידציה שקודמת ל-mutation.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  alignmentPayload,
  colorPayload,
  fontFamilyPayload,
  fontSizePayload,
  lineHeightPayload,
  parseFontSizePt,
  parseLineHeight,
  stylePayload,
  zoomPayload,
} from '../../src/engine/payloads';

/* ------------------------------------------------------------------ */
/* חילוץ הוולידטורים מהחבילה                                            */
/* ------------------------------------------------------------------ */

const CHUNKS_DIR = join(process.cwd(), 'node_modules/superdoc/dist/chunks');

/** שם הקובץ נושא hash שמשתנה בכל build של החבילה, ולכן הוא נמצא ולא נכתב. */
function readControllerChunk(): string {
  const file = readdirSync(CHUNKS_DIR).find((name) =>
    /^create-super-doc-ui-.*\.es\.js$/.test(name),
  );
  if (!file) throw new Error('לא נמצא ה-chunk של controller ה-UI ב-superdoc');
  return readFileSync(join(CHUNKS_DIR, file), 'utf8');
}

const CHUNK = readControllerChunk();

/**
 * הפונקציות ברמת המודול. הן מעוצבות עם tab, ולכן `}` בתחילת שורה הוא סוף
 * הפונקציה — מה שהופך את החילוץ לחד-משמעי בלי מנתח JS.
 */
const TOP_LEVEL_FUNCTIONS = [
  'normalizeFontSizePayload',
  'normalizeZoomPayload',
  'normalizeColorPayload',
  'normalizeAlignmentPayload',
  'normalizeLineHeightPayload',
  'normalizeStyleIdPayload',
  'unwrapScalar',
  'buildInlineFormatInput',
] as const;

type InlineSpec = { key: string; kind: 'toggle' | 'value-string' | 'value-number' | 'clear' };
type InlineInput = { target: unknown; value?: unknown; inline?: unknown } | null;

interface EngineValidators {
  normalizeFontSizePayload(payload: unknown): unknown;
  normalizeZoomPayload(payload: unknown): unknown;
  normalizeColorPayload(payload: unknown): unknown;
  normalizeAlignmentPayload(payload: unknown): unknown;
  normalizeLineHeightPayload(payload: unknown): unknown;
  normalizeStyleIdPayload(payload: unknown): unknown;
  unwrapScalar(payload: unknown, keys: string[]): unknown;
  buildInlineFormatInput(
    spec: InlineSpec,
    target: unknown,
    payload: unknown,
    active: boolean,
  ): InlineInput;
  instanceCommandPayloadIsValid(descriptor: { id: string }, payload: unknown): boolean;
}

function extractTopLevelFunction(name: string): string {
  const match = CHUNK.match(new RegExp(String.raw`^function ${name}\([\s\S]*?\n\}`, 'm'));
  if (!match) {
    throw new Error(`הפונקציה ${name} לא נמצאה ב-chunk — חוזה ה-payload של superdoc השתנה`);
  }
  return match[0];
}

/**
 * `instanceCommandPayloadIsValid` הוא closure בתוך ה-controller ולא פונקציה
 * ברמת המודול, ולכן הוא נחלץ לפי ההזחה שלו. הוא זה שדוחה `{ zoom: 1 }` — עוד
 * לפני ש-`SuperDoc.setZoom` מתלונן.
 */
function extractInstanceValidator(): string {
  const match = CHUNK.match(/^\tconst instanceCommandPayloadIsValid = \([\s\S]*?\n\t\};/m);
  if (!match) {
    throw new Error('instanceCommandPayloadIsValid לא נמצא ב-chunk — חוזה הזום של superdoc השתנה');
  }
  return match[0].replace(/^\t/, '').replace(/^const /, 'var ');
}

/**
 * `CLEAR_INLINE_PATCH` הוא הקבוע היחיד שהפונקציות שנחלצו נשענות עליו, והוא
 * נוגע רק ל-`kind: 'clear'` (נקה עיצוב) שאינו נבדק כאן — פקודה בלי payload.
 */
const engine: EngineValidators = new Function(
  'CLEAR_INLINE_PATCH',
  [
    ...TOP_LEVEL_FUNCTIONS.map((name) => extractTopLevelFunction(name)),
    extractInstanceValidator(),
    `return { ${[...TOP_LEVEL_FUNCTIONS, 'instanceCommandPayloadIsValid'].join(', ')} };`,
  ].join('\n'),
)({}) as EngineValidators;

/* ------------------------------------------------------------------ */
/* ה-descriptor של כל פקודה, כפי שהוא בקטלוג של החבילה                  */
/* ------------------------------------------------------------------ */

/** גוף ה-entry של פקודה בקטלוג. `id` הוא השדה הראשון בכל entry. */
function descriptorSource(id: string): string {
  const start = CHUNK.indexOf(`id: "${id}",`);
  if (start === -1) throw new Error(`הפקודה ${id} אינה בקטלוג של superdoc`);
  const end = CHUNK.indexOf('\n\t},', start);
  return CHUNK.slice(start, end === -1 ? undefined : end);
}

/** מריצה את השרשרת שה-controller מריץ על פקודת inline: נרמול ואז בנייה. */
function applyInline(spec: InlineSpec, normalize: ((p: unknown) => unknown) | null, payload: unknown): InlineInput {
  const target = { kind: 'text', segments: [] };
  return engine.buildInlineFormatInput(spec, target, normalize ? normalize(payload) : payload, false);
}

const FONT_FAMILY_SPEC: InlineSpec = { key: 'fontFamily', kind: 'value-string' };
const FONT_SIZE_SPEC: InlineSpec = { key: 'fontSize', kind: 'value-number' };
const COLOR_SPEC: InlineSpec = { key: 'color', kind: 'value-string' };
const HIGHLIGHT_SPEC: InlineSpec = { key: 'highlight', kind: 'value-string' };

const fontFamilyInput = (payload: unknown) => applyInline(FONT_FAMILY_SPEC, null, payload);
const fontSizeInput = (payload: unknown) =>
  applyInline(FONT_SIZE_SPEC, engine.normalizeFontSizePayload, payload);
const colorInput = (payload: unknown) => applyInline(COLOR_SPEC, engine.normalizeColorPayload, payload);
const highlightInput = (payload: unknown) =>
  applyInline(HIGHLIGHT_SPEC, engine.normalizeColorPayload, payload);

/** הזום אינו פקודת inline: נרמול, ואז הוולידטור של מסלול המופע. */
function zoomAccepted(payload: unknown): number | null {
  const normalized = engine.normalizeZoomPayload(payload);
  return engine.instanceCommandPayloadIsValid({ id: 'zoom' }, normalized)
    ? (normalized as number)
    : null;
}

/* ------------------------------------------------------------------ */

describe('החילוץ עצמו', () => {
  it('כל הוולידטורים נמצאו ורצים', () => {
    for (const name of TOP_LEVEL_FUNCTIONS) {
      expect(typeof engine[name], name).toBe('function');
    }
    expect(typeof engine.instanceCommandPayloadIsValid).toBe('function');
  });

  it('ה-descriptor של כל פקודה קושר אותה לוולידטור שנבדק כאן', () => {
    // אם החבילה תחליף נרמול או `kind`, ההנחות של payloads.ts לא נכונות יותר.
    expect(descriptorSource('font-family')).toContain('kind: "value-string"');
    expect(descriptorSource('font-family')).not.toContain('normalizePayload');

    expect(descriptorSource('font-size')).toContain('normalizePayload: normalizeFontSizePayload');
    expect(descriptorSource('font-size')).toContain('kind: "value-number"');

    expect(descriptorSource('text-color')).toContain('normalizePayload: normalizeColorPayload');
    expect(descriptorSource('text-color')).toContain('kind: "value-string"');
    expect(descriptorSource('highlight-color')).toContain('normalizePayload: normalizeColorPayload');

    expect(descriptorSource('zoom')).toContain('normalizePayload: normalizeZoomPayload');
    expect(descriptorSource('zoom')).toContain('instanceRoute: "setZoom"');

    expect(descriptorSource('text-align')).toContain('normalizePayload: normalizeAlignmentPayload');
    expect(descriptorSource('line-height')).toContain('normalizePayload: normalizeLineHeightPayload');
    expect(descriptorSource('linked-style')).toContain('normalizePayload: normalizeStyleIdPayload');
  });
});

describe('font-family', () => {
  it('ה-payload שלנו מגיע למנוע כשם הגופן', () => {
    expect(fontFamilyInput(fontFamilyPayload('TaameyDavidCLM'))).toMatchObject({
      value: 'TaameyDavidCLM',
    });
  });

  it('גופן עם רווחים בשם עובר שלם', () => {
    expect(fontFamilyInput(fontFamilyPayload('Times New Roman'))).toMatchObject({
      value: 'Times New Roman',
    });
  });

  it('{ fontFamily } — הצורה שהייתה — נדחית', () => {
    // אובייקט בלי `value` אינו string, ולכן `buildInlineFormatInput` מחזיר
    // `null` וה-controller לא נוגע במסמך. זו הרגרסיה שהבדיקה הזאת שומרת.
    expect(fontFamilyInput({ fontFamily: 'TaameyDavidCLM' })).toBeNull();
  });

  it('מחרוזת ריקה נדחית, ולכן `fontFamilyPayload` לא בונה אותה', () => {
    expect(fontFamilyPayload('   ')).toBeNull();
    expect(fontFamilyInput('')).toBeNull();
  });
});

describe('font-size', () => {
  it('ה-payload שלנו מגיע למנוע כמספר נקודות', () => {
    expect(fontSizeInput(fontSizePayload(16))).toMatchObject({ value: 16 });
  });

  it('„16pt” מהבורר מגיע כ-16', () => {
    expect(fontSizeInput(fontSizePayload('16pt'))).toMatchObject({ value: 16 });
  });

  it('חצי נקודה נשמרת — המנוע מדווח 20.5 על טקסט כזה', () => {
    expect(fontSizeInput(fontSizePayload(20.5))).toMatchObject({ value: 20.5 });
  });

  it('{ fontSize } — הצורה שהייתה — נדחית', () => {
    // `normalizeFontSizePayload` אינו מכיר את המפתח `fontSize`, ולכן האובייקט
    // מגיע שלם ל-`Number({...})` = NaN.
    expect(fontSizeInput({ fontSize: '16pt' })).toBeNull();
    expect(fontSizeInput({ fontSize: 16 })).toBeNull();
  });

  it('גודל לא חוקי אינו נשלח בכלל', () => {
    expect(fontSizePayload('לא מספר')).toBeNull();
    expect(fontSizePayload(0)).toBeNull();
    expect(fontSizePayload(-4)).toBeNull();
  });

  it('הערך שהמנוע קיבל חוזר דרך `parseFontSizePt` לאותו מספר', () => {
    const input = fontSizeInput(fontSizePayload('18pt'));
    expect(parseFontSizePt(input?.value)).toBe(18);
  });
});

describe('text-color / highlight-color', () => {
  it('צבע מהפלטה מגיע כ-#RRGGBB', () => {
    expect(colorInput(colorPayload('#0055FF'))).toMatchObject({ value: '#0055FF' });
    expect(highlightInput(colorPayload('#FFFF00'))).toMatchObject({ value: '#FFFF00' });
  });

  it('„ללא צבע” מגיע כ-null — מסלול הניקוי המתועד של המנוע', () => {
    expect(colorInput(colorPayload(null))).toMatchObject({ value: null });
    expect(highlightInput(colorPayload(null))).toMatchObject({ value: null });
  });

  it('{ color } — הצורה שהייתה — נדחית', () => {
    expect(colorInput({ color: '#0055FF' })).toBeNull();
    expect(highlightInput({ color: '#FFFF00' })).toBeNull();
  });

  it('{ color: "" } — „ללא צבע” שהיה — נדחית', () => {
    // וזה הכשל שהיה חמור יותר: הכפתור נראה כאילו הוא מנקה, ולא ניקה כלום.
    expect(colorInput({ color: '' })).toBeNull();
    expect(colorInput('')).toBeNull();
  });
});

describe('zoom', () => {
  it('ה-payload שלנו מגיע למנוע כאחוזים', () => {
    expect(zoomAccepted(zoomPayload(100))).toBe(100);
    expect(zoomAccepted(zoomPayload(150))).toBe(150);
    expect(zoomAccepted(zoomPayload(200))).toBe(200);
  });

  it('{ zoom: 1 } — הצורה שהייתה — נדחית', () => {
    // הזום הוא הפקד שהוכח חי: הסרגל הזיז את התווית ל-„150%” ורוחב העמוד
    // בצילום נשאר זהה. `normalizeZoomPayload` אינו מפרק אובייקט בכלל.
    expect(zoomAccepted({ zoom: 1 })).toBeNull();
    expect(zoomAccepted({ zoom: 1.5 })).toBeNull();
  });

  it('אחוז נמוך אינו מתפרש כשבר של דור v1', () => {
    // `normalizeZoomPayload` מכפיל ב-100 כל מספר בטווח 0..5. `zoomPayload`
    // מוציא לכן `'3%'`, והמנוע מכבד אותו כאחוזים.
    expect(zoomAccepted(zoomPayload(3))).toBe(3);
    expect(zoomAccepted(3)).toBe(300);
  });

  it('רמת זום לא חוקית אינה נשלחת', () => {
    expect(zoomPayload(0)).toBeNull();
    expect(zoomPayload(Number.NaN)).toBeNull();
  });
});

describe('הפקודות שכבר עבדו — רגרסיה בלבד', () => {
  it('text-align: המפתח `alignment` מוכר ל-unwrapScalar', () => {
    expect(engine.normalizeAlignmentPayload(alignmentPayload('right'))).toBe('right');
    expect(engine.normalizeAlignmentPayload(alignmentPayload('justify'))).toBe('justify');
  });

  it('line-height: המפתח `lineHeight` מוכר, והמנוע ממיר ל-240ths', () => {
    expect(engine.normalizeLineHeightPayload(lineHeightPayload(1))).toBe(240);
    expect(engine.normalizeLineHeightPayload(lineHeightPayload(1.5))).toBe(360);
    expect(engine.normalizeLineHeightPayload(lineHeightPayload(2))).toBe(480);
  });

  it('line-height: ההמרה שלנו הפוכה לזו של המנוע', () => {
    for (const multiplier of [1, 1.15, 1.5, 2, 2.5, 3]) {
      const twentieths = engine.normalizeLineHeightPayload(lineHeightPayload(multiplier));
      expect(parseLineHeight(twentieths), `מכפיל ${multiplier}`).toBe(multiplier);
    }
  });

  it('linked-style: המפתח `style` מוכר ל-unwrapScalar', () => {
    expect(engine.normalizeStyleIdPayload(stylePayload('Heading1'))).toBe('Heading1');
  });

  it('unwrapScalar אינו מכיר את `fontFamily`, `fontSize`, `color` ו-`zoom`', () => {
    // זו הסיבה השורשית לכל הבאגים כאן: שם השדה של הפקודה אינו מפתח unwrap.
    for (const key of ['fontFamily', 'fontSize', 'color', 'zoom']) {
      const payload = { [key]: 'X' };
      expect(engine.unwrapScalar(payload, ['value']), key).toBe(payload);
    }
  });
});
