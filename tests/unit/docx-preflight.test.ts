/**
 * השלב המקדים הוא הדבר היחיד שעומד בין המשתמש לבין קיפאון שאין ממנו יציאה:
 * `<w:defaultTabStop w:val="0"/>` שולח את המנוע ללולאה על החוט הראשי, ולכן
 * `OPEN_TIMEOUT_MS` אינו יכול לירות ואין שום שגיאה להציג. מכאן שתי החובות
 * שהבדיקות כאן שומרות עליהן:
 *
 * 1. **הערך אכן מתוקן** — אחרת אין לשלב הזה טעם.
 * 2. **שום מסמך אחר אינו נפגע** — הארכיון שנכתב מחדש חייב לשמור את כל שאר
 *    החלקים בייט-בבייט, ומסמך שאין בו מה לתקן חייב לעבור הלאה כפי שהוא, ולא
 *    להיכתב מחדש „ליתר ביטחון”.
 *
 * ה-zip נבנה כאן ביד, עם `deflateRawSync` אמיתי, מפני שהקורא שנבדק קורא
 * מהספרייה המרכזית ומכותרות מקומיות — ומבנה מזויף היה בודק את עצמו.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import {
  DEFAULT_TAB_STOP_TWIPS,
  preflightDocx,
  preflightSource,
  repairSettings,
  SETTINGS_PART,
} from '../../src/engine/docx-preflight';

const SETTINGS_WITH_ZERO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:settings xmlns:w="ns"><w:zoom w:percent="100"/><w:defaultTabStop w:val="0"/>' +
  '<w:characterSpacingControl w:val="doNotCompress"/></w:settings>';

const DOCUMENT_XML = '<w:document xmlns:w="ns"><w:body><w:p/></w:body></w:document>';

interface Part {
  name: string;
  content: string;
  /** `false` מאחסן את החלק כמות שהוא — כמו ש-DOCX אמיתי עושה לחלקים קטנים. */
  deflate?: boolean;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i++) {
    let value = (crc ^ bytes[i]) & 0xff;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crc = value ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** ארכיון ZIP מינימלי אך אמיתי: כותרות מקומיות, ספרייה מרכזית ו-EOCD. */
function buildZip(parts: Part[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const records = parts.map((part) => {
    const raw = encoder.encode(part.content);
    const stored = part.deflate === false ? raw : new Uint8Array(deflateRawSync(raw));
    return {
      nameBytes: encoder.encode(part.name),
      raw,
      stored,
      method: part.deflate === false ? 0 : 8,
      crc: crc32(raw),
    };
  });

  const size =
    records.reduce((total, r) => total + 30 + r.nameBytes.byteLength + r.stored.byteLength, 0) +
    records.reduce((total, r) => total + 46 + r.nameBytes.byteLength, 0) +
    22;

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  let at = 0;

  for (const record of records) {
    offsets.push(at);
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 8, record.method, true);
    view.setUint32(at + 14, record.crc, true);
    view.setUint32(at + 18, record.stored.byteLength, true);
    view.setUint32(at + 22, record.raw.byteLength, true);
    view.setUint16(at + 26, record.nameBytes.byteLength, true);
    at += 30;
    out.set(record.nameBytes, at);
    at += record.nameBytes.byteLength;
    out.set(record.stored, at);
    at += record.stored.byteLength;
  }

  const centralOffset = at;
  records.forEach((record, index) => {
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 20, true);
    view.setUint16(at + 10, record.method, true);
    view.setUint32(at + 16, record.crc, true);
    view.setUint32(at + 20, record.stored.byteLength, true);
    view.setUint32(at + 24, record.raw.byteLength, true);
    view.setUint16(at + 28, record.nameBytes.byteLength, true);
    view.setUint32(at + 42, offsets[index], true);
    at += 46;
    out.set(record.nameBytes, at);
    at += record.nameBytes.byteLength;
  });

  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, records.length, true);
  view.setUint16(at + 10, records.length, true);
  view.setUint32(at + 12, at - centralOffset, true);
  view.setUint32(at + 16, centralOffset, true);
  return out;
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let start = 0; start + needle.byteLength <= haystack.byteLength; start++) {
    for (let i = 0; i < needle.byteLength; i++) {
      if (haystack[start + i] !== needle[i]) continue outer;
    }
    return true;
  }
  return false;
}

const bytesOf = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

