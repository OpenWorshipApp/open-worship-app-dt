// The minimal ZIP writer behind the Office packages this app writes (`.docx`,
// `.pptx`). Deflating uses the platform's own `CompressionStream`, so nothing
// is bundled for it, and every finished entry goes straight to a sink: a
// `.pptx` streams its pictures to disk one at a time instead of holding the
// whole package in memory, while the small `.docx` simply collects its chunks.

export type ZipSinkType = (chunk: Uint8Array) => Promise<void> | void;

type ZipEntryType = {
    fileNameBytes: Uint8Array;
    storedSize: number;
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
// A fixed DOS timestamp (1980-01-01) keeps the package reproducible; Office
// never surfaces the entry dates of a package.
const DOS_TIME = 0;
const DOS_DATE = 0x21;
// No ZIP64: past these the classic records cannot address the package.
const MAX_ZIP_OFFSET = 0xffffffff;
const MAX_ZIP_ENTRY_COUNT = 0xffff;

// Deliberately built per package and dropped with it rather than kept in a
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

function toBytes(data: string | Uint8Array) {
    return typeof data === 'string' ? new TextEncoder().encode(data) : data;
}

export function concatBytes(chunkList: Uint8Array[]) {
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

async function toDeflatedRawBytes(bytes: Uint8Array) {
    if (typeof CompressionStream === 'undefined') {
        return null;
    }
    const { readable, writable } = new CompressionStream('deflate-raw');
    const writer = writable.getWriter();
    // not awaited before reading starts: a payload past the stream's high-water
    // mark would deadlock. It is awaited after, so write errors still surface.
    const writing = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => {
        return writer.close();
    });
    const deflated = new Uint8Array(await new Response(readable).arrayBuffer());
    await writing;
    // storing is cheaper to read back when deflating did not pay off
    return deflated.length < bytes.length ? deflated : null;
}

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
    view.setUint32(18, entry.storedSize, true);
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
    view.setUint32(20, entry.storedSize, true);
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

export class OfficeZipWriter {
    private readonly crc32Table = genCRC32Table();
    private readonly entryList: ZipEntryType[] = [];
    private offset = 0;
    private readonly sink: ZipSinkType;

    constructor(sink: ZipSinkType) {
        this.sink = sink;
    }

    private async write(chunk: Uint8Array) {
        await this.sink(chunk);
        this.offset += chunk.length;
    }

    // `isCompressible: false` stores the bytes as they are. Pictures are
    // already compressed, and deflating a large one again only burns the CPU of
    // exactly the machines this app is built for.
    async addEntry(
        fileName: string,
        data: string | Uint8Array,
        { isCompressible = true }: { isCompressible?: boolean } = {},
    ) {
        if (this.entryList.length >= MAX_ZIP_ENTRY_COUNT) {
            throw new Error('Too many entries for a ZIP package');
        }
        const rawBytes = toBytes(data);
        const deflatedBytes = isCompressible
            ? await toDeflatedRawBytes(rawBytes)
            : null;
        const storedBytes = deflatedBytes ?? rawBytes;
        const entry: ZipEntryType = {
            fileNameBytes: toBytes(fileName),
            storedSize: storedBytes.length,
            originalSize: rawBytes.length,
            crc: toCRC32(rawBytes, this.crc32Table),
            isDeflated: deflatedBytes !== null,
            localHeaderOffset: this.offset,
        };
        const localHeader = toLocalFileHeader(entry);
        if (
            this.offset + localHeader.length + storedBytes.length >
            MAX_ZIP_OFFSET
        ) {
            throw new Error('The package is too large for a ZIP file');
        }
        await this.write(localHeader);
        await this.write(storedBytes);
        this.entryList.push(entry);
    }

    async finish() {
        const centralDirectoryOffset = this.offset;
        for (const entry of this.entryList) {
            await this.write(toCentralDirectoryHeader(entry));
        }
        await this.write(
            toEndOfCentralDirectory(
                this.entryList.length,
                this.offset - centralDirectoryOffset,
                centralDirectoryOffset,
            ),
        );
    }
}

export async function toZipBytes(
    fileList: { fileName: string; data: string | Uint8Array }[],
) {
    const chunkList: Uint8Array[] = [];
    const writer = new OfficeZipWriter((chunk) => {
        chunkList.push(chunk);
    });
    for (const { fileName, data } of fileList) {
        await writer.addEntry(fileName, data);
    }
    await writer.finish();
    return concatBytes(chunkList);
}
