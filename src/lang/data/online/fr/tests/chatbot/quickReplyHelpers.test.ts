import { beforeEach, describe, expect, test, vi } from 'vitest';

// The corpus is a lazy chunk of JSON the real window imports; the layers above
// it are what is under test here, so it is stubbed and asserted on separately.
const genFollowUpQuestions = vi.fn(async (): Promise<string[]> => {
    return [];
});
vi.mock('../../../../../../chatbot/questionHelpers', () => ({
    genFollowUpQuestions: (...args: any[]) => {
        return genFollowUpQuestions(...(args as []));
    },
}));

import { parseAnswerOptions } from '../../../../../../chatbot/quickReplyHelpers';

beforeEach(() => {
    genFollowUpQuestions.mockReset();
    genFollowUpQuestions.mockResolvedValue([]);
});

// A chip is a one-press yes; a removal is asked for in words (2026-10-17, the
// elder-persona run: "delete everything" answered with one-press chips to
// delete every document, the settings and the installed Bibles).
describe('a removal is never a chip', () => {
    test.each([
        [
            'Lequel ?',
            'OPTIONS: Supprimer tous les documents | Réinitialiser | Où dois-je cliquer ?',
        ],
    ])('%s', (answer, frame) => {
        const { options } = parseAnswerOptions(`${answer}\n\n${frame}`);
        expect(options).toHaveLength(1);
    });
});
