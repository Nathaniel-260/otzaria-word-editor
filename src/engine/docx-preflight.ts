/**
 * תיקון ערכים שמקפיאים את המנוע, לפני שהוא רואה אותם.
 *
 * ## למה זה קיים, ולמה דווקא כאן
 *
 * `<w:defaultTabStop w:val="0"/>` ב-`word/settings.xml` שולח את בונה עצירות
 * הטאב של המנוע ללולאה שאינה נגמרת: הוא מקדם מיקום בצעדים של הערך הזה, וצעד
 * של אפס אינו מקדם. נמדד ב-superdoc 2.8.0 וגם ב-2.10.0 — מסמך Word ריק ותקין
 * שמכריחים בו את המאפיין הזה לאפס מקפיא את הדפדפן לצמיתות.
 *
 * הלולאה רצה על **החוט הראשי**, וזאת הנקודה שקובעת את הצורה של הקובץ הזה:
 * `OPEN_TIMEOUT_MS` ב-create-editor.ts אינו יכול להציל כאן, מפני שהטיימר שלו
 * צריך בדיוק את החוט שחסום. אין שום שעון-שמירה שיכול לתפוס את זה מבחוץ. הדרך
 * היחידה היא לא למסור למנוע את הערך מלכתחילה — כלומר כאן, לפני הפתיחה.
 *
 * ## הכלל: לתקן, ולא לחסום
 *
 * כל כשל בדרך — zip שלא נקרא, חלק חסר, דחיסה שלא נתמכת — מחזיר את המקור כמות
 * שהוא. שלב מקדים שנכשל אינו אמור למנוע פתיחה של מסמך שהיה נפתח בלעדיו: הוא
 * תיקון, לא שער. לכן אין כאן אף מסלול שזורק.
 *
 * ## למה zip מלא ולא חיפוש-והחלפה על הבייטים
 *
 * `settings.xml` דחוס בתוך הארכיון, ולכן אי אפשר לגעת בו בלי לפרוס אותו. מה
 * שכן נחסך: **אין כאן דוחס**. החלק המתוקן נכתב כרשומה לא-דחוסה (`STORED`),
 * וכל שאר החלקים מועתקים בייט-בבייט בדיוק כפי שהיו. כך הקובץ שנמסר למנוע זהה
 * למקור בכל מה שאינו המאפיין הבודד שתוקן, והמחיר הוא כמה קילובייטים.
 *
 * `CompressionStream` היה חוסך את הקילובייטים האלה, אבל דוחס שמתנהג אחרת
 * מהצפוי הוא באג שקט במסמך של המשתמש; רשומה לא-דחוסה אינה יכולה להשתבש.
 */
import { DOCX_MIME } from './export';
import { NO_VBA, readDocumentVba, type DocumentVba } from './vba-import';

/** החלק שבו יושבות הגדרות המסמך. */
export const SETTINGS_PART = 'word/settings.xml';

/**
 * החלק שמתאר את הגופנים שהמסמך משתמש בהם — כולל כאלה שאינם מותקנים.
 *
 * אינו מתוקן כאן ואינו נוגע לקיפאון; הוא נקרא ונמסר החוצה, מפני שזה המקום
 * היחיד שכבר פותח את הארכיון. מה שנעשה איתו נמצא ב-engine/docx-fonts.ts.
 */
export const FONT_TABLE_PART = 'word/fontTable.xml';

/**
 * ברירת המחדל של Word לעצירת טאב, ב-twips (720 = חצי אינץ' = 1.27 ס"מ).
 *
 * זה גם מה ש-OOXML מגדיר כערך כשהמאפיין נעדר לגמרי, ולכן כתיבתו במפורש שקולה
 * למחיקת המאפיין — ומפורשת יותר למי שיפתח את הקובץ אחר כך.
 */
export const DEFAULT_TAB_STOP_TWIPS = 720;

