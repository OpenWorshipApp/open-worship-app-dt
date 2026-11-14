import { describe, expect, it } from 'vitest';

import {
    genBibleImportAsk,
    genBibleImportLanguageAsk,
    readBibleImportAskName,
} from './bibleImportAskHelpers';

describe('asking the assistant for a Bible by its short name', () => {
    it('a name the sentence cannot carry still asks for a Bible', () => {
        for (const name of ['', 'K', 'two words', 'say "x"', 'x'.repeat(25)]) {
            expect([name, genBibleImportAsk(name)]).toEqual([
                name,
                'Import bible',
            ]);
        }
    });

    it('reads the name as a person would type it', () => {
        expect(readBibleImportAskName('import bible named kjv')).toEqual({
            name: 'kjv',
            rest: 'import bible',
        });
        // The full stop is the sentence's, the curly quotes a phone's.
        expect(
            readBibleImportAskName('Please install the Bible called KJV.')
                ?.name,
        ).toBe('KJV');
        expect(
            readBibleImportAskName('I want the bible called “NKJV”!')?.name,
        ).toBe('NKJV');
        // What the name is, the rest of the sentence is not about.
        expect(
            readBibleImportAskName('Import the Bible called "LIST"')?.rest,
        ).toBe('Import the Bible');
    });

    it('asks for a Bible in the language the window is shown in', () => {
        // The card under _Bible key "KJV" is not available!_ offers a Bible
        // the person can READ, not the key that happens to be missing.
        expect(genBibleImportLanguageAsk('en-US')).toBe(
            'Import bible for English',
        );
        expect(genBibleImportLanguageAsk('EN')).toBe(
            'Import bible for English',
        );
        // A code no table names is still a language the chat can look up,
        // by its code.
        expect(genBibleImportLanguageAsk('xx-XX')).toBe('Import bible for xx');
        // A code with no language part, or a region alone, still asks for a
        // Bible rather than writing an empty name.
        expect(genBibleImportLanguageAsk('')).toBe('Import bible');
        expect(genBibleImportLanguageAsk('  ')).toBe('Import bible');
    });

    it('a sentence that names none is left alone', () => {
        for (const text of [
            'Import bible',
            'Import a Bible in "Xxish"',
            // Not ONE name: a title, which is searched for as words.
            'import the bible called Xxish Standard Version',
            'the song called KJV',
            'Import the Bible called "KJV" from my computer',
        ]) {
            expect([text, readBibleImportAskName(text)]).toEqual([text, null]);
        }
    });
});
