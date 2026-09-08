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
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => ({
    callTool: (...args: any[]) => callTool(...(args as [])),
    parseToolJson: (...args: any[]) => parseToolJson(...(args as [])),
}));

import {
    askHelpBot,
    describeActionError,
    runBotAction,
} from './helpBotHelpers';
import { genQuickReplies } from './quickReplyHelpers';

beforeEach(() => {
    callTool.mockClear();
    parseToolJson.mockReset();
    parseToolJson.mockReturnValue(null);
});

// Reported from a real window: the assistant asked "would you like help to
// show a screen?", the user said "yes", and the thread was lost. This bot has
// no memory of what it offered, so what it must NOT do is search the manual
// for the word "yes" -- measured, the best match for that is the page about
// resetting the app's panels.
describe('askHelpBot follow-ups', () => {
    test('a bare yes is answered against what they last asked for themselves', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [],
            displays: [{}, {}],
        });
        const answer = await askHelpBot('yes', 'presenter', [
            { author: 'you', text: 'Is any screen showing right now?' },
            { author: 'bot', text: 'No. Would you like help to show one?' },
        ]);
        // It says which question it took them to mean: this is a guess at
        // their meaning and it has to look like one.
        expect(answer.text).toContain('Is any screen showing right now?');
        expect(answer.text).toContain('No presentation screen is showing');
        expect(callTool).toHaveBeenCalledWith('owa_list_screens');
    });

    test('a yes with nothing behind it asks for the subject', async () => {
        const answer = await askHelpBot('ok', 'presenter', []);
        expect(answer.text).toContain('what you would like to do');
        // Nothing is looked up at all: there is nothing to look up.
        expect(callTool).not.toHaveBeenCalled();
    });

    test('a run of yeses still finds the real question', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [],
            displays: [],
        });
        const answer = await askHelpBot('go on', 'presenter', [
            { author: 'you', text: 'How do I show the projector screen?' },
            { author: 'bot', text: 'Here is how.' },
            { author: 'you', text: 'yes' },
            { author: 'bot', text: 'Anything else?' },
        ]);
        expect(answer.text).toContain('How do I show the projector screen?');
    });

    test('a no is taken as a no, not as a search', async () => {
        const answer = await askHelpBot('no thanks', 'presenter', [
            { author: 'you', text: 'Is any screen showing right now?' },
        ]);
        expect(answer.text).toContain('Alright');
        expect(callTool).not.toHaveBeenCalled();
    });

    test('a real question is untouched by any of this', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [2],
            displays: [{}, {}],
        });
        const answer = await askHelpBot(
            'Is any screen showing right now?',
            'presenter',
            [{ author: 'you', text: 'something older' }],
        );
        expect(answer.text).not.toContain('Going back to');
        expect(answer.text).toContain('Screen 2');
    });
});

// The window puts buttons under an answer that asks a question, and pressing
// one sends its words back as the user's own message. Nothing in the type
// system holds those two halves together: reword a button and this bot
// silently stops understanding the press, and searches the manual for "Yeah"
// instead. So the words themselves are pinned here, from the module that
// picks them.
describe('the quick-reply buttons are words this bot understands', () => {
    const [yesReply, noReply] = genQuickReplies(
        'No screen is showing. Would you like help turning one on?',
    );

    test('the offered words are the two this bot answers to', () => {
        expect(yesReply).toBe('Yes');
        expect(noReply).toBe('No thanks');
    });

    test('pressing the yes re-asks what they last named themselves', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [],
            displays: [{}],
        });
        const answer = await askHelpBot(yesReply, 'presenter', [
            { author: 'you', text: 'Is any screen showing right now?' },
            { author: 'bot', text: 'No. Would you like help to show one?' },
        ]);
        expect(answer.text).toContain('Is any screen showing right now?');
    });

    test('pressing the no is taken as a no, not as a search', async () => {
        const answer = await askHelpBot(noReply, 'presenter', [
            { author: 'you', text: 'Is any screen showing right now?' },
        ]);
        expect(answer.text).toContain('Alright');
        expect(callTool).not.toHaveBeenCalled();
    });
});

