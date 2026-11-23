// A `.pptx` / `.docx` opened for the help window's assistant to change, and
// written back (2026-11-20, the user: _open pptx or docx in chatbot then
// interact to edit the powerpoint_).
//
// The file's bytes are held for ONE call and dropped with it. A part is
// inflated only when it is read, and a part read twice in the call is read
// from the copy kept for that call alone. Written back, every part the call
// did not change is copied as the bytes the file already stores -- a deck's
// pictures are never inflated or deflated again -- in the order the file
// had them, and the package goes to a sink so it is streamed to disk.

import {
    concatBytes,
    OfficeZipWriter,
    type ZipSinkType,
} from './officeZipHelpers';
import {
    type OfficeZipEntryType,
    readOfficeZipEntries,
    readOfficeZipEntryBytes,
    readOfficeZipEntryText,
    toStoredBytes,
} from './officeZipReadHelpers';
import type { OfficePackageType } from './officePackageEditHelpers';

// One XML part past this is not a slide or a letter: a file built to blow
// up when inflated is refused before it fills the memory of a small machine.
const MAX_PART_BYTES = 64 * 1024 * 1024;

export type OpenedOfficePackageType = {
    bytes: Uint8Array;
    entries: OfficeZipEntryType[];
    pkg: OfficePackageType;
};

export function openOfficePackage(
    bytes: Uint8Array,
): OpenedOfficePackageType | { reason: string } {
    const entries = readOfficeZipEntries(bytes);
    if ('reason' in entries) {
        return entries;
    }
    const entryMap = new Map(
        entries.map((entry) => {
            return [entry.fileName, entry];
        }),
    );
    const readMap = new Map<string, string>();
    return {
        bytes,
        entries,
        pkg: {
            names: entries.map((entry) => {
                return entry.fileName;
            }),
            readText: async (name) => {
                const known = readMap.get(name);
                if (known !== undefined) {
                    return known;
                }
                const entry = entryMap.get(name);
                if (entry === undefined) {
                    return null;
                }
                if (entry.originalSize > MAX_PART_BYTES) {
                    throw new Error(
                        `The file's part "${name}" is too large to change here.`,
                    );
                }
                const text = await readOfficeZipEntryText(bytes, entry);
                readMap.set(name, text);
                return text;
            },
            readBytes: async (name) => {
                const entry = entryMap.get(name);
                if (entry === undefined) {
                    return null;
                }
                if (entry.originalSize > MAX_PART_BYTES) {
                    throw new Error(
                        `The file's part "${name}" is too large to change here.`,
                    );
                }
                return await readOfficeZipEntryBytes(bytes, entry);
            },
        },
    };
}

/**
 * A package held as bytes -- a chart's embedded workbook -- with some of
 * its parts given new text, every other part copied as it is stored.
 */
export async function rewriteZipParts(
    bytes: Uint8Array,
    // null leaves a part out
    parts: ReadonlyMap<string, string | null>,
): Promise<Uint8Array | { reason: string }> {
    const opened = openOfficePackage(bytes);
    if ('reason' in opened) {
        return opened;
    }
    const chunkList: Uint8Array[] = [];
    await writeOfficePackage(opened, parts, (chunk) => {
        chunkList.push(chunk);
    });
    return concatBytes(chunkList);
}

/**
 * The package written again with `parts` applied: a part named with text is
 * written new, one named with `null` is left out, every other one copied.
 */
async function addPart(
    writer: OfficeZipWriter,
    name: string,
    value: string | Uint8Array | null | undefined,
) {
    if (typeof value === 'string') {
        await writer.addEntry(name, value);
    } else if (value instanceof Uint8Array) {
        await writer.addEntry(name, value, { isCompressible: false });
    }
}

export async function writeOfficePackage(
    opened: OpenedOfficePackageType,
    // a part's new text, a new picture's bytes (stored as they are: a
    // picture is compressed already), or null when it is taken out
    parts: ReadonlyMap<string, string | Uint8Array | null>,
    sink: ZipSinkType,
) {
    const writer = new OfficeZipWriter(sink);
    const known = new Set<string>();
    for (const entry of opened.entries) {
        known.add(entry.fileName);
        if (!parts.has(entry.fileName)) {
            await writer.addStoredEntry(entry.fileName, {
                bytes: toStoredBytes(opened.bytes, entry),
                crc: entry.crc,
                originalSize: entry.originalSize,
                isDeflated: entry.method === 8,
            });
            continue;
        }
        await addPart(writer, entry.fileName, parts.get(entry.fileName));
    }
    for (const [name, value] of parts) {
        if (!known.has(name)) {
            await addPart(writer, name, value);
        }
    }
    await writer.finish();
}
