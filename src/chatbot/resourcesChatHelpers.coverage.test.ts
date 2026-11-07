import { describe, expect, test } from 'vitest';

import {
    RESOURCES_RANGE_HINT,
    genResourceRangeReplies,
    genResourcesRangeHint,
    toResourceChapterVerseCount,
    toResourcePassageRef,
    toWholeResourceChapterRef,
} from './resourcesChatHelpers';

// A Resources reading where the app had nothing to hand over: no verses
// pre-read, a lookup that answered nothing like a passage, and a verse 0.

describe('the hint a chosen range rides with', () => {
    test('with no verses read beforehand, is the hint alone', () => {
        expect(genResourcesRangeHint()).toBe(RESOURCES_RANGE_HINT);
        expect(genResourcesRangeHint(null, 'JHN 3:1-3', 'JHN 3:1-36')).toBe(
            RESOURCES_RANGE_HINT,
        );
    });
});

describe('a chapter read that came back as no passage at all', () => {
    test('keeps the chapter as it was, and knows no verse count', () => {
        expect(toWholeResourceChapterRef(null, 'JHN 3')).toBe('JHN 3');
        expect(toWholeResourceChapterRef('JHN 3:1-36', 'JHN 3')).toBe('JHN 3');
        expect(toResourceChapterVerseCount(null, 'JHN 3')).toBeNull();
    });
});

describe('a verse 0 chosen from a chapter file', () => {
    test('is no passage to read, and no next buttons', () => {
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '0')).toBeNull();
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '0-2')).toBeNull();
        expect(genResourceRangeReplies('0')).toEqual([]);
    });
});