/**
 * בייטים שגובים מ-`ArrayBuffer` רגיל.
 *
 * הכינוי מפורש מפני ש-TypeScript מבדיל מאז 5.7 בין `ArrayBuffer` ל-
 * `SharedArrayBuffer`, ו-`Uint8Array` סתם כולל את שניהם — צורה ש-`Blob`
 * ו-`DecompressionStream` אינם מקבלים.
 */
type Bytes = Uint8Array<ArrayBuffer>;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_LOCAL_HEADER_SIZE = 30;
const ZIP_CENTRAL_HEADER_SIZE = 46;
const ZIP_EOCD_SIZE = 22;

/** דגל „הגדלים מגיעים אחרי הנתונים”. הכתיבה כאן תמיד יודעת אותם מראש. */
const ZIP_FLAG_DATA_DESCRIPTOR = 0x0008;
/** דגל הצפנה. ארכיון מוצפן אינו משהו שיש כאן מה לעשות איתו. */
const ZIP_FLAG_ENCRYPTED = 0x0001;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** הסימן שהארכיון הוא ZIP64. אין כאלה ב-DOCX ריאלי, ולכן פשוט לא נוגעים בהם. */
const ZIP64_MARKER_32 = 0xffffffff;
const ZIP64_MARKER_16 = 0xffff;

interface ZipEntry {
  /** שם החלק, לזיהוי. */
  name: string;
  /** בייטי השם כפי שהיו — כדי לא לקודד מחדש שם שאינו UTF-8. */
  nameBytes: Bytes;
  versionMadeBy: number;
  versionNeeded: number;
  flags: number;
  method: number;
  modTime: number;
  modDate: number;
  crc: number;
  internalAttrs: number;
  externalAttrs: number;
  /** התוכן כפי שהוא מאוחסן — דחוס או לא, לפי `method`. */
  data: Bytes;
  uncompressedSize: number;
}

/**
 * מתקנת את `settings.xml`. `null` = אין מה לתקן.
 *
 * הבדיקה היא על **הערך** ולא על המחרוזת `"0"`: גם `-1` וגם ערך שאינו מספר
 * מגיעים למנוע כאותו צעד-אפס. הרגקס סובלני לסדר מאפיינים ולרווחים, מפני שזה
 * XML שנכתב על ידי כלים שונים ולא רק על ידי Word.
 */
export function repairSettings(xml: string): string | null {
  const element = /<w:defaultTabStop\b[^>]*\/>/.exec(xml);
  if (!element) return null;

  const value = /\bw:val\s*=\s*"([^"]*)"/.exec(element[0]);
  const twips = value ? Number(value[1]) : Number.NaN;
  if (Number.isFinite(twips) && twips > 0) return null;

  return (
    xml.slice(0, element.index) +
    `<w:defaultTabStop w:val="${DEFAULT_TAB_STOP_TWIPS}"/>` +
    xml.slice(element.index + element[0].length)
  );
}

/** מה שהשלב המקדים מוציא: המסמך שיימסר למנוע, ומה שנקרא עליו בדרך. */
export interface PreflightResult {
  /** המקור שיש למסור למנוע. זהה למקור שנכנס כשלא נגענו בו. */
  source: string | File | Blob | undefined;
  /** תוכן `FONT_TABLE_PART`, או `null` כשאין או שלא נקרא. */
  fontTable: string | null;
  /**
   * המאקרו שבמסמך — לקריאה בלבד (engine/vba-import.ts).
   *
   * כאן מאותו טעם כמו טבלת הגופנים: הבייטים כבר נקראו והארכיון כבר נפתח, וזה
   * גם **הרגע** הנכון — הידיעה שבמסמך יש מאקרו שWord מריץ בפתיחה שייכת לזמן
   * הפתיחה, לא לזמן שבו המשתמש יחשוב לחפש אותה.
   */
  vba: DocumentVba;
}

