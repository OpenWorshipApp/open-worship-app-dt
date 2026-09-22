// Renderer-side `.docx` writer for the bible export: the OOXML parts are plain
// strings and the package is the minimal ZIP from `officeZipHelpers`, so
// nothing is loaded until an export is actually requested.

import { fsWriteFile, pathJoin } from '../server/fileHelpers';
import { toZipBytes } from './officeZipHelpers';

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

export async function generateBibleMSWordBytes(data: BibleWordEntryType[]) {
    // `[Content_Types].xml` must be the first entry of an OPC package.
    return await toZipBytes([
        { fileName: '[Content_Types].xml', data: CONTENT_TYPES_XML },
        { fileName: '_rels/.rels', data: PACKAGE_RELS_XML },
        { fileName: 'word/document.xml', data: toDocumentXML(data) },
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
