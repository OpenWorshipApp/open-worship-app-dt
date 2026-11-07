import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The offline bot's less travelled roads: the answers it gives when a tool
// fails, says nothing useful, or is slow to bring a window up. It talks to
// the app through the MCP client alone, so a router of tool answers stands in
// for the app -- and a tool nobody routed THROWS, so a test cannot pass on a
// call it did not expect.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        appError: vi.fn(),
        routes: {} as Record<string, (args: any) => any>,
    },
}));

// `loggerHelpers` reaches `appProvider`, which touches `document` while it
// loads -- a ReferenceError in a node suite (memory
// `appprovider-mock-node-env`).
vi.mock('../helper/loggerHelpers', () => ({
    appError: (...args: any[]) => mocks.appError(...args),
}));
vi.mock('./mcpClient', () => ({
    callTool: async (name: string, args?: any) => {
        const route = mocks.routes[name];
        if (route === undefined) {
            throw new Error(`unrouted tool ${name}`);
        }
        return await route(args);
    },
    parseToolJson: (text: any) => {
        return typeof text === 'string' && text.length > 0
            ? JSON.parse(text)
            : null;
    },
}));

import {
    answerWhereIs,
    askHelpBot,
    genReaderButtonReferenceAnswer,
    runBotAction,
} from './helpBotHelpers';
import { setChatTranslator } from './chatTranHelpers';

const COULD_NOT_FIND_GUIDE = 'I could not find that in the app guide.';

function route(name: string, answer: (args: any) => any) {
    mocks.routes[name] = answer;
}

function routeJson(name: string, value: unknown) {
    route(name, () => JSON.stringify(value));
}

function callsOf(name: string) {
    return toolCalls.filter((call) => call.name === name);
}

let toolCalls: { name: string; args: any }[] = [];

beforeEach(() => {
    toolCalls = [];
    mocks.appError.mockImplementation(() => {});
    // Every call recorded, routed or not.
    mocks.routes = new Proxy({} as Record<string, (args: any) => any>, {
        get(target, name: string) {
            const answer = target[name];
            if (answer === undefined) {
                return undefined;
            }
            return (args: any) => {
                toolCalls.push({ name, args });
                return answer(args);
            };
        },
    });
    // Nothing found in the guide unless a test says otherwise.
    routeJson('owa_help_search', []);
});

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    vi.useRealTimers();
});

describe('a question with nothing in it', () => {
    test('asks for one, and asks the app nothing', async () => {
        const answer = await askHelpBot('   ', 'presenter');
        expect(answer).toEqual({
            text: 'Ask me how to do something in the app.',
        });
        expect(toolCalls).toEqual([]);
    });
});

describe('the Reader’s book buttons', () => {
    test('a question about them with no reference in it is left to the guide', async () => {
        expect(
            genReaderButtonReferenceAnswer(
                'How do the book buttons work?',
                'reader',
            ),
        ).toBeNull();
        // A book no Bible has is no reference either.
        expect(
            genReaderButtonReferenceAnswer(
                'Open Hezekiah 3:16 with the book buttons',
                'reader',
            ),
        ).toBeNull();
        const answer = await askHelpBot(
            'How do the book buttons work?',
            'reader',
        );
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(callsOf('owa_help_search')).toHaveLength(1);
    });
});

describe('a guide page in the window’s language', () => {
    // A cross marks the words the search gave in the window's language: the
    // bot quotes what it is given, whatever the language.
    test('quotes the translation, and offers ONE other page above the floor', async () => {
        routeJson('owa_help_search', [
            {
                id: 'W-06',
                title: 'Clear the screen',
                titleInLanguage: '✝ Clear the screen',
                section: 's',
                excerpt: 'Press **Clear All**.',
                excerptInLanguage: '✝ Press **✝ Clear All**.',
                score: 40,
            },
            // Under the floor: never an answer, never a button.
            {
                id: 'W-05',
                title: 'Weak match',
                section: 's',
                excerpt: 'x',
                score: 3,
            },
            {
                id: 'W-07',
                title: 'Hide a screen',
                titleInLanguage: '✝ Hide a screen',
                section: 's',
                excerpt: 'y',
                score: 20,
            },
            {
                id: 'W-08',
                title: 'A third place',
                section: 's',
                excerpt: 'z',
                score: 10,
            },
        ]);
        const answer = await askHelpBot(
            'How do I clear the screen?',
            'presenter',
        );
        // The translated page itself, with no word about the guide being
        // in English above it.
        expect(answer.text).toBe(
            '**✝ Clear the screen**\n\n✝ Press **✝ Clear All**.',
        );
        expect(callsOf('owa_help_search')[0].args).toEqual({
            query: 'How do I clear the screen?',
            focus: 'presenter',
            kind: 'manual',
        });
        const actions = answer.actions ?? [];
        expect(actions.slice(-2)).toEqual([
            {
                label: 'Read the whole thing',
                toolName: 'owa_help_page',
                args: { id: 'W-06' },
            },
            {
                label: '✝ Hide a screen',
                toolName: 'owa_help_page',
                args: { id: 'W-07' },
            },
        ]);
        const pageIdList = actions.map((action) => action.args?.id);
        expect(pageIdList).not.toContain('W-05');
        expect(pageIdList).not.toContain('W-08');
    });
});

