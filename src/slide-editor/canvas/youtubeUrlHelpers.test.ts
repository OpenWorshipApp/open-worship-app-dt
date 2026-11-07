import { describe, expect, it } from 'vitest';

import { checkIsYouTubeUrl, extractYouTubeVideoId } from './youtubeUrlHelpers';

describe('checkIsYouTubeUrl', () => {
    it('accepts the YouTube hosts and their sub-domains', () => {
        expect(checkIsYouTubeUrl('https://youtu.be/abc')).toBe(true);
        expect(checkIsYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(
            true,
        );
        expect(checkIsYouTubeUrl('https://m.youtube.com/shorts/abc')).toBe(
            true,
        );
    });

    it('rejects other hosts and text that is not a URL at all', () => {
        expect(checkIsYouTubeUrl('https://notyoutube.com/watch?v=abc')).toBe(
            false,
        );
        expect(checkIsYouTubeUrl('https://example.com/youtube.com')).toBe(
            false,
        );
        expect(checkIsYouTubeUrl('youtube.com/watch?v=abc')).toBe(false);
        expect(checkIsYouTubeUrl('')).toBe(false);
    });
});

describe('extractYouTubeVideoId', () => {
    it('reads the id from every common link form', () => {
        expect(extractYouTubeVideoId('https://youtu.be/abc123')).toBe('abc123');
        expect(
            extractYouTubeVideoId('https://www.youtube.com/watch?v=abc123&t=5'),
        ).toBe('abc123');
        for (const kind of ['embed', 'shorts', 'live', 'v']) {
            expect(
                extractYouTubeVideoId(
                    `https://www.youtube.com/${kind}/abc123?feature=share`,
                ),
            ).toBe('abc123');
        }
    });

    it('returns an empty id for anything else', () => {
        expect(extractYouTubeVideoId('https://www.youtube.com/watch')).toBe('');
        expect(extractYouTubeVideoId('https://www.youtube.com/channel/x')).toBe(
            '',
        );
        expect(extractYouTubeVideoId('https://vimeo.com/123')).toBe('');
        expect(extractYouTubeVideoId('not a url')).toBe('');
    });
});
