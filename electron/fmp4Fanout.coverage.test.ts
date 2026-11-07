import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Fmp4Fanout, readVideoTrackInfo } from './fmp4Fanout';

// Box shapes a muxer seldom writes -- 64-bit sizes, a size of 0 meaning "to
// the end", sizes that lie -- read the way an untrusted stream must be.

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

// The same box with the 64-bit "largesize" header.
function largeBox(type: string, ...payload: Buffer[]) {
    const body = Buffer.concat(payload);
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(body.length + 16));
    return Buffer.concat([u32(1), Buffer.from(type, 'latin1'), size, body]);
}

// A box whose size field is 0: it runs to the end of its parent.
function toEndBox(type: string, ...payload: Buffer[]) {
    return Buffer.concat([u32(0), Buffer.from(type, 'latin1'), ...payload]);
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

function tkhd(trackId: number) {
    return fullBox(
        'tkhd',
        0,
        3,
        Buffer.alloc(8),
        u32(trackId),
        Buffer.alloc(60),
    );
}

function mdia(handler: string) {
    return box(
        'mdia',
        fullBox(
            'hdlr',
            0,
            0,
            u32(0),
            Buffer.from(handler, 'latin1'),
            Buffer.alloc(12),
        ),
    );
}

function moov(...children: Buffer[]) {
    return box('moov', ...children);
}

describe('readVideoTrackInfo over unusual box sizes', () => {
    test('a track written with a 64-bit size is read', () => {
        const info = readVideoTrackInfo(
            moov(largeBox('trak', tkhd(7), mdia('vide'))),
        );

        expect(info.trackId).toBe(7);
    });

    test('a last track whose size says "to the end" is read', () => {
        const info = readVideoTrackInfo(
            moov(
                box('trak', tkhd(2), mdia('soun')),
                toEndBox('trak', tkhd(9), mdia('vide')),
            ),
        );

        expect(info.trackId).toBe(9);
    });

    test('a 64-bit size cut short ends the read', () => {
        // Size 1 says the real size follows -- and only four bytes do.
        const cut = Buffer.concat([u32(1), Buffer.from('trak'), u32(0)]);

        expect(readVideoTrackInfo(moov(cut)).trackId).toBeNull();
    });

    test('a size smaller than its own header ends the read', () => {
        const lying = Buffer.concat([u32(4), Buffer.from('trak')]);

        expect(
            readVideoTrackInfo(moov(lying, box('trak', tkhd(3), mdia('vide'))))
                .trackId,
        ).toBeNull();
    });

    test('a size past the end of its parent ends the read', () => {
        const lying = Buffer.concat([
            u32(4096),
            Buffer.from('trak'),
            tkhd(5),
            mdia('vide'),
        ]);

        expect(readVideoTrackInfo(moov(lying)).trackId).toBeNull();
    });

    test('a track missing its header or handler is passed over', () => {
        const info = readVideoTrackInfo(
            moov(
                // No mdia, so no handler: not a track that can be told apart.
                box('trak', tkhd(4)),
                // A handler but no tkhd: no id to take.
                box('trak', mdia('vide')),
                box('trak', tkhd(6), mdia('vide')),
            ),
        );

        expect(info.trackId).toBe(6);
    });
});

class FakeResponse extends EventEmitter {
    headersSent = false;
    statusCode = 0;
    isEnded = false;
    isDestroyed = false;
    writableLength = 0;

    writeHead(statusCode: number) {
        this.statusCode = statusCode;
        this.headersSent = true;
        return this;
    }

    write() {
        return true;
    }

    end() {
        this.isEnded = true;
        return this;
    }

    destroy() {
        if (!this.isDestroyed) {
            this.isDestroyed = true;
            this.emit('close');
        }
        return this;
    }
}

describe('a viewer that asks again under the same id', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('is not cut off by the wait of its earlier ask', () => {
        vi.useFakeTimers();
        const onClientGone = vi.fn();
        const fanout = new Fmp4Fanout(onClientGone, () => {});
        const first = new FakeResponse();
        const second = new FakeResponse();
        fanout.addClient('viewer-1', first as unknown as http.ServerResponse);
        vi.advanceTimersByTime(10_000);
        fanout.addClient('viewer-1', second as unknown as http.ServerResponse);

        // The first ask's 20 s are up: it is not the one waiting any more.
        vi.advanceTimersByTime(10_000);
        expect(second.isEnded).toBe(false);
        expect(onClientGone).not.toHaveBeenCalled();
        expect(fanout.size).toBe(1);
        // The first one closing is not the second one leaving.
        first.destroy();
        expect(fanout.size).toBe(1);

        // The second ask's own wait.
        vi.advanceTimersByTime(10_000);
        expect(second.statusCode).toBe(503);
        expect(second.isEnded).toBe(true);
        expect(onClientGone).toHaveBeenCalledTimes(1);
        expect(onClientGone).toHaveBeenCalledWith('viewer-1');
        expect(fanout.size).toBe(0);
    });
});