// Reported from a real window, with the screenshot: the user asked how to
// change the theme, pressed **Do it for me**, and was handed the tool's own
// words -- "The app has no open page matching \"setting.html\". The open pages
// are: chatbot.html?uuid=chatbot, presenter.html." A volunteer can do nothing
// with that sentence, and it names two files this window promises never to
// show them. The Settings window was one press away the whole time.
describe('a walkthrough of a window that is not open', () => {
    const genNoPageError = (page: string) => {
        return new Error(
            `The app has no open page matching "${page}". The open pages ` +
                'are: chatbot.html?uuid=chatbot, presenter.html.',
        );
    };
    const guideAction = (page: string) => {
        return {
            label: 'Do it for me',
            toolName: 'owa_guide_start',
            args: { manualId: 'W-19', page, mode: 'demo' },
        };
    };
    const RUNNING_GUIDE = JSON.stringify({
        isRunning: true,
        isDemo: false,
        isTargetFound: true,
        stepCount: 3,
    });

    beforeEach(() => {
        parseToolJson.mockImplementation((text: any) => {
            return typeof text === 'string' && text.length > 0
                ? JSON.parse(text)
                : null;
        });
    });

    test('opens a window of its own by pressing the one control that does', async () => {
        let isOpen = false;
        callTool.mockImplementation(async (...args: any[]) => {
            const [name] = args as [string, any];
            if (name === 'owa_guide_start') {
                if (!isOpen) {
                    throw genNoPageError('setting.html');
                }
                return RUNNING_GUIDE;
            }
            if (name === 'owa_click') {
                isOpen = true;
                return '{}';
            }
            if (name === 'owa_app_state') {
                return JSON.stringify({
                    windows: isOpen
                        ? [{ url: 'https://localhost:3000/setting.html?x=1' }]
                        : [],
                });
            }
            return '';
        });
        const result = await runBotAction(guideAction('setting.html'));
        expect(callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Setting',
        });
        // It says what it did, then gets on with what was asked for.
        expect(result.text).toContain('Opening Settings for you');
        expect(result.text).toContain('card is showing step 1 of 3');
        // And none of the tool's own words reach the user.
        expect(result.text).not.toContain('no open page');
        expect(result.text).not.toContain('.html');
    });

    test('crosses to a page of the main window instead of clicking a tab', async () => {
        let isOpen = false;
        callTool.mockImplementation(async (...args: any[]) => {
            const [name] = args as [string, any];
            if (name === 'owa_guide_start') {
                if (!isOpen) {
                    throw genNoPageError('reader.html');
                }
                return RUNNING_GUIDE;
            }
            if (name === 'owa_goto_page') {
                isOpen = true;
                return '{}';
            }
            return '';
        });
        const result = await runBotAction(guideAction('reader.html'));
        expect(callTool).toHaveBeenCalledWith('owa_goto_page', {
            page: 'reader.html',
        });
        // `owa_goto_page` waits for the arrival itself, so nothing polls for
        // it -- and a tab is never clicked, because a click cannot wait.
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
        expect(result.text).toContain('Opening Bible Reader for you');
    });

    test('a window no single press opens asks the user, in the words on the controls', async () => {
        callTool.mockImplementation(async (...args: any[]) => {
            const [name] = args as [string, any];
            if (name === 'owa_guide_start') {
                throw genNoPageError('lwShare.html');
            }
            return '';
        });
        const result = await runBotAction(guideAction('lwShare.html'));
        expect(result.text).toContain('Open Local Web Share first');
        expect(result.text).toContain('Tools menu');
        // Nothing was pressed on their behalf, and nothing was ringed: there
        // is no one control to ring.
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_find_ui',
            expect.anything(),
        );
        // The walkthrough is one press away once they are there.
        expect(result.actions?.[0]?.label).toContain("I'm there");
        expect(result.text).not.toContain('.html');
    });

    test('one attempt to open it, never a loop of them', async () => {
        callTool.mockImplementation(async (...args: any[]) => {
            const [name] = args as [string, any];
            if (name === 'owa_guide_start') {
                throw genNoPageError('setting.html');
            }
            if (name === 'owa_app_state') {
                return JSON.stringify({
                    windows: [{ url: 'https://localhost:3000/setting.html' }],
                });
            }
            return '';
        });
        // The window reports itself open and the guide still refuses: the
        // second attempt must give up rather than open it again.
        await expect(
            runBotAction(guideAction('setting.html')),
        ).rejects.toThrow();
        const clicks = callTool.mock.calls.filter((call: any[]) => {
            return call[0] === 'owa_click';
        });
        expect(clicks).toHaveLength(1);
    });
});

describe('what a failed button press says', () => {
    test('never the tool words, whatever went wrong', () => {
        const text = describeActionError(
            new Error(
                'The app has no open page matching "setting.html". The open ' +
                    'pages are: chatbot.html?uuid=chatbot, presenter.html.',
            ),
            { label: 'Do it for me', toolName: 'owa_guide_start' },
        );
        expect(text).not.toContain('.html');
        expect(text).not.toContain('owa_');
        expect(text).toContain('Ask me again');
    });
});