describe('"where is" when the control is not plainly there', () => {
    test('nothing called that, but something close: names it and offers to ring it', async () => {
        routeJson('owa_find_ui', {
            count: 0,
            matches: [],
            nearMisses: ['Bible Reference', 'Reference list'],
        });
        const answer = await answerWhereIs('reference box', 'reader');
        expect(answer).toEqual({
            text:
                'I could not find "reference box", but there is **Bible ' +
                'Reference** on screen — is that the one? Ask again with ' +
                'those words and I will point it out.',
            actions: [
                {
                    label: 'Highlight "Bible Reference"',
                    toolName: 'owa_find_ui',
                    args: {
                        text: 'Bible Reference',
                        highlight: true,
                        page: 'reader.html',
                    },
                },
            ],
        });
        expect(callsOf('owa_find_ui')[0].args).toEqual({
            text: 'reference box',
            highlight: true,
            page: 'reader.html',
        });
    });

    test('nothing close either: no answer of its own, and the guide is asked', async () => {
        routeJson('owa_find_ui', { count: 0, matches: [], nearMisses: [] });
        expect(await answerWhereIs('reference box', 'reader')).toBeNull();
        route('owa_find_ui', () => '');
        expect(await answerWhereIs('reference box', 'reader')).toBeNull();
        const answer = await askHelpBot(
            'Where is the reference box?',
            'presenter',
        );
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
    });

    test('found but hidden: says so, in the window’s own name', async () => {
        routeJson('owa_find_ui', {
            count: 1,
            matches: [{ label: 'Clear All', isVisible: false }],
        });
        const answer = await answerWhereIs('Clear All', 'presenter');
        expect(answer).toEqual({
            text:
                'I found "Clear All" in the presenter, but it is not visible ' +
                'right now. Try opening the panel or tab it belongs to first.',
        });
        // Translated, the window is called what the app calls it.
        setChatTranslator(
            (text) => text,
            (text) => (text === 'Presenter' ? '✝ Presenter' : text),
        );
        expect((await answerWhereIs('Clear All', 'presenter'))?.text).toContain(
            'in the ✝ Presenter, but',
        );
        // A focus the list does not know is named by its key.
        expect(
            (await answerWhereIs('Clear All', 'nowhere' as any))?.text,
        ).toContain('in the nowhere, but');
        expect(callsOf('owa_find_ui')[2].args.page).toBe('nowhere.html');
    });

    test('a window nobody knows the way into is still a failure', async () => {
        route('owa_find_ui', () => {
            throw new Error(
                'The app has no open page matching "nowhere.html". The open ' +
                    'pages are: presenter.html.',
            );
        });
        await expect(
            askHelpBot('Where is the clear button?', 'presenter'),
        ).rejects.toThrow('no open page matching "nowhere.html"');
    });
});

