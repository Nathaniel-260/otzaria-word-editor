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
  COMPLEX_SCRIPT_BOLD_NOTICE,
  CONTENT_PARTS,
  crc32 as moduleCrc32,
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
    expect(repairSettings(odd)).toContain(`"${DEFAULT_TAB_STOP_TWIPS}"`);
  });

  /* ------- שלוש דרכים שבהן הקיפאון לא נמנע, וסקירה יריבה מצאה אותן -------
   *
   * לא „תיקון פחות מדויק”: בכל השלוש התיקון פשוט לא קרה, והמשתמש נשאר עם
   * אוצריא תקועה שאין ממנה יציאה. לכן כל אחת מהן היא בדיקה משלה.                */

  it('הערה שיש בה ערך תקין אינה מסתירה את הערך האמיתי שאחריה', () => {
    // הרגקס הקודם לקח את ההתאמה הראשונה — זו שבהערה — ראה 720, והחזיר null.
    const shadowed =
      '<w:settings xmlns:w="ns"><!-- <w:defaultTabStop w:val="720"/> -->' +
      '<w:defaultTabStop w:val="0"/></w:settings>';
    const repaired = repairSettings(shadowed);
    expect(repaired).not.toBeNull();
    // ההערה נשארת תו-בתו; מה שהשתנה הוא רק האלמנט החי.
    expect(repaired).toContain('<!-- <w:defaultTabStop w:val="720"/> -->');
    expect(repaired).toContain(`<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>`);
  });

  it('הערה שיש בה הערך המקפיא אינה נערכת — אין שם עיצוב', () => {
    const inComment =
      '<w:settings xmlns:w="ns"><!-- <w:defaultTabStop w:val="0"/> --></w:settings>';
    expect(repairSettings(inComment)).toBeNull();
  });

  it('צורה שאינה סוגרת את עצמה מתוקנת, ונשארת זוג פתיחה-סגירה', () => {
    const paired =
      '<w:settings xmlns:w="ns"><w:defaultTabStop w:val="0"></w:defaultTabStop></w:settings>';
    const repaired = repairSettings(paired);
    expect(repaired).toBe(
      '<w:settings xmlns:w="ns">' +
        `<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"></w:defaultTabStop></w:settings>`,
    );
  });

  it('`>` בתוך ערך של מאפיין אחר אינו מסתיר את האלמנט', () => {
    const tricky = '<w:settings xmlns:w="ns"><w:defaultTabStop w:foo="a>b" w:val="0"/></w:settings>';
    const repaired = repairSettings(tricky);
    expect(repaired).toContain('w:foo="a>b"');
    expect(repaired).toContain(`w:val="${DEFAULT_TAB_STOP_TWIPS}"`);
  });

  /* ------------------- מה שנשמר, ולא נכתב מחדש ------------------- */

  it('קידומת שאינה `w` נשמרת', () => {
    const other = '<ns0:settings xmlns:ns0="ns"><ns0:defaultTabStop ns0:val="0"/></ns0:settings>';
    expect(repairSettings(other)).toContain(`<ns0:defaultTabStop ns0:val="${DEFAULT_TAB_STOP_TWIPS}"/>`);
  });

  it('מרכאות בודדות נקראות, ונשארות בודדות', () => {
    const single = "<w:settings xmlns:w='ns'><w:defaultTabStop w:val='0'/></w:settings>";
    expect(repairSettings(single)).toContain(`w:val='${DEFAULT_TAB_STOP_TWIPS}'`);
  });

  it('מרכאות בודדות עם ערך תקין אינן נוגעות', () => {
    // הרגקס הקודם קרא רק מרכאות כפולות, ולכן ראה „אין ערך” וכתב 720 על ערך
    // תקין לחלוטין — כתיבה מיותרת לתוך המסמך של המשתמש.
    const single = "<w:settings xmlns:w='ns'><w:defaultTabStop w:val='425'/></w:settings>";
    expect(repairSettings(single)).toBeNull();
  });

  it('אלמנט בלי `w:val` כלל מקבל אותו, בקידומת שלו', () => {
    const bare = '<w:settings xmlns:w="ns"><w:defaultTabStop/></w:settings>';
    expect(repairSettings(bare)).toBe(
      `<w:settings xmlns:w="ns"><w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/></w:settings>`,
    );
  });

  it('הוראת עיבוד שיש בה האלמנט אינה נערכת', () => {
    const pi = '<w:settings xmlns:w="ns"><?tool <w:defaultTabStop w:val="0"/> ?></w:settings>';
    expect(repairSettings(pi)).toBeNull();
  });

  it('הצהרת ה-XML אינה מפריעה לתיקון שאחריה', () => {
    // ההצהרה היא הוראת עיבוד, וההוראות נבלעות שלמות — צריך לוודא שהבליעה
    // אינה בולעת גם את מה שבא אחריה.
    expect(repairSettings(SETTINGS_WITH_ZERO)).toContain(`"${DEFAULT_TAB_STOP_TWIPS}"`);
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
    expect(repairComplexScriptBold('<w:r><w:rPr />' + '<w:t>שלום</w:t></w:r>')).toBeNull();
  });

  /* ---------------- מה שהתיקון אסור לו לגעת בו ---------------- */

  it('אינה כותבת בתוך הערת XML', () => {
    // ההערה נראית לרגקס בדיוק כמו תגים, וכתיבה בתוכה היא עריכה של טקסט ולא
    // של עיצוב.
    const commented = `<w:body><!-- ${runProps('<w:bCs/>')} --></w:body>`;
    expect(repairComplexScriptBold(commented)).toBeNull();
  });

  it('אינה כותבת בתוך CDATA', () => {
    const cdata = `<w:r><w:rPr><w:i/></w:rPr><w:t><![CDATA[${runProps('<w:bCs/>')}]]></w:t></w:r>`;
    expect(repairComplexScriptBold(cdata)).toBeNull();
  });

  it('הערה או CDATA אינן מכבות תיקון אמיתי שאחריהן', () => {
    // המקרה שקבר את הגרסה הקודמת בצורה אחרת: `</w:rPr>` שיושבת בתוך הערה
    // הוציאה מהמחסנית את ה-scope החי, והתיקון האמיתי נעלם.
    const mixed = `<w:body><!-- </w:rPr> -->${runProps('<w:bCs/>')}</w:body>`;
    expect(repairComplexScriptBold(mixed)).toContain('<w:b/><w:bCs/>');
  });

  it('`>` בתוך ערך מאפיין אינו מבלבל את הסורק', () => {
    // XML חוקי לגמרי. רגקס שנעצר על ה-`>` הראשון קרא כאן תג אחר לגמרי.
    const odd =
      '<w:r><w:rPr><w:rStyle w:val="a>b"/><w:bCs/></w:rPr><w:t>שלום</w:t></w:r>';
    expect(repairComplexScriptBold(odd)).toContain('<w:b/><w:bCs/>');
  });

  it('`rPrChange` שאינו נקרא כמצופה אינו מכבה את שאר החלק', () => {
    // ההתנהגות שהייתה הגרועה מכולן: מונה `rPrChange` שנתקע על 1 והשתיק את
    // התיקון מאותו בייט ועד סוף הקובץ, בשקט. הכלל היום הוא קינון, ולכן
    // ה-`rPr` שבתוך ההיסטוריה מדולגת בזכות עומקה ולא בזכות שם התג.
    const brokenName =
      '<w:body><w:r><w:rPr><w:rPrChange w:id="1" w:author="a>b">' +
      '<w:rPr><w:bCs/></w:rPr></w:rPrChange></w:rPr></w:r>' +
      runProps('<w:bCs/>') +
      '</w:body>';
    const repaired = repairComplexScriptBold(brokenName);
    expect(repaired).toContain('<w:b/><w:bCs/>');
    // ההיסטוריה עצמה נשארה כפי שהייתה.
    expect(repaired).toContain('<w:rPrChange w:id="1" w:author="a>b"><w:rPr><w:bCs/></w:rPr>');
  });

  it('סגירת `rPr` תלושה אינה מפילה את המונה מתחת לאפס', () => {
    // וזה מה שהיה מרשה ל-`rPrChange` **האמיתי** הבא להיכתב לתוכו.
    const stray =
      '</w:rPr><w:r><w:rPr><w:rPrChange w:id="2" w:author="x">' +
      '<w:rPr><w:bCs/></w:rPr></w:rPrChange></w:rPr></w:r>';
    expect(repairComplexScriptBold(stray)).toBeNull();
  });

  it('`rPr` שאינה נסגרת בסוף החלק מאבדת רק את עצמה', () => {
    const truncated = `<w:body>${runProps('<w:bCs/>')}<w:r><w:rPr><w:bCs/>`;
    const repaired = repairComplexScriptBold(truncated);
    expect(repaired!.match(/<w:b\/>/g)).toHaveLength(1);
  });

  it('`rPr` שאינה נסגרת **באמצע** מכבה את מה שאחריה — וזה מתועד, לא מתוקן', () => {
    // סקירה יריבה מצאה את זה, וזו אותה צורת כשל שכלל העומק נבחר כדי למנוע
    // („מונה שנתקע מכבה את התיקון עד סוף החלק”) — רק שהטריגר אחר: פתיחה בלי
    // סגירה משאירה את העומק על 1 לנצח, ולכן כל `bCs` שאחריה נראית כהיסטוריה.
    //
    // לא מתוקן, וזו החלטה: כדי להתאושש צריך לדעת **איפה** ה-`rPr` הפתוחה
    // הייתה נסגרת, וזה בדיוק מה שאין ב-XML שאינו תקין. המנוע עצמו אינו פורס
    // מסמך כזה, ולכן אין כאן הדגשה שאובדת למשתמש — יש מסמך שאינו נפתח.
    // הבדיקה קיימת כדי שההתנהגות תהיה נמדדת ולא מופתעת.
    const broken = `<w:body><w:r><w:rPr><w:bCs/><w:r><w:rPr><w:bCs/></w:rPr></w:r>`;
    expect(repairComplexScriptBold(broken)).toBeNull();
  });

  /* ---------------- קידומות ---------------- */

  it('מתקנת גם כשמרחב השמות קשור לקידומת אחרת, ובאותה קידומת', () => {
    // החבילה רשאית לקשור את WordprocessingML לכל קידומת. `w:b` שנכתבת לתוך
    // מסמך כזה שייכת למרחב שמות אחר לגמרי — כלומר לא הדגשה.
    const other = '<ns0:r><ns0:rPr><ns0:bCs/></ns0:rPr><ns0:t>שלום</ns0:t></ns0:r>';
    expect(repairComplexScriptBold(other)).toContain('<ns0:b/><ns0:bCs/>');
  });

  it('אינה מוסיפה `b` שנייה כשהקיימת נושאת קידומת אחרת', () => {
    // שתי `b` באותה `rPr` הן `CT_RPr` פסולה.
    expect(repairComplexScriptBold('<w:rPr><ns0:b/><w:bCs/></w:rPr>')).toBeNull();
  });

  /* ---------------- ערכי ST_OnOff ---------------- */

  it('קוראת `w:val` גם במרכאות בודדות', () => {
    // אחרת „לא מודגש” שנכתב במפורש היה נהפך למודגש — שינוי במסמך.
    expect(repairComplexScriptBold(runProps("<w:bCs w:val='0'/>"))).toBeNull();
    expect(repairComplexScriptBold(runProps("<w:bCs w:val='1'/>"))).toContain('<w:b/>');
    expect(repairComplexScriptBold(runProps("<w:b w:val='0'/><w:bCs/>"))).toBeNull();
  });

  it('שתי `bCs` באותה rPr — האחרונה קובעת', () => {
    expect(repairComplexScriptBold(runProps('<w:bCs w:val="0"/><w:bCs/>'))).toContain('<w:b/>');
    expect(repairComplexScriptBold(runProps('<w:bCs/><w:bCs w:val="0"/>'))).toBeNull();
  });

  /* ---------------- אינווריאנטים ---------------- */

  it('אינה משנה דבר מלבד ה-`b` שהוסיפה', () => {
    // `toContain` אינו יכול לתפוס פלט שכל השאר בו נהרס. זה כן.
    const source =
      '<w:body>' +
      runProps('<w:rFonts w:cs="David"/><w:bCs/><w:szCs w:val="28"/>') +
      runProps('<w:b/><w:bCs/>') +
      '<w:p><w:pPr><w:rPr><w:bCs/></w:rPr></w:pPr></w:p>' +
      '</w:body>';
    const repaired = repairComplexScriptBold(source)!;
    const strip = (text: string) => text.split('<w:b/>').join('');
    expect(strip(repaired)).toBe(strip(source));
  });

  it('מעבר שני אינו מוצא מה לתקן', () => {
    const once = repairComplexScriptBold(runProps('<w:bCs/>') + runProps('<w:bCs/>'))!;
    expect(repairComplexScriptBold(once)).toBeNull();
  });

  it('סורקת בזמן לינארי, גם על חלק בגודל של ספר', () => {
    // המודול הזה קיים מפני שחסימה של החוט הראשי אינה נתפסת אחר כך. סריקה
    // ריבועית כאן הייתה בדיוק אותו כשל, במסלול חדש.
    const unit = runProps('<w:bCs/>');
    const small = unit.repeat(2_000);
    const large = unit.repeat(8_000);

    const time = (xml: string): number => {
      const started = performance.now();
      expect(repairComplexScriptBold(xml)).not.toBeNull();
      return performance.now() - started;
    };
    time(small); // חימום, שלא נמדוד את ההידור הראשון
    const smallMs = Math.max(time(small), 1);
    const largeMs = time(large);

    // פי ארבעה קלט. סף רחב בכוונה — זה שער נגד ריבועיות, לא מדידת ביצועים.
    expect(largeMs / smallMs).toBeLessThan(12);
  });

  it('הפלט הוא XML תקין', () => {
    const source = `<w:document xmlns:w="ns"><w:body>${runProps('<w:bCs/>')}</w:body></w:document>`;
    const repaired = repairComplexScriptBold(source)!;
    const parsed = new DOMParser().parseFromString(repaired, 'application/xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
  });
});

