import { describe, expect, test, vi } from 'vitest';

const { fsWriteFileMock } = vi.hoisted(() => ({
    fsWriteFileMock: vi.fn(
        async (targetPath: string, _data: Buffer) => targetPath,
    ),
}));
vi.mock('../server/fileHelpers', () => ({
    fsWriteFile: fsWriteFileMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

import {
    type BibleWordEntryType,
    exportBibleMSWord,
    generateBibleMSWordBytes,
    toBibleMSWordFileFullName,
} from './docxHelpers';

type ZipFileType = {
    fileName: string;
    isDeflated: boolean;
    crc: number;
    text: string;
};

// A table-less CRC32, deliberately implemented differently from the helper so
// the assertion is an independent check of the stored checksums.
function toReferenceCRC32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

async function toInflatedBytes(bytes: Uint8Array<ArrayBuffer>) {
    const decompressionStream = new DecompressionStream('deflate-raw');
    const writer = decompressionStream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = decompressionStream.readable.getReader();
    const chunkList: Uint8Array[] = [];
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunkList.push(value);
    }
    const totalSize = chunkList.reduce((size, chunk) => size + chunk.length, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunkList) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged;
}

async function readZipFiles(zipBytes: Uint8Array<ArrayBuffer>) {
    const view = new DataView(zipBytes.buffer);
    const fileList: ZipFileType[] = [];
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
        const method = view.getUint16(offset + 8, true);
        const crc = view.getUint32(offset + 14, true);
        const compressedSize = view.getUint32(offset + 18, true);
        const uncompressedSize = view.getUint32(offset + 22, true);
        const fileNameSize = view.getUint16(offset + 26, true);
        const extraSize = view.getUint16(offset + 28, true);
        const fileNameOffset = offset + 30;
        const dataOffset = fileNameOffset + fileNameSize + extraSize;
        const fileName = new TextDecoder().decode(
            zipBytes.subarray(fileNameOffset, fileNameOffset + fileNameSize),
        );
        const storedBytes = zipBytes.subarray(
            dataOffset,
            dataOffset + compressedSize,
        ) as Uint8Array<ArrayBuffer>;
        const rawBytes =
            method === 8 ? await toInflatedBytes(storedBytes) : storedBytes;
        expect(rawBytes.length).toBe(uncompressedSize);
        expect(crc).toBe(toReferenceCRC32(rawBytes));
        fileList.push({
            fileName,
            isDeflated: method === 8,
            crc,
            text: new TextDecoder().decode(rawBytes),
        });
        offset = dataOffset + compressedSize;
    }
    // what is left has to be the central directory followed by the EOCD record
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const eocdOffset = zipBytes.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(fileList.length);
    expect(view.getUint32(eocdOffset + 16, true)).toBe(offset);
    return fileList;
}

const SAMPLE_DATA = [
    { title: 'Genesis 1:1', body: 'In the beginning', fontFamily: 'Khmer OS' },
    { title: 'John 3:16', body: 'For God so loved', fontFamily: null },
];

async function readDocumentXML(data: BibleWordEntryType[] = SAMPLE_DATA) {
    const fileList = await readZipFiles(await generateBibleMSWordBytes(data));
    const documentFile = fileList.find(({ fileName }) => {
        return fileName === 'word/document.xml';
    });
    expect(documentFile).toBeDefined();
    return (documentFile as ZipFileType).text;
}

describe('generateBibleMSWordBytes', () => {
    test('writes a readable OPC package with the three required parts', async () => {
        const fileList = await readZipFiles(
            await generateBibleMSWordBytes(SAMPLE_DATA),
        );
        expect(
            fileList.map(({ fileName }) => {
                return fileName;
            }),
        ).toEqual([
            // `[Content_Types].xml` must come first in an OPC package
            '[Content_Types].xml',
            '_rels/.rels',
            'word/document.xml',
        ]);
        expect(fileList[0].text).toContain(
            'wordprocessingml.document.main+xml',
        );
        expect(fileList[1].text).toContain('Target="word/document.xml"');
    });

    test('mirrors the paragraph structure of the .NET helper', async () => {
        const documentXML = await readDocumentXML();
        expect(documentXML.startsWith('<?xml version="1.0"')).toBe(true);
        expect(documentXML).toContain(
            '<w:document xmlns:w="http://schemas.openxmlformats.org/' +
                'wordprocessingml/2006/main"><w:body>',
        );
        // title: bold 14pt (28 half-points), body: 12pt (24 half-points)
        expect(documentXML).toContain(
            '<w:b/><w:sz w:val="28"/></w:rPr>' +
                '<w:t xml:space="preserve">Genesis 1:1</w:t>',
        );
        expect(documentXML).toContain(
            '<w:sz w:val="24"/></w:rPr>' +
                '<w:t xml:space="preserve">In the beginning</w:t>',
        );
        // no bold on body runs
        expect(documentXML).not.toContain('<w:b/><w:sz w:val="24"/>');
        // two blank spacer paragraphs after every entry
        expect(documentXML.split('<w:p/><w:p/>').length - 1).toBe(
            SAMPLE_DATA.length,
        );
    });

    test('applies the font family to both runs, and only when given', async () => {
        const documentXML = await readDocumentXML();
        const fontXML =
            '<w:rFonts w:ascii="Khmer OS" w:hAnsi="Khmer OS" ' +
            'w:eastAsia="Khmer OS" w:cs="Khmer OS"/>';
        // once for the title run, once for the body run of the first entry
        expect(documentXML.split(fontXML).length - 1).toBe(2);
        // the second entry has a null font family, so no other rFonts element
        expect(documentXML.split('<w:rFonts').length - 1).toBe(2);
    });

    test('escapes XML in text and font names', async () => {
        const documentXML = await readDocumentXML([
            {
                title: 'A & B <tag>',
                body: '"quoted" & <escaped>',
                fontFamily: 'Font "X" & Y',
            },
        ]);
        expect(documentXML).toContain(
            '<w:t xml:space="preserve">A &amp; B &lt;tag&gt;</w:t>',
        );
        expect(documentXML).toContain(
            '<w:t xml:space="preserve">' +
                '"quoted" &amp; &lt;escaped&gt;</w:t>',
        );
        expect(documentXML).toContain('w:ascii="Font &quot;X&quot; &amp; Y"');
    });

    test('drops characters XML 1.0 cannot represent', async () => {
        // built by code point so the literals stay readable
        const nul = String.fromCharCode(0);
        const backspace = String.fromCharCode(8);
        const verticalTab = String.fromCharCode(11);
        const unitSeparator = String.fromCharCode(31);
        const tab = String.fromCharCode(9);
        const documentXML = await readDocumentXML([
            {
                title: `Ti${nul}tle${backspace}`,
                body: `bo${unitSeparator}dy${tab}tab`,
                fontFamily: `Fo${verticalTab}nt`,
            },
        ]);
        expect(documentXML).toContain('<w:t xml:space="preserve">Title</w:t>');
        // a tab is legal XML 1.0 and has to survive
        expect(documentXML).toContain(
            `<w:t xml:space="preserve">body${tab}tab</w:t>`,
        );
        expect(documentXML).toContain('w:ascii="Font"');
    });

    test('handles an empty entry list', async () => {
        const documentXML = await readDocumentXML([]);
        expect(documentXML).toContain('<w:body></w:body>');
    });
});

describe('exportBibleMSWord', () => {
    test('writes the package into the given folder', async () => {
        fsWriteFileMock.mockClear();

        const filePath = await exportBibleMSWord(SAMPLE_DATA, '/downloads');

        expect(filePath).toMatch(
            /^\/downloads\/owa-bible-verses_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.docx$/,
        );
        expect(fsWriteFileMock).toHaveBeenCalledOnce();
        const [writtenPath, writtenData] = fsWriteFileMock.mock.calls[0] as [
            string,
            Buffer,
        ];
        expect(writtenPath).toBe(filePath);
        // a real ZIP local file header, not a blob handed to the browser
        expect(Buffer.isBuffer(writtenData)).toBe(true);
        expect(writtenData.subarray(0, 4).toString('hex')).toBe('504b0304');
    });

    test('stamps the file name with the local time, not UTC', () => {
        vi.useFakeTimers();
        try {
            // constructed in local time, so the stamp has to read it
            // back unchanged whatever zone the machine is in
            vi.setSystemTime(new Date(2024, 0, 1, 22, 4, 5));
            expect(toBibleMSWordFileFullName()).toBe(
                'owa-bible-verses_2024-01-01_22-04-05.docx',
            );
        } finally {
            vi.useRealTimers();
        }
    });
});
