import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    AUDIO_TRACK_ID,
    VIDEO_TRACK_ID,
    buildFragment,
    buildInitSegment,
    toAudioSpecificConfig,
} from '../src/virtual-display/fmp4Muxer';
import {
    Fmp4Fanout,
    checkIsKeyframeFragment,
    readFragmentDecodeTime,
    readVideoTrackInfo,
} from './fmp4Fanout';

const MAX_CLIENT_BACKLOG = 4 * 1024 * 1024;
const MAX_WAIT_MILLISECOND = 20000;

function toBuffer(data: Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

const VIDEO = {
    width: 1280,
    height: 720,
    avcC: Uint8Array.of(1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 0),
};
const AUDIO = {
    sampleRate: 48000,
    channelCount: 2,
    audioSpecificConfig: toAudioSpecificConfig(48000, 2),
};
const INIT = toBuffer(buildInitSegment(VIDEO, AUDIO));

let sequence = 0;
function videoFragment(isKey: boolean, size = 32) {
    sequence += 1;
    return toBuffer(
        buildFragment({
            sequence,
            trackId: VIDEO_TRACK_ID,
            baseDecodeTime: sequence * 3000,
            samples: [
                {
                    data: new Uint8Array(size).fill(sequence & 0xff),
                    duration: 3000,
                    isKey,
                },
            ],
        }),
    );
}

function audioFragment() {
    sequence += 1;
    return toBuffer(
        buildFragment({
            sequence,
            trackId: AUDIO_TRACK_ID,
            baseDecodeTime: sequence * 1024,
            samples: [
                {
                    data: new Uint8Array(8).fill(7),
                    duration: 1024,
                    isKey: true,
                },
            ],
        }),
    );
}

function moofOf(fragment: Buffer) {
    return fragment.subarray(0, fragment.readUInt32BE(0));
}

function moovOf(init: Buffer) {
    return init.subarray(init.readUInt32BE(0));
}

// -- A tiny box writer for shapes the muxer never makes -----------------------

function u32(...values: number[]) {
    const out = Buffer.alloc(4 * values.length);
    values.forEach((value, index) => out.writeUInt32BE(value >>> 0, index * 4));
    return out;
}

function box(type: string, ...payload: Buffer[]) {
    const body = Buffer.concat(payload);
    return Buffer.concat([
        u32(body.length + 8),
        Buffer.from(type, 'latin1'),
        body,
    ]);
}

function fullBox(
    type: string,
    version: number,
    flags: number,
    ...payload: Buffer[]
) {
    return box(
        type,
        u32(((version & 0xff) << 24) | (flags & 0xffffff)),
        ...payload,
    );
}

function trak(trackId: number, handler: string, tkhdVersion = 0) {
    const times = Buffer.alloc(tkhdVersion === 1 ? 16 : 8);
    return box(
        'trak',
        fullBox('tkhd', tkhdVersion, 3, times, u32(trackId), Buffer.alloc(60)),
        box(
            'mdia',
            fullBox(
                'hdlr',
                0,
                0,
                u32(0),
                Buffer.from(handler, 'latin1'),
                Buffer.alloc(12),
                Buffer.from('x\0', 'latin1'),
            ),
        ),
    );
}

function trex(trackId: number, defaultFlags: number) {
    return fullBox('trex', 0, 0, u32(trackId, 1, 0, 0, defaultFlags));
}

function traf(
    trackId: number,
    {
        tfhdFlags = 0,
        tfhdFields = [] as number[],
        trunFlags = 0,
        trunFields = [] as number[],
    } = {},
) {
    return box(
        'traf',
        fullBox('tfhd', 0, tfhdFlags, u32(trackId, ...tfhdFields)),
        fullBox('trun', 0, trunFlags, u32(...trunFields)),
    );
}

function moof(...trafs: Buffer[]) {
    return box('moof', fullBox('mfhd', 0, 0, u32(1)), ...trafs);
}

// -- A response that records what the fan-out does to it ----------------------

class FakeResponse extends EventEmitter {
    headersSent = false;
    statusCode = 0;
    headers: Record<string, string> = {};
    chunks: Buffer[] = [];
    writableLength = 0;
    isEnded = false;
    isDestroyed = false;

    writeHead(statusCode: number, headers: Record<string, string> = {}) {
        this.statusCode = statusCode;
        this.headers = headers;
        this.headersSent = true;
        return this;
    }

    write(data: Buffer) {
        this.chunks.push(Buffer.from(data));
        return true;
    }

    end() {
        this.isEnded = true;
        return this;
    }

    // A real response emits `close` once it is destroyed.
    destroy() {
        if (!this.isDestroyed) {
            this.isDestroyed = true;
            this.emit('close');
        }
        return this;
    }
}

function asResponse(res: FakeResponse) {
    return res as unknown as http.ServerResponse;
}

function setup() {
    const onClientGone = vi.fn();
    const onKeyframeWanted = vi.fn();
    const fanout = new Fmp4Fanout(onClientGone, onKeyframeWanted);
    const join = (id: string) => {
        const res = new FakeResponse();
        fanout.addClient(id, asResponse(res));
        return res;
    };
    return { fanout, onClientGone, onKeyframeWanted, join };
}

// Pushes `data` in uneven pieces: 1, 2, 3, 5, 7, ... bytes, then again.
function pushSplit(fanout: Fmp4Fanout, data: Buffer) {
    const sizes = [1, 2, 3, 5, 7, 11, 13, 17, 64, 4];
    let offset = 0;
    for (let index = 0; offset < data.length; index++) {
        const size = sizes[index % sizes.length];
        fanout.push(data.subarray(offset, offset + size));
        offset += size;
    }
}

describe('readVideoTrackInfo', () => {
    test('finds the muxer video track and its trex flags', () => {
        expect(readVideoTrackInfo(moovOf(INIT))).toEqual({
            trackId: VIDEO_TRACK_ID,
            trexFlags: 0,
            timescale: 90000,
        });
        const videoOnly = toBuffer(buildInitSegment(VIDEO, null));
        expect(readVideoTrackInfo(moovOf(videoOnly)).trackId).toBe(
            VIDEO_TRACK_ID,
        );
    });

    test('reads a version-1 tkhd and the video track trex, after audio', () => {
        const moov = box(
            'moov',
            trak(3, 'soun'),
            trak(7, 'vide', 1),
            box('mvex', trex(3, 0), trex(7, 0x10000)),
        );
        expect(readVideoTrackInfo(moov)).toEqual({
            trackId: 7,
            trexFlags: 0x10000,
            // No mdhd in this one.
            timescale: 0,
        });
    });

    // Where the picture is: a cast TV is steered by how far behind it plays.
    test('reads where a fragment starts, and the fanout keeps the newest', () => {
        const fragment = videoFragment(true);
        const moof = fragment.subarray(0, fragment.readUInt32BE(0));
        expect(readFragmentDecodeTime(moof, VIDEO_TRACK_ID)).toBe(
            sequence * 3000,
        );
        expect(readFragmentDecodeTime(moof, AUDIO_TRACK_ID)).toBeNull();
        expect(readFragmentDecodeTime(Buffer.alloc(8), null)).toBeNull();

        const fanout = new Fmp4Fanout();
        expect(fanout.liveTime).toBeNull();
        fanout.push(INIT);
        fanout.push(videoFragment(true));
        fanout.push(audioFragment());
        // The sound does not move it: the picture's time is the live edge.
        expect(fanout.liveTime).toBe(((sequence - 1) * 3000) / 90000);
        fanout.resetStream();
        expect(fanout.liveTime).toBeNull();
    });

    test('no video track: no id and no flags', () => {
        const moov = box(
            'moov',
            trak(2, 'soun'),
            box('mvex', trex(2, 0x10000)),
        );
        expect(readVideoTrackInfo(moov)).toEqual({
            trackId: null,
            trexFlags: 0,
            timescale: 0,
        });
    });
});

describe('checkIsKeyframeFragment', () => {
    test('the muxer KEY and DELTA fragments', () => {
        for (const trackId of [VIDEO_TRACK_ID, null]) {
            expect(
                checkIsKeyframeFragment(
                    moofOf(videoFragment(true)),
                    trackId,
                    0,
                ),
            ).toBe(true);
            expect(
                checkIsKeyframeFragment(
                    moofOf(videoFragment(false)),
                    trackId,
                    0,
                ),
            ).toBe(false);
        }
    });

    test('an audio fragment is no start point once the video track is known', () => {
        const audio = moofOf(audioFragment());
        expect(checkIsKeyframeFragment(audio, VIDEO_TRACK_ID, 0)).toBe(false);
        // Not knowing the video track, the first traf decides.
        expect(checkIsKeyframeFragment(audio, null, 0)).toBe(true);
    });

    test('the video traf decides when audio comes first', () => {
        const fragment = moof(
            traf(2, { trunFlags: 0x400, trunFields: [1, 0x02000000] }),
            traf(1, { trunFlags: 0x400, trunFields: [1, 0x01010000] }),
        );
        expect(checkIsKeyframeFragment(fragment, 1, 0)).toBe(false);
    });

    test("trun's first-sample flags win over its per-sample flags", () => {
        const fragment = moof(
            traf(1, {
                trunFlags: 0x001 | 0x004 | 0x400,
                trunFields: [2, 0, 0x02000000, 0x01010000, 0x01010000],
            }),
        );
        expect(checkIsKeyframeFragment(fragment, 1, 0x10000)).toBe(true);
        const nonSyncFirst = moof(
            traf(1, {
                trunFlags: 0x004,
                trunFields: [1, 0x01010000],
            }),
        );
        expect(checkIsKeyframeFragment(nonSyncFirst, 1, 0)).toBe(false);
    });

    test('per-sample flags are read past the duration and size columns', () => {
        const key = moof(
            traf(1, {
                trunFlags: 0x100 | 0x200 | 0x400 | 0x800,
                trunFields: [1, 3000, 99, 0x02000000, 0],
            }),
        );
        expect(checkIsKeyframeFragment(key, 1, 0x10000)).toBe(true);
        const delta = moof(
            traf(1, {
                trunFlags: 0x200 | 0x400,
                trunFields: [1, 99, 0x01010000],
            }),
        );
        expect(checkIsKeyframeFragment(delta, 1, 0)).toBe(false);
    });

    test("tfhd's default flags, read past its optional fields", () => {
        const allFields = 0x1 | 0x2 | 0x8 | 0x10 | 0x20;
        const withDefault = (defaultFlags: number) => {
            return moof(
                traf(1, {
                    tfhdFlags: allFields,
                    tfhdFields: [0, 0, 1, 3000, 99, defaultFlags],
                    trunFields: [1],
                }),
            );
        };
        expect(checkIsKeyframeFragment(withDefault(0x10000), 1, 0)).toBe(false);
        expect(
            checkIsKeyframeFragment(withDefault(0x02000000), 1, 0x10000),
        ).toBe(true);
    });

    test("trex's flags when nothing in the moof says", () => {
        const plain = moof(traf(1, { trunFields: [1] }));
        expect(checkIsKeyframeFragment(plain, 1, 0x10000)).toBe(false);
        expect(checkIsKeyframeFragment(plain, 1, 0)).toBe(true);
        // A per-sample column with no samples says nothing either.
        const empty = moof(traf(1, { trunFlags: 0x400, trunFields: [0] }));
        expect(checkIsKeyframeFragment(empty, 1, 0x10000)).toBe(false);
    });

    test('no traf of the video track: not a keyframe', () => {
        expect(checkIsKeyframeFragment(moof(), 1, 0)).toBe(false);
        const other = moof(traf(9, { trunFlags: 0x004, trunFields: [1, 0] }));
        expect(checkIsKeyframeFragment(other, 1, 0)).toBe(false);
    });
});

describe('Fmp4Fanout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('the init segment is found across arbitrarily split chunks', () => {
        const { fanout } = setup();
        pushSplit(fanout, INIT.subarray(0, INIT.length - 1));
        expect(fanout.hasInit).toBe(false);
        fanout.push(INIT.subarray(INIT.length - 1));
        expect(fanout.hasInit).toBe(true);
    });

    test('a client joining before init gets headers, init, then a KEY fragment', () => {
        const { fanout, join, onKeyframeWanted } = setup();
        const res = join('a');
        expect(onKeyframeWanted).toHaveBeenCalledTimes(1);
        expect(fanout.size).toBe(1);
        const delta1 = videoFragment(false);
        const key = videoFragment(true);
        const delta2 = videoFragment(false);
        pushSplit(fanout, Buffer.concat([INIT, delta1]));
        // A delta is never where a viewer starts.
        expect(res.headersSent).toBe(false);
        expect(res.chunks).toEqual([]);
        pushSplit(fanout, Buffer.concat([key, delta2]));
        expect(res.statusCode).toBe(200);
        expect(res.headers).toMatchObject({
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        });
        expect(res.chunks).toEqual([INIT, key, delta2]);
    });

    test('a client joining mid-stream starts on the next KEY, not a delta', () => {
        const { fanout, join, onKeyframeWanted } = setup();
        const early = join('early');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        expect(early.chunks).toHaveLength(2);
        const late = join('late');
        expect(onKeyframeWanted).toHaveBeenCalledTimes(2);
        const delta = videoFragment(false);
        const audio = audioFragment();
        fanout.push(Buffer.concat([delta, audio]));
        expect(late.chunks).toEqual([]);
        expect(early.chunks.slice(2)).toEqual([delta, audio]);
        const key = videoFragment(true);
        fanout.push(key);
        expect(late.chunks).toEqual([INIT, key]);
        // Once live, audio follows.
        const audio2 = audioFragment();
        fanout.push(audio2);
        expect(late.chunks).toEqual([INIT, key, audio2]);
    });

    test('a restarted stream (new ftyp + moov) is the init newcomers get', () => {
        const { fanout, join } = setup();
        fanout.push(INIT);
        const next = toBuffer(
            buildInitSegment({ ...VIDEO, width: 1920, height: 1080 }, null),
        );
        fanout.push(next);
        const res = join('a');
        const key = videoFragment(true);
        fanout.push(key);
        expect(res.chunks).toEqual([next, key]);
    });

    test('a fragment before init is not sent', () => {
        const { fanout, join } = setup();
        const res = join('a');
        fanout.push(videoFragment(true));
        expect(res.headersSent).toBe(false);
        expect(res.chunks).toEqual([]);
    });

    test('an mdat whose moof was already used is dropped', () => {
        const { fanout, join } = setup();
        const res = join('a');
        const key = videoFragment(true);
        fanout.push(Buffer.concat([INIT, key]));
        fanout.push(key.subarray(key.readUInt32BE(0)));
        expect(res.chunks).toEqual([INIT, key]);
    });

    test('a client whose backlog passes the cap is dropped', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        res.writableLength = MAX_CLIENT_BACKLOG;
        fanout.push(videoFragment(false));
        // At the cap is still live.
        expect(res.chunks).toHaveLength(3);
        expect(onClientGone).not.toHaveBeenCalled();
        res.writableLength = MAX_CLIENT_BACKLOG + 1;
        fanout.push(videoFragment(false));
        expect(res.chunks).toHaveLength(3);
        expect(res.isEnded).toBe(true);
        expect(res.isDestroyed).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        expect(onClientGone).toHaveBeenCalledWith('a');
        expect(fanout.size).toBe(0);
    });

    test('a client already behind when it starts is dropped before the key', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        res.writableLength = MAX_CLIENT_BACKLOG + 1;
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        expect(res.chunks).toEqual([]);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        expect(fanout.size).toBe(0);
    });

    test('no KEY within the wait: 503 and gone', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.push(Buffer.concat([INIT, videoFragment(false)]));
        vi.advanceTimersByTime(MAX_WAIT_MILLISECOND - 1);
        expect(fanout.size).toBe(1);
        expect(res.headersSent).toBe(false);
        vi.advanceTimersByTime(1);
        expect(res.statusCode).toBe(503);
        expect(res.headers).toEqual({ 'Cache-Control': 'no-store' });
        expect(res.isEnded).toBe(true);
        expect(res.isDestroyed).toBe(true);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        expect(fanout.size).toBe(0);
    });

    test('a live client outlasts the wait', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        vi.advanceTimersByTime(MAX_WAIT_MILLISECOND * 2);
        expect(fanout.size).toBe(1);
        expect(res.isEnded).toBe(false);
        expect(onClientGone).not.toHaveBeenCalled();
    });

    test('a viewer that closes is forgotten once', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        res.emit('close');
        expect(fanout.size).toBe(0);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        const before = res.chunks.length;
        fanout.push(videoFragment(true));
        expect(res.chunks).toHaveLength(before);
        // Its wait timer is gone too.
        vi.advanceTimersByTime(MAX_WAIT_MILLISECOND);
        expect(onClientGone).toHaveBeenCalledTimes(1);
    });

    test('removeClient: a waiting viewer is told 503; an unknown id is ignored', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.removeClient('nobody');
        expect(onClientGone).not.toHaveBeenCalled();
        fanout.removeClient('a');
        expect(res.statusCode).toBe(503);
        expect(res.isEnded).toBe(true);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        fanout.removeClient('a');
        expect(onClientGone).toHaveBeenCalledTimes(1);
    });

    test('reset ends every viewer and forgets the stream', () => {
        const { fanout, join, onClientGone } = setup();
        const live = join('live');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        const waiting = join('waiting');
        fanout.reset();
        expect(fanout.hasInit).toBe(false);
        expect(fanout.size).toBe(0);
        expect(live.isEnded).toBe(true);
        expect(live.statusCode).toBe(200);
        expect(waiting.statusCode).toBe(503);
        expect(onClientGone.mock.calls.map(([id]) => id).sort()).toEqual([
            'live',
            'waiting',
        ]);
    });

    test('resetStream ends live viewers and keeps waiting ones for the new stream', () => {
        const { fanout, join } = setup();
        const live = join('live');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        const waiting = join('waiting');
        fanout.resetStream();
        expect(fanout.hasInit).toBe(false);
        expect(live.isEnded).toBe(true);
        expect(fanout.size).toBe(1);
        const next = toBuffer(buildInitSegment(VIDEO, null));
        const key = videoFragment(true);
        fanout.push(Buffer.concat([next, key]));
        expect(waiting.chunks).toEqual([next, key]);
    });

    test('resetStream drops a half-received box', () => {
        const { fanout } = setup();
        fanout.push(INIT.subarray(0, 20));
        fanout.resetStream();
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(true);
    });

    test('a box too small to be one breaks the stream until resetStream', () => {
        const { fanout, join, onClientGone } = setup();
        const res = join('a');
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        fanout.push(Buffer.concat([u32(4), Buffer.from('junk')]));
        expect(res.isEnded).toBe(true);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        expect(fanout.hasInit).toBe(false);
        // Nothing is read while broken...
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(false);
        // ...until the encoder starts again.
        fanout.resetStream();
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(true);
    });

    test('a box larger than 64 MB breaks the stream without buffering it', () => {
        const { fanout } = setup();
        fanout.push(
            Buffer.concat([u32(64 * 1024 * 1024 + 1), Buffer.from('mdat')]),
        );
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(false);
        fanout.resetStream();
        // A 64-bit size over the limit too.
        const large = Buffer.alloc(16);
        large.writeUInt32BE(1, 0);
        large.write('mdat', 4, 'latin1');
        large.writeBigUInt64BE(BigInt(2 ** 40), 8);
        fanout.push(large);
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(false);
    });

    test('a 64-bit sized box is read whole, even split mid-header', () => {
        const { fanout } = setup();
        const free = Buffer.alloc(24);
        free.writeUInt32BE(1, 0);
        free.write('free', 4, 'latin1');
        free.writeBigUInt64BE(24n, 8);
        pushSplit(fanout, Buffer.concat([free, INIT]));
        expect(fanout.hasInit).toBe(true);
    });

    test('an empty push is ignored', () => {
        const { fanout } = setup();
        fanout.push(new Uint8Array(0));
        fanout.push(INIT);
        expect(fanout.hasInit).toBe(true);
    });

    test('a sink is given the stream as it is, then every fragment and reset', () => {
        const { fanout } = setup();
        fanout.push(INIT);
        const sink = { onInit: vi.fn(), onFragment: vi.fn(), onReset: vi.fn() };
        // Attached mid-stream: told the init it missed.
        fanout.setSink(sink);
        expect(sink.onInit).toHaveBeenCalledWith(INIT);
        const key = videoFragment(true);
        const sound = audioFragment();
        fanout.push(Buffer.concat([key, sound]));
        expect(sink.onFragment.mock.calls).toEqual([
            [key, true, (sequence - 1) * (3000 / 90000)],
            [sound, false, null],
        ]);
        fanout.resetStream();
        expect(sink.onReset).toHaveBeenCalledTimes(1);
        // Let go: told nothing more.
        fanout.setSink(null);
        fanout.push(Buffer.concat([INIT, videoFragment(true)]));
        expect(sink.onInit).toHaveBeenCalledTimes(1);
        expect(sink.onFragment).toHaveBeenCalledTimes(2);
    });
});