describe('a verse or a countdown the app could not check', () => {
    test('a verse check that fails is logged, and the guide answers', async () => {
        const failure = new Error('Tool host stopped');
        route('owa_present_bible', () => {
            throw failure;
        });
        const answer = await askHelpBot('Show John 3:16', 'presenter');
        expect(callsOf('owa_present_bible')[0].args).toEqual({
            reference: 'John 3:16',
            action: 'check',
        });
        expect(mocks.appError).toHaveBeenCalledWith(
            failure,
            'offline verse ask',
        );
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(answer.text).not.toContain('Tool host stopped');
    });

    test('a verse check that reads as nothing offers no button', async () => {
        routeJson('owa_present_bible', {});
        const answer = await askHelpBot('Show John 3:16', 'presenter');
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(answer.actions ?? []).toEqual([]);
        expect(mocks.appError).not.toHaveBeenCalled();
    });

    test('a countdown check that fails is logged, and the guide answers', async () => {
        const failure = new Error('Tool host stopped');
        route('owa_foreground', () => {
            throw failure;
        });
        const answer = await askHelpBot(
            'Start a 5 minute countdown',
            'presenter',
        );
        expect(callsOf('owa_foreground')[0].args).toEqual({
            action: 'check',
        });
        expect(mocks.appError).toHaveBeenCalledWith(
            failure,
            'offline countdown ask',
        );
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(answer.text).not.toContain('Tool host stopped');
    });

    test('a countdown check that says nothing usable offers no button', async () => {
        route('owa_foreground', () => '"ok"');
        const answer = await askHelpBot(
            'Start a 5 minute countdown',
            'presenter',
        );
        expect(answer.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(answer.actions ?? []).toEqual([]);
    });
});

describe('the selection and the run sheet', () => {
    test('a selection with a slide either side offers both steps', async () => {
        routeJson('owa_app_state', {
            mainWindow: {
                page: 'presenter.html',
                selectedDocument: {
                    name: 'Amazing Grace',
                    kind: 'song',
                    slideCount: 3,
                    slides: [],
                    onScreen: null,
                    next: { n: 3, name: 'Verse 3', find: 'Slide 3: Verse 3' },
                    previous: {
                        n: 1,
                        name: 'Verse 1',
                        find: 'Slide 1: Verse 1',
                    },
                },
            },
        });
        const answer = await askHelpBot(
            'Which song is selected right now?',
            'presenter',
        );
        expect(answer.text).toContain('"Amazing Grace" is selected');
        expect(answer.actions).toEqual([
            {
                label: 'Show the next slide',
                toolName: 'builtin-command',
                args: { command: '/next' },
            },
            {
                label: 'Back one slide',
                toolName: 'builtin-command',
                args: { command: '/previous' },
            },
        ]);
    });

    test('no main window in the state: the guide answers instead', async () => {
        routeJson('owa_app_state', {});
        const selection = await askHelpBot(
            'Which song is selected right now?',
            'presenter',
        );
        expect(selection.text).toContain(COULD_NOT_FIND_GUIDE);
        const runSheet = await askHelpBot(
            "What's next in my running order?",
            'presenter',
        );
        expect(runSheet.text).toContain(COULD_NOT_FIND_GUIDE);
        expect(callsOf('owa_app_state')).toHaveLength(2);
        expect(callsOf('owa_help_search')).toHaveLength(2);
    });

    test('off the Presenter the run sheet says where it lives', async () => {
        routeJson('owa_app_state', { mainWindow: { page: 'reader.html' } });
        const answer = await askHelpBot(
            "What's next in my running order?",
            'reader',
        );
        expect(answer).toEqual({
            text:
                'The run sheet lives in the Presenter, and the main window ' +
                'is not on it right now.',
            actions: [
                {
                    label: 'Go to the Presenter',
                    toolName: 'builtin-command',
                    args: { command: '/goto presenter' },
                },
            ],
        });
        expect(callsOf('owa_help_search')).toHaveLength(0);
    });
});

describe('a song title the collection nearly has', () => {
    test('names the nearest ones, and never makes the song up', async () => {
        route(
            'owa_lyric_validate',
            () =>
                'No song called "Amzing Grace" is in the app’s public-domain ' +
                'hymn collection (36 classic hymns, offline).\n' +
                'Nearest in the collection: "Amazing Grace", "Amazing Love".',
        );
        const answer = await askHelpBot(
            'Create a lyric file for song "Amzing Grace"',
            'presenter',
        );
        expect(callsOf('owa_lyric_validate')[0].args).toEqual({
            mode: 'find',
            title: 'Amzing Grace',
        });
        const [notFound, didYouMean, advice] = answer.text.split('\n\n');
        expect(notFound).toBe(
            'I could not find "Amzing Grace" in your songs or in the ' +
                "app's collection of public-domain hymns.",
        );
        expect(didYouMean).toBe(
            'Did you mean **Amazing Grace**, **Amazing Love**? Ask again ' +
                'with that name.',
        );
        expect(advice).toContain('I do not write songs out from memory');
        expect(answer.actions).toBeUndefined();
    });
});

describe('pressing a button under an answer', () => {
    test('a button with no tool is done at once, and asks the model only when it carries a question', async () => {
        expect(await runBotAction({ label: 'Thanks' })).toEqual({
            text: 'Done.',
            isNeedingModel: false,
        });
        expect(
            await runBotAction({ label: 'Do it for me', ask: 'Do it' }),
        ).toEqual({ text: 'Done.', isNeedingModel: true });
        expect(toolCalls).toEqual([]);
    });

    test('a demo whose steps cannot be pressed says to press Next instead', async () => {
        routeJson('owa_guide_start', {
            isRunning: true,
            canDemo: false,
            stepCount: 4,
        });
        const result = await runBotAction({
            label: 'Do it for me',
            toolName: 'owa_guide_start',
            args: { manualId: 'W-01', page: 'presenter.html', mode: 'demo' },
        });
        expect(result).toEqual({
            text:
                '**Look at the app window.** I cannot press this one for you ' +
                '— its steps are things to do in the page itself, not ' +
                'buttons. A card is showing step 1 of 4; press **Next** on ' +
                'it as you go.',
            isNeedingModel: false,
        });
        // Not prepared as a show: no model is building better steps.
        expect(callsOf('owa_guide_start')[0].args.mode).toBe('demo');
    });

    test('opening a verse in the lookup says what opened, never the JSON', async () => {
        routeJson('owa_find_verse', { opened: 'JHN 3:16', bible: 'KJV' });
        const action = {
            label: 'Open John 3:16 in Bible Lookup',
            toolName: 'owa_find_verse',
            args: { action: 'open', ref: 'JHN 3:16', bible: 'KJV' },
        };
        expect(await runBotAction(action)).toEqual({
            text:
                '**Look at the app window.** JHN 3:16 (KJV) is open in the ' +
                'Bible Lookup. Nothing went on a screen.',
            isNeedingModel: false,
        });
        expect(callsOf('owa_find_verse')[0].args).toEqual(action.args);
        routeJson('owa_find_verse', { error: 'no such verse' });
        expect((await runBotAction(action)).text).toBe(
            'I could not open that verse just now.',
        );
    });

    test('any other tool says what it said, or Done when it said nothing', async () => {
        route('owa_hide_screens', () => 'Hid 2 screens.');
        expect(
            await runBotAction({
                label: 'Hide every screen',
                toolName: 'owa_hide_screens',
            }),
        ).toEqual({ text: 'Hid 2 screens.', isNeedingModel: false });
        // No args at all is an empty set of them.
        expect(callsOf('owa_hide_screens')[0].args).toEqual({});
        route('owa_hide_screens', () => '');
        expect(
            (
                await runBotAction({
                    label: 'Hide every screen',
                    toolName: 'owa_hide_screens',
                    args: {},
                })
            ).text,
        ).toBe('Done.');
    });
});

describe('a walkthrough whose window will not come up', () => {
    const guideAction = {
        label: 'Do it for me',
        toolName: 'owa_guide_start',
        args: { manualId: 'W-19', page: 'setting.html', mode: 'demo' },
    };

    test('waits for it, then says where to press and keeps the walkthrough one press away', async () => {
        vi.useFakeTimers();
        route('owa_guide_start', () => {
            throw new Error(
                'The app has no open page matching "setting.html". The open ' +
                    'pages are: chatbot.html?uuid=chatbot, presenter.html.',
            );
        });
        route('owa_click', () => '{}');
        let stateCount = 0;
        route('owa_app_state', () => {
            stateCount++;
            if (stateCount === 1) {
                // A state read that fails is "not open yet", never a claim
                // that it arrived.
                throw new Error('state unavailable');
            }
            return JSON.stringify({ windows: [{ url: 'presenter.html' }] });
        });
        routeJson('owa_find_ui', {
            count: 1,
            matches: [{ label: 'Setting', isVisible: true }],
        });
        const pending = runBotAction(guideAction);
        await vi.advanceTimersByTimeAsync(7000);
        // Still waiting: a slow machine gets its eight seconds.
        expect(callsOf('owa_find_ui')).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(2000);
        const result = await pending;
        expect(callsOf('owa_click')).toEqual([
            { name: 'owa_click', args: { find: 'Setting' } },
        ]);
        // Polled every 300 ms for the eight seconds, not once.
        expect(stateCount).toBeGreaterThan(20);
        expect(callsOf('owa_find_ui')[0].args).toEqual({
            text: 'Setting',
            highlight: true,
            anyPage: true,
        });
        expect(result).toEqual({
            text:
                '**Open Settings first.** It is the ⚙️ button at the top ' +
                'right of the window — I have outlined it in red. When it is ' +
                "showing, come back here and press **I'm there — start it**.",
            isNeedingModel: false,
            actions: [
                {
                    label: "I'm there — start it",
                    toolName: 'owa_guide_start',
                    args: guideAction.args,
                },
            ],
        });
        // Only once: the walkthrough was not tried again on its own.
        expect(callsOf('owa_guide_start')).toHaveLength(1);
    });

    test('a failure that is not about a missing window is passed on as it is', async () => {
        route('owa_guide_start', () => {
            throw new Error('The card could not be drawn');
        });
        await expect(runBotAction(guideAction)).rejects.toThrow(
            'The card could not be drawn',
        );
        route('owa_guide_start', () => {
            throw new Error(
                'The app has no open page matching "nowhere.html". The open ' +
                    'pages are: presenter.html.',
            );
        });
        await expect(runBotAction(guideAction)).rejects.toThrow(
            'no open page matching "nowhere.html"',
        );
        // Nothing was opened or pressed for a window nobody knows.
        expect(callsOf('owa_click')).toHaveLength(0);
        expect(callsOf('owa_goto_page')).toHaveLength(0);
    });
});
