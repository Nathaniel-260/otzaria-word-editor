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
 *
 * מאז שהתיקון השני נכנס — `<w:b/>` שמושלם לצד `<w:bCs/>`, כדי שהדגשה של כתב
 * מורכב תגיע למסך — יש כאן חובה שלישית, והיא זו שקשה: **מה שאין לגעת בו**.
 * `w:bCs` מופיע גם בתוך `w:rPrChange`, שהוא העיצוב שהיה *לפני* שינוי מסומן;
 * כתיבה שם משנה היסטוריה, ומסמך עם מעקב שינויים הוא בדיוק המסמך שאין רשות
 * לשבור. לכן הבדיקות כאן מודדות גם קינון, גם `w:val` מכובה, וגם מסמך שאין בו
 * מה לתקן ולכן אינו נכתב מחדש בכלל.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import {
  CONTENT_PARTS,
  DEFAULT_TAB_STOP_TWIPS,
  preflightDocx,
  preflightSource,
  repairComplexScriptBold,
  repairSettings,
  SETTINGS_PART,
} from '../../src/engine/docx-preflight';
import { NO_VBA } from '../../src/engine/vba-import';

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

/** `rPr` שלמה, כדי שהבדיקות יקראו כמו ה-XML האמיתי ולא כמו קטעים. */
const runProps = (inner: string) => `<w:r><w:rPr>${inner}</w:rPr><w:t>שלום</w:t></w:r>`;

describe('repairComplexScriptBold', () => {
  it('משלימה `w:b` לצד `bCs` בודדת', () => {
    const repaired = repairComplexScriptBold(runProps('<w:bCs/>'));
    // מיד לפני `bCs`, מפני ש-CT_RPr היא רצף ו-`b` בא לפניה.
    expect(repaired).toContain('<w:rPr><w:b/><w:bCs/></w:rPr>');
  });

  it('שומרת על סדר האלמנטים גם כשיש שכנים לפני ואחרי', () => {
    const repaired = repairComplexScriptBold(
      runProps('<w:rFonts w:cs="David"/><w:bCs/><w:i/><w:szCs w:val="28"/>'),
    );
    expect(repaired).toContain('<w:rFonts w:cs="David"/><w:b/><w:bCs/><w:i/>');
  });

  it('מתקנת כל ה-rPr במסמך, ולא רק את הראשונה', () => {
    const repaired = repairComplexScriptBold(
      runProps('<w:bCs/>') + runProps('<w:iCs/>') + runProps('<w:bCs/>'),
    );
    expect(repaired!.match(/<w:b\/>/g)).toHaveLength(2);
  });

  it('אינה נוגעת ב-rPr שיש בה כבר `w:b`', () => {
    expect(repairComplexScriptBold(runProps('<w:b/><w:bCs/>'))).toBeNull();
    expect(repairComplexScriptBold(runProps('<w:b w:val="1"/><w:bCs/>'))).toBeNull();
  });

  it('אינה הופכת `w:b` שכובה במפורש', () => {
    // אמירה מפורשת של מי שכתב את הקובץ: „לא מודגש בלטינית, מודגש בעברית”.
    // אנחנו משלימים מה שנעדר, לא מבטלים מה שנכתב.
    expect(repairComplexScriptBold(runProps('<w:b w:val="0"/><w:bCs/>'))).toBeNull();
  });

  it('אינה נוגעת ב-`bCs` שכובה', () => {
    for (const off of ['0', 'false', 'off', 'FALSE']) {
      expect(repairComplexScriptBold(runProps(`<w:bCs w:val="${off}"/>`))).toBeNull();
    }
  });

  it('מתקנת `bCs` שדולקת במפורש', () => {
    for (const on of ['1', 'true', 'on']) {
      expect(repairComplexScriptBold(runProps(`<w:bCs w:val="${on}"/>`))).toContain('<w:b/>');
    }
  });

  it('אינה כותבת בתוך `w:rPrChange` — זו היסטוריה של שינוי מסומן', () => {
    const tracked = `<w:r><w:rPr><w:rPrChange w:id="1" w:author="x"><w:rPr><w:bCs/></w:rPr></w:rPrChange></w:rPr></w:r>`;
    expect(repairComplexScriptBold(tracked)).toBeNull();
  });

  it('מתקנת את הריצה עצמה גם כשיש לצדה `rPrChange`', () => {
    // המקרה שרגקס לא-להוט על `<w:rPr>…</w:rPr>` היה טועה בו: הוא היה קושר את
    // הפתיחה החיצונית לסגירה הפנימית, ומודד את ההיסטוריה במקום את הריצה.
    const tracked =
      `<w:r><w:rPr><w:bCs/>` +
      `<w:rPrChange w:id="1" w:author="x"><w:rPr><w:i/></w:rPr></w:rPrChange>` +
      `</w:rPr><w:t>שלום</w:t></w:r>`;
    const repaired = repairComplexScriptBold(tracked);
    expect(repaired).toContain('<w:rPr><w:b/><w:bCs/>');
    // וההיסטוריה נשארה כפי שהייתה.
    expect(repaired).toContain('<w:rPrChange w:id="1" w:author="x"><w:rPr><w:i/></w:rPr>');
  });

  it('מתקנת סגנון, שזה המקרה שדווח', () => {
    // בדיוק מה שיש בקובץ שדווח: „כותרת 2” עם `bCs` ובלי `b`.
    const styles =
      '<w:styles xmlns:w="ns"><w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/>' +
      '<w:rPr><w:rFonts w:cs="FrankRuehl DP"/><w:bCs/><w:szCs w:val="28"/></w:rPr></w:style></w:styles>';
    expect(repairComplexScriptBold(styles)).toContain('<w:b/><w:bCs/>');
  });

  it('אינה נוגעת במסמך שאין בו `bCs` בכלל', () => {
    expect(repairComplexScriptBold(runProps('<w:b/><w:i/>'))).toBeNull();
    expect(repairComplexScriptBold(DOCUMENT_XML)).toBeNull();
  });

  it('אינה מתקנת `rPr` ריקה או סוגרת-עצמה', () => {
    expect(repairComplexScriptBold('<w:r><w:rPr/><w:t>שלום</w:t></w:r>')).toBeNull();
  });
});

