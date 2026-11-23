// The minimal ZIP READER beside `officeZipHelpers.ts`'s writer: what the help
// window's assistant needs to change a `.pptx` or `.docx` the user keeps
// (2026-11-20, the user: _open pptx or docx in chatbot then interact to edit
// the powerpoint_, _able to undo_).
//
// Only the central directory is parsed, and an entry is inflated only when it
// is asked for: a deck of photos is read for its few slide XML parts, and
// every picture is handed back to the writer as the bytes it already is
// (`OfficeZipWriter.addStoredEntry`), never inflated and deflated again on
// the low-spec machines this app is for. Inflating uses the platform's own
// `DecompressionStream`, so nothing is bundled for it.
//
// Refused rather than guessed at: ZIP64, an encrypted entry, a compression
// other than stored or deflate -- PowerPoint and Word write none of them.

export type OfficeZipEntryType = {
    fileName: string;
    // 0 stored, 8 deflated
    method: number;
    crc: number;
    storedSize: number;
    originalSize: number;
    // where the stored bytes start in the package
    dataOffset: number;
};

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_MARK = 0xffffffff;
const ENCRYPTED_FLAG = 0x1;

function findEndOfCentralDirectory(view: DataView) {
    const last = view.byteLength - END_OF_CENTRAL_DIRECTORY_SIZE;
    const first = Math.max(0, last - MAX_COMMENT_SIZE);
    for (let offset = last; offset >= first; offset--) {
        if (
            view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE
        ) {
            return offset;
        }
    }
    return -1;
}

/**
 * Every entry of a package, in the order its central directory lists them,
 * or a sentence saying why the bytes are not a package this can read.
 */
export function readOfficeZipEntries(
    bytes: Uint8Array,
): OfficeZipEntryType[] | { reason: string } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset =
        bytes.byteLength < END_OF_CENTRAL_DIRECTORY_SIZE
            ? -1
            : findEndOfCentralDirectory(view);
    if (endOffset < 0) {
        return { reason: 'The file is not a PowerPoint or Word package.' };
    }
    const entryCount = view.getUint16(endOffset + 10, true);
    const directorySize = view.getUint32(endOffset + 12, true);
    const directoryOffset = view.getUint32(endOffset + 16, true);
    if (
        directoryOffset === ZIP64_MARK ||
        directorySize === ZIP64_MARK ||
        entryCount === 0xffff
    ) {
        return { reason: 'The file is too large a package to change here.' };
    }
    if (directoryOffset + directorySize > endOffset) {
        return { reason: 'The file is damaged: its table of contents is cut.' };
    }
    const decoder = new TextDecoder();
    const entries: OfficeZipEntryType[] = [];
    let offset = directoryOffset;
    for (let index = 0; index < entryCount; index++) {
        if (
            offset + 46 > endOffset ||
            view.getUint32(offset, true) !== CENTRAL_HEADER_SIGNATURE
        ) {
            return {
                reason: 'The file is damaged: its table of contents is cut.',
            };
        }
        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const crc = view.getUint32(offset + 16, true);
        const storedSize = view.getUint32(offset + 20, true);
        const originalSize = view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const fileName = decoder.decode(
            bytes.subarray(offset + 46, offset + 46 + nameLength),
        );
        if (
            storedSize === ZIP64_MARK ||
            originalSize === ZIP64_MARK ||
            localOffset === ZIP64_MARK
        ) {
            return {
                reason: 'The file is too large a package to change here.',
            };
        }
        if ((flags & ENCRYPTED_FLAG) !== 0) {
            return {
                reason:
                    'The file is protected with a password, so it cannot be ' +
                    'changed here.',
            };
        }
        if (method !== 0 && method !== 8) {
            return {
                reason: `The file packs "${fileName}" in a way this app cannot read.`,
            };
        }
        if (
            localOffset + 30 > bytes.byteLength ||
            view.getUint32(localOffset, true) !== LOCAL_HEADER_SIGNATURE
        ) {
            return { reason: `The file is damaged at "${fileName}".` };
        }
        // The LOCAL header's own lengths: its extra field may differ from
        // the central one's.
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataOffset =
            localOffset + 30 + localNameLength + localExtraLength;
        if (dataOffset + storedSize > bytes.byteLength) {
            return { reason: `The file is damaged at "${fileName}".` };
        }
        entries.push({
            fileName,
            method,
            crc,
            storedSize,
            originalSize,
            dataOffset,
        });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

/** The bytes of an entry as the package stores them: no copy is made. */
export function toStoredBytes(bytes: Uint8Array, entry: OfficeZipEntryType) {
    return bytes.subarray(
        entry.dataOffset,
        entry.dataOffset + entry.storedSize,
    );
}

async function inflateRaw(stored: Uint8Array) {
    const { readable, writable } = new DecompressionStream('deflate-raw');
    const writer = writable.getWriter();
    // not awaited before reading starts: see `toDeflatedRawBytes`.
    const writing = writer.write(stored as Uint8Array<ArrayBuffer>).then(() => {
        return writer.close();
    });
    const inflated = new Uint8Array(await new Response(readable).arrayBuffer());
    await writing;
    return inflated;
}

/** An entry's own bytes, inflated when the package deflated them. */
export async function readOfficeZipEntryBytes(
    bytes: Uint8Array,
    entry: OfficeZipEntryType,
) {
    const stored = toStoredBytes(bytes, entry);
    return entry.method === 8 ? await inflateRaw(stored) : stored;
}

/** An entry read as text: the XML parts of a package are UTF-8. */
export async function readOfficeZipEntryText(
    bytes: Uint8Array,
    entry: OfficeZipEntryType,
) {
    return new TextDecoder().decode(
        await readOfficeZipEntryBytes(bytes, entry),
    );
}
