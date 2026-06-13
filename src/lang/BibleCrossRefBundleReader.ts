// Read ONE record from a bundle without loading the whole file.
//
// On open: read the tiny footer + index only (a few hundred KB).
// On each lookup: a single positioned read (pread) of just that record's bytes.
// The 42 MB of record data is never allocated; only the bytes you ask for are.

import { type CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import appProvider from '../server/appProvider';

const MAGIC = 'FBBNDL01';
const FLAG_GZIP = 1;

const { openSync, readSync, fstatSync, closeSync, gunzipSync } =
    appProvider.fileUtils;
export class BibleCrossRefBundleReader {
    fd: number;
    gzip: boolean;
    index: Map<string, [number, number]>;

    constructor(path: string) {
        this.fd = openSync(path, 'r');
        const size = fstatSync(this.fd).size;

        const footer = Buffer.alloc(20);
        readSync(this.fd, footer, 0, 20, size - 20);
        if (footer.toString('latin1', 12, 20) !== MAGIC) {
            closeSync(this.fd);
            throw new Error('Not a valid bundle (bad magic)');
        }
        const indexOffset = footer.readUInt32LE(0);
        const indexLength = footer.readUInt32LE(4);
        this.gzip = (footer.readUInt32LE(8) & FLAG_GZIP) === FLAG_GZIP;

        const indexBuf = Buffer.alloc(indexLength);
        readSync(this.fd, indexBuf, 0, indexLength, indexOffset);
        // Map gives fast lookups and a low-overhead in-memory index (~1 MB).
        this.index = new Map(
            Object.entries(JSON.parse(indexBuf.toString('utf8'))),
        );
    }

    get size() {
        return this.index.size;
    }

    has(key: string) {
        return this.index.has(key);
    }

    /** Raw record bytes (decompressed if the bundle is gzipped), or undefined. */
    getBytes(key: string) {
        const entry = this.index.get(key);
        if (!entry) return undefined;
        const [offset, length] = entry;
        const buf = Buffer.allocUnsafe(length);
        readSync(this.fd, buf, 0, length, offset);
        return this.gzip ? gunzipSync(buf) : buf;
    }

    /** Record as a UTF-8 string, or undefined. */
    getText(key: string) {
        const buf = this.getBytes(key);
        return buf?.toString('utf8');
    }

    /** Parsed JSON for a "BOOK/CH/VS" key, or null. */
    get(key: string): CrossReferenceType[] | null {
        const text = this.getText(key);
        return text === undefined ? null : JSON.parse(text);
    }

    /** Convenience: getVerse("GEN", 1, 1). */
    getVerse(book: string, chapter: number, verse: number) {
        return this.get(`${book}/${chapter}/${verse}`);
    }

    close() {
        closeSync(this.fd);
    }
}
