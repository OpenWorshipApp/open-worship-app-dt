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
    genBackToPresenterLead,
    genBackToPresenterRoute,
    genGuideActions,
    genReaderButtonReferenceAnswer,
    readCountdownAsk,
    runBotAction,
} from './helpBotHelpers';
import { genQuickReplies } from './quickReplyHelpers';

beforeEach(() => {
    callTool.mockClear();
    parseToolJson.mockReset();
    parseToolJson.mockReturnValue(null);
});

describe('walkthrough actions', () => {
    test('carry the exact question into a broad manual recipe', () => {
        const actions = genGuideActions(
            { id: 'W-11' },
            'reader',
            true,
            'The words are too small.',
        );
        expect(actions.map((action) => action.args)).toEqual([
            {
                manualId: 'W-11',
                page: 'reader.html',
                mode: 'show',
                topic: 'The words are too small.',
            },
            {
                demoId: 'reader-font-larger',
            },
        ]);
        expect(actions[1].ask).toBeUndefined();
    });

    test('offline help offers a walkthrough but never a recipe-built demo', () => {
        const actions = genGuideActions(
            { id: 'W-11' },
            'reader',
            false,
            'The words are too small.',
        );
        expect(actions.map((action) => action.label)).toEqual([
            'Show me step by step',
        ]);
    });

    test('starts the known font-size demo without a second model round', async () => {
        parseToolJson.mockReturnValue({
            isRunning: true,
            isDemo: true,
            isTargetFound: true,
            canDemo: true,
            stepCount: 1,
        });
        const action = genGuideActions(
            { id: 'W-11' },
            'reader',
            true,
            'The words are too small.',
        )[1];
        const result = await runBotAction(action);
        expect(callTool).toHaveBeenCalledWith('owa_guide_start', {
            demoId: 'reader-font-larger',
        });
        expect(result.isNeedingModel).toBe(false);
        expect(result.text).toContain('Press **Do it**');
    });

    test('still prepares a model-built demo for a localized Reader task', async () => {
        parseToolJson.mockReturnValue({
            isRunning: true,
            isDemo: false,
            isTargetFound: true,
            stepCount: 1,
        });
        const action = genGuideActions(
            { id: 'W-11' },
            'reader',
            true,
            'Use the Khmer book and chapter buttons.',
        )[1];
        const result = await runBotAction(action);
        expect(callTool).toHaveBeenCalledWith('owa_guide_start', {
            manualId: 'W-11',
            page: 'reader.html',
            mode: 'show',
            topic: 'Use the Khmer book and chapter buttons.',
        });
        expect(result.isNeedingModel).toBe(true);
        expect(result.text).toContain('prepare the safe **Do it** step');
    });
});

