import { beforeEach, describe, expect, test, vi } from 'vitest';

// Built-in commands talk to the app through the MCP client and nothing
// else, so stubbing that leaves the commands themselves under test with no
// app running. Same shape as `helpBotHelpers.test.ts`, for the same reason.
const callTool = vi.fn(async (_name: string, _args?: any) => '');
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
// The spend guard (`/limit`, and the hour line under `/credit`) rides the
// settings store; an in-memory map stands in for the file.
const settingMap = new Map<string, string>();
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));
vi.mock('../../../../../../chatbot/mcpClient', () => ({
    callTool: (...args: any[]) => callTool(...(args as [string, any])),
    parseToolJson: (text: string) => {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    },
}));

import { readInheritedGeneralQuestion } from '../../../../../../chatbot/builtinActionHelpers';
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';

beforeEach(() => {
    callTool.mockReset();
    callTool.mockResolvedValue('');
    settingMap.clear();
    resetSpendGuardForTests();
});

describe('/btw', () => {
    test('a plain follow-up under a general question stays general', () => {
        const underBtw = [
            { author: 'you' as const, text: '/btw what is holy bible?' },
            { author: 'bot' as const, text: 'The Bible is …' },
        ];
        expect(readInheritedGeneralQuestion('in khmer please', underBtw)).toBe(
            'in khmer please',
        );
        // A chain holds: the follow-up carries the flag, not the words.
        const chain = [
            ...underBtw,
            {
                author: 'you' as const,
                text: 'in khmer please',
                isGeneral: true as const,
            },
            { author: 'bot' as const, text: 'ព្រះគម្ពីរ …' },
        ];
        expect(readInheritedGeneralQuestion('shorter', chain)).toBe('shorter');
        // A slash line is a new thing to do, and the way back to the app.
        expect(readInheritedGeneralQuestion('/screen', chain)).toBeNull();
        expect(readInheritedGeneralQuestion('   ', chain)).toBeNull();
        // And so is anything that names the app's own things: a question
        // about casting a display is the app's, whatever came before it.
        expect(
            readInheritedGeneralQuestion(
                'How do I cast the virtual display to a TV from my phone?',
                chain,
            ),
        ).toBeNull();
        expect(
            readInheritedGeneralQuestion('and the screen?', chain),
        ).toBeNull();
        expect(readInheritedGeneralQuestion('in French please', chain)).toBe(
            'in French please',
        );
        expect(readInheritedGeneralQuestion('who wrote it?', chain)).toBe(
            'who wrote it?',
        );
        // Nothing general before it: an app question is an app question.
        expect(
            readInheritedGeneralQuestion('in khmer please', [
                { author: 'you', text: 'How do I show the screen?' },
                { author: 'bot', text: 'Press F5.' },
            ]),
        ).toBeNull();
        expect(readInheritedGeneralQuestion('in khmer please', [])).toBeNull();
        // The last QUESTION decides, whatever the bot said after it.
        expect(
            readInheritedGeneralQuestion('and then?', [
                { author: 'you', text: '/btw who wrote Psalms' },
                { author: 'bot', text: 'Mostly David.' },
                { author: 'you', text: '/screen' },
                { author: 'bot', text: 'Nothing is showing.' },
            ]),
        ).toBeNull();
    });
});
