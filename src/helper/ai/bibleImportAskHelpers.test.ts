import { describe, expect, it } from 'vitest';

import {
    genBibleImportAsk,
    readBibleImportAskName,
} from './bibleImportAskHelpers';

describe('asking the assistant for a Bible by its short name', () => {
    it('what the card writes, the chat reads back', () => {
        // The app's own default, a name with a sign in it, and names in the
        // scripts this app is used in.
        for (const name of ['KJV', 'KM-1954', 'NIV2011', 'គខប', 'ไทย1971']) {
            const ask = genBibleImportAsk(name);
            expect(ask).toBe(`Import the Bible called "${name}"`);
            expect(readBibleImportAskName(ask)).toEqual({
                name,
                rest: 'Import the Bible',
            });
        }
        expect(genBibleImportAsk('  KJV ')).toBe(
            'Import the Bible called "KJV"',
        );
    });

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

    it('a sentence that names none is left alone', () => {
        for (const text of [
            'Import bible',
            'Import a Bible in "Khmer"',
            // Not ONE name: a title, which is searched for as words.
            'import the bible called Khmer Standard Version',
            'the song called KJV',
            'Import the Bible called "KJV" from my computer',
        ]) {
            expect([text, readBibleImportAskName(text)]).toEqual([text, null]);
        }
    });
});