describe('localized Bible button lookup', () => {
    test('turns an English reference into exact book, chapter, and verse buttons', () => {
        const answer = genReaderButtonReferenceAnswer(
            'I use a Khmer Bible. Typing John 3:16 does not work. Use the book and chapter buttons.',
            'reader',
        );
        expect(answer?.text).toContain('do not need to type');
        expect(answer?.text).toContain("in your Bible's own language");
        expect(answer?.actions?.map((action) => action.label)).toEqual([
            'Show me step by step',
            'Do it for me',
        ]);
        expect(answer?.actions?.[1].args).toMatchObject({
            page: 'reader.html',
            mode: 'demo',
            steps: [
                { find: 'Clear input', action: 'click' },
                { find: 'John', action: 'click' },
                { find: 'Chapter 3', action: 'click' },
                { find: 'Verse 16', action: 'click' },
            ],
        });
    });

    test('does not take over an ordinary Reader question', () => {
        expect(
            genReaderButtonReferenceAnswer(
                'How do I make the words larger?',
                'reader',
            ),
        ).toBeNull();
    });

    test('offline help returns the button solution without searching', async () => {
        const answer = await askHelpBot(
            'My non-English Bible will not accept John 3:16. Use the book and chapter buttons.',
            'reader',
        );
        expect(answer.actions?.[1].label).toBe('Do it for me');
        expect(callTool).not.toHaveBeenCalled();
    });
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

    // What the tool now answers beside the ids: a screen that is off still
    // holds its layers, and the sentence a panicking volunteer needs is that
    // the song is already there and only the show button is missing.
    test('a screen that is off but holds a slide is said to hold it', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [],
            displays: [{}],
            screens: [
                {
                    screenId: 0,
                    isShowing: false,
                    isBlank: false,
                    slide: {
                        document: 'Amazing Grace',
                        kind: 'song',
                        name: 'Verse 2',
                        text: 'Twas grace',
                    },
                    bible: null,
                    background: null,
                    foreground: [],
                },
            ],
        });
        const answer = await askHelpBot(
            'Is anything showing on the projector right now?',
            'presenter',
        );
        expect(answer.text).toContain('No presentation screen is showing');
        expect(answer.text).toContain(
            'Screen 0 is off but already holds the song "Amazing Grace" ' +
                '(Verse 2) -- "Twas grace", so turning it on shows that.',
        );
    });

    test('a showing screen is described by what is on it', async () => {
        parseToolJson.mockReturnValue({
            showingScreenIds: [0],
            displays: [{}],
            screens: [
                {
                    screenId: 0,
                    isShowing: true,
                    isBlank: false,
                    slide: null,
                    bible: { reference: 'John 3:16', version: 'KJV' },
                    background: { kind: 'image', name: 'sky.jpg' },
                    foreground: [],
                },
            ],
        });
        const answer = await askHelpBot(
            'Is anything showing on the projector right now?',
            'presenter',
        );
        expect(answer.text).toContain(
            'Screen 0 is showing right now, on a machine with 1 display(s) ' +
                '-- John 3:16 (KJV); an image background (sky.jpg).',
        );
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

    // Measured 2026-09-10 with the assistant paused: the app's own starter
    // chip, "Create a lyric file from https://…", was searched for in the
    // manual and answered with how to make an EMPTY file.
    const PAGE = 'https://hymnary.example/text/amazing_grace';

    test('a song link is read by the drafter itself, never searched for', async () => {
        callTool.mockResolvedValue(
            DRAFT.replace('from the text', 'from the page'),
        );
        const answer = await askHelpBot(
            `Create a lyric file from ${PAGE}`,
            'presenter',
        );
        expect(callTool).toHaveBeenCalledTimes(1);
        expect(callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            url: PAGE,
            mode: 'draft',
        });
        expect(answer.text).toContain('I read hymnary.example');
        expect(answer.text).toContain('Song: "Amazing Grace"');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Create "Amazing Grace"',
            'Copy song text',
        ]);
    });

    test('a page with no song on it is said so, not searched for', async () => {
        callTool.mockResolvedValue(
            'That does not look like the words of a song.',
        );
        const answer = await askHelpBot(
            `the lyrics are at ${PAGE}`,
            'presenter',
        );
        expect(callTool).toHaveBeenCalledTimes(1);
        expect(answer.text).toContain('could not find a song on it');
        expect(answer.actions ?? []).toHaveLength(0);
    });

    test("a site's bot check is said as what it is", async () => {
        callTool.mockResolvedValue(
            'That address answered with a browser check ("checking your ' +
                'browser") instead of the page, so there is no song to read.',
        );
        const answer = await askHelpBot(`song ${PAGE}`, 'presenter');
        expect(answer.text).toContain(
            'hymnary.example answered with a "checking your browser" page',
        );
        expect(answer.text).not.toContain('could not find a song');
    });

    test("a page that could not be read gets a sentence, never the tool's words", async () => {
        callTool.mockRejectedValue(
            new Error('Refused: the address budget for this window is spent'),
        );
        const answer = await askHelpBot(`song from ${PAGE}`, 'presenter');
        expect(answer.text).toContain('I could not read hymnary.example');
        expect(answer.text).not.toContain('budget');
    });

    test('a link with no song word beside it still goes to the manual', async () => {
        callTool.mockResolvedValue('[]');
        parseToolJson.mockReturnValue([]);
        await askHelpBot(`what is this ${PAGE}`, 'presenter');
        expect(callTool).toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_lyric_validate',
            expect.anything(),
        );
    });
});

