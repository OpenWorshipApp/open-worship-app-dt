import { describe, expect, test } from 'vitest';

import { readBackgroundLinkAsk } from './backgroundLinkAskHelpers';

describe('a background video or a track from a link', () => {
    test('the ask the baseline run answered with steps', () => {
        expect(
            readBackgroundLinkAsk(
                'Add this video as a background: https://youtu.be/ZSsOrph7rJs',
            ),
        ).toEqual({ kind: 'video', url: 'https://youtu.be/ZSsOrph7rJs' });
    });

    test('the other ways a person says it', () => {
        expect(
            readBackgroundLinkAsk(
                'Please download https://www.youtube.com/watch?v=abc123 to my backgrounds.',
            ),
        ).toEqual({
            kind: 'video',
            url: 'https://www.youtube.com/watch?v=abc123',
        });
        expect(
            readBackgroundLinkAsk(
                'Can you get the MP3 of https://youtu.be/xyz for the offering?',
            ),
        ).toEqual({ kind: 'audio', url: 'https://youtu.be/xyz' });
        expect(
            readBackgroundLinkAsk(
                'Download this song as audio https://youtu.be/q1',
            ),
        ).toEqual({ kind: 'audio', url: 'https://youtu.be/q1' });
        expect(
            readBackgroundLinkAsk(
                'I want this clip (https://vimeo.com/123) for the welcome',
            ),
        ).toEqual({ kind: 'video', url: 'https://vimeo.com/123' });
    });

    test('a how-to, a page to read, a song’s words and two links are not it', () => {
        for (const text of [
            'How do I download a background video from a link?',
            'Add this video as a background',
            'Read https://example.com for me',
            'Create a lyric file from https://example.com/lyric/amazing_grace',
            'Make a song from the words on https://example.com/song',
            'Add https://a.example/v and https://b.example/w as videos',
            'What is on https://youtu.be/x?',
            '/btw https://youtu.be/x video',
            '',
        ]) {
            expect(readBackgroundLinkAsk(text)).toBeNull();
        }
    });
});
