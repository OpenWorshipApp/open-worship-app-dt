import type http from 'node:http';

// One live fragmented MP4 (`ftyp`, `moov`, then a `moof` + `mdat` per frame,
// written by the compositor's `LiveMp4Encoder`) handed to many HTTP viewers.
// A viewer that joins asks for a keyframe and starts on it: the init segment,
// that fragment, then the live ones. Nothing is replayed -- a backlog is
// latency -- so all that is held is the init segment.
const MAX_CLIENT_BACKLOG = 4 * 1024 * 1024;
const MAX_WAIT_MILLISECOND = 20000;
// A box bigger than this is not something MediaRecorder writes; reading on
// would only buffer a broken stream.
const MAX_BOX_BYTES = 64 * 1024 * 1024;

type BoxType = { type: string; start: number; header: number; end: number };

function* readBoxes(buffer: Buffer, start: number, end: number) {
    let offset = start;
    while (offset + 8 <= end) {
        let size = buffer.readUInt32BE(offset);
        const type = buffer.toString('latin1', offset + 4, offset + 8);
        let header = 8;
        if (size === 1) {
            if (offset + 16 > end) {
                return;
            }
            size = Number(buffer.readBigUInt64BE(offset + 8));
            header = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < header || offset + size > end) {
            return;
        }
        yield { type, start: offset, header, end: offset + size } as BoxType;
        offset += size;
    }
}

function findChild(buffer: Buffer, parent: BoxType, type: string) {
    for (const box of readBoxes(
        buffer,
        parent.start + parent.header,
        parent.end,
    )) {
        if (box.type === type) {
            return box;
        }
    }
    return null;
}

// The video track's id and its `trex` default sample flags, read off `moov`.
export function readVideoTrackInfo(moov: Buffer) {
    const root: BoxType = {
        type: 'moov',
        start: 0,
        header: 8,
        end: moov.length,
    };
    let trackId: number | null = null;
    let timescale = 0;
    for (const trak of readBoxes(moov, root.header, root.end)) {
        if (trak.type !== 'trak') {
            continue;
        }
        const mdia = findChild(moov, trak, 'mdia');
        const hdlr = mdia ? findChild(moov, mdia, 'hdlr') : null;
        const tkhd = findChild(moov, trak, 'tkhd');
        if (!hdlr || !tkhd) {
            continue;
        }
        const handler = moov.toString(
            'latin1',
            hdlr.start + hdlr.header + 8,
            hdlr.start + hdlr.header + 12,
        );
        if (handler !== 'vide') {
            continue;
        }
        const mdhd = mdia ? findChild(moov, mdia, 'mdhd') : null;
        if (mdhd) {
            const body = mdhd.start + mdhd.header;
            const at = body + 4 + (moov[body] === 1 ? 16 : 8);
            if (at + 4 <= mdhd.end) {
                timescale = moov.readUInt32BE(at);
            }
        }
        const version = moov[tkhd.start + tkhd.header];
        trackId = moov.readUInt32BE(
            tkhd.start + tkhd.header + 4 + (version === 1 ? 16 : 8),
        );
    }
    let trexFlags = 0;
    const mvex = findChild(moov, root, 'mvex');
    if (mvex && trackId !== null) {
        for (const trex of readBoxes(
            moov,
            mvex.start + mvex.header,
            mvex.end,
        )) {
            const body = trex.start + trex.header + 4;
            if (trex.type === 'trex' && moov.readUInt32BE(body) === trackId) {
                trexFlags = moov.readUInt32BE(body + 16);
            }
        }
    }
    return { trackId, trexFlags, timescale };
}

// When a `moof`'s fragment of `trackId` starts, in that track's timescale:
// its `tfdt`. Null when it carries none.
export function readFragmentDecodeTime(moof: Buffer, trackId: number | null) {
    for (const traf of readBoxes(moof, 8, moof.length)) {
        if (traf.type !== 'traf') {
            continue;
        }
        let id: number | null = null;
        let time: number | null = null;
        for (const box of readBoxes(moof, traf.start + traf.header, traf.end)) {
            const body = box.start + box.header;
            if (box.type === 'tfhd' && body + 8 <= box.end) {
                id = moof.readUInt32BE(body + 4);
            } else if (box.type === 'tfdt') {
                const isLong = moof[body] === 1;
                if (body + (isLong ? 12 : 8) <= box.end) {
                    time = isLong
                        ? Number(moof.readBigUInt64BE(body + 4))
                        : moof.readUInt32BE(body + 4);
                }
            }
        }
        if (time !== null && (trackId === null || id === trackId)) {
            return time;
        }
    }
    return null;
}

