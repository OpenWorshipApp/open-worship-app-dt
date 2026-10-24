// A virtual display's live MP4 cut into HLS segments, for the players that
// cannot play an endless MP4: an iPhone or an iPad (every browser there runs
// Safari's engine), Safari on a Mac, Apple's own player. iOS plays a live
// video only as HLS: it asks `/video` for its first two bytes, gets an
// endless stream back and shows nothing -- while Android, VLC, computers and
// TVs played the same address (reported 2026-10-09).
//
// One per display, shared by every such player, and only while one watches.
// The fan-out's fragments (one `moof` + `mdat` per frame, see `Fmp4Fanout`)
// are gathered into segments of about two seconds, each starting on a
// keyframe asked for once the segment is long enough -- the encoder makes a
// keyframe only when asked, and answers within a frame (a still screen is
// re-sent ten times a second). Held: the init segment and the last few
// segments, no more than a player may be offered (three target durations,
// about 8 s; ~4 MB at the display's usual bitrate).

const TARGET_DURATION_SECOND = 2;
// A segment is cut at the first keyframe after this long; one is asked for
// once it is this long, and again this often while none comes.
const MIN_SEGMENT_SECOND = 1.5;
const KEYFRAME_WANTED_SECOND = 1.7;
const KEYFRAME_RETRY_SECOND = 1;
// A segment this big is not two seconds of this display: dropped, and the
// next keyframe starts again.
const MAX_SEGMENT_BYTES = 16 * 1024 * 1024;
const MAX_SEGMENTS = 12;
// What a player is offered at first: it starts that far from the live end.
export const HLS_READY_SEGMENTS = 2;

type SegmentType = {
    sequence: number;
    epoch: number;
    duration: number;
    data: Buffer;
    // The stream started again before it (a new encoder, a new size).
    isDiscontinuity: boolean;
};

type OpenSegmentType = {
    epoch: number;
    start: number;
    parts: Buffer[];
    bytes: number;
    keyAskedAt: number | null;
};

function toHex(byte: number) {
    return byte.toString(16).padStart(2, '0');
}

// The `CODECS` of a master playlist, read off the init segment: the video's
// `avcC` profile, compatibility and level, and AAC-LC when there is sound.
// Null when there is no H.264 track to name.
export function readHlsCodecs(init: Buffer) {
    const at = init.indexOf('avcC', 0, 'latin1');
    if (at < 4 || at + 8 > init.length) {
        return null;
    }
    const video = `avc1.${toHex(init[at + 5])}${toHex(init[at + 6])}${toHex(init[at + 7])}`;
    return init.includes('mp4a', 0, 'latin1') ? `${video},mp4a.40.2` : video;
}

// Who gets HLS from `/video`: Apple's own player (AppleCoreMedia -- what
// Safari hands a video to), every browser on an iPhone or iPad, and Safari
// on a Mac, which is also what an iPad says by default. VLC, TVs, Chrome,
// Firefox and Android keep the MP4 they play.
export function checkIsHlsOnlyUserAgent(userAgent: string) {
    if (/VLC|LibVLC/.test(userAgent)) {
        return false;
    }
    if (/AppleCoreMedia|iPhone|iPad|iPod/.test(userAgent)) {
        return true;
    }
    return (
        /Macintosh/.test(userAgent) &&
        /Safari\//.test(userAgent) &&
        !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(userAgent)
    );
}

// The one-variant playlist a player opens first; `variant` is relative to
// it, and carries the token that stands for this player from then on.
export function toHlsMasterPlaylist({
    codecs,
    width,
    height,
    bandwidth,
    variant,
}: {
    codecs: string;
    width: number;
    height: number;
    bandwidth: number;
    variant: string;
}) {
    return [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-INDEPENDENT-SEGMENTS',
        `#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(bandwidth)},` +
            `CODECS="${codecs}",RESOLUTION=${width}x${height}`,
        variant,
        '',
    ].join('\n');
}

export class HlsSegmenter {
    private epoch = -1;
    private inits = new Map<number, Buffer>();
    private codecsOfEpoch = new Map<number, string | null>();
    private segments: SegmentType[] = [];
    private open: OpenSegmentType | null = null;
    private nextSequence = 0;
    private discontinuitySequence = 0;
    // The next segment follows a restart.
    private isAfterRestart = false;
    // The latest video time seen while no segment is open: for asking for a
    // keyframe once, not on every frame.
    private keyAskedWhileClosedAt: number | null = null;
    // Told of every new init segment and every finished segment.
    onChange: () => void = () => {};

    constructor(private readonly onKeyframeWanted: () => void) {}

    get segmentCount() {
        return this.segments.length;
    }

    get codecs() {
        return this.codecsOfEpoch.get(this.epoch) ?? null;
    }

    // The encoder's init segment: on the first and on every restart.
    setInit(init: Buffer) {
        if (this.epoch >= 0) {
            this.isAfterRestart = true;
        }
        this.epoch += 1;
        this.inits.set(this.epoch, init);
        this.codecsOfEpoch.set(this.epoch, readHlsCodecs(init));
        this.open = null;
        this.keyAskedWhileClosedAt = null;
        this.forgetUnusedInits();
        this.onChange();
    }

