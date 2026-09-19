import { describe, expect, test } from 'vitest';

import {
    checkIsFileUrlMediaSource,
    checkIsRemoteMediaSource,
    checkIsUrlMediaSource,
} from './mediaSourceHelpers';

describe('mediaSourceHelpers', () => {
    test('tells a remote media link apart from a local path', () => {
        expect(
            checkIsRemoteMediaSource(
                'https://www.openworship.app/shared/audios/Doxology 21&22.mp3',
            ),
        ).toBe(true);
        expect(checkIsRemoteMediaSource('http://example.com/a.mp4')).toBe(true);
        expect(checkIsRemoteMediaSource('HTTPS://example.com/a.mp4')).toBe(
            true,
        );

        expect(checkIsRemoteMediaSource('C:\\medias\\a.mp4')).toBe(false);
        expect(checkIsRemoteMediaSource('/home/user/a.mp4')).toBe(false);
        expect(checkIsRemoteMediaSource('')).toBe(false);
        // A `file://` source is still a local file, not something to fetch.
        expect(checkIsRemoteMediaSource('file:///home/user/a.mp4')).toBe(false);
        // A data URL is inlined pixels, not something to fetch over the wire.
        expect(checkIsRemoteMediaSource('data:image/png;base64,abc')).toBe(
            false,
        );
        // Only the scheme counts — a path that merely mentions http does not.
        expect(checkIsRemoteMediaSource('/medias/http/a.mp4')).toBe(false);
    });

    test('tells a `file://` attachment link apart from a path', () => {
        expect(checkIsFileUrlMediaSource('file:///home/user/a.mp4')).toBe(true);
        expect(checkIsFileUrlMediaSource('file:///C:/medias/a.mp4')).toBe(true);
        // The scheme is case-insensitive, like the `http(s)` one above.
        expect(checkIsFileUrlMediaSource('FILE:///C:/medias/a.mp4')).toBe(true);

        expect(checkIsFileUrlMediaSource('C:\\medias\\a.mp4')).toBe(false);
        expect(checkIsFileUrlMediaSource('/home/user/a.mp4')).toBe(false);
        expect(checkIsFileUrlMediaSource('')).toBe(false);
        expect(checkIsFileUrlMediaSource('https://example.com/a.mp4')).toBe(
            false,
        );
        // Only the scheme counts — a path that merely mentions file does not.
        expect(checkIsFileUrlMediaSource('/medias/file/a.mp4')).toBe(false);
    });

    test('tells a source that is already a URL apart from a path', () => {
        expect(checkIsUrlMediaSource('https://example.com/a.mp4')).toBe(true);
        expect(checkIsUrlMediaSource('http://example.com/a.mp4')).toBe(true);
        expect(checkIsUrlMediaSource('file:///home/user/a.mp4')).toBe(true);

        expect(checkIsUrlMediaSource('C:\\medias\\a.mp4')).toBe(false);
        expect(checkIsUrlMediaSource('/home/user/a.mp4')).toBe(false);
        expect(checkIsUrlMediaSource('')).toBe(false);
        // Inlined pixels are neither a URL to render verbatim nor a path.
        expect(checkIsUrlMediaSource('data:image/png;base64,abc')).toBe(false);
    });
});
