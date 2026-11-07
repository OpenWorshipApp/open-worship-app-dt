// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';

import { readBibleReaderAsk } from '../../../../../../chatbot/bibleReaderChatHelpers';

// The corpus is read in the language the window is SHOWN in, and the row the
// regression came from is translated. Load it as a Khmer window does, before
// anything reads the corpus (it is cached on first use).
beforeAll(() => {
    document.documentElement.lang = 'km';
});

describe('a typed Bible-Reader question', () => {
    test.each([
        // ...and in French, because every language is data.
        [
            'montre les fichiers de ressources de Jean chapitre 3',
            { intent: 'resources' },
        ],
        ['quels noms dans Genèse chapitre 4', { intent: 'names' }],
        ['ouvre Genèse 3:203', { intent: 'reference' }],
    ])('%s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each(['comment ouvrir Jean 3:16 dans le lecteur'])(
        '%s is not one',
        (asked) => {
            expect(readBibleReaderAsk(asked)).toBeNull();
        },
    );
});

// A bare book and chapter in French with an English Bible open: the window
// confirms the book against every language package's own names when the open
// Bible has none of that name (2026-11-04, EC-461, `readBibleReaderAskWithBook`).
describe('a French book named while another Bible is open', () => {
    test('is a book by the packages, and a chapter ask with it', async () => {
        const { listLangBibleBookNames } =
            await import('../../../../../langPackageFileHelpers');
        const { toCompactBookName } =
            await import('../../../../../../helper/bibleSuggestHelpers');
        const nameSet = new Set(
            (await listLangBibleBookNames()).map((name) => {
                return toCompactBookName(name);
            }),
        );
        const checkIsBook = (text: string) => {
            return nameSet.has(toCompactBookName(text));
        };
        expect(checkIsBook('Matthieu')).toBe(true);
        expect(readBibleReaderAsk('Résume Matthieu 18')).toBeNull();
        expect(readBibleReaderAsk('Résume Matthieu 18', checkIsBook)).toEqual({
            intent: 'reference',
        });
    });
});
