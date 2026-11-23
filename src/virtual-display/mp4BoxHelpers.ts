// The bytes every MP4 written here is made of -- a box, a full box, the
// numbers inside them, and the boxes a video track needs whatever else is in
// the file. Shared by the live fragmented MP4 a virtual display streams
// (`fmp4Muxer.ts`) and the whole MP4 file an animation is saved as
// (`mp4FileWriter.ts`). A leaf: nothing here reaches the app.

export const mp4TextEncoder = new TextEncoder();

export function concatBytes(parts: Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function bytes(writer: (view: DataView) => void, length: number) {
    const out = new Uint8Array(length);
    writer(new DataView(out.buffer));
    return out;
}

export function u8(value: number) {
    return Uint8Array.of(value & 0xff);
}

export function u16(value: number) {
    return bytes((view) => view.setUint16(0, value), 2);
}

export function u32(value: number) {
    return bytes((view) => view.setUint32(0, value >>> 0), 4);
}

export function u64(value: number) {
    return bytes(
        (view) => view.setBigUint64(0, BigInt(Math.max(0, Math.floor(value)))),
        8,
    );
}

export function zeros(length: number) {
    return new Uint8Array(length);
}

export function box(type: string, ...payload: Uint8Array[]) {
    const body = concatBytes(payload);
    return concatBytes([
        u32(body.length + 8),
        mp4TextEncoder.encode(type),
        body,
    ]);
}

export function fullBox(
    type: string,
    version: number,
    flags: number,
    ...payload: Uint8Array[]
) {
    return box(
        type,
        u32(((version & 0xff) << 24) | (flags & 0xffffff)),
        ...payload,
    );
}

export const UNITY_MATRIX = concatBytes(
    [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32),
);

/**
 * `tkhd`; `duration` is in the MOVIE's timescale, 0 for a fragmented file,
 * whose length the fragments say.
 */
export function trackHeader(
    trackId: number,
    width: number,
    height: number,
    isAudio: boolean,
    duration = 0,
) {
    return fullBox(
        'tkhd',
        0,
        3,
        u32(0),
        u32(0),
        u32(trackId),
        u32(0),
        u32(duration),
        zeros(8),
        u16(0),
        u16(0),
        u16(isAudio ? 0x0100 : 0),
        u16(0),
        UNITY_MATRIX,
        u32(width << 16),
        u32(height << 16),
    );
}

/** `mdhd`; `duration` in the track's own `timescale`. Language "und". */
export function mediaHeader(timescale: number, duration = 0) {
    return fullBox(
        'mdhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(timescale),
        u32(duration),
        u16(0x55c4),
        u16(0),
    );
}

export function dataInformation() {
    return box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
}

export function handler(type: string, name: string) {
    return fullBox(
        'hdlr',
        0,
        0,
        u32(0),
        mp4TextEncoder.encode(type),
        zeros(12),
        mp4TextEncoder.encode(`${name}\0`),
    );
}

/**
 * The `avc1` sample entry: H.264 at this size, decoded with the
 * AVCDecoderConfigurationRecord WebCodecs hands over as
 * `decoderConfig.description` (avc format).
 */
export function avc1SampleEntry(
    width: number,
    height: number,
    avcC: Uint8Array,
) {
    return box(
        'avc1',
        zeros(6),
        u16(1),
        u16(0),
        u16(0),
        zeros(12),
        u16(width),
        u16(height),
        u32(0x00480000),
        u32(0x00480000),
        u32(0),
        u16(1),
        zeros(32),
        u16(0x0018),
        u16(0xffff),
        box('avcC', avcC),
    );
}
