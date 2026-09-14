/**
 * בונה DOCX מינימליים לבדיקת superdoc/docx-editor#3946.
 *
 *   node tmp/sp3946/make-docx.mjs
 *
 * מייצר:
 *   min-space.docx    — רווח אחד לפני <w:br/>
 *   min-nospace.docx  — זהה, בלי הרווח (ביקורת)
 *   grid-space.docx   — 24 פסקאות שאורכן גדל בתו, עם הרווח
 *   grid-nospace.docx — אותן 24, בלי הרווח
 */
import { writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ---------- zip מינימלי (store + deflate) ---------- */
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8');
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, end]);
}

/* ---------- חלקי ה-DOCX ---------- */
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

const SECT = `<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:num="2" w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;

function doc(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:p><w:pPr>${SECT}</w:pPr></w:p></w:body></w:document>`;
}

/** פסקה: טקסט (אולי עם רווח בסוף) → <w:br/> → טקסט אחרי. */
function para(before, withSpace, after) {
  const text = before + (withSpace ? ' ' : '');
  return (
    `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>` +
    `<w:r><w:br/></w:r>` +
    `<w:r><w:t xml:space="preserve">${after}</w:t></w:r>` +
    `</w:p>`
  );
}

function build(name, body) {
  const buf = zip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', RELS],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', doc(body)],
    ['word/styles.xml', STYLES],
  ]);
  writeFileSync(join(HERE, name), buf);
  console.log(name, buf.length, 'bytes');
}

const ONE = 'P10 abc abc abc abc abc dddddddddd';
build('min-space.docx', para(ONE, true, 'AFTER the break'));
build('min-nospace.docx', para(ONE, false, 'AFTER the break'));

/* רשת: אורך גדל בתו, כדי לראות באילו רוחבים הפער מופיע */
const GRID = [];
const GRIDN = [];
for (let i = 0; i < 24; i++) {
  const filler = 'd'.repeat(i);
  const before = `P${String(i).padStart(2, '0')} abc abc abc abc abc ${filler}`;
  GRID.push(para(before, true, 'AFTER the break'));
  GRIDN.push(para(before, false, 'AFTER the break'));
}
build('grid-space.docx', GRID.join(''));
build('grid-nospace.docx', GRIDN.join(''));

/* ---------- גרסאות RTL ---------- */
const SECT_RTL = `<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:num="2" w:space="708"/><w:bidi/><w:rtlGutter/><w:docGrid w:linePitch="360"/></w:sectPr>`;

function docRtl(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:p><w:pPr>${SECT_RTL}</w:pPr></w:p></w:body></w:document>`;
}

/** פסקה עברית: jc נתון, bidi, טקסט + רווח → <w:br/> → טקסט. */
function paraHe(before, withSpace, after, jc) {
  const text = before + (withSpace ? ' ' : '');
  return (
    `<w:p><w:pPr><w:bidi/><w:jc w:val="${jc}"/><w:rPr><w:rtl/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>` +
    `<w:r><w:rPr><w:rtl/></w:rPr><w:br/></w:r>` +
    `<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${after}</w:t></w:r>` +
    `</w:p>`
  );
}

function buildRtl(name, body) {
  const buf = zip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', RELS],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', docRtl(body)],
    ['word/styles.xml', STYLES],
  ]);
  writeFileSync(join(HERE, name), buf);
  console.log(name, buf.length, 'bytes');
}

const HE_HEAD = 'שבועת הדיינין וביאר רשי';
const HE_AFTER = 'השורה אחרי השבירה';

for (const jc of ['both', 'distribute']) {
  const g = [], gn = [];
  for (let i = 0; i < 24; i++) {
    const filler = 'ד'.repeat(i);
    const before = `${HE_HEAD} ${filler}`;
    g.push(paraHe(before, true, HE_AFTER, jc));
    gn.push(paraHe(before, false, HE_AFTER, jc));
  }
  buildRtl(`he-${jc}-space.docx`, g.join(''));
  buildRtl(`he-${jc}-nospace.docx`, gn.join(''));
}

/* ---------- מטריצת בידוד: כתב × כיוון ---------- */
const EN_HEAD = 'P00 abc abc abc abc abc';
for (const [scriptName, head, after] of [
  ['en', EN_HEAD, 'AFTER the break'],
  ['he', HE_HEAD, HE_AFTER],
]) {
  for (const dirName of ['ltr', 'rtl']) {
    const rtl = dirName === 'rtl';
    const body = [];
    for (let i = 0; i < 12; i++) {
      const filler = (rtl || scriptName === 'he' ? 'ד' : 'd').repeat(i);
      const text = `${head} ${filler} `;
      const rpr = rtl ? '<w:rPr><w:rtl/></w:rPr>' : '';
      const ppr = `<w:pPr>${rtl ? '<w:bidi/>' : ''}<w:jc w:val="both"/></w:pPr>`;
      body.push(
        `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${text}</w:t></w:r>` +
          `<w:r>${rpr}<w:br/></w:r>` +
          `<w:r>${rpr}<w:t xml:space="preserve">${after}</w:t></w:r></w:p>`,
      );
    }
    const sect = rtl ? SECT_RTL : SECT;
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:p><w:pPr>${sect}</w:pPr></w:p></w:body></w:document>`;
    const buf = zip([
      ['[Content_Types].xml', CONTENT_TYPES],
      ['_rels/.rels', RELS],
      ['word/_rels/document.xml.rels', DOC_RELS],
      ['word/document.xml', xml],
      ['word/styles.xml', STYLES],
    ]);
    writeFileSync(join(HERE, `mx-${scriptName}-${dirName}.docx`), buf);
    console.log(`mx-${scriptName}-${dirName}.docx`, buf.length, 'bytes');
  }
}
