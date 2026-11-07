import { describe, expect, test, vi } from 'vitest';

vi.mock('../../../../../../chatbot/questionHelpers', () => ({
    clipKnownPage: (text: string, find: string | null) => {
        return find === null ? text : `${text} [clipped around ${find}]`;
    },
    HELP_WINDOW_MANUAL_ID: 'W-42',
}));
import { checkIsDisputingAnswer } from '../../../../../../chatbot/disputeHelpers';

describe('checkIsDisputingAnswer', () => {
    test.each(['ខ្ញុំរកមិនឃើញ'])(
        'takes "%s" as disputing the last answer',
        (text) => {
            expect(checkIsDisputingAnswer(text)).toBe(true);
        },
    );
});