/**
 * מקור המסמך, אחרי תיקון. מחזירה את המקור עצמו כשאין מה לתקן — כולל כשהבדיקה
 * עצמה לא הצליחה לרוץ.
 *
 * המקור נשאר URL כשלא נגענו בו, ובכוונה: כך המסלול שבו כל המסמכים נפתחים היום
 * אינו משתנה בגללנו. המחיר הוא קריאה נוספת של הבייטים מ-loopback מקומי, והוא
 * זניח מול פתיחה שנתקעת לנצח.
 *
 * טבלת הגופנים נקראת באותה הזדמנות: הבייטים כבר כאן והארכיון כבר נפתח, ולכן
 * קריאה שנייה שלהם רק בשביל הטבלה הייתה בזבוז.
 */
export async function preflightSource(
  source: string | File | Blob | undefined,
): Promise<PreflightResult> {
  if (source === undefined) return { source, fontTable: null, vba: NO_VBA };

  let bytes: Bytes;
  try {
    bytes =
      typeof source === 'string'
        ? new Uint8Array(await (await fetch(source)).arrayBuffer())
        : new Uint8Array(await source.arrayBuffer());
  } catch (error) {
    console.warn('[otzaria-word] הבדיקה המקדימה לא קראה את המסמך', error);
    return { source, fontTable: null, vba: NO_VBA };
  }

  const fontTable = await readDocxPart(bytes, FONT_TABLE_PART);
  // על בייטי המקור ולא על המתוקנים: התיקון נוגע ל-`settings.xml` בלבד, ואין
  // טעם לקרוא את המאקרו מעותק שנכתב מחדש.
  const vba = await readDocumentVba(bytes);
  const repaired = await preflightDocx(bytes);
  if (!repaired) return { source, fontTable, vba };

  console.warn(
    `[otzaria-word] ${SETTINGS_PART}: defaultTabStop מתוקן ל-${DEFAULT_TAB_STOP_TWIPS} — הערך שהיה מקפיא את המנוע`,
  );
  return { source: new Blob([repaired], { type: DOCX_MIME }), fontTable, vba };
}

/**
 * תוכן חלק מתוך ה-DOCX כטקסט. `null` כשאינו קיים, כשהארכיון אינו נקרא, או
 * כשהדחיסה אינה נתמכת — שלושה מקרים שבהם פשוט אין לנו מה לומר עליו.
 */
export async function readDocxPart(bytes: Bytes, name: string): Promise<string | null> {
  const entry = readZip(bytes)?.find((candidate) => candidate.name === name);
  return entry ? readEntryText(entry) : null;
}

/**
 * בייטי DOCX מתוקנים, או `null` כשאין מה לתקן ואין מה לדווח.
 *
 * מיוצאת בנפרד מ-`preflightSource` כדי שאפשר יהיה לבדוק אותה בלי רשת ובלי
 * `Blob` — היא כל הלוגיקה שיש כאן.
 */
export async function preflightDocx(bytes: Bytes): Promise<Bytes | null> {
  const entries = readZip(bytes);
  if (!entries) return null;

  const settings = entries.find((entry) => entry.name === SETTINGS_PART);
  if (!settings) return null;

  const xml = await readEntryText(settings);
  if (xml === null) return null;

  const repaired = repairSettings(xml);
  if (repaired === null) return null;

  const content = new TextEncoder().encode(repaired);
  const patched = entries.map((entry) =>
    entry === settings
      ? {
          ...entry,
          flags: entry.flags & ~ZIP_FLAG_DATA_DESCRIPTOR,
          method: METHOD_STORED,
          crc: crc32(content),
          data: content,
          uncompressedSize: content.byteLength,
        }
      : entry,
  );
  return writeZip(patched);
}