describe('CONTENT_PARTS', () => {
  it('תופס את החלקים שיש בהם תכונות ריצה', () => {
    for (const name of [
      'word/document.xml',
      'word/styles.xml',
      'word/numbering.xml',
      'word/footnotes.xml',
      'word/endnotes.xml',
      'word/comments.xml',
      'word/header1.xml',
      'word/footer3.xml',
    ]) {
      expect(CONTENT_PARTS.test(name)).toBe(true);
    }
  });

  it('אינו תופס חלקים שאין להם מה לתרום', () => {
    // `settings.xml` יש לו תיקון משלו; `glossary` אינו מרונדר; `styles` שאינו
    // תחת `word/` אינו החלק שלנו.
    for (const name of [
      SETTINGS_PART,
      'word/fontTable.xml',
      'word/glossary/document.xml',
      'word/theme/theme1.xml',
      'customXml/item1.xml',
      'styles.xml',
    ]) {
      expect(CONTENT_PARTS.test(name)).toBe(false);
    }
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
    expect(contains(repaired!.bytes, bytesOf(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`))).toBe(true);
    expect(contains(repaired!.bytes, bytesOf('<w:defaultTabStop w:val="0"/>'))).toBe(false);

    // החלקים האחרים עברו בייט-בבייט: גם הדחוס וגם זה שלא.
    expect(contains(repaired!.bytes, new Uint8Array(deflateRawSync(bytesOf('<Types/>'))))).toBe(true);
    expect(contains(repaired!.bytes, bytesOf(DOCUMENT_XML))).toBe(true);

    // היומן מדווח מה שונה, ולא רק שנגענו.
    expect(repaired!.notes).toEqual([expect.stringContaining('defaultTabStop')]);
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
    await expect(preflightDocx(repaired!.bytes)).resolves.toBeNull();
  });

  it('מתקנת גם סגנונות, ומדווחת על שני התיקונים בנפרד', async () => {
    const styles =
      '<w:styles xmlns:w="ns"><w:style w:styleId="2"><w:rPr><w:bCs/></w:rPr></w:style></w:styles>';
    const repaired = await preflightDocx(
      buildZip([
        { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO },
        { name: 'word/styles.xml', content: styles },
        { name: 'word/document.xml', content: DOCUMENT_XML },
      ]),
    );

    expect(repaired).not.toBeNull();
    expect(contains(repaired!.bytes, bytesOf('<w:rPr><w:b/><w:bCs/></w:rPr>'))).toBe(true);
    expect(repaired!.notes).toHaveLength(2);
    expect(repaired!.notes[1]).toContain('word/styles.xml');
    // ושוב על התוצאה: אין יותר מה לתקן, לא בהגדרות ולא בסגנונות.
    await expect(preflightDocx(repaired!.bytes)).resolves.toBeNull();
  });

  it('חלק שאין בו `bCs` אינו נכתב מחדש בכלל', async () => {
    // חשוב לא פחות מהתיקון: מסמך עברי רגיל אינו משלם על התיקון הזה כלום. הגוף
    // עובר בייט-בבייט, כלומר גם דחוס כפי שהיה.
    const body =
      '<w:document xmlns:w="ns"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr>' +
      '<w:t>מודגש</w:t></w:r></w:p></w:body></w:document>';
    const repaired = await preflightDocx(
      buildZip([
        { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO },
        { name: 'word/document.xml', content: body },
      ]),
    );

    expect(repaired!.notes).toEqual([expect.stringContaining('defaultTabStop')]);
    expect(contains(repaired!.bytes, new Uint8Array(deflateRawSync(bytesOf(body))))).toBe(true);
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
      vba: NO_VBA,
    });
  });

  it('מסמך בלי מאקרו מדווח שאין בו מאקרו', async () => {
    const clean = buildZip([{ name: SETTINGS_PART, content: SETTINGS_WITH_ZERO.replace('"0"', '"720"') }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(clean)),
    );

    const { vba } = await preflightSource('http://127.0.0.1:1/doc.docx');
    // `hasMacroPart` הוא מה שקובע את סיומת השמירה, ולכן חשוב שהוא יהיה שקר
    // כאן: מסמך רגיל אינו אמור להיות נשמר כ-`.docm`.
    expect(vba.hasMacroPart).toBe(false);
    expect(vba.status).toBeNull();
  });

  it('קריאה שנכשלה אינה מדווחת על מאקרו שלא נבדקו', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('אין רשת');
      }),
    );

    // „לא יודעים” אינו „יש מאקרו”: דיווח חיובי כאן היה משנה סיומת של מסמך
    // שכלל לא נקרא.
    const { vba } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(vba).toEqual(NO_VBA);
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
