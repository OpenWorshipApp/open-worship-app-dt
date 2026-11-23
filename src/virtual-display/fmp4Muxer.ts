// A fragmented MP4 written one small fragment at a time, for a virtual
// display's live video: H.264 from WebCodecs on track 1, AAC on track 2.
//
// Chromium's MediaRecorder only closes an MP4 fragment at a keyframe, so a
// viewer sees nothing until a whole keyframe interval has passed (measured:
// ~1.1 s). Written here, every video frame is its own fragment and leaves the
// moment it is encoded (~5 ms on this hardware), and a viewer that joins is
// sent a keyframe at once instead of waiting for the next one.

import {
    avc1SampleEntry,
    box,
    concatBytes,
    dataInformation,
    fullBox,
    handler,
    mediaHeader,
    mp4TextEncoder,
    trackHeader,
    u16,
    u32,
    u64,
    u8,
    UNITY_MATRIX,
    zeros,
} from './mp4BoxHelpers';

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
    const body = concatBytes(payload);
    // Every descriptor here is under 128 bytes: one length byte.
    return concatBytes([u8(tag), u8(body.length), body]);
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

function videoTrack(video: VideoTrackInfoType) {
    const avc1 = avc1SampleEntry(video.width, video.height, video.avcC);
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
        mp4TextEncoder.encode('isom'),
        u32(0x200),
        mp4TextEncoder.encode('isomiso6avc1mp41'),
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
    return concatBytes([ftyp, moov]);
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
    const sampleRows = concatBytes(
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
    return concatBytes([moof, mdat]);
}