/** תוכן החלק כטקסט, או `null` כשאי אפשר לפרוס אותו. */
async function readEntryText(entry: ZipEntry): Promise<string | null> {
  if (entry.method === METHOD_STORED) return new TextDecoder().decode(entry.data);
  if (entry.method !== METHOD_DEFLATE) return null;

  const inflated = await inflateRaw(entry.data);
  return inflated && new TextDecoder().decode(inflated);
}

/**
 * פריסת deflate גולמי דרך `DecompressionStream`.
 *
 * `null` כשהסביבה אינה מכירה אותו או כשהנתונים אינם נפרסים — שני מקרים שבהם
 * אין לנו מה לומר על המסמך, ולכן הוא נמסר למנוע כמות שהוא.
 */
async function inflateRaw(data: Bytes): Promise<Bytes | null> {
  const Decompression = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!Decompression) return null;

  try {
    const source = new ReadableStream<BufferSource>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const reader = source.pipeThrough(new Decompression('deflate-raw')).getReader();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }

    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.byteLength;
    }
    return out;
  } catch (error) {
    console.warn('[otzaria-word] פריסת חלק מהמסמך נכשלה', error);
    return null;
  }
}

/**
 * קריאת הארכיון מהספרייה המרכזית שלו — ולא מסריקת כותרות מקומיות, שהיא ניחוש
 * כשיש בהן data descriptor. `null` פירושו „לא ארכיון שאני מבין”, וזו תשובה
 * חוקית לגמרי: המנוע יקבל את המקור.
 */
