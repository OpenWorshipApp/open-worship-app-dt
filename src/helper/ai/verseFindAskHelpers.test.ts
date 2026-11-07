import { describe, expect, it } from 'vitest';

import { genVerseFindAsk, readVerseFindAsk } from './verseFindAskHelpers';

describe('asking the assistant to find a verse', () => {
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