    // One fragment as the fan-out read it: a video one has its start time
    // (seconds), an audio one null.
    addFragment(fragment: Buffer, isKey: boolean, videoTime: number | null) {
        if (this.epoch < 0) {
            return;
        }
        const open = this.open;
        if (videoTime === null) {
            // Sound belongs to the segment the picture is in.
            this.append(open, fragment);
            return;
        }
        if (
            isKey &&
            (open === null || videoTime - open.start >= MIN_SEGMENT_SECOND)
        ) {
            if (open !== null) {
                this.close(open, videoTime);
            }
            this.open = {
                epoch: this.epoch,
                start: videoTime,
                parts: [fragment],
                bytes: fragment.length,
                keyAskedAt: null,
            };
            return;
        }
        if (open === null) {
            // Nothing can start before a keyframe: ask for one, once a
            // second at most.
            if (
                this.keyAskedWhileClosedAt === null ||
                videoTime - this.keyAskedWhileClosedAt >=
                    KEYFRAME_RETRY_SECOND ||
                videoTime < this.keyAskedWhileClosedAt
            ) {
                this.keyAskedWhileClosedAt = videoTime;
                this.onKeyframeWanted();
            }
            return;
        }
        this.append(open, fragment);
        const length = videoTime - open.start;
        if (
            length >= KEYFRAME_WANTED_SECOND &&
            (open.keyAskedAt === null ||
                videoTime - open.keyAskedAt >= KEYFRAME_RETRY_SECOND)
        ) {
            open.keyAskedAt = videoTime;
            this.onKeyframeWanted();
        }
    }

    // The stream was forgotten (the encoder stopped or starts again): what
    // was being gathered goes; what was finished stays listed until it ages
    // out, and the next segment is marked as following a restart.
    reset() {
        this.open = null;
        this.keyAskedWhileClosedAt = null;
        this.isAfterRestart = this.epoch >= 0;
    }

    getInit(epoch: number) {
        return this.inits.get(epoch) ?? null;
    }

    getSegment(sequence: number) {
        return (
            this.segments.find((segment) => {
                return segment.sequence === sequence;
            })?.data ?? null
        );
    }

    // The media playlist of what is held now.
    toPlaylist() {
        const longest = Math.max(
            0,
            ...this.segments.map((segment) => segment.duration),
        );
        const lines = [
            '#EXTM3U',
            '#EXT-X-VERSION:7',
            `#EXT-X-TARGETDURATION:${Math.max(TARGET_DURATION_SECOND, Math.round(longest))}`,
            `#EXT-X-MEDIA-SEQUENCE:${this.segments[0]?.sequence ?? this.nextSequence}`,
            `#EXT-X-DISCONTINUITY-SEQUENCE:${this.discontinuitySequence}`,
            '#EXT-X-INDEPENDENT-SEGMENTS',
        ];
        let epoch: number | null = null;
        for (const segment of this.segments) {
            if (segment.isDiscontinuity) {
                lines.push('#EXT-X-DISCONTINUITY');
            }
            if (segment.epoch !== epoch) {
                epoch = segment.epoch;
                lines.push(`#EXT-X-MAP:URI="init-${segment.epoch}.mp4"`);
            }
            lines.push(
                `#EXTINF:${segment.duration.toFixed(3)},`,
                `seg-${segment.sequence}.m4s`,
            );
        }
        lines.push('');
        return lines.join('\n');
    }

    private append(open: OpenSegmentType | null, fragment: Buffer) {
        if (open === null) {
            return;
        }
        open.parts.push(fragment);
        open.bytes += fragment.length;
        if (open.bytes > MAX_SEGMENT_BYTES) {
            this.open = null;
        }
    }

    private close(open: OpenSegmentType, end: number) {
        const duration = end - open.start;
        if (!(duration > 0)) {
            return;
        }
        this.segments.push({
            sequence: this.nextSequence,
            epoch: open.epoch,
            duration,
            data: Buffer.concat(open.parts, open.bytes),
            isDiscontinuity: this.isAfterRestart && this.nextSequence > 0,
        });
        this.isAfterRestart = false;
        this.nextSequence += 1;
        this.trim();
        this.forgetUnusedInits();
        this.onChange();
    }

    // Kept: a player may start three target durations from the end, and one
    // more segment, so a slow phone still finds the oldest it was offered
    // when it asks for it one segment later.
    private trim() {
        let total = this.segments.reduce((sum, segment) => {
            return sum + segment.duration;
        }, 0);
        while (
            this.segments.length > 1 &&
            (total - this.segments[0].duration >= 4 * TARGET_DURATION_SECOND ||
                this.segments.length > MAX_SEGMENTS)
        ) {
            const removed = this.segments.shift()!;
            total -= removed.duration;
            // Its discontinuity is no longer listed: counted instead.
            if (removed.isDiscontinuity) {
                this.discontinuitySequence += 1;
            }
        }
    }

    private forgetUnusedInits() {
        for (const epoch of [...this.inits.keys()]) {
            if (
                epoch !== this.epoch &&
                !this.segments.some((segment) => segment.epoch === epoch)
            ) {
                this.inits.delete(epoch);
                this.codecsOfEpoch.delete(epoch);
            }
        }
    }
}