// Whether a `moof` starts its video track on a sync sample: `trun`'s
// first-sample flags, else its per-sample flags, else `tfhd`'s default, else
// `trex`'s. A sample is a sync sample when "is non-sync" (0x10000) is clear.
export function checkIsKeyframeFragment(
    moof: Buffer,
    videoTrackId: number | null,
    trexFlags: number,
) {
    const root: BoxType = {
        type: 'moof',
        start: 0,
        header: 8,
        end: moof.length,
    };
    for (const traf of readBoxes(moof, root.header, root.end)) {
        if (traf.type !== 'traf') {
            continue;
        }
        let trackId: number | null = null;
        let defaultFlags: number | null = null;
        let sampleFlags: number | null = null;
        for (const box of readBoxes(moof, traf.start + traf.header, traf.end)) {
            const flags = moof.readUInt32BE(box.start + box.header) & 0xffffff;
            let offset = box.start + box.header + 4;
            if (box.type === 'tfhd') {
                trackId = moof.readUInt32BE(offset);
                offset += 4;
                if (flags & 0x1) offset += 8;
                if (flags & 0x2) offset += 4;
                if (flags & 0x8) offset += 4;
                if (flags & 0x10) offset += 4;
                if (flags & 0x20) defaultFlags = moof.readUInt32BE(offset);
            } else if (box.type === 'trun') {
                const count = moof.readUInt32BE(offset);
                offset += 4;
                if (flags & 0x1) offset += 4;
                if (flags & 0x4) {
                    sampleFlags = moof.readUInt32BE(offset);
                } else if (flags & 0x400 && count > 0) {
                    if (flags & 0x100) offset += 4;
                    if (flags & 0x200) offset += 4;
                    sampleFlags = moof.readUInt32BE(offset);
                }
            }
        }
        if (videoTrackId !== null && trackId !== videoTrackId) {
            continue;
        }
        const resolved = sampleFlags ?? defaultFlags ?? trexFlags;
        return !(resolved & 0x10000);
    }
    return false;
}

type ClientType = {
    res: http.ServerResponse;
    isLive: boolean;
    waitTimer?: ReturnType<typeof setTimeout>;
};

export class Fmp4Fanout {
    private pending: Buffer = Buffer.alloc(0);
    private initParts: Buffer[] = [];
    private init: Buffer | null = null;
    private videoTrackId: number | null = null;
    private trexFlags = 0;
    private videoTimescale = 0;
    // Where the picture is now, in seconds of the stream's own timeline: the
    // newest video fragment's start. A cast TV is steered by it.
    liveTime: number | null = null;
    private moof: Buffer | null = null;
    private isKeyMoof = false;
    private clients = new Map<string, ClientType>();
    private isBroken = false;
    constructor(
        private onClientGone: (id: string) => void = () => {},
        private onKeyframeWanted: () => void = () => {},
    ) {}

    get size() {
        return this.clients.size;
    }

    get hasInit() {
        return this.init !== null;
    }

    push(data: Uint8Array) {
        if (this.isBroken || data.length === 0) {
            return;
        }
        this.pending =
            this.pending.length === 0
                ? Buffer.from(data)
                : Buffer.concat([this.pending, data]);
        while (this.pending.length >= 8) {
            let size = this.pending.readUInt32BE(0);
            if (size === 1) {
                if (this.pending.length < 16) {
                    return;
                }
                size = Number(this.pending.readBigUInt64BE(8));
            }
            if (size < 8 || size > MAX_BOX_BYTES) {
                // Not a stream this can follow: end it rather than buffer it,
                // and read nothing more until the encoder starts again.
                this.reset();
                this.isBroken = true;
                return;
            }
            if (this.pending.length < size) {
                return;
            }
            const type = this.pending.toString('latin1', 4, 8);
            // Copied out so the whole pending buffer is not retained by one box.
            const box = Buffer.from(this.pending.subarray(0, size));
            this.pending =
                this.pending.length === size
                    ? Buffer.alloc(0)
                    : Buffer.from(this.pending.subarray(size));
            this.handleBox(type, box);
        }
    }

