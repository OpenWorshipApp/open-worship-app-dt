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
    UNITY_MATRIX,
    zeros,
} from './mp4BoxHelpers';

/**
 * A whole MP4 FILE of H.264 from WebCodecs -- what an animation is saved as
 * (`animationExportHelpers.ts`), to be played by this app's Videos and by
 * any other program a church shows video with. Not `fmp4Muxer.ts`, whose
 * fragments are for a live stream: some players a church uses read a
 * fragmented file badly, and every one reads this one.
 *
 * Laid out `ftyp`, `mdat`, `moov`: the samples go to disk the moment they
 * are encoded, so nothing of the picture is held -- only each sample's size
 * and which are keyframes, 4 bytes a frame. `mdat` carries a 64-bit size
 * written as 0 at the start; `finish` hands back the 8 bytes and where they
 * go, for the caller to write over them once the file is closed.
 */

export const MP4_FILE_TIMESCALE = 90000;
// The movie's own clock, in which `mvhd` and `tkhd` say how long it is.
const MOVIE_TIMESCALE = 1000;
const VIDEO_TRACK_ID = 1;
// `size` 1 + the type + a 64-bit size: the header of an mdat of any length.
const MDAT_HEADER_LENGTH = 16;

export type Mp4ByteSinkType = {
    write: (chunk: Uint8Array) => Promise<void>;
};

export type Mp4FileVideoType = {
    width: number;
    height: number;
    frameRate: number;
};

export type Mp4FilePatchType = { position: number; bytes: Uint8Array };

export function toMp4SampleDuration(frameRate: number) {
    return Math.max(1, Math.round(MP4_FILE_TIMESCALE / frameRate));
}

export function genMp4FileHead() {
    const ftyp = box(
        'ftyp',
        mp4TextEncoder.encode('isom'),
        u32(0x200),
        mp4TextEncoder.encode('isomiso2avc1mp41'),
    );
    const mdatHeader = concatBytes([
        u32(1),
        mp4TextEncoder.encode('mdat'),
        u64(0),
    ]);
    return concatBytes([ftyp, mdatHeader]);
}

/** The mdat's real 64-bit size, and where in the file it goes. */
export function genMp4MdatSizePatch(
    headLength: number,
    dataLength: number,
): Mp4FilePatchType {
    return {
        position: headLength - 8,
        bytes: u64(MDAT_HEADER_LENGTH + dataLength),
    };
}

function sampleTables({
    video,
    avcC,
    sampleSizeList,
    keySampleNumberList,
    dataOffset,
}: {
    video: Mp4FileVideoType;
    avcC: Uint8Array;
    sampleSizeList: number[];
    keySampleNumberList: number[];
    dataOffset: number;
}) {
    const sampleCount = sampleSizeList.length;
    // A second of samples a chunk: a player reads a chunk at a time.
    const samplesPerChunk = Math.max(1, Math.round(video.frameRate));
    const chunkOffsetList: number[] = [];
    let offset = dataOffset;
    sampleSizeList.forEach((size, index) => {
        if (index % samplesPerChunk === 0) {
            chunkOffsetList.push(offset);
        }
        offset += size;
    });
    const remainder = sampleCount % samplesPerChunk;
    const fullChunkCount = Math.floor(sampleCount / samplesPerChunk);
    const stscRows: Uint8Array[] = [];
    if (fullChunkCount > 0) {
        stscRows.push(u32(1), u32(samplesPerChunk), u32(1));
    }
    if (remainder > 0) {
        stscRows.push(u32(fullChunkCount + 1), u32(remainder), u32(1));
    }
    return box(
        'stbl',
        fullBox(
            'stsd',
            0,
            0,
            u32(1),
            avc1SampleEntry(video.width, video.height, avcC),
        ),
        fullBox(
            'stts',
            0,
            0,
            u32(1),
            u32(sampleCount),
            u32(toMp4SampleDuration(video.frameRate)),
        ),
        fullBox(
            'stss',
            0,
            0,
            u32(keySampleNumberList.length),
            ...keySampleNumberList.map(u32),
        ),
        fullBox('stsc', 0, 0, u32(stscRows.length / 3), ...stscRows),
        fullBox(
            'stsz',
            0,
            0,
            u32(0),
            u32(sampleCount),
            ...sampleSizeList.map(u32),
        ),
        fullBox(
            'co64',
            0,
            0,
            u32(chunkOffsetList.length),
            ...chunkOffsetList.map(u64),
        ),
    );
}

export function genMp4FileMoov(options: {
    video: Mp4FileVideoType;
    avcC: Uint8Array;
    sampleSizeList: number[];
    keySampleNumberList: number[];
    dataOffset: number;
}) {
    const { video, sampleSizeList } = options;
    const mediaDuration =
        sampleSizeList.length * toMp4SampleDuration(video.frameRate);
    const movieDuration = Math.round(
        (mediaDuration * MOVIE_TIMESCALE) / MP4_FILE_TIMESCALE,
    );
    const mvhd = fullBox(
        'mvhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(MOVIE_TIMESCALE),
        u32(movieDuration),
        u32(0x00010000),
        u16(0x0100),
        zeros(10),
        UNITY_MATRIX,
        zeros(24),
        u32(VIDEO_TRACK_ID + 1),
    );
    const trak = box(
        'trak',
        trackHeader(
            VIDEO_TRACK_ID,
            video.width,
            video.height,
            false,
            movieDuration,
        ),
        box(
            'mdia',
            mediaHeader(MP4_FILE_TIMESCALE, mediaDuration),
            handler('vide', 'VideoHandler'),
            box(
                'minf',
                fullBox('vmhd', 0, 1, u16(0), zeros(6)),
                dataInformation(),
                sampleTables(options),
            ),
        ),
    );
    return box('moov', mvhd, trak);
}

/**
 * Writes one H.264 track into `sink` as samples come: `start`, `addSample`
 * per encoded frame in order, then `finish` with the decoder's `avcC`.
 */
export class Mp4FileWriter {
    private readonly sampleSizeList: number[] = [];
    private readonly keySampleNumberList: number[] = [];
    private headLength = 0;
    private dataLength = 0;

    constructor(
        private readonly sink: Mp4ByteSinkType,
        private readonly video: Mp4FileVideoType,
    ) {}

    get sampleCount() {
        return this.sampleSizeList.length;
    }

    async start() {
        const head = genMp4FileHead();
        this.headLength = head.length;
        await this.sink.write(head);
    }

    async addSample(data: Uint8Array, isKey: boolean) {
        this.sampleSizeList.push(data.length);
        if (isKey) {
            this.keySampleNumberList.push(this.sampleSizeList.length);
        }
        this.dataLength += data.length;
        await this.sink.write(data);
    }

    /** Writes `moov`; answers the mdat size to write over its placeholder. */
    async finish(avcC: Uint8Array): Promise<Mp4FilePatchType> {
        const moov = genMp4FileMoov({
            video: this.video,
            avcC,
            sampleSizeList: this.sampleSizeList,
            keySampleNumberList: this.keySampleNumberList,
            // The samples start right after the head.
            dataOffset: this.headLength,
        });
        await this.sink.write(moov);
        return genMp4MdatSizePatch(this.headLength, this.dataLength);
    }
}