function readZip(bytes: Bytes): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) return null;

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === ZIP64_MARKER_16 || centralOffset === ZIP64_MARKER_32) return null;

  const entries: ZipEntry[] = [];
  let at = centralOffset;
  for (let i = 0; i < count; i++) {
    if (at + ZIP_CENTRAL_HEADER_SIZE > bytes.byteLength) return null;
    if (view.getUint32(at, true) !== ZIP_CENTRAL_SIGNATURE) return null;

    const flags = view.getUint16(at + 8, true);
    if (flags & ZIP_FLAG_ENCRYPTED) return null;

    const compressedSize = view.getUint32(at + 20, true);
    const uncompressedSize = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    if (compressedSize === ZIP64_MARKER_32 || localOffset === ZIP64_MARKER_32) return null;

    const nameBytes = bytes.subarray(at + ZIP_CENTRAL_HEADER_SIZE, at + ZIP_CENTRAL_HEADER_SIZE + nameLength);
    const data = entryData(bytes, view, localOffset, compressedSize);
    if (!data) return null;

    entries.push({
      name: new TextDecoder().decode(nameBytes),
      nameBytes: nameBytes.slice(),
      versionMadeBy: view.getUint16(at + 4, true),
      versionNeeded: view.getUint16(at + 6, true),
      flags,
      method: view.getUint16(at + 10, true),
      modTime: view.getUint16(at + 12, true),
      modDate: view.getUint16(at + 14, true),
      crc: view.getUint32(at + 16, true),
      internalAttrs: view.getUint16(at + 36, true),
      externalAttrs: view.getUint32(at + 38, true),
      data,
      uncompressedSize,
    });

    at += ZIP_CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** הבייטים המאוחסנים של רשומה, לפי הכותרת המקומית שלה. */
function entryData(
  bytes: Bytes,
  view: DataView,
  localOffset: number,
  compressedSize: number,
): Bytes | null {
  if (localOffset + ZIP_LOCAL_HEADER_SIZE > bytes.byteLength) return null;
  if (view.getUint32(localOffset, true) !== ZIP_LOCAL_SIGNATURE) return null;

  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const start = localOffset + ZIP_LOCAL_HEADER_SIZE + nameLength + extraLength;
  if (start + compressedSize > bytes.byteLength) return null;

  return bytes.subarray(start, start + compressedSize);
}

/**
 * מיקום ה-EOCD. נסרק מהסוף, כי לארכיון מותרת הערה בת עד 64KB אחריו.
 */
function findEocd(view: DataView): number {
  const last = view.byteLength - ZIP_EOCD_SIZE;
  const first = Math.max(0, view.byteLength - ZIP_EOCD_SIZE - 0xffff);
  for (let at = last; at >= first; at--) {
    if (view.getUint32(at, true) === ZIP_EOCD_SIGNATURE) return at;
  }
  return -1;
}

/**
 * כתיבת הארכיון מחדש.
 *
 * שדות ה-extra וההערות אינם נכתבים: הם נושאים חותמות זמן ומידע של מערכת
 * הקבצים, ואינם חלק ממה ש-DOCX הוא. מה שכן נשמר בדיוק הוא סדר הרשומות,
 * השמות, שיטת הדחיסה והבייטים עצמם.
 */
function writeZip(entries: ZipEntry[]): Bytes {
  let size = ZIP_EOCD_SIZE;
  for (const entry of entries) {
    size += ZIP_LOCAL_HEADER_SIZE + entry.nameBytes.byteLength + entry.data.byteLength;
    size += ZIP_CENTRAL_HEADER_SIZE + entry.nameBytes.byteLength;
  }

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  let at = 0;

  for (const entry of entries) {
    offsets.push(at);
    view.setUint32(at, ZIP_LOCAL_SIGNATURE, true);
    view.setUint16(at + 4, entry.versionNeeded, true);
    view.setUint16(at + 6, entry.flags & ~ZIP_FLAG_DATA_DESCRIPTOR, true);
    view.setUint16(at + 8, entry.method, true);
    view.setUint16(at + 10, entry.modTime, true);
    view.setUint16(at + 12, entry.modDate, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.data.byteLength, true);
    view.setUint32(at + 22, entry.uncompressedSize, true);
    view.setUint16(at + 26, entry.nameBytes.byteLength, true);
    view.setUint16(at + 28, 0, true);
    at += ZIP_LOCAL_HEADER_SIZE;
    out.set(entry.nameBytes, at);
    at += entry.nameBytes.byteLength;
    out.set(entry.data, at);
    at += entry.data.byteLength;
  }

  const centralOffset = at;
  entries.forEach((entry, index) => {
    view.setUint32(at, ZIP_CENTRAL_SIGNATURE, true);
    view.setUint16(at + 4, entry.versionMadeBy, true);
    view.setUint16(at + 6, entry.versionNeeded, true);
    view.setUint16(at + 8, entry.flags & ~ZIP_FLAG_DATA_DESCRIPTOR, true);
    view.setUint16(at + 10, entry.method, true);
    view.setUint16(at + 12, entry.modTime, true);
    view.setUint16(at + 14, entry.modDate, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.data.byteLength, true);
    view.setUint32(at + 24, entry.uncompressedSize, true);
    view.setUint16(at + 28, entry.nameBytes.byteLength, true);
    view.setUint16(at + 30, 0, true);
    view.setUint16(at + 32, 0, true);
    view.setUint16(at + 34, 0, true);
    view.setUint16(at + 36, entry.internalAttrs, true);
    view.setUint32(at + 38, entry.externalAttrs, true);
    view.setUint32(at + 42, offsets[index], true);
    at += ZIP_CENTRAL_HEADER_SIZE;
    out.set(entry.nameBytes, at);
    at += entry.nameBytes.byteLength;
  });

  view.setUint32(at, ZIP_EOCD_SIGNATURE, true);
  view.setUint16(at + 4, 0, true);
  view.setUint16(at + 6, 0, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralOffset, true);
  view.setUint32(at + 16, centralOffset, true);
  view.setUint16(at + 20, 0, true);

  return out;
}

let crcTable: Uint32Array | null = null;

/** CRC32 כפי ש-ZIP מגדיר אותו. נבנה פעם אחת, בפעם הראשונה שצריך אותו. */
function crc32(bytes: Bytes): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let value = i;
      for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[i] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
