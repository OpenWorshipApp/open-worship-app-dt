import { describe, expect, test } from 'vitest';

import {
    AUDIO_TRACK_ID,
    DELTA_SAMPLE_FLAGS,
    KEY_SAMPLE_FLAGS,
    VIDEO_TIMESCALE,
    VIDEO_TRACK_ID,
    buildFragment,
    buildInitSegment,
    toAudioSpecificConfig,
} from './fmp4Muxer';

// Where each container box's children start, counted from the box's first
// byte: a plain box's 8-byte header, a full box's 4 more, a sample entry's
// fixed fields (avc1 78 bytes, mp4a 28) after that.
const CHILDREN_AT: Record<string, number> = {
    moov: 8,
    trak: 8,
    mdia: 8,
    minf: 8,
    dinf: 8,
    stbl: 8,
    mvex: 8,
    moof: 8,
    traf: 8,
    stsd: 16,
    dref: 16,
    avc1: 86,
    mp4a: 36,
};

type ParsedBoxType = {
    path: string;
    type: string;
    start: number;
    size: number;
};

function toView(data: Uint8Array) {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function toText(data: Uint8Array, start: number, end: number) {
    return String.fromCharCode(...data.subarray(start, end));
}

// Every box from `start` to `end`, recursing into containers, and failing
// the test when a declared size does not tile its parent exactly.
function walk(
    data: Uint8Array,
    start: number,
    end: number,
    parentPath = '',
): ParsedBoxType[] {
    const view = toView(data);
    const found: ParsedBoxType[] = [];
    let offset = start;
    while (offset < end) {
        expect(offset + 8).toBeLessThanOrEqual(end);
        const size = view.getUint32(offset);
        const type = toText(data, offset + 4, offset + 8);
        expect(size).toBeGreaterThanOrEqual(8);
        expect(offset + size).toBeLessThanOrEqual(end);
        const path = parentPath ? `${parentPath}/${type}` : type;
        found.push({ path, type, start: offset, size });
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
    const matches = boxes.filter((item) => item.path === path);
    expect(matches.length).toBeGreaterThan(0);
    return matches;
}

const VIDEO = {
    width: 1280,
    height: 720,
    avcC: Uint8Array.of(1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 4, 1, 2, 3, 4),
};
const AUDIO = {
    sampleRate: 48000,
    channelCount: 2,
    audioSpecificConfig: toAudioSpecificConfig(48000, 2),
};

describe('fmp4Muxer init segment', () => {
    test('ftyp + moov, each box size tiling its parent exactly', () => {
        for (const audio of [null, AUDIO]) {
            const init = buildInitSegment(VIDEO, audio);
            const boxes = walk(init, 0, init.length);
            expect(
                boxes.filter((item) => !item.path.includes('/')),
            ).toMatchObject([{ type: 'ftyp' }, { type: 'moov' }]);
            const topLevelTotal = boxes
                .filter((item) => !item.path.includes('/'))
                .reduce((sum, item) => sum + item.size, 0);
            expect(topLevelTotal).toBe(init.length);
            expect(findBox(boxes, 'moov/trak')).toHaveLength(
                audio === null ? 1 : 2,
            );
            expect(findBox(boxes, 'moov/mvex/trex')).toHaveLength(
                audio === null ? 1 : 2,
            );
        }
    });

    test('ftyp names isom and its compatible brands', () => {
        const init = buildInitSegment(VIDEO, null);
        const [ftyp] = findBox(walk(init, 0, init.length), 'ftyp');
        expect(toText(init, ftyp.start + 8, ftyp.start + 12)).toBe('isom');
        expect(toView(init).getUint32(ftyp.start + 12)).toBe(0x200);
        expect(toText(init, ftyp.start + 16, ftyp.start + ftyp.size)).toBe(
            'isomiso6avc1mp41',
        );
    });

    test('mvhd and tkhd have their version-0 sizes and the right ids', () => {
        const init = buildInitSegment(VIDEO, AUDIO);
        const view = toView(init);
        const boxes = walk(init, 0, init.length);
        const [mvhd] = findBox(boxes, 'moov/mvhd');
        expect(mvhd.size).toBe(108);
        // next_track_ID: the last 4 bytes.
        expect(view.getUint32(mvhd.start + mvhd.size - 4)).toBe(3);
        const tkhds = findBox(boxes, 'moov/trak/tkhd');
        expect(tkhds.map((item) => item.size)).toEqual([92, 92]);
        expect(tkhds.map((item) => view.getUint32(item.start + 20))).toEqual([
            VIDEO_TRACK_ID,
            AUDIO_TRACK_ID,
        ]);
        // Video: no volume, its size in 16.16; audio: full volume, no size.
        const [videoTkhd, audioTkhd] = tkhds;
        expect(view.getUint16(videoTkhd.start + 44)).toBe(0);
        expect(view.getUint32(videoTkhd.start + 84)).toBe(1280 << 16);
        expect(view.getUint32(videoTkhd.start + 88)).toBe(720 << 16);
        expect(view.getUint16(audioTkhd.start + 44)).toBe(0x0100);
        expect(view.getUint32(audioTkhd.start + 84)).toBe(0);

        const noAudio = buildInitSegment(VIDEO, null);
        const [mvhdNoAudio] = findBox(
            walk(noAudio, 0, noAudio.length),
            'moov/mvhd',
        );
        expect(
            toView(noAudio).getUint32(mvhdNoAudio.start + mvhdNoAudio.size - 4),
        ).toBe(2);
    });

    test('handlers, timescales, sample entries and trex track ids', () => {
        const init = buildInitSegment(VIDEO, AUDIO);
        const view = toView(init);
        const boxes = walk(init, 0, init.length);
        const handlers = findBox(boxes, 'moov/trak/mdia/hdlr').map((item) => {
            return toText(init, item.start + 16, item.start + 20);
        });
        expect(handlers).toEqual(['vide', 'soun']);
        const timescales = findBox(boxes, 'moov/trak/mdia/mdhd').map((item) =>
            view.getUint32(item.start + 20),
        );
        expect(timescales).toEqual([VIDEO_TIMESCALE, 48000]);
        const trexIds = findBox(boxes, 'moov/mvex/trex').map((item) => {
            return view.getUint32(item.start + 12);
        });
        expect(trexIds).toEqual([VIDEO_TRACK_ID, AUDIO_TRACK_ID]);

        const [avc1] = findBox(boxes, 'moov/trak/mdia/minf/stbl/stsd/avc1');
        expect(view.getUint16(avc1.start + 32)).toBe(1280);
        expect(view.getUint16(avc1.start + 34)).toBe(720);
        const [avcC] = findBox(
            boxes,
            'moov/trak/mdia/minf/stbl/stsd/avc1/avcC',
        );
        expect([
            ...init.subarray(avcC.start + 8, avcC.start + avcC.size),
        ]).toEqual([...VIDEO.avcC]);

        const [mp4a] = findBox(boxes, 'moov/trak/mdia/minf/stbl/stsd/mp4a');
        expect(view.getUint16(mp4a.start + 24)).toBe(2);
        expect(view.getUint32(mp4a.start + 32) >>> 16).toBe(48000);
        const [esds] = findBox(
            boxes,
            'moov/trak/mdia/minf/stbl/stsd/mp4a/esds',
        );
        // ES_Descriptor (tag 3) whose one length byte covers the rest.
        expect(init[esds.start + 12]).toBe(0x03);
        expect(init[esds.start + 13]).toBe(esds.size - 14);
        const esdsBody = [...init.subarray(esds.start, esds.start + esds.size)];
        // DecoderSpecificInfo (tag 5, length 2) carries the AudioSpecificConfig.
        const at = esdsBody.findIndex((value, index) => {
            return value === 0x05 && esdsBody[index + 1] === 2;
        });
        expect(esdsBody.slice(at + 2, at + 4)).toEqual([0x11, 0x90]);
    });
});

describe('fmp4Muxer fragment', () => {
    function sample(size: number, fill: number, isKey: boolean) {
        return {
            data: new Uint8Array(size).fill(fill),
            duration: 3000,
            isKey,
        };
    }

    test('moof + mdat tile the buffer; trun points at the first payload byte', () => {
        for (const samples of [
            [],
            [sample(17, 0xaa, true)],
            [sample(5, 1, true), sample(9, 2, false), sample(1, 3, false)],
        ]) {
            const fragment = buildFragment({
                sequence: 7,
                trackId: VIDEO_TRACK_ID,
                baseDecodeTime: 2 ** 33 + 5,
                samples,
            });
            const view = toView(fragment);
            const boxes = walk(fragment, 0, fragment.length);
            const top = boxes.filter((item) => !item.path.includes('/'));
            expect(top.map((item) => item.type)).toEqual(['moof', 'mdat']);
            expect(top[0].size + top[1].size).toBe(fragment.length);
            const [moof, mdat] = top;

            const [trun] = findBox(boxes, 'moof/traf/trun');
            expect(trun.size).toBe(20 + 12 * samples.length);
            expect(view.getUint32(trun.start + 8) & 0xffffff).toBe(0x000701);
            expect(view.getUint32(trun.start + 12)).toBe(samples.length);
            // default-base-is-moof: the offset counts from the moof's start.
            const dataOffset = view.getUint32(trun.start + 16);
            expect(moof.start + dataOffset).toBe(mdat.start + 8);

            let payloadAt = moof.start + dataOffset;
            for (const [index, item] of samples.entries()) {
                const row = trun.start + 20 + 12 * index;
                expect(view.getUint32(row)).toBe(3000);
                expect(view.getUint32(row + 4)).toBe(item.data.length);
                expect(view.getUint32(row + 8)).toBe(
                    item.isKey ? KEY_SAMPLE_FLAGS : DELTA_SAMPLE_FLAGS,
                );
                expect([
                    ...fragment.subarray(
                        payloadAt,
                        payloadAt + item.data.length,
                    ),
                ]).toEqual([...item.data]);
                payloadAt += item.data.length;
            }
            expect(payloadAt).toBe(fragment.length);
        }
    });

    test('mfhd sequence, tfhd track and flags, 64-bit tfdt', () => {
        const fragment = buildFragment({
            sequence: 42,
            trackId: AUDIO_TRACK_ID,
            baseDecodeTime: 2 ** 40 + 3,
            samples: [sample(4, 9, true)],
        });
        const view = toView(fragment);
        const boxes = walk(fragment, 0, fragment.length);
        const [mfhd] = findBox(boxes, 'moof/mfhd');
        expect(view.getUint32(mfhd.start + 12)).toBe(42);
        const [tfhd] = findBox(boxes, 'moof/traf/tfhd');
        expect(view.getUint32(tfhd.start + 8)).toBe(0x020000);
        expect(view.getUint32(tfhd.start + 12)).toBe(AUDIO_TRACK_ID);
        const [tfdt] = findBox(boxes, 'moof/traf/tfdt');
        expect(tfdt.size).toBe(20);
        expect(view.getUint8(tfdt.start + 8)).toBe(1);
        expect(view.getBigUint64(tfdt.start + 12)).toBe(BigInt(2 ** 40 + 3));
    });

    test('a negative or fractional decode time is written as a whole >= 0', () => {
        for (const [input, expected] of [
            [-5, 0n],
            [12.9, 12n],
        ] as const) {
            const fragment = buildFragment({
                sequence: 1,
                trackId: VIDEO_TRACK_ID,
                baseDecodeTime: input,
                samples: [sample(1, 1, true)],
            });
            const [tfdt] = findBox(
                walk(fragment, 0, fragment.length),
                'moof/traf/tfdt',
            );
            expect(toView(fragment).getBigUint64(tfdt.start + 12)).toBe(
                expected,
            );
        }
    });
});

describe('toAudioSpecificConfig', () => {
    test('AAC-LC, the sample-rate index and the channel count', () => {
        expect([...toAudioSpecificConfig(48000, 2)]).toEqual([0x11, 0x90]);
        expect([...toAudioSpecificConfig(44100, 2)]).toEqual([0x12, 0x10]);
        expect([...toAudioSpecificConfig(48000, 1)]).toEqual([0x11, 0x88]);
        expect([...toAudioSpecificConfig(8000, 1)]).toEqual([0x15, 0x88]);
    });
});