// Measured on the standing corpus on 2026-09-02, the afternoon every provider
// on the machine answered 429 -- so this bot was what the window had. Three
// of its twelve answers went wrong in the same two ways, both cheap.
describe('the offline bot does not mistake a task for a screen question', () => {
    test('a how-do-I that mentions the screen searches the manual', async () => {
        callTool.mockResolvedValue(
            JSON.stringify([
                {
                    id: 'W-06',
                    title: 'Look up and present a Bible verse',
                    section: 's',
                    excerpt: 'e',
                },
            ]),
        );
        parseToolJson.mockImplementation((text: string) => JSON.parse(text));
        const answer = await askHelpBot(
            'How do I put a Bible verse on the screen?',
            'presenter',
        );
        expect(callTool).not.toHaveBeenCalledWith('owa_list_screens');
        expect(answer.text).toContain('Look up and present a Bible verse');
    });

    test('the focus is a filter, never a word in the query', async () => {
        callTool.mockResolvedValue('[]');
        await askHelpBot('clear the bible', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_help_search', {
            query: 'clear the bible',
            focus: 'presenter',
            kind: 'manual',
        });
    });

    test('a symptom still reads the screens, and offers to turn one on', async () => {
        parseToolJson.mockReturnValue({ showingScreenIds: [], displays: [{}] });
        const answer = await askHelpBot(
            'Nothing is showing on the projector',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_list_screens');
        expect(answer.actions?.[0]).toEqual({
            label: 'Turn the screen on',
            toolName: 'builtin-command',
            args: { command: '/screen-show' },
        });
    });
});

// "Can it stream to Facebook?" scored the Presenter overview page 2 -- the
// only page sharing a word -- and the bot offered to walk the user through it.
describe('a search hit under the floor is not an answer', () => {
    test('the could-not-find answer, with no walkthrough buttons', async () => {
        callTool.mockResolvedValue(
            JSON.stringify([
                {
                    id: 'W-01',
                    title: 'Understand the Presenter window',
                    section: 's',
                    excerpt: 'e',
                    score: 2,
                },
            ]),
        );
        parseToolJson.mockImplementation((text: string) => JSON.parse(text));
        const answer = await askHelpBot(
            'Can it stream to Facebook?',
            'presenter',
        );
        expect(answer.text).toContain('could not find that');
        expect(answer.actions ?? []).toEqual([]);
    });

    test('a real hit still answers', async () => {
        callTool.mockResolvedValue(
            JSON.stringify([
                {
                    id: 'W-10',
                    title: 'Control what the audience sees',
                    section: 's',
                    excerpt: 'e',
                    score: 69,
                },
            ]),
        );
        parseToolJson.mockImplementation((text: string) => JSON.parse(text));
        const answer = await askHelpBot('clear the bible', 'presenter');
        expect(answer.text).toContain('Control what the audience sees');
    });
});

// Measured 2026-09-08 on Kimi's free tier: the paste the starter chip invited
// arrived inside the minute the chip's own rounds had used up, was refused
// with a 429, and the offline bot searched the manual for the lyric and said
// it could not find it. The drafter needs no model, so the offline bot can do
// the one thing the paste was for.
describe('the offline bot writes a pasted song out itself', () => {
    const PASTE = [
        'Amazing Grace',
        '',
        'Verse 1',
        'Amazing grace! how sweet the sound,',
        'That saved a wretch like me!',
        'I once was lost, but now am found,',
        'Was blind, but now I see.',
    ].join('\n');
    const DRAFT = [
        'Drafted a song from the text.',
        '',
        'Valid Open Lyric. No problems found.',
        '',
        'Song: "Amazing Grace" by Unknown Artist — key C, 120bpm, 4/4',
        'Sections (1): Verse 1 (4 lines)',
        'Play order: Verse 1',
        '',
        'Guessed, and worth telling them:',
        '- the text gave no key, tempo, time -- used C, 120bpm, 4/4',
        '',
        'The song itself is below. Do NOT paste it into your answer.',
        '# Amazing Grace',
        '',
        '```ol:Config',
        '- Title: Amazing Grace',
        '```',
        '',
        '```ol:Verse 1',
        'Amazing grace! how sweet the sound,',
        '```',
    ].join('\n');

    test('a lyric paste becomes a draft with the two buttons, no search', async () => {
        callTool.mockResolvedValue(DRAFT);
        const answer = await askHelpBot(PASTE, 'presenter');
        expect(callTool).toHaveBeenCalledTimes(1);
        expect(callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            text: PASTE,
            mode: 'draft',
        });
        expect(answer.text).toContain('Song: "Amazing Grace"');
        expect(answer.text).toContain('used C, 120bpm, 4/4');
        // Never the notation itself: that is what the preview box is for.
        expect(answer.text).not.toContain('```ol:');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Create "Amazing Grace"',
            'Copy song text',
        ]);
        expect(answer.actions?.[0].toolName).toBe('owa-lyric-create');
        expect(answer.actions?.[0].args.reference).toMatch(/^lyric-/);
    });

    test('a paste the drafter would not call a song falls through to the search', async () => {
        callTool.mockImplementation(async (name: string) => {
            return name === 'owa_lyric_validate'
                ? 'That does not look like the words of a song.'
                : '[]';
        });
        parseToolJson.mockReturnValue([]);
        const answer = await askHelpBot(
            'Songs for Sunday\nAmazing Grace\nHow Great Thou Art\nBlessed Assurance\nIt Is Well',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
        expect(answer.text).toContain('could not find that');
    });

    test('a question is never drafted', async () => {
        callTool.mockResolvedValue('[]');
        parseToolJson.mockReturnValue([]);
        await askHelpBot('How do I add a background?', 'presenter');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_lyric_validate',
            expect.anything(),
        );
    });
});
