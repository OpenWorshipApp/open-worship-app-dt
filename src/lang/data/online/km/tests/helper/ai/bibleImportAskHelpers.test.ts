import { describe, expect, it } from 'vitest';

import {
    genBibleImportAsk,
    readBibleImportAskName,
} from '../../../../../../../helper/ai/bibleImportAskHelpers';

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
});
