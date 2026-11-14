import { beforeEach, describe, expect, test, vi } from 'vitest';

// EC-622: with no model, a passage asked for in a language other than
// English is answered with the verse and ONE button that puts it up -- or,
// when no installed Bible names the book, with the parser's sentence and an
// import of a Bible in that language -- never with the guide's page. The
// app is reached through the MCP client alone, stubbed here; what a line
// is typed in is the screen asks' reading, stubbed too.
const callTool = vi.fn(async (..._args: any[]): Promise<string> => '');
const parseToolJson = vi.fn((_text?: any) => null as any);
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => ({
    callTool: (...args: any[]) => callTool(...(args as [])),
    parseToolJson: (...args: any[]) => parseToolJson(...(args as [])),
}));
const subject = {
    typedCode: 'zz' as string | null,
    isHowTo: false,
    isOtherSubject: false,
};
vi.mock('./typedScreenAskHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<object>()),
        readTypedLineSubject: () => {
            return { ...subject };
        },
    };
});

import { BIBLE_XML_CATALOG_URL } from '../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import { answerTypedVerseAsk } from './helpBotHelpers';

const BOOKS_ANSWER = {
    kind: 'books',
    bookKeys: ['PSA', 'JHN'],
    english: ['Psalms', 'John'],
    bibles: [
        { keys: ['KJV'], locale: 'en', books: ['Psalm', 'John'] },
        { keys: ['XXB'], locale: 'xx', books: ['Xpsa', 'Xjohn'] },
    ],
};

const READ = {
    isPresented: false,
    reference: 'Xjohn 3:16',
    version: 'XXB',
    text: '(16): Xwords',
};

const REFUSAL =
    '"Blarg 3:16" could not be read as a passage in any installed version.';

// Each tool's answer, by its name: a check that reads the passage, or the
// parser's refusal.
function answerTools(check: object | Error) {
    callTool.mockImplementation(async (name: string) => {
        if (name === 'owa_present_bible' && check instanceof Error) {
            throw check;
        }
        return name;
    });
    parseToolJson.mockImplementation((text: string) => {
        return text === 'owa_bible_suggest' ? BOOKS_ANSWER : check;
    });
}

beforeEach(() => {
    callTool.mockReset();
    parseToolJson.mockReset();
    subject.typedCode = 'zz';
    subject.isHowTo = false;
    subject.isOtherSubject = false;
});

describe('a passage typed in another language, with no model', () => {
    test('is read from the Bible that names it, with one button to put it up', async () => {
        answerTools({ ...READ, screens: [], isAnyShowing: true });
        const answer = await answerTypedVerseAsk('zorp Xjohn 3:16 blip', {
            isUnknownRead: true,
        });
        expect(callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'books',
            prefix: '',
        });
        expect(callTool).toHaveBeenCalledWith('owa_present_bible', {
            reference: 'Xjohn 3:16',
            action: 'check',
        });
        expect(answer).toEqual({
            text:
                '**Xjohn 3:16 (XXB)** reads -- "(16): Xwords". ' +
                'I can put it on the screen for you.',
            actions: [
                {
                    label: 'Put Xjohn 3:16 on the screen',
                    toolName: 'builtin-command',
                    args: { command: '/verse Xjohn 3:16' },
                },
            ],
        });
    });

    test('says nothing of a screen the check could not see', async () => {
        // Off the Presenter the check carries no screens.
        answerTools(READ);
        const answer = await answerTypedVerseAsk('zorp Xjohn 3:16', {
            isUnknownRead: true,
        });
        expect(answer?.text).toBe(
            '**Xjohn 3:16 (XXB)** reads -- "(16): Xwords".',
        );
        expect(answer?.actions).toHaveLength(1);
    });

    test('a book no Bible names is the parser sentence and an import in that language', async () => {
        answerTools(new Error(REFUSAL));
        const answer = await answerTypedVerseAsk('zorp Blarg 3:16', {
            isUnknownRead: true,
        });
        expect(answer).toEqual({
            text:
                'These could not be read as a passage in any installed ' +
                'Bible: Blarg 3:16.\n\nOr let the assistant import a ' +
                'Bible in your language for you:',
            actions: [
                {
                    label: 'Import a Bible for me',
                    toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                    args: {
                        step: 'check',
                        url: BIBLE_XML_CATALOG_URL,
                        find: 'zz',
                    },
                },
            ],
        });
    });

    test('a language its words cannot tell asks which language to import', async () => {
        subject.typedCode = null;
        answerTools(new Error(REFUSAL));
        const answer = await answerTypedVerseAsk('zorp Blarg 3:16', {
            isUnknownRead: true,
        });
        expect(answer?.actions?.[0]?.args).toEqual({ step: 'language' });
    });

    test('with a Bible in that language, a book it does not name is a slip', async () => {
        subject.typedCode = 'xx';
        answerTools(new Error(REFUSAL));
        const answer = await answerTypedVerseAsk('zorp Blarg 3:16', {
            isUnknownRead: true,
        });
        expect(answer).toEqual({
            text:
                'These could not be read as a passage in any installed ' +
                'Bible: Blarg 3:16.',
        });
    });

    test('a book a Bible names that the parser still refuses is said so', async () => {
        answerTools(new Error(REFUSAL));
        const answer = await answerTypedVerseAsk('zorp Xjohn 3:16', {
            isUnknownRead: true,
        });
        expect(answer?.text).toBe(
            'These could not be read as a passage in any installed ' +
                'Bible: Xjohn 3:16.',
        );
        expect(answer?.actions).toBeUndefined();
    });

    test('a book no Bible names is left to the guide when the line was put into English', async () => {
        answerTools(new Error(REFUSAL));
        expect(
            await answerTypedVerseAsk('zorp Blarg 3:16', {
                isUnknownRead: false,
            }),
        ).toBeNull();
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_present_bible',
            expect.anything(),
        );
    });

    test('a how-to is the guide, and nothing is asked of the app', async () => {
        subject.isHowTo = true;
        answerTools(READ);
        expect(
            await answerTypedVerseAsk('zorp Xjohn 3:16', {
                isUnknownRead: true,
            }),
        ).toBeNull();
        expect(callTool).not.toHaveBeenCalled();
    });

    test('a line naming no passage is not answered', async () => {
        answerTools(READ);
        expect(
            await answerTypedVerseAsk('zorp blip 12 blop', {
                isUnknownRead: true,
            }),
        ).toBeNull();
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_present_bible',
            expect.anything(),
        );
    });

    test('an app that cannot be asked leaves the line to the guide', async () => {
        callTool.mockRejectedValue(new Error('no app'));
        expect(
            await answerTypedVerseAsk('zorp Xjohn 3:16', {
                isUnknownRead: true,
            }),
        ).toBeNull();
        answerTools(new Error('the window is busy'));
        expect(
            await answerTypedVerseAsk('zorp Xjohn 3:16', {
                isUnknownRead: true,
            }),
        ).toBeNull();
    });
});