    private handleBox(type: string, box: Buffer) {
        if (type === 'ftyp') {
            this.initParts = [box];
            this.init = null;
        } else if (type === 'moov') {
            this.initParts.push(box);
            this.init = Buffer.concat(this.initParts);
            this.initParts = [];
            const info = readVideoTrackInfo(box);
            this.videoTrackId = info.trackId;
            this.trexFlags = info.trexFlags;
            this.videoTimescale = info.timescale;
        } else if (type === 'moof') {
            this.moof = box;
            this.isKeyMoof = checkIsKeyframeFragment(
                box,
                this.videoTrackId,
                this.trexFlags,
            );
            if (this.videoTrackId !== null && this.videoTimescale > 0) {
                const time = readFragmentDecodeTime(box, this.videoTrackId);
                if (time !== null) {
                    this.liveTime = time / this.videoTimescale;
                }
            }
        } else if (type === 'mdat' && this.moof !== null && this.init) {
            const fragment = Buffer.concat([this.moof, box]);
            this.moof = null;
            this.addFragment(fragment, this.isKeyMoof);
        }
    }

    private addFragment(fragment: Buffer, isKey: boolean) {
        for (const [id, client] of this.clients) {
            if (client.isLive) {
                this.write(id, client, fragment);
            } else if (isKey) {
                this.startClient(id, client, fragment);
            }
        }
    }

    private write(id: string, client: ClientType, data: Buffer) {
        if (client.res.writableLength > MAX_CLIENT_BACKLOG) {
            // A viewer this far behind is not watching live any more.
            this.removeClient(id);
            return;
        }
        client.res.write(data);
    }

    private startClient(id: string, client: ClientType, keyFragment: Buffer) {
        if (!this.init) {
            return;
        }
        clearTimeout(client.waitTimer);
        client.isLive = true;
        if (!client.res.headersSent) {
            client.res.writeHead(200, {
                'Content-Type': 'video/mp4',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'Access-Control-Allow-Origin': '*',
            });
        }
        this.write(id, client, this.init);
        if (this.clients.has(id)) {
            this.write(id, client, keyFragment);
        }
    }

    addClient(id: string, res: http.ServerResponse) {
        const client: ClientType = { res, isLive: false };
        this.clients.set(id, client);
        res.on('close', () => {
            if (this.clients.get(id) === client) {
                this.removeClient(id);
            }
        });
        this.onKeyframeWanted();
        client.waitTimer = setTimeout(() => {
            if (this.clients.get(id) !== client || client.isLive) {
                return;
            }
            if (!res.headersSent) {
                res.writeHead(503, { 'Cache-Control': 'no-store' });
            }
            this.removeClient(id);
        }, MAX_WAIT_MILLISECOND);
    }

    removeClient(id: string) {
        const client = this.clients.get(id);
        if (!client) {
            return;
        }
        this.clients.delete(id);
        clearTimeout(client.waitTimer);
        if (!client.res.headersSent) {
            client.res.writeHead(503, { 'Cache-Control': 'no-store' });
        }
        client.res.end();
        client.res.destroy();
        this.onClientGone(id);
    }

    // A new encoder run (a restart, a size change): every viewer is ended so
    // its player reconnects to the new stream.
    reset() {
        for (const id of [...this.clients.keys()]) {
            this.removeClient(id);
        }
        this.resetStream();
    }

    // Forgets the stream itself, keeping waiting viewers waiting.
    resetStream() {
        this.pending = Buffer.alloc(0);
        this.initParts = [];
        this.init = null;
        this.moof = null;
        this.liveTime = null;
        this.isBroken = false;
        for (const [id, client] of this.clients) {
            if (client.isLive) {
                this.removeClient(id);
            }
        }
    }
}
