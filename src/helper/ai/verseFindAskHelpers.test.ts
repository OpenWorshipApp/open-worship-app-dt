import { describe, expect, it } from 'vitest';

import { genVerseFindAsk, readVerseFindAsk } from './verseFindAskHelpers';

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

    it('asks with no Bible when the name cannot ride in the sentence', () => {
        expect(genVerseFindAsk(null)).toBe('Help me find a Bible verse');
        expect(genVerseFindAsk('King James')).toBe(
            'Help me find a Bible verse',
        );
        expect(readVerseFindAsk(genVerseFindAsk(null))).toEqual({
            bibleKey: null,
            remembered: null,
        });
    });

    it('reads the ask typed by a person', () => {
        for (const said of [
            'Help me find a Bible verse',
            'help me find a verse I forgot',
            'Please help me find the verse I can’t remember',
            "Can you help me find a bible verse I don't remember?",
            // The question corpus's own row (questions/reader.json).
            'Can you help me find a Bible verse I forgot?',
            'find verse',
        ]) {
            expect(readVerseFindAsk(said.replace('’', "'")), said).toEqual({
                bibleKey: null,
                remembered: null,
            });
        }
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

    // A verse asked for by what it SAYS is the guide's Bible Find answer,
    // and a question about the app is the app's.
    it('leaves every other question alone', () => {
        for (const said of [
            'find me a verse about hope',
            'Help me find a Bible verse about love',
            'How do I find a verse?',
            'find John 3:16',
            'Import the Bible called "KJV"',
        ]) {
            expect(readVerseFindAsk(said), said).toBeNull();
        }
    });
});