/**
 * jsdom אינו מממש `Blob.arrayBuffer`, שקיים בכל דפדפן מ-2019. בלי ההשלמה הזאת
 * מסלול הטיוטה — היחיד שמגיע ל-`preflightSource` כ-Blob ולא כ-URL — היה נופל
 * בשקט למסלול „לא הצלחתי לקרוא, מחזיר את המקור” ולא נבדק כלל.
 */
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    configurable: true,
    value(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('repairSettings', () => {
  it('מחליפה אפס בברירת המחדל של Word', () => {
    const repaired = repairSettings(SETTINGS_WITH_ZERO);
    expect(repaired).toContain(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`);
    expect(repaired).not.toContain('w:val="0"');
    // כל השאר נשאר: התיקון אינו כותב מחדש קובץ הגדרות.
    expect(repaired).toContain('<w:zoom w:percent="100"/>');
    expect(repaired).toContain('<w:characterSpacingControl w:val="doNotCompress"/>');
  });

  it('אינה נוגעת בערך תקין', () => {
    expect(repairSettings(SETTINGS_WITH_ZERO.replace('"0"', '"720"'))).toBeNull();
    expect(repairSettings(SETTINGS_WITH_ZERO.replace('"0"', '"425"'))).toBeNull();
  });

  it('אינה נוגעת בקובץ שאין בו המאפיין', () => {
    expect(repairSettings('<w:settings xmlns:w="ns"><w:zoom w:percent="100"/></w:settings>')).toBeNull();
  });

  it('תופסת גם ערך שלילי וגם ערך שאינו מספר', () => {
    // שניהם מגיעים למנוע כאותו צעד שאינו מקדם, ולכן אינם שונים מאפס.
    expect(repairSettings(SETTINGS_WITH_ZERO.replace('"0"', '"-1"'))).toContain('"720"');
    expect(repairSettings(SETTINGS_WITH_ZERO.replace('"0"', '""'))).toContain('"720"');
  });

  it('סובלנית לרווחים ולסדר מאפיינים', () => {
    const odd = '<w:settings xmlns:w="ns"><w:defaultTabStop w:foo="x" w:val = "0" /></w:settings>';
    expect(repairSettings(odd)).toContain(`w:val="${DEFAULT_TAB_STOP_TWIPS}"`);
  });
});

describe('preflightDocx', () => {
  it('מתקנת את ההגדרות ומשאירה את שאר החלקים כפי שהיו', async () => {
    const original = buildZip([
      { name: '[Content_Types].xml', content: '<Types/>' },
      { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO },
      { name: 'word/document.xml', content: DOCUMENT_XML, deflate: false },
    ]);

    const repaired = await preflightDocx(original);
    expect(repaired).not.toBeNull();

    // ההגדרות נכתבות כרשומה לא-דחוסה, ולכן הערך המתוקן נמצא בקובץ כטקסט גלוי.
    expect(contains(repaired!, bytesOf(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`))).toBe(true);
    expect(contains(repaired!, bytesOf('<w:defaultTabStop w:val="0"/>'))).toBe(false);

    // החלקים האחרים עברו בייט-בבייט: גם הדחוס וגם זה שלא.
    expect(contains(repaired!, new Uint8Array(deflateRawSync(bytesOf('<Types/>'))))).toBe(true);
    expect(contains(repaired!, bytesOf(DOCUMENT_XML))).toBe(true);
  });

  it('הארכיון שנכתב נקרא בחזרה, ואין בו יותר מה לתקן', async () => {
    const repaired = await preflightDocx(
      buildZip([
        { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO },
        { name: 'word/document.xml', content: DOCUMENT_XML },
      ]),
    );
    expect(repaired).not.toBeNull();
    // אותה קריאה בדיוק על התוצאה: מוכיחה גם שהמבנה תקין וגם שהתיקון הושלם.
    await expect(preflightDocx(repaired!)).resolves.toBeNull();
  });

  it('אינה נוגעת במסמך תקין', async () => {
    const clean = buildZip([
      { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO.replace('"0"', '"720"') },
      { name: 'word/document.xml', content: DOCUMENT_XML },
    ]);
    await expect(preflightDocx(clean)).resolves.toBeNull();
  });

  it('אינה נוגעת במסמך שאין בו קובץ הגדרות', async () => {
    const noSettings = buildZip([{ name: 'word/document.xml', content: DOCUMENT_XML }]);
    await expect(preflightDocx(noSettings)).resolves.toBeNull();
  });

  it('מוותרת בשקט על מה שאינו ארכיון', async () => {
    await expect(preflightDocx(bytesOf('לא zip בכלל'))).resolves.toBeNull();
  });
});

describe('preflightSource', () => {
  it('מסמך ריק עובר כפי שהוא', async () => {
    await expect(preflightSource(undefined)).resolves.toEqual({
      source: undefined,
      fontTable: null,
    });
  });

  it('URL שאין בו מה לתקן נשאר URL', async () => {
    const clean = buildZip([{ name: SETTINGS_PART, content: SETTINGS_WITH_ZERO.replace('"0"', '"720"') }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(clean)),
    );
    // חשוב שהמקור יחזור זהה: כך מסלול הפתיחה של כל שאר המסמכים אינו משתנה.
    const { source } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(source).toBe('http://127.0.0.1:1/doc.docx');
  });

  it('URL שיש בו מה לתקן מוחלף בבייטים מתוקנים', async () => {
    const broken = buildZip([{ name: SETTINGS_PART, content: SETTINGS_WITH_ZERO }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(broken)),
    );

    const { source } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(source).toBeInstanceOf(Blob);
    const bytes = new Uint8Array(await (source as Blob).arrayBuffer());
    expect(contains(bytes, bytesOf(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`))).toBe(true);
  });

  it('קריאה שנכשלה מחזירה את המקור, ואינה מונעת פתיחה', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('אין רשת');
      }),
    );
    const { source } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(source).toBe('http://127.0.0.1:1/doc.docx');
  });

  it('טיוטה שיש בה מה לתקן מתוקנת גם היא', async () => {
    // טיוטת שחזור מגיעה כ-Blob ולא כ-URL, וגם היא עלולה לשאת את הערך.
    const draft = new Blob([buildZip([{ name: SETTINGS_PART, content: SETTINGS_WITH_ZERO }])]);
    const { source } = await preflightSource(draft);
    expect(source).not.toBe(draft);
    const bytes = new Uint8Array(await (source as Blob).arrayBuffer());
    expect(contains(bytes, bytesOf(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`))).toBe(true);
  });
});