describe('crc32', () => {
  // `crc32` המקומי בקובץ הזה מחשב את הפולינום בכל בייט מחדש, בלי טבלה — ולכן
  // הוא מימוש **בלתי תלוי** במה שבמודול, ולא העתקה שלו. CRC שגוי הוא ארכיון
  // שבור, וזה כשל שקט.
  //
  // הבדיקות כאן נשארות גם אחרי ש-slice-by-4 הוסר מהמודול (הוא נמדד איטי
  // יותר; ראו את ההערה שם). זה בדיוק מה שהן נועדו לתפוס: מי שיכתוב שוב
  // מימוש „מהיר” ויטעה בשארית או בסדר הבייטים ייפול כאן.

  it('מסכימה עם וקטור הבדיקה המקובל', () => {
    // "123456789" → 0xCBF43926, הווקטור של CRC-32/ISO-HDLC.
    expect(moduleCrc32(bytesOf('123456789'))).toBe(0xcbf43926);
  });

  it('מסכימה עם מימוש הייחוס בכל אורך, ובפרט באלה שאינם כפולה של ארבע', () => {
    // מימוש שמתקדם יותר מבייט בשלב נשבר בשארית, ולכן כל אורך קצר נבדק.
    for (let length = 0; length <= 16; length++) {
      const bytes = new Uint8Array(length) as Uint8Array<ArrayBuffer>;
      for (let i = 0; i < length; i++) bytes[i] = (i * 31 + 7) & 0xff;
      expect(moduleCrc32(bytes)).toBe(crc32(bytes));
    }

    const big = new Uint8Array(5_003) as Uint8Array<ArrayBuffer>;
    for (let i = 0; i < big.byteLength; i++) big[i] = (i * 131 + 17) & 0xff;
    expect(moduleCrc32(big)).toBe(crc32(big));
  });

  it('מסכימה עם מימוש הייחוס על טקסט עברי', () => {
    // עברית היא שני בייטים לתו, ולכן גם הגושים וגם השארית נראים אחרת.
    const bytes = bytesOf('שבועת הדיינין, מודה במקצת');
    expect(moduleCrc32(bytes)).toBe(crc32(bytes));
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
      // שמות שאינם מה ש-Word כותב אבל חוקיים ב-OPC: הוא נפתר דרך ה-rels ואינו
      // מחייב ספרה, ושמות חלקים אינם תלויי רישיות.
      'word/header.xml',
      'word/footer.xml',
      'word/document2.xml',
      'Word/Document.xml',
      // חלק אמיתי של Word 2010, ובו גיליון סגנונות שלם.
      'word/stylesWithEffects.xml',
      // הספרה מותרת בכל שם שיכול לשאת אותה, ולא רק בארבעה מהם.
      'word/footnotes2.xml',
      'word/endnotes2.xml',
      'word/comments2.xml',
      'word/numbering2.xml',
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
      // ההתאמה היא על שם החלק כולו, ולא על חלק ממנו.
      'word/document.xml.rels',
      'word/_rels/document.xml.rels',
      'word/../word/document.xml',
      'word/documentation.xml',
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
      notice: null,
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

  it('מסמך שההדגשה בו הושלמה מדווח על כך למשתמש', async () => {
    const withBoldCs = buildZip([
      { name: SETTINGS_PART, content: SETTINGS_WITH_ZERO.replace('"0"', '"720"') },
      {
        name: 'word/styles.xml',
        content: '<w:styles xmlns:w="ns"><w:style><w:rPr><w:bCs/></w:rPr></w:style></w:styles>',
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(withBoldCs)),
    );

    const { notice } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(notice).toBe(COMPLEX_SCRIPT_BOLD_NOTICE);
  });

  it('תיקון שאינו נראה למשתמש אינו מדווח לו', async () => {
    // `defaultTabStop` הוא ההפרש בין מסמך שנפתח למסמך שקופא, ואינו משנה דבר
    // במסמך עצמו. שורת מצב שמדווחת על כל דבר היא שורת מצב שאיש אינו קורא.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(buildZip([{ name: SETTINGS_PART, content: SETTINGS_WITH_ZERO }]))),
    );

    const { notice } = await preflightSource('http://127.0.0.1:1/doc.docx');
    expect(notice).toBeNull();
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