// What the user is in the MIDDLE of: measured with a model on 2026-09-09,
// "which song is selected" was answered with the song on the PROJECTOR. This
// bot reads the field the presenter now hands over, and an imperative gets
// the state plus the command that does it -- never a press of its own.
describe('the offline bot answers what is selected from the app', () => {
    const selected = {
        name: 'Amazing Grace',
        kind: 'song',
        slideCount: 3,
        slides: [],
        onScreen: null,
        next: {
            n: 1,
            name: 'Verse 1',
            find: 'Slide 1: Verse 1',
            text: 'Amazing grace',
        },
        previous: null,
    };

    test('which song is selected is read off the presenter, not the screens', async () => {
        parseToolJson.mockReturnValue({
            mainWindow: { page: 'presenter.html', selectedDocument: selected },
        });
        const answer = await askHelpBot(
            'Which song is selected right now?',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_app_state', {});
        expect(callTool).not.toHaveBeenCalledWith('owa_list_screens');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
        expect(answer.text).toContain(
            'The song "Amazing Grace" is selected (3 slides).',
        );
        expect(answer.text).toContain('None of its slides is on a screen yet.');
        expect(answer.actions).toEqual([
            {
                label: 'Show the next slide',
                toolName: 'builtin-command',
                args: { command: '/next' },
            },
        ]);
    });

    test('"show the next slide" is the state and the button, never a press', async () => {
        parseToolJson.mockReturnValue({
            mainWindow: { page: 'presenter.html', selectedDocument: selected },
        });
        const answer = await askHelpBot('Show the next slide', 'presenter');
        expect(answer.text).toContain('Next is slide 1 "Verse 1"');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
        expect(answer.actions?.[0]?.args).toEqual({ command: '/next' });
    });

    test('a how-do-I about the next slide still goes to the manual', async () => {
        callTool.mockResolvedValue('[]');
        await askHelpBot('How do I move to the next slide?', 'presenter');
        expect(callTool).not.toHaveBeenCalledWith('owa_app_state', {});
        expect(callTool).toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });

    // The run sheet is a different question from the selected document, and
    // since EC-132 it has its own field to answer from.
    test('the running order is answered from the run sheet, not the selection', async () => {
        parseToolJson.mockReturnValue({
            mainWindow: {
                page: 'presenter.html',
                selectedDocument: {
                    name: 'Amazing Grace',
                    kind: 'song',
                    slideCount: 3,
                    slides: [],
                    onScreen: null,
                    next: null,
                    previous: null,
                },
                runSheet: {
                    openSheets: [
                        {
                            name: 'Sunday',
                            lineCount: 4,
                            lines: [],
                            cursor: {
                                n: 2,
                                title: 'Amazing Grace',
                                kind: 'song',
                                slide: { n: 3, name: 'Verse 3', isLast: true },
                            },
                            next: {
                                n: 3,
                                title: 'John 3:16',
                                kind: 'Bible passage',
                            },
                        },
                    ],
                },
            },
        });
        const answer = await askHelpBot(
            "What's next in my running order?",
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_app_state', {});
        expect(answer.text).toContain('"Sunday" is open (4 lines)');
        expect(answer.text).toContain('its last slide');
        expect(answer.text).toContain(
            'Next is line 3 "John 3:16" (Bible passage)',
        );
        expect(answer.text).not.toContain('Amazing Grace" is selected');
    });

    test('with no run player open it names the sheets there are', async () => {
        parseToolJson.mockReturnValue({
            mainWindow: {
                page: 'presenter.html',
                runSheet: {
                    openSheets: [],
                    availableSheets: ['Sunday', 'Youth night'],
                },
            },
        });
        const answer = await askHelpBot(
            'what is next in the order of service?',
            'presenter',
        );
        expect(answer.text).toContain('No run sheet is open');
        expect(answer.text).toContain('"Sunday", "Youth night"');
    });

    test('off the presenter it says where the answer lives', async () => {
        parseToolJson.mockReturnValue({ mainWindow: { page: 'reader.html' } });
        const answer = await askHelpBot('What slide is up?', 'reader');
        expect(answer.text).toContain('not on it right now');
        expect(answer.actions?.[0]?.args).toEqual({
            command: '/goto presenter',
        });
    });
});

// Measured 2026-09-09 through the real window with every key dead: *How do I
// edit a slide?* asked from the Bible Reader was answered off the slides page,
// which opens "in the Documents list" -- a panel the Reader page has not got
// -- and named no way across. The model's prompt carries that page fact; the
// offline bot has to carry it too, because the offline bot is what the window
// has on exactly the afternoon this was measured on.
describe('the offline bot names the way back to the Presenter', () => {
    // Bolded the way the manual writes it: the lead was measured missing a
    // second time because the pattern wanted the plain words.
    const SLIDES_EXCERPT =
        'Making a new file: in the **Documents** list, click the ⋮ in the ' +
        'list header and pick **New App Document**.';

    test('the route is a fact about the page, not one button for all', () => {
        // The Reader has no Presenter tab.
        expect(genBackToPresenterRoute('reader')).toContain(
            'Go Back to Presenter',
        );
        expect(genBackToPresenterRoute('appDocumentEditor')).toContain(
            '**Presenter** tab',
        );
        expect(genBackToPresenterRoute('presenter')).toBeNull();
        // A window of its own is not a page the Presenter is a tab away from.
        expect(genBackToPresenterRoute('setting')).toBeNull();
    });

    test('a Presenter recipe read from the Reader leads with the way across', () => {
        const lead = genBackToPresenterLead('reader', SLIDES_EXCERPT);
        expect(lead).toContain('Bible Reader page has none of these panels');
        expect(lead).toContain('Go Back to Presenter');
    });

    test('a recipe that names no Presenter panel is left alone', () => {
        expect(
            genBackToPresenterLead(
                'reader',
                'Click the double chevron in the bottom-right corner.',
            ),
        ).toBe('');
        // And on the Presenter itself nothing is ever added.
        expect(genBackToPresenterLead('presenter', SLIDES_EXCERPT)).toBe('');
    });

    test('the manual answer from the Reader carries it in front', async () => {
        callTool.mockResolvedValue(
            JSON.stringify([
                {
                    id: 'W-02',
                    title: 'Create and edit slides / lyrics / web backgrounds',
                    section: 's',
                    excerpt: SLIDES_EXCERPT,
                    score: 40,
                },
            ]),
        );
        parseToolJson.mockImplementation((text: string) => JSON.parse(text));
        const answer = await askHelpBot('How do I edit a slide?', 'reader');
        expect(answer.text.startsWith('This is done in the Presenter')).toBe(
            true,
        );
        expect(answer.text).toContain('Go Back to Presenter');
        expect(answer.text).toContain(SLIDES_EXCERPT);
    });
});

// "Put John 3:16 on the screen" used to be searched, and the best hit was
// the page about the Bible Lookup's picker -- which no button can drive. The
// reference is checked against the app's own parser first, and ONE button
// puts it up: offered, then pressed, never done off a typed sentence.
describe('the offline bot offers to put a passage on the screen', () => {
    const checked = {
        isPresented: false,
        reference: 'John 3:16',
        version: 'KJV',
        text: '(16): For God so loved the world',
        screens: [],
        isAnyShowing: false,
    };

    test('a concrete reference is checked, quoted, and offered as one press', async () => {
        parseToolJson.mockReturnValue(checked);
        const answer = await askHelpBot(
            'Put John 3:16 on the screen',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_present_bible', {
            reference: 'John 3:16',
            action: 'check',
        });
        expect(callTool).not.toHaveBeenCalledWith('owa_present_bible', {
            reference: 'John 3:16',
        });
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
        expect(answer.text).toContain('**John 3:16 (KJV)** reads');
        expect(answer.text).toContain('For God so loved');
        expect(answer.text).toContain('the screen is off just now');
        expect(answer.actions).toEqual([
            {
                label: 'Put John 3:16 on the screen',
                toolName: 'builtin-command',
                args: { command: '/verse John 3:16' },
            },
        ]);
    });

    test('the reference is read off several shapes of the sentence', async () => {
        parseToolJson.mockReturnValue(checked);
        for (const [ask, reference] of [
            ['show Psalm 23 on the projector', 'Psalm 23'],
            ['please put up 1 John 1:1-4', '1 John 1:1-4'],
            ['Present Romans 8.28 to the big screen.', 'Romans 8.28'],
        ]) {
            callTool.mockClear();
            await askHelpBot(ask, 'presenter');
            expect(callTool, ask).toHaveBeenCalledWith('owa_present_bible', {
                reference,
                action: 'check',
            });
        }
    });

    test('a how-do-I, or a verse with no chapter, still goes to the manual', async () => {
        callTool.mockResolvedValue('[]');
        for (const ask of [
            'How do I put John 3:16 on the screen?',
            'How do I put a Bible verse on the screen?',
            'Put the song on the screen',
            'show slide 3 on the screen',
        ]) {
            callTool.mockClear();
            await askHelpBot(ask, 'presenter');
            expect(callTool, ask).not.toHaveBeenCalledWith(
                'owa_present_bible',
                expect.anything(),
            );
        }
    });

    test("a reference the app cannot read gets the app's sentence and no button", async () => {
        callTool.mockRejectedValue(
            new Error(
                '"Jhn 99:99" could not be read as a passage in any installed version. Write it as book, chapter and verse.',
            ),
        );
        const answer = await askHelpBot(
            'Put Jhn 99:99 on the screen',
            'presenter',
        );
        expect(answer.text).toContain('could not be read as a passage');
        expect(answer.actions).toBeUndefined();
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });
});

// "Start a 5 minute countdown on the screen" used to be searched, and the
// best hit was the page about the Foreground tab's boxes -- which the model
// then spent ten rounds hunting (2026-09-11). The screens are read first so
// the answer can say whether the screen is on, and ONE button starts it.
describe('the offline bot offers to start a countdown', () => {
    const checked = {
        did: 'checked',
        widget: null,
        detail: 'No foreground extra is on any screen.',
        screens: [],
        isAnyShowing: false,
    };

    test('reads the minutes or the time off the sentence', () => {
        expect(
            readCountdownAsk('Start a 5 minute countdown on the screen'),
        ).toEqual({
            minutes: 5,
        });
        expect(readCountdownAsk('please put up a 10-min timer')).toEqual({
            minutes: 10,
        });
        expect(readCountdownAsk('Can you start a countdown to 10:30?')).toEqual(
            {
                at: '10:30',
            },
        );
        expect(readCountdownAsk('run a 1 hour countdown')).toEqual({
            minutes: 60,
        });
        // A how-do-I, a bare word, and a countdown with no length go to the
        // manual.
        expect(
            readCountdownAsk('How do I show a countdown before the service?'),
        ).toBeNull();
        expect(readCountdownAsk('Start the countdown')).toBeNull();
        expect(readCountdownAsk('countdown')).toBeNull();
    });

    test('a countdown is offered as one press, with the screen state', async () => {
        parseToolJson.mockReturnValue(checked);
        const answer = await askHelpBot(
            'Start a 5 minute countdown on the screen',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            action: 'check',
        });
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
        expect(answer.text).toContain(
            '**I can start a 5 minute countdown on the screen for you**',
        );
        expect(answer.text).toContain('the screen is off just now');
        expect(answer.actions).toEqual([
            {
                label: 'Start a 5 minute countdown',
                toolName: 'builtin-command',
                args: { command: '/countdown 5' },
            },
        ]);
    });

    test('a countdown to a time, with the screen showing', async () => {
        parseToolJson.mockReturnValue({ ...checked, isAnyShowing: true });
        const answer = await askHelpBot(
            'put a countdown to 6:45 pm on the screen',
            'presenter',
        );
        expect(answer.text).toContain(
            '**I can start a countdown to 6:45 pm on the screen for you**.',
        );
        expect(answer.text).not.toContain('off just now');
        expect(answer.actions?.[0]?.args).toEqual({
            command: '/countdown 6:45 pm',
        });
    });

    test("off the Presenter the app's own sentence is repeated, and nothing offered", async () => {
        callTool.mockRejectedValue(
            new Error(
                'A foreground extra is started from the Presenter page, and the main window is not on it. Switch it to the Presenter first, then ask again.',
            ),
        );
        const answer = await askHelpBot(
            'Start a 5 minute countdown on the screen',
            'presenter',
        );
        expect(answer.text).toContain('started from the Presenter page');
        expect(answer.actions).toBeUndefined();
    });
});
