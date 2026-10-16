import { describe, expect, test } from 'vitest';

import {
    toChapterFullKeyFormat,
    toVerseFullKeyFormat,
} from './bibleKeyFormatHelpers';

describe('bibleKeyFormatHelpers', () => {
    test('spells a chapter and a one-chapter passage as before', () => {
        expect(toChapterFullKeyFormat('JHN', 3)).toBe('JHN 3');
        expect(toVerseFullKeyFormat('JHN', 3, 16)).toBe('JHN 3:16');
        expect(toVerseFullKeyFormat('JHN', 3, 16, 16)).toBe('JHN 3:16');
        expect(toVerseFullKeyFormat('JHN', 3, 16, 18)).toBe('JHN 3:16-18');
        expect(toVerseFullKeyFormat('JHN', 3, 16, 18, 3)).toBe('JHN 3:16-18');
        expect(toVerseFullKeyFormat('JHN', 3, 16, 18, null)).toBe(
            'JHN 3:16-18',
        );
    });

    test('spells a passage across chapters with its end chapter', () => {
        expect(toVerseFullKeyFormat('JHN', 1, 2, 4, 3)).toBe('JHN 1:2-3:4');
        expect(toVerseFullKeyFormat('JHN', 1, 4, 4, 3)).toBe('JHN 1:4-3:4');
        expect(toVerseFullKeyFormat('យ៉ូហាន', '១', '២', '៤', '៣')).toBe(
            'យ៉ូហាន ១:២-៣:៤',
        );
    });
});
