import { describe, expect, test } from 'vitest';

import {
    MP4_FILE_TIMESCALE,
    Mp4FileWriter,
    toMp4SampleDuration,
} from './mp4FileWriter';

// Where each container box's children start, counted from its first byte.
const CHILDREN_AT: Record<string, number> = {
    moov: 8,
    trak: 8,
    mdia: 8,
    minf: 8,
    dinf: 8,
    stbl: 8,
    stsd: 16,
    dref: 16,
    avc1: 86,
};

type ParsedBoxType = { path: string; start: number; size: number };

function walk(
    data: Uint8Array,
    start: number,
    end: number,
    parentPath = '',
): ParsedBoxType[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const found: ParsedBoxType[] = [];
    let offset = start;
    while (offset < end) {
        let size = view.getUint32(offset);
        const type = String.fromCharCode(
            ...data.subarray(offset + 4, offset + 8),
        );
        if (size === 1) {
            size = Number(view.getBigUint64(offset + 8));
        }
        expect(size).toBeGreaterThanOrEqual(8);
        expect(offset + size).toBeLessThanOrEqual(end);
        const path = parentPath ? `${parentPath}/${type}` : type;
        found.push({ path, start: offset, size });
        const childrenAt = CHILDREN_AT[type];
        if (childrenAt !== undefined) {
            found.push(...walk(data, offset + childrenAt, offset + size, path));
        }
        offset += size;
    }
    expect(offset).toBe(end);
    return found;
}

function findBox(boxes: ParsedBoxType[], path: string) {
    const found = boxes.find((item) => item.path === path);
    expect(found, path).toBeDefined();
    return found!;
}

function u32At(data: Uint8Array, offset: number) {
    return new DataView(data.buffer, data.byteOffset).getUint32(offset);
}

function u64At(data: Uint8Array, offset: number) {
    return Number(
        new DataView(data.buffer, data.byteOffset).getBigUint64(offset),
    );
}

// Writes a file of `sizes` samples, every `keyEvery`th a keyframe, then puts
// the mdat size where `finish` says, as the caller does on disk.
async function writeFile(sizes: number[], keyEvery: number, frameRate = 30) {
    const chunks: Uint8Array[] = [];
    const writer = new Mp4FileWriter(
        {
            write: async (chunk) => {
                chunks.push(chunk.slice());
            },
        },
        { width: 1280, height: 720, frameRate },
    );
    await writer.start();
    for (const [index, size] of sizes.entries()) {
        await writer.addSample(
            new Uint8Array(size).fill(index % 251),
            index % keyEvery === 0,
        );
    }
    const patch = await writer.finish(Uint8Array.of(1, 2, 3, 4));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const data = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
    }
    data.set(patch.bytes, patch.position);
    return data;
}

describe('Mp4FileWriter', () => {
    test('lays the file out ftyp, mdat, moov with the mdat size patched', async () => {
        const sizes = [100, 20, 30, 40, 50];
        const data = await writeFile(sizes, 2);
        const boxes = walk(data, 0, data.length);
        const topLevel = boxes
            .filter((item) => !item.path.includes('/'))
            .map((item) => item.path);
        expect(topLevel).toEqual(['ftyp', 'mdat', 'moov']);
        const mdat = findBox(boxes, 'mdat');
        // 16-byte header and every sample, nothing else.
        expect(mdat.size).toBe(16 + 240);
    });

    test('says how long it is in every header', async () => {
        const data = await writeFile(new Array(45).fill(10), 30, 30);
        const boxes = walk(data, 0, data.length);
        const sampleDuration = toMp4SampleDuration(30);
        expect(sampleDuration).toBe(3000);
        const mvhd = findBox(boxes, 'moov/mvhd');
        // version/flags, creation, modification, timescale, duration.
        expect(u32At(data, mvhd.start + 20)).toBe(1000);
        expect(u32At(data, mvhd.start + 24)).toBe(1500);
        const tkhd = findBox(boxes, 'moov/trak/tkhd');
        expect(u32At(data, tkhd.start + 28)).toBe(1500);
        const mdhd = findBox(boxes, 'moov/trak/mdia/mdhd');
        expect(u32At(data, mdhd.start + 20)).toBe(MP4_FILE_TIMESCALE);
        expect(u32At(data, mdhd.start + 24)).toBe(45 * sampleDuration);
        const stts = findBox(boxes, 'moov/trak/mdia/minf/stbl/stts');
        expect(u32At(data, stts.start + 12)).toBe(1);
        expect(u32At(data, stts.start + 16)).toBe(45);
        expect(u32At(data, stts.start + 20)).toBe(sampleDuration);
    });

    test('lists every sample size and keyframe', async () => {
        const sizes = [100, 20, 30, 40, 50];
        const data = await writeFile(sizes, 2);
        const boxes = walk(data, 0, data.length);
        const stsz = findBox(boxes, 'moov/trak/mdia/minf/stbl/stsz');
        expect(u32At(data, stsz.start + 16)).toBe(sizes.length);
        sizes.forEach((size, index) => {
            expect(u32At(data, stsz.start + 20 + index * 4)).toBe(size);
        });
        const stss = findBox(boxes, 'moov/trak/mdia/minf/stbl/stss');
        expect(u32At(data, stss.start + 12)).toBe(3);
        // Sample numbers count from 1.
        expect(
            [0, 1, 2].map((index) => {
                return u32At(data, stss.start + 16 + index * 4);
            }),
        ).toEqual([1, 3, 5]);
        const avc1 = findBox(boxes, 'moov/trak/mdia/minf/stbl/stsd/avc1');
        expect(u32At(data, avc1.start + 32)).toBe((1280 << 16) | 720);
    });

    test('points each chunk of a second at its first sample', async () => {
        // 30 fps, 70 samples: chunks of 30, 30 and 10.
        const sizes = Array.from({ length: 70 }, (_, index) => 10 + index);
        const data = await writeFile(sizes, 30, 30);
        const boxes = walk(data, 0, data.length);
        const mdat = findBox(boxes, 'mdat');
        const stsc = findBox(boxes, 'moov/trak/mdia/minf/stbl/stsc');
        expect(u32At(data, stsc.start + 12)).toBe(2);
        expect(
            [0, 1, 2, 3, 4, 5].map((index) => {
                return u32At(data, stsc.start + 16 + index * 4);
            }),
        ).toEqual([1, 30, 1, 3, 10, 1]);
        const co64 = findBox(boxes, 'moov/trak/mdia/minf/stbl/co64');
        expect(u32At(data, co64.start + 12)).toBe(3);
        const firstSampleAt = mdat.start + 16;
        const sumOf = (count: number) => {
            return sizes.slice(0, count).reduce((sum, size) => sum + size, 0);
        };
        expect(u64At(data, co64.start + 16)).toBe(firstSampleAt);
        expect(u64At(data, co64.start + 24)).toBe(firstSampleAt + sumOf(30));
        expect(u64At(data, co64.start + 32)).toBe(firstSampleAt + sumOf(60));
        // The bytes there are the 31st sample's (filled with its index).
        expect(data[firstSampleAt + sumOf(30)]).toBe(30);
    });
});
