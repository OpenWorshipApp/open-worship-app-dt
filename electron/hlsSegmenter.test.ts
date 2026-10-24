import { describe, expect, test, vi } from 'vitest';

import {
    buildInitSegment,
    toAudioSpecificConfig,
} from '../src/virtual-display/fmp4Muxer';
import {
    HlsSegmenter,
    checkIsHlsOnlyUserAgent,
    readHlsCodecs,
    toHlsMasterPlaylist,
} from './hlsSegmenter';

function toBuffer(data: Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

const VIDEO = {
    width: 1920,
    height: 1080,
    avcC: Uint8Array.of(1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 0),
};
const AUDIO = {
    sampleRate: 48000,
    channelCount: 2,
    audioSpecificConfig: toAudioSpecificConfig(48000, 2),
};

// A segmenter fed 30 frames a second, a keyframe wherever asked.
function feed(segmenter: HlsSegmenter, from: number, to: number) {
    for (let time = from; time < to - 1e-9; time += 1 / 30) {
        segmenter.addFragment(Buffer.from(`v${time.toFixed(3)}`), false, time);
    }
}

describe('readHlsCodecs', () => {
    test('names the H.264 profile and level, and AAC when there is sound', () => {
        expect(readHlsCodecs(toBuffer(buildInitSegment(VIDEO, AUDIO)))).toBe(
            'avc1.640028,mp4a.40.2',
        );
        expect(readHlsCodecs(toBuffer(buildInitSegment(VIDEO, null)))).toBe(
            'avc1.640028',
        );
        expect(readHlsCodecs(Buffer.from('no video here'))).toBeNull();
    });
});

describe('checkIsHlsOnlyUserAgent', () => {
    test('every browser on an iPhone or iPad, Apple’s player, and Safari on a Mac', () => {
        for (const userAgent of [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
            'AppleCoreMedia/1.0.0.22A3354 (iPad; U; CPU OS 18_0 like Mac OS X; en_us)',
            // An iPad says it is a Mac by default.
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        ]) {
            expect(checkIsHlsOnlyUserAgent(userAgent)).toBe(true);
        }
    });

    test('players that play the MP4 keep it', () => {
        for (const userAgent of [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
            'VLC/3.0.21 LibVLC/3.0.21',
            'Player/1.0',
            '',
        ]) {
            expect(checkIsHlsOnlyUserAgent(userAgent)).toBe(false);
        }
    });
});

describe('toHlsMasterPlaylist', () => {
    test('one variant, under the address given', () => {
        expect(
            toHlsMasterPlaylist({
                codecs: 'avc1.640028,mp4a.40.2',
                width: 1920,
                height: 1080,
                bandwidth: 6_000_000.4,
                variant: 'hls/abc/index.m3u8',
            }),
        ).toBe(
            [
                '#EXTM3U',
                '#EXT-X-VERSION:7',
                '#EXT-X-INDEPENDENT-SEGMENTS',
                '#EXT-X-STREAM-INF:BANDWIDTH=6000000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080',
                'hls/abc/index.m3u8',
                '',
            ].join('\n'),
        );
    });
});

describe('HlsSegmenter', () => {
    const INIT = toBuffer(buildInitSegment(VIDEO, AUDIO));

    test('nothing before an init segment, nothing before a keyframe -- which it asks for once a second', () => {
        const wanted = vi.fn();
        const segmenter = new HlsSegmenter(wanted);
        segmenter.addFragment(Buffer.from('early'), true, 0);
        expect(segmenter.codecs).toBeNull();
        segmenter.setInit(INIT);
        expect(segmenter.codecs).toBe('avc1.640028,mp4a.40.2');
        feed(segmenter, 0, 2.5);
        expect(wanted).toHaveBeenCalledTimes(3);
        expect(segmenter.segmentCount).toBe(0);
    });

    test('segments start on a keyframe asked for near two seconds, and keep their sound', () => {
        const wanted = vi.fn();
        const onChange = vi.fn();
        const segmenter = new HlsSegmenter(wanted);
        segmenter.onChange = onChange;
        segmenter.setInit(INIT);
        segmenter.addFragment(Buffer.from('K0'), true, 0);
        segmenter.addFragment(Buffer.from('A0'), false, null);
        // A joining MP4 player's keyframe this early does not cut.
        segmenter.addFragment(Buffer.from('K1'), true, 0.5);
        feed(segmenter, 0.6, 1.7);
        expect(wanted).not.toHaveBeenCalled();
        feed(segmenter, 1.7, 1.75);
        expect(wanted).toHaveBeenCalledTimes(1);
        segmenter.addFragment(Buffer.from('K2'), true, 1.8);
        expect(segmenter.segmentCount).toBe(1);
        expect(onChange).toHaveBeenCalledTimes(2);
        const first = segmenter.getSegment(0)!.toString('latin1');
        expect(first.startsWith('K0A0K1v0.600')).toBe(true);
        expect(first).not.toContain('K2');
        expect(segmenter.getSegment(1)).toBeNull();
        expect(segmenter.toPlaylist()).toBe(
            [
                '#EXTM3U',
                '#EXT-X-VERSION:7',
                '#EXT-X-TARGETDURATION:2',
                '#EXT-X-MEDIA-SEQUENCE:0',
                '#EXT-X-DISCONTINUITY-SEQUENCE:0',
                '#EXT-X-INDEPENDENT-SEGMENTS',
                '#EXT-X-MAP:URI="init-0.mp4"',
                '#EXTINF:1.800,',
                'seg-0.m4s',
                '',
            ].join('\n'),
        );
        expect(segmenter.getInit(0)).toBe(INIT);
    });

    test('holds three target durations and one segment more, no more', () => {
        const segmenter = new HlsSegmenter(() => {});
        segmenter.setInit(INIT);
        for (let index = 0; index <= 10; index++) {
            segmenter.addFragment(Buffer.from(`K${index}`), true, index * 2);
        }
        // Ten 2 s segments made; 8 s stay.
        expect(segmenter.segmentCount).toBe(4);
        const playlist = segmenter.toPlaylist();
        expect(playlist).toContain('#EXT-X-MEDIA-SEQUENCE:6');
        expect(playlist).toContain('seg-9.m4s');
        expect(segmenter.getSegment(5)).toBeNull();
    });

    test('a restart is a discontinuity with its own init, counted once it ages out', () => {
        const segmenter = new HlsSegmenter(() => {});
        const otherInit = Buffer.concat([INIT, Buffer.from('x')]);
        segmenter.setInit(INIT);
        segmenter.addFragment(Buffer.from('K0'), true, 0);
        segmenter.addFragment(Buffer.from('K1'), true, 2);
        // The encoder stopped mid-segment and started again, a new size.
        segmenter.addFragment(Buffer.from('v'), false, 3);
        segmenter.reset();
        segmenter.setInit(otherInit);
        segmenter.addFragment(Buffer.from('k0'), true, 0);
        segmenter.addFragment(Buffer.from('k1'), true, 2);
        expect(segmenter.toPlaylist()).toContain(
            [
                '#EXT-X-MAP:URI="init-0.mp4"',
                '#EXTINF:2.000,',
                'seg-0.m4s',
                '#EXT-X-DISCONTINUITY',
                '#EXT-X-MAP:URI="init-1.mp4"',
                '#EXTINF:2.000,',
                'seg-1.m4s',
            ].join('\n'),
        );
        expect(segmenter.getInit(1)).toBe(otherInit);
        for (let index = 2; index <= 6; index++) {
            segmenter.addFragment(Buffer.from(`k${index}`), true, index * 2);
        }
        const playlist = segmenter.toPlaylist();
        expect(playlist).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:1');
        expect(playlist).not.toContain('#EXT-X-DISCONTINUITY\n');
        expect(playlist).not.toContain('init-0.mp4');
        // The old init goes with the last segment that needed it.
        expect(segmenter.getInit(0)).toBeNull();
    });

    test('a segment too big to be two seconds of this display is dropped', () => {
        const segmenter = new HlsSegmenter(() => {});
        segmenter.setInit(INIT);
        segmenter.addFragment(Buffer.from('K0'), true, 0);
        segmenter.addFragment(Buffer.alloc(17 * 1024 * 1024), false, 0.1);
        segmenter.addFragment(Buffer.from('K1'), true, 2);
        segmenter.addFragment(Buffer.from('K2'), true, 4);
        expect(segmenter.segmentCount).toBe(1);
        expect(segmenter.getSegment(0)!.toString('latin1')).toBe('K1');
    });
});
