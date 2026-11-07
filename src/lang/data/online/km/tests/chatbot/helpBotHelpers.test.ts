import { beforeEach, describe, expect, test, vi } from 'vitest';

// The offline bot is what a volunteer gets when the wifi dies mid-service, and
// what everyone gets with no key at all. It talks to the app through the MCP
// client and nothing else, so stubbing that leaves the answering logic itself
// under test with no app running.
const callTool = vi.fn(async (..._args: any[]): Promise<string> => '');
const parseToolJson = vi.fn((_text?: any) => null as any);
// `helpBotHelpers` logs the reason a button press failed, and that module
// reaches `appProvider`, which touches `document` while it loads -- in a
// node-env suite that is a ReferenceError before a single test runs (memory
// `appprovider-mock-node-env`).
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/mcpClient', () => ({
    callTool: (...args: any[]) => callTool(...(args as [])),
    parseToolJson: (...args: any[]) => parseToolJson(...(args as [])),
}));

import { askHelpBot } from '../../../../../../chatbot/helpBotHelpers';

beforeEach(() => {
    callTool.mockClear();
    parseToolJson.mockReset();
    parseToolJson.mockReturnValue(null);
});

// The offline bot's answers when the app answers otherwise, and the presses
// whose card or window did not come up the way the first tests above say.
describe('the offline bot when the app answers otherwise', () => {
    const realParse = (text: any) => {
        try {
            return typeof text === 'string' && text.length > 0
                ? JSON.parse(text)
                : null;
        } catch (_error) {
            return null;
        }
    };

    beforeEach(() => {
        parseToolJson.mockImplementation(realParse);
    });

    test('a guide page in the window’s language is quoted in it', async () => {
        callTool.mockResolvedValue(
            JSON.stringify([
                {
                    kind: 'manual',
                    id: 'W-03',
                    title: 'Present a slide',
                    titleInLanguage: 'បង្ហាញស្លាយ',
                    excerpt: 'Double-click the slide.',
                    excerptInLanguage: 'ចុចពីរដងលើស្លាយ។',
                    score: 40,
                },
                {
                    kind: 'manual',
                    id: 'W-10',
                    title: 'Clear the screen',
                    titleInLanguage: 'សម្អាតអេក្រង់',
                    excerpt: 'Press Clear All.',
                    score: 30,
                },
            ]),
        );
        const answer = await askHelpBot(
            'How do I present a slide?',
            'presenter',
        );
        expect(answer.text).toContain('**បង្ហាញស្លាយ**\n\nចុចពីរដងលើស្លាយ។');
        expect(answer.text).not.toContain('Double-click the slide.');
        // The one other place to look, named as it is shown.
        expect(
            answer.actions?.find((action) => {
                return action.args?.id === 'W-10';
            })?.label,
        ).toBe('សម្អាតអេក្រង់');
    });
});
