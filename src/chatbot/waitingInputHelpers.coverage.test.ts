import { describe, expect, test } from 'vitest';

import {
    readWaitingInputReply,
    type WaitingInputContextType,
} from './waitingInputHelpers';

// What the interpreter's reply is NOT allowed to be: longer than one
// interpretation, or a link that is no address.

const LINK_STEP: WaitingInputContextType = {
    question: 'Paste the link to the Bible file.',
    valueKind: 'link',
    choices: [{ id: 1, label: 'Cancel' }],
};

describe('a reply from the interpreter', () => {
    test('longer than one interpretation is none, however it starts', () => {
        const reply = JSON.stringify({ kind: 'unrelated' });
        expect(readWaitingInputReply(reply, LINK_STEP)).toEqual({
            kind: 'unrelated',
        });
        expect(
            readWaitingInputReply(reply + ' '.repeat(5000), LINK_STEP),
        ).toBeNull();
    });

    test('a link that is no address is no value, and the question keeps waiting', () => {
        const typed = 'https://exa mple.org/bibles/khmer.xml';
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value: typed }),
                LINK_STEP,
                typed,
            ),
        ).toBeNull();
        // The same reply with a real address is the value.
        const good = 'https://example.org/bibles/khmer.xml';
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value: good }),
                LINK_STEP,
                good,
            ),
        ).toEqual({ kind: 'value', value: good });
    });
});
