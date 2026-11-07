import { describe, expect, test, vi } from 'vitest';

// A Bible-key map a language pack got wrong: a name that is not words, and
// a name so short it is initials. The French map is this suite's own; the
// rules are the real ones. (Its own file: the mock is file-wide, and the
// package's other suite reads the real map.)
vi.mock('../../bibleKeyMap.json', () => ({
    default: {
        LSG: 'La Sainte Bible, Louis Segond',
        S21: 21,
        BDS: 'Bds',
    },
}));

import {
    findChatBibleKeyByName,
    getChatBibleKeyList,
} from '../../../../../../chatbot/chatTranHelpers';

describe('a language pack with a name that is no name', () => {
    test('lists only the keys that have one', () => {
        expect(getChatBibleKeyList('fr-FR')).toEqual(['LSG', 'BDS']);
    });

    test('matches a title by a whole name only, never by initials or a number', () => {
        expect(
            findChatBibleKeyByName(
                'La Sainte Bible, Louis Segond (1910)',
                'fr',
            ),
        ).toBe('LSG');
        // "Bds" is initials: a title holding them by accident claims nothing.
        expect(findChatBibleKeyByName('Bible BDS 2015', 'fr')).toBeNull();
        expect(findChatBibleKeyByName('Segond 21', 'fr')).toBeNull();
    });
});
