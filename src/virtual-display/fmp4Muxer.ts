// A fragmented MP4 written one small fragment at a time, for a virtual
// display's live video: H.264 from WebCodecs on track 1, AAC on track 2.
//
// Chromium's MediaRecorder only closes an MP4 fragment at a keyframe, so a
// viewer sees nothing until a whole keyframe interval has passed (measured:
// ~1.1 s). Written here, every video frame is its own fragment and leaves the
// moment it is encoded (~5 ms on this hardware), and a viewer that joins is
// sent a keyframe at once instead of waiting for the next one.

export const VIDEO_TRACK_ID = 1;
export const AUDIO_TRACK_ID = 2;
export const VIDEO_TIMESCALE = 90000;
// Sample flags: a sync sample, and a sample that depends on others.
export const KEY_SAMPLE_FLAGS = 0x02000000;
export const DELTA_SAMPLE_FLAGS = 0x01010000;

export type VideoTrackInfoType = {
    width: number;
    height: number;
    // The AVCDecoderConfigurationRecord WebCodecs hands over as
    // `decoderConfig.description` (avc format).
    avcC: Uint8Array;
};
export type AudioTrackInfoType = {
    sampleRate: number;
    channelCount: number;
    audioSpecificConfig: Uint8Array;
};
export type SampleType = {
    data: Uint8Array;
    duration: number;
    isKey: boolean;
};

const textEncoder = new TextEncoder();

