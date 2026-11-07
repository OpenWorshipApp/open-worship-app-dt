import { describe, expect, it } from 'vitest';

import {
    genVerseFindAsk,
    readVerseFindAsk,
} from '../../../../../../../helper/ai/verseFindAskHelpers';

describe('asking the assistant to find a verse', () => {
    // The Find panel writes the sentence and the chat reads it: every key
    // the writer takes must come back out of the reader.
    it('reads back every Bible the Find panel can name', () => {
        for (const key of ['KJV', 'ពគប', 'NIV-2011', 'kjv', 'Louis_Segond']) {
            expect(readVerseFindAsk(genVerseFindAsk(key))).toEqual({
                bibleKey: key,
                remembered: null,
            });
        }
    });

    it('carries the words typed in Find, searched at once', () => {
        // 2026-10-22: `shepherd` typed in Find was left behind by the 🤖.
        expect(genVerseFindAsk('ពគប', '  shepherd \n')).toBe(
            'Help me find a Bible verse in "ពគប": shepherd',
        );
        expect(
            readVerseFindAsk(genVerseFindAsk('ពគប', 'ព្រះយេហូវ៉ាជាអ្នកគង្វាល')),
        ).toEqual({ bibleKey: 'ពគប', remembered: 'ព្រះយេហូវ៉ាជាអ្នកគង្វាល' });
        expect(genVerseFindAsk('KJV', '   ')).toBe(
            'Help me find a Bible verse in "KJV"',
        );
        expect(genVerseFindAsk('KJV', 'x'.repeat(500)).length).toBeLessThan(
            260,
        );
    });

    // The whole of it in one line: the Bible and what they remember.
    it('reads what they remember after a colon', () => {
        expect(
            readVerseFindAsk(
                'Help me find a Bible verse in "KJV": love your enemies',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'love your enemies' });
        expect(
            readVerseFindAsk('find a verse in ពគប: ព្រះយេស៊ូសួរពេត្រុស?'),
        ).toEqual({ bibleKey: 'ពគប', remembered: 'ព្រះយេស៊ូសួរពេត្រុស' });
        expect(
            readVerseFindAsk('Help me find a Bible verse: shepherd'),
        ).toEqual({ bibleKey: null, remembered: 'shepherd' });
    });
});
