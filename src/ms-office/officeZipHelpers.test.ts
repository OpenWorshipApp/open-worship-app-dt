import { describe, expect, test } from 'vitest';

import { OfficeZipWriter, concatBytes, toZipBytes } from './officeZipHelpers';

type ZipFileType = {
    fileName: string;
    method: number;
    flags: number;
    bytes: Uint8Array;
};

// A table-less CRC32, deliberately implemented differently from the writer's
// so the assertion is an independent check of the stored checksums.
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

async function toInflatedBytes(bytes: Uint8Array) {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(zipBytes: Uint8Array) {
    const view = new DataView(
        zipBytes.buffer,
        zipBytes.byteOffset,
        zipBytes.byteLength,
    );
    const fileList: ZipFileType[] = [];
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
        const flags = view.getUint16(offset + 6, true);
        const method = view.getUint16(offset + 8, true);
        const crc = view.getUint32(offset + 14, true);
        const storedSize = view.getUint32(offset + 18, true);
        const originalSize = view.getUint32(offset + 22, true);
        const nameSize = view.getUint16(offset + 26, true);
        const nameOffset = offset + 30;
        const dataOffset = nameOffset + nameSize;
        const stored = zipBytes.subarray(dataOffset, dataOffset + storedSize);
        const bytes = method === 8 ? await toInflatedBytes(stored) : stored;
        expect(bytes.length).toBe(originalSize);
        expect(crc).toBe(toReferenceCRC32(bytes));
        fileList.push({
            fileName: new TextDecoder().decode(
                zipBytes.subarray(nameOffset, dataOffset),
            ),
            method,
            flags,
            bytes,
        });
        offset = dataOffset + storedSize;
    }
    const centralDirectoryOffset = offset;
    for (let index = 0; index < fileList.length; index++) {
        expect(view.getUint32(offset, true)).toBe(0x02014b50);
        const nameSize = view.getUint16(offset + 28, true);
        offset += 46 + nameSize;
    }
    expect(view.getUint32(offset, true)).toBe(0x06054b50);
    expect(view.getUint16(offset + 10, true)).toBe(fileList.length);
    expect(view.getUint32(offset + 12, true)).toBe(
        offset - centralDirectoryOffset,
    );
    expect(view.getUint32(offset + 16, true)).toBe(centralDirectoryOffset);
    expect(offset + 22).toBe(zipBytes.length);
    return fileList;
}

describe('OfficeZipWriter', () => {
    test('streams every entry to the sink as it is added', async () => {
        const chunkList: Uint8Array[] = [];
        const writer = new OfficeZipWriter((chunk) => {
            chunkList.push(chunk);
        });
        await writer.addEntry('a.xml', '<a/>');
        // the entry is already out before the package is finished
        expect(chunkList.length).toBe(2);
        await writer.addEntry('b.xml', '<b/>');
        await writer.finish();
        const fileList = await readZip(concatBytes(chunkList));
        expect(
            fileList.map(({ fileName }) => {
                return fileName;
            }),
        ).toEqual(['a.xml', 'b.xml']);
    });

    test('deflates text that shrinks and stores what does not', async () => {
        const chunkList: Uint8Array[] = [];
        const collecting = new OfficeZipWriter((chunk) => {
            chunkList.push(chunk);
        });
        const repeated = '<a:p>slide</a:p>'.repeat(200);
        await collecting.addEntry('slide.xml', repeated);
        await collecting.addEntry('tiny.xml', 'x');
        await collecting.finish();
        const [slide, tiny] = await readZip(concatBytes(chunkList));
        expect(slide.method).toBe(8);
        expect(new TextDecoder().decode(slide.bytes)).toBe(repeated);
        // deflating one byte only grows it
        expect(tiny.method).toBe(0);
    });

    test('stores a picture as it is, compressible or not', async () => {
        const chunkList: Uint8Array[] = [];
        const writer = new OfficeZipWriter((chunk) => {
            chunkList.push(chunk);
        });
        const bytes = new Uint8Array(4096).fill(7);
        await writer.addEntry('ppt/media/image1.png', bytes, {
            isCompressible: false,
        });
        await writer.finish();
        const [picture] = await readZip(concatBytes(chunkList));
        expect(picture.method).toBe(0);
        expect(picture.bytes).toEqual(bytes);
    });

    test('marks file names as UTF-8', async () => {
        const [file] = await readZip(
            await toZipBytes([{ fileName: 'ស្លាយ.xml', data: '<a/>' }]),
        );
        expect(file.fileName).toBe('ស្លាយ.xml');
        expect(file.flags & 0x800).toBe(0x800);
    });

    test('waits for an asynchronous sink before the next entry', async () => {
        const order: string[] = [];
        const writer = new OfficeZipWriter(async (chunk) => {
            await new Promise((resolve) => {
                setTimeout(resolve, 1);
            });
            order.push(`chunk:${chunk.length}`);
        });
        await writer.addEntry('a.xml', '<a/>');
        order.push('added');
        await writer.finish();
        expect(order.indexOf('added')).toBe(2);
    });
});
