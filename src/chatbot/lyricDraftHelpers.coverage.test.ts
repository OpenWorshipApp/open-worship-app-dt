import { describe, expect, test } from 'vitest';

import { readDraftedLyric } from './lyricDraftHelpers';

// A draft the drafter said was valid, with nothing fenced to lift.

describe('a valid draft with no song in the result', () => {
    test('is not offered as a file', () => {
        expect(
            readDraftedLyric(
                'Drafted a song called "Amazing Grace" from the words given.\n' +
                    'Valid Open Lyric. No problems found.\n' +
                    '(The document was too long to print here.)',
            ),
        ).toBeNull();
        // With the fence it is.
        expect(
            readDraftedLyric(
                'Drafted a song called "Amazing Grace".\n' +
                    'Valid Open Lyric. No problems found.\n' +
                    '```ol:Config\nTitle: Amazing Grace\n```',
            ),
        ).toBe('```ol:Config\nTitle: Amazing Grace\n```');
    });
});
