/**
 * `w:nsid` ייחודי לכל הגדרת מספור — והתיקונים של הדרך החוצה כמקשה אחת.
 *
 * המקרה שממנו זה בא נמדד ב-Word: רשימה עברית שהעורך יצר חלקה nsid עם
 * ההגדרה העשרונית שממנה שוכפלה, ו-Word הציג אותה כ-„1. 2.”. ראו
 * engine/docx-numbering-ids.ts.
 */
import { describe, it, expect } from 'vitest';
import { uniqueNumberingIds } from '../../src/engine/docx-numbering-ids';
import { postflightDocx } from '../../src/engine/docx-postflight';
import { crc32, readEntryText, readZip, writeZip, type Bytes, type ZipEntry } from '../../src/engine/docx-parts';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const abstractNum = (id: number, nsid: string, fmt: string, text: string): string =>
  `<w:abstractNum w:abstractNumId="${id}"><w:nsid w:val="${nsid}"/><w:multiLevelType w:val="hybridMultilevel"/>` +
  `<w:tmpl w:val="EE6417C4"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/>` +
  `<w:lvlText w:val="${text}"/></w:lvl></w:abstractNum>`;

const numbering = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}>${body}` +
  `<w:num w:numId="3"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="4"><w:abstractNumId w:val="2"/></w:num>` +
  `</w:numbering>`;

/** צורת הקובץ שנמדדה: העשרוני והעברי חולקים nsid. */
const MEASURED = numbering(
  abstractNum(0, '16126B07', 'bullet', '') +
    abstractNum(1, '587013BA', 'decimal', '%1.') +
    abstractNum(2, '587013BA', 'hebrew1', '%1)'),
);

const nsids = (xml: string): string[] => [...xml.matchAll(/<w:nsid w:val="([^"]+)"\/>/g)].map((m) => m[1]!);

describe('uniqueNumberingIds', () => {
  it('ההופעה השנייה של nsid מקבלת ערך חדש, והראשונה נשארת', () => {
    const out = uniqueNumberingIds(MEASURED) ?? '';
    const [bullet, decimal, hebrew] = nsids(out);
    expect(bullet).toBe('16126B07');
    expect(decimal).toBe('587013BA');
    expect(hebrew).not.toBe('587013BA');
    expect(hebrew).toMatch(/^[0-9A-F]{8}$/);
  });

  it('רק התג עצמו משתנה — שאר הקובץ זהה', () => {
    const out = uniqueNumberingIds(MEASURED) ?? '';
    const fresh = nsids(out)[2]!;
    expect(out.replace(fresh, '587013BA')).toBe(MEASURED);
  });

  it('הערך החדש דטרמיניסטי — שתי שמירות, אותם בייטים', () => {
    expect(uniqueNumberingIds(MEASURED)).toBe(uniqueNumberingIds(MEASURED));
  });

  it('הערך החדש אינו מתנגש באף nsid קיים', () => {
    const many = numbering(
      [0, 1, 2, 3, 4, 5].map((id) => abstractNum(id, id < 3 ? 'AAAAAAAA' : `0000000${id}`, 'decimal', '%1.')).join(''),
    );
    const values = nsids(uniqueNumberingIds(many) ?? '');
    expect(new Set(values).size).toBe(values.length);
  });

  it('בלי כפילות — `null`', () => {
    expect(uniqueNumberingIds(numbering(abstractNum(0, '11111111', 'decimal', '%1.')))).toBeNull();
  });

  it('השוואה בלי תלות ברישיות', () => {
    const xml = numbering(abstractNum(0, 'abcdef12', 'decimal', '%1.') + abstractNum(1, 'ABCDEF12', 'hebrew1', '%1.'));
    const values = nsids(uniqueNumberingIds(xml) ?? '');
    expect(values[0]).toBe('abcdef12');
    expect(values[1]!.toUpperCase()).not.toBe('ABCDEF12');
  });

  it('קידומת אחרת נתמכת', () => {
    const xml = MEASURED.replace(/<(\/?)w:/g, '<$1ns0:').replace(/ w:/g, ' ns0:').replace('xmlns:ns0', 'xmlns:ns0');
    const out = uniqueNumberingIds(xml) ?? '';
    const values = [...out.matchAll(/<ns0:nsid ns0:val="([^"]+)"\/>/g)].map((m) => m[1]);
    expect(new Set(values).size).toBe(3);
  });

  it('nsid בתוך הערה אינו נספר', () => {
    const xml = numbering(
      `<!-- ${abstractNum(9, '587013BA', 'decimal', '%1.')} -->` + abstractNum(1, '587013BA', 'decimal', '%1.'),
    );
    expect(uniqueNumberingIds(xml)).toBeNull();
  });
});

const enc = new TextEncoder();

function entry(name: string, text: string): ZipEntry {
  const data = enc.encode(text) as Bytes;
  return {
    name,
    nameBytes: enc.encode(name) as Bytes,
    versionMadeBy: 20,
    versionNeeded: 10,
    flags: 0,
    method: 0,
    modTime: 0,
    modDate: 0x21,
    crc: crc32(data),
    internalAttrs: 0,
    externalAttrs: 0,
    data,
    uncompressedSize: data.byteLength,
  };
}

async function partText(bytes: Bytes, name: string): Promise<string> {
  const found = readZip(bytes)?.find((e) => e.name === name);
  return (found && (await readEntryText(found))) ?? '';
}

describe('postflightDocx', () => {
  const documentXml =
    `<w:document ${W}><w:body><w:p><w:pPr><w:bidi/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">שלום עולם.</w:t></w:r></w:p></w:body></w:document>`;

  it('שני התיקונים, כל אחד בחלק שלו', async () => {
    const input = writeZip([entry('word/document.xml', documentXml), entry('word/numbering.xml', MEASURED)]);
    const out = await postflightDocx(input);
    expect(out).not.toBeNull();
    expect(await partText(out!, 'word/document.xml')).toContain('<w:rtl/>');
    expect(new Set(nsids(await partText(out!, 'word/numbering.xml'))).size).toBe(3);
  });

  it('מסמך שאין בו מה לתקן — `null`', async () => {
    const plain = `<w:document ${W}><w:body><w:p><w:r><w:t>hello</w:t></w:r></w:p></w:body></w:document>`;
    const input = writeZip([entry('word/document.xml', plain)]);
    expect(await postflightDocx(input)).toBeNull();
  });
});
