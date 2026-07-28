// Renderer-side `.docx` writer for the bible export. It mirrors
// `ExportBibleMSWord` in `extra-work/bin-helper/Helper.cs` (which uses
// `DocumentFormat.OpenXml`) so both paths produce the same document, but
// without the .NET helper process: the OOXML parts are plain strings and the
// package is a minimal ZIP built here, so nothing is loaded until an export is
// actually requested.

import { fsWriteFile, pathJoin } from '../server/fileHelpers';

export type BibleWordEntryType = {
    title: string;
    body: string;
    fontFamily: string | null;
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const WORD_NAMESPACE =
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Word font sizes are in half-points, matching the `FontSize` values in
// `Helper.cs`: 28 = 14pt for titles, 24 = 12pt for verse bodies.
const TITLE_HALF_POINT_SIZE = '28';
const BODY_HALF_POINT_SIZE = '24';

const CONTENT_TYPES_XML =
    XML_HEADER +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/' +
    'content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.' +
    'openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.' +
    'openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

const PACKAGE_RELS_XML =
    XML_HEADER +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/' +
    'relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/' +
    'officeDocument/2006/relationships/officeDocument" ' +
    'Target="word/document.xml"/>' +
    '</Relationships>';

// XML 1.0 cannot represent these at all, not even as entities. Verse text and
// font names come from user-imported bible files, and letting one through
// yields a `document.xml` that Word refuses to open.
// eslint-disable-next-line no-control-regex -- matching them is the point
const INVALID_XML_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

function escapeXMLText(value: string) {
    return value
        .replaceAll(INVALID_XML_CHAR_REGEX, '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeXMLAttribute(value: string) {
    return escapeXMLText(value).replaceAll('"', '&quot;');
}

function toRunXML(
    text: string,
    fontFamily: string,
    halfPointSize: string,
    isBold: boolean,
) {
    // `CT_RPr` fixes the child order: rFonts before b before sz. The .NET SDK
    // reorders on save, here it has to be written correctly.
    const propertyXMLList: string[] = [];
    if (fontFamily !== '') {
        const name = escapeXMLAttribute(fontFamily);
        propertyXMLList.push(
            `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" ` +
                `w:eastAsia="${name}" w:cs="${name}"/>`,
        );
    }
    if (isBold) {
        propertyXMLList.push('<w:b/>');
    }
    propertyXMLList.push(`<w:sz w:val="${halfPointSize}"/>`);
    return (
        `<w:r><w:rPr>${propertyXMLList.join('')}</w:rPr>` +
        `<w:t xml:space="preserve">${escapeXMLText(text)}</w:t></w:r>`
    );
}

function toBibleEntryXML({ title, body, fontFamily }: BibleWordEntryType) {
    const fontFamilyName = fontFamily ?? '';
    return (
        `<w:p>${toRunXML(title, fontFamilyName, TITLE_HALF_POINT_SIZE, true)}` +
        '</w:p>' +
        `<w:p>${toRunXML(body, fontFamilyName, BODY_HALF_POINT_SIZE, false)}` +
        '</w:p>' +
        // the two blank spacer paragraphs `AppendBibleEntryToWordBody` adds
        '<w:p/><w:p/>'
    );
}

function toDocumentXML(data: BibleWordEntryType[]) {
    return (
        `${XML_HEADER}<w:document xmlns:w="${WORD_NAMESPACE}"><w:body>` +
        data.map(toBibleEntryXML).join('') +
        '</w:body></w:document>'
    );
}

// Deliberately built per export and dropped with it rather than kept in a
// module-level cache: 256 shifts is nothing next to holding 1KB for the rest of
// the session.
function genCRC32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index++) {
        let value = index;
        for (let bit = 0; bit < 8; bit++) {
            value =
                (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value;
    }
    return table;
}

function toCRC32(bytes: Uint8Array, table: Uint32Array) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index++) {
        crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(text: string) {
    return new TextEncoder().encode(text);
}

function concatBytes(chunkList: Uint8Array[]) {
    const totalSize = chunkList.reduce((size, chunk) => {
        return size + chunk.length;
    }, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunkList) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged;
}

async function toDeflatedRawBytes(bytes: Uint8Array<ArrayBuffer>) {
    if (typeof CompressionStream === 'undefined') {
        return null;
    }
    const { readable, writable } = new CompressionStream('deflate-raw');
    const writer = writable.getWriter();
    // not awaited before reading starts: a payload past the stream's high-water
    // mark would deadlock. It is awaited after, so write errors still surface.
    const writing = writer.write(bytes).then(() => {
        return writer.close();
    });
    const deflated = new Uint8Array(await new Response(readable).arrayBuffer());
    await writing;
    // storing is cheaper to read back when deflating did not pay off
    return deflated.length < bytes.length ? deflated : null;
}

type ZipEntryType = {
    fileNameBytes: Uint8Array;
    storedBytes: Uint8Array;
    originalSize: number;
    crc: number;
    isDeflated: boolean;
    localHeaderOffset: number;
};

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const UTF8_FILE_NAME_FLAG = 0x800;
const ZIP_VERSION = 20;
// A fixed DOS timestamp (1980-01-01) keeps the package reproducible; Word never
// surfaces the entry dates of a `.docx`.
const DOS_TIME = 0;
const DOS_DATE = 0x21;

function toLocalFileHeader(entry: ZipEntryType) {
    const { fileNameBytes } = entry;
    const header = new Uint8Array(LOCAL_HEADER_SIZE + fileNameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, UTF8_FILE_NAME_FLAG, true);
    view.setUint16(8, entry.isDeflated ? 8 : 0, true);
    view.setUint16(10, DOS_TIME, true);
    view.setUint16(12, DOS_DATE, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.storedBytes.length, true);
    view.setUint32(22, entry.originalSize, true);
    view.setUint16(26, fileNameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(fileNameBytes, LOCAL_HEADER_SIZE);
    return header;
}

function toCentralDirectoryHeader(entry: ZipEntryType) {
    const { fileNameBytes } = entry;
    const header = new Uint8Array(CENTRAL_HEADER_SIZE + fileNameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, ZIP_VERSION, true);
    view.setUint16(8, UTF8_FILE_NAME_FLAG, true);
    view.setUint16(10, entry.isDeflated ? 8 : 0, true);
    view.setUint16(12, DOS_TIME, true);
    view.setUint16(14, DOS_DATE, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.storedBytes.length, true);
    view.setUint32(24, entry.originalSize, true);
    view.setUint16(28, fileNameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.localHeaderOffset, true);
    header.set(fileNameBytes, CENTRAL_HEADER_SIZE);
    return header;
}

function toEndOfCentralDirectory(
    entryCount: number,
    centralDirectorySize: number,
    centralDirectoryOffset: number,
) {
    const record = new Uint8Array(END_OF_CENTRAL_DIRECTORY_SIZE);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    view.setUint16(20, 0, true);
    return record;
}

async function toZipBytes(fileList: { fileName: string; text: string }[]) {
    const crc32Table = genCRC32Table();
    const localChunkList: Uint8Array[] = [];
    const centralChunkList: Uint8Array[] = [];
    let offset = 0;
    for (const { fileName, text } of fileList) {
        const rawBytes = toBytes(text);
        const deflatedBytes = await toDeflatedRawBytes(rawBytes);
        const entry: ZipEntryType = {
            fileNameBytes: toBytes(fileName),
            storedBytes: deflatedBytes ?? rawBytes,
            originalSize: rawBytes.length,
            crc: toCRC32(rawBytes, crc32Table),
            isDeflated: deflatedBytes !== null,
            localHeaderOffset: offset,
        };
        const localHeader = toLocalFileHeader(entry);
        localChunkList.push(localHeader, entry.storedBytes);
        centralChunkList.push(toCentralDirectoryHeader(entry));
        offset += localHeader.length + entry.storedBytes.length;
    }
    const centralDirectorySize = centralChunkList.reduce((size, chunk) => {
        return size + chunk.length;
    }, 0);
    return concatBytes([
        ...localChunkList,
        ...centralChunkList,
        toEndOfCentralDirectory(
            centralChunkList.length,
            centralDirectorySize,
            offset,
        ),
    ]);
}

export async function generateBibleMSWordBytes(data: BibleWordEntryType[]) {
    // `[Content_Types].xml` must be the first entry of an OPC package.
    return await toZipBytes([
        { fileName: '[Content_Types].xml', text: CONTENT_TYPES_XML },
        { fileName: '_rels/.rels', text: PACKAGE_RELS_XML },
        { fileName: 'word/document.xml', text: toDocumentXML(data) },
    ]);
}

function toTwoDigits(value: number) {
    return `${value}`.padStart(2, '0');
}

export function toBibleMSWordFileFullName() {
    // local time, not `toISOString`: a UTC stamp dates the file a day off for
    // anyone far enough from Greenwich, which is most of the target users
    const date = new Date();
    const dateStr =
        `${date.getFullYear()}-${toTwoDigits(date.getMonth() + 1)}-` +
        `${toTwoDigits(date.getDate())}_${toTwoDigits(date.getHours())}-` +
        `${toTwoDigits(date.getMinutes())}-${toTwoDigits(date.getSeconds())}`;
    return `owa-bible-verses_${dateStr}.docx`;
}

// Written straight to disk rather than handed to the browser as an `<a
// download>` blob: the app registers no `will-download` handler, so Chromium
// falls back to a native Save As dialog and parks the bytes in an orphan
// `<uuid>.tmp` until it is answered. Writing here also keeps the real path,
// which the caller needs to reveal the document and to put the fonts beside it.
export async function exportBibleMSWord(
    data: BibleWordEntryType[],
    dirPath: string,
) {
    const bytes = await generateBibleMSWordBytes(data);
    const filePath = pathJoin(dirPath, toBibleMSWordFileFullName());
    await fsWriteFile(filePath, Buffer.from(bytes));
    return filePath;
}