function concat(parts: Uint8Array[]) {
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

function u8(value: number) {
    return Uint8Array.of(value & 0xff);
}

function u16(value: number) {
    return bytes((view) => view.setUint16(0, value), 2);
}

function u32(value: number) {
    return bytes((view) => view.setUint32(0, value >>> 0), 4);
}

function u64(value: number) {
    return bytes(
        (view) => view.setBigUint64(0, BigInt(Math.max(0, Math.floor(value)))),
        8,
    );
}

function zeros(length: number) {
    return new Uint8Array(length);
}

function box(type: string, ...payload: Uint8Array[]) {
    const body = concat(payload);
    return concat([u32(body.length + 8), textEncoder.encode(type), body]);
}

function fullBox(
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

const UNITY_MATRIX = concat(
    [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32),
);

// AAC-LC's two-byte AudioSpecificConfig, for when the encoder does not give
// one: object type 2, the sample-rate index, the channel count.
export function toAudioSpecificConfig(
    sampleRate: number,
    channelCount: number,
) {
    const rates = [
        96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000,
        11025, 8000, 7350,
    ];
    const index = Math.max(0, rates.indexOf(sampleRate));
    return Uint8Array.of(
        (2 << 3) | (index >> 1),
        ((index & 1) << 7) | ((channelCount & 0xf) << 3),
    );
}

function descriptor(tag: number, ...payload: Uint8Array[]) {
    const body = concat(payload);
    // Every descriptor here is under 128 bytes: one length byte.
    return concat([u8(tag), u8(body.length), body]);
}

function trackHeader(
    trackId: number,
    width: number,
    height: number,
    isAudio: boolean,
) {
    return fullBox(
        'tkhd',
        0,
        3,
        u32(0),
        u32(0),
        u32(trackId),
        u32(0),
        u32(0),
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

function emptySampleTables(sampleEntry: Uint8Array) {
    return box(
        'stbl',
        fullBox('stsd', 0, 0, u32(1), sampleEntry),
        fullBox('stts', 0, 0, u32(0)),
        fullBox('stsc', 0, 0, u32(0)),
        fullBox('stsz', 0, 0, u32(0), u32(0)),
        fullBox('stco', 0, 0, u32(0)),
    );
}

function dataInformation() {
    return box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
}

function mediaHeader(timescale: number) {
    // Language "und".
    return fullBox(
        'mdhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(timescale),
        u32(0),
        u16(0x55c4),
        u16(0),
    );
}

function handler(type: string, name: string) {
    return fullBox(
        'hdlr',
        0,
        0,
        u32(0),
        textEncoder.encode(type),
        zeros(12),
        textEncoder.encode(`${name}\0`),
    );
}

function videoTrack(video: VideoTrackInfoType) {
    const compressorName = zeros(32);
    const avc1 = box(
        'avc1',
        zeros(6),
        u16(1),
        u16(0),
        u16(0),
        zeros(12),
        u16(video.width),
        u16(video.height),
        u32(0x00480000),
        u32(0x00480000),
        u32(0),
        u16(1),
        compressorName,
        u16(0x0018),
        u16(0xffff),
        box('avcC', video.avcC),
    );
    return box(
        'trak',
        trackHeader(VIDEO_TRACK_ID, video.width, video.height, false),
        box(
            'mdia',
            mediaHeader(VIDEO_TIMESCALE),
            handler('vide', 'VideoHandler'),
            box(
                'minf',
                fullBox('vmhd', 0, 1, u16(0), zeros(6)),
                dataInformation(),
                emptySampleTables(avc1),
            ),
        ),
    );
}

function audioTrack(audio: AudioTrackInfoType) {
    const esds = fullBox(
        'esds',
        0,
        0,
        descriptor(
            0x03,
            u16(AUDIO_TRACK_ID),
            u8(0),
            descriptor(
                0x04,
                u8(0x40),
                u8((0x05 << 2) | 1),
                zeros(3),
                u32(128000),
                u32(128000),
                descriptor(0x05, audio.audioSpecificConfig),
            ),
            descriptor(0x06, u8(0x02)),
        ),
    );
    const mp4a = box(
        'mp4a',
        zeros(6),
        u16(1),
        zeros(8),
        u16(audio.channelCount),
        u16(16),
        u16(0),
        u16(0),
        u32(audio.sampleRate << 16),
        esds,
    );
    return box(
        'trak',
        trackHeader(AUDIO_TRACK_ID, 0, 0, true),
        box(
            'mdia',
            mediaHeader(audio.sampleRate),
            handler('soun', 'SoundHandler'),
            box(
                'minf',
                fullBox('smhd', 0, 0, u16(0), u16(0)),
                dataInformation(),
                emptySampleTables(mp4a),
            ),
        ),
    );
}

function trackExtends(trackId: number) {
    return fullBox('trex', 0, 0, u32(trackId), u32(1), u32(0), u32(0), u32(0));
}

// `ftyp` + `moov`: what every viewer is sent first.
export function buildInitSegment(
    video: VideoTrackInfoType,
    audio: AudioTrackInfoType | null,
) {
    const ftyp = box(
        'ftyp',
        textEncoder.encode('isom'),
        u32(0x200),
        textEncoder.encode('isomiso6avc1mp41'),
    );
    const mvhd = fullBox(
        'mvhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(1000),
        u32(0),
        u32(0x00010000),
        u16(0x0100),
        zeros(10),
        UNITY_MATRIX,
        zeros(24),
        u32(audio === null ? 2 : 3),
    );
    const moov = box(
        'moov',
        mvhd,
        videoTrack(video),
        ...(audio === null ? [] : [audioTrack(audio)]),
        box(
            'mvex',
            trackExtends(VIDEO_TRACK_ID),
            ...(audio === null ? [] : [trackExtends(AUDIO_TRACK_ID)]),
        ),
    );
    return concat([ftyp, moov]);
}

// One `moof` + `mdat`: the samples of one track, decoded from
// `baseDecodeTime` (in that track's timescale).
export function buildFragment({
    sequence,
    trackId,
    baseDecodeTime,
    samples,
}: {
    sequence: number;
    trackId: number;
    baseDecodeTime: number;
    samples: SampleType[];
}) {
    const sampleRows = concat(
        samples.flatMap((sample) => [
            u32(sample.duration),
            u32(sample.data.length),
            u32(sample.isKey ? KEY_SAMPLE_FLAGS : DELTA_SAMPLE_FLAGS),
        ]),
    );
    const build = (dataOffset: number) => {
        return box(
            'moof',
            fullBox('mfhd', 0, 0, u32(sequence)),
            box(
                'traf',
                // default-base-is-moof: data offsets count from this moof.
                fullBox('tfhd', 0, 0x020000, u32(trackId)),
                fullBox('tfdt', 1, 0, u64(baseDecodeTime)),
                // data offset + duration + size + flags, per sample.
                fullBox(
                    'trun',
                    0,
                    0x000701,
                    u32(samples.length),
                    u32(dataOffset),
                    sampleRows,
                ),
            ),
        );
    };
    // moof 8 + mfhd 16 + traf 8 + tfhd 16 + tfdt 20 + trun 20, and 12 a sample.
    const moofLength = 88 + 12 * samples.length;
    const moof = build(moofLength + 8);
    const mdat = box('mdat', ...samples.map((sample) => sample.data));
    return concat([moof, mdat]);
}
