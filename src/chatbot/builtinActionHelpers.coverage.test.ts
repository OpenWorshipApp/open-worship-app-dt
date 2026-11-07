// The `/` commands' less travelled roads (`builtinActionHelpers.ts`): a
// press that cannot find its button, a read that comes back empty, a screen
// that will not go off, a run sheet, the window a tab works in -- each said
// in the command's own words, and a tool's own error never shown (rule 3 of
// that module).
//
// The app is reached through `callTool` alone, routed here by tool name; the
// guide (`helpBotHelpers`) is a fake, since only what the command does with
// its answer is under test. Fake timers stand in for the 600 ms a press is
// given to reach the screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listAssistantLangPackages } from '../test-setup/langPackageDirs';

const h = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        appError: vi.fn(),
        answerFromManual: vi.fn(),
        answerLyricLink: vi.fn(),
        answerLyricPaste: vi.fn(),
        answerLyricTitle: vi.fn(),
        answerWhereIs: vi.fn(),
        settingMap: new Map<string, string>(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return {
        appError: (...args: any[]) => h.appError(...args),
    };
});

vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => h.settingMap.get(key) ?? null,
        setSetting: (key: string, value: string) => {
            h.settingMap.set(key, value);
        },
    };
});

vi.mock('./mcpClient', () => {
    return {
        callTool: (...args: any[]) => h.callTool(...args),
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch {
                return null;
            }
        },
    };
});

vi.mock('./helpBotHelpers', () => {
    return {
        BUILTIN_TOOL_NAME: 'builtin-command',
        answerFromManual: (...args: any[]) => h.answerFromManual(...args),
        answerLyricLink: (...args: any[]) => h.answerLyricLink(...args),
        answerLyricPaste: (...args: any[]) => h.answerLyricPaste(...args),
        answerLyricTitle: (...args: any[]) => h.answerLyricTitle(...args),
        answerWhereIs: (...args: any[]) => h.answerWhereIs(...args),
    };
});

import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';
import {
    answerScreenToggleAsk,
    answerSlideShowAsk,
    answerSlideStepAsk,
    runBuiltinCommand,
} from './builtinActionHelpers';
import { CHAT_TIP_LIST } from './tipHelpers';
import { setCurrentWindowAim } from './windowAimHelpers';

type ToolReplyType = string | Error | ((args: any) => string);

// Each tool answers with the next reply in its list; the last one repeats.
function routeTools(map: Record<string, ToolReplyType | ToolReplyType[]>) {
    const queueMap = new Map<string, ToolReplyType[]>(
        Object.entries(map).map(([name, reply]) => {
            return [name, Array.isArray(reply) ? [...reply] : [reply]];
        }),
    );
    h.callTool.mockImplementation(async (name: string, args?: any) => {
        const queue = queueMap.get(name);
        if (queue === undefined) {
            throw new Error(`no reply for ${name}`);
        }
        const reply = queue.length > 1 ? queue.shift()! : queue[0];
        if (reply instanceof Error) {
            throw reply;
        }
        return typeof reply === 'function' ? reply(args) : reply;
    });
}

function genScreens(
    showingScreenIds: number[],
    extra: Record<string, unknown> = {},
) {
    return JSON.stringify({
        isAnyShowing: showingScreenIds.length > 0,
        showingScreenIds,
        displays: [{ id: 1 }],
        ...extra,
    });
}

const SONG_SCREEN = {
    screenId: 0,
    isBlank: false,
    slide: { document: 'Amazing Grace', kind: 'song', name: 'Verse 1' },
};

function genAppState(mainWindow: unknown, extra: Record<string, unknown> = {}) {
    return JSON.stringify({ mainWindow, ...extra });
}

const SLIDES = [
    { n: 1, name: '(1)-Verse 1', text: 'Amazing grace', find: 'Slide 1' },
    { n: 2, name: '(2)-Chorus', text: 'How sweet', find: 'Slide 2' },
];

function genSelected(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Amazing Grace',
        kind: 'song',
        slideCount: 2,
        slides: SLIDES,
        onScreen: SLIDES[0],
        next: SLIDES[1],
        previous: null,
        ...overrides,
    };
}

const COULD_NOT_REACH =
    'I could not reach the app window just now. Try again in a moment.';

// A command run to its end, the screen's settle sleep included.
async function run(text: string, focus: BotFocusType = 'presenter') {
    const steps: { text: string; isDone: boolean }[] = [];
    const promise = runBuiltinCommand(text, focus, (step) => {
        steps.push({ text: step.text, isDone: step.isDone });
    });
    await vi.advanceTimersByTimeAsync(5000);
    return { answer: await promise, steps };
}

function toCommands(actions: any[] | undefined) {
    return (actions ?? []).map((action) => {
        return [action.label, action.args?.command];
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    h.settingMap.clear();
    routeTools({});
});

afterEach(() => {
    setCurrentWindowAim(null);
    vi.useRealTimers();
});

describe('reading the screens', () => {
    it('cannot say anything when the app does not answer', async () => {
        routeTools({ owa_list_screens: 'not json' });
        expect((await run('/screen')).answer).toEqual({
            text: COULD_NOT_REACH,
        });
        routeTools({ owa_list_screens: JSON.stringify({ error: 'gone' }) });
        expect((await run('/screen')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('names what an off screen already holds, and the displays it has', async () => {
        routeTools({
            owa_list_screens: genScreens([], {
                displays: [{ id: 1 }, { id: 2 }],
                screens: [SONG_SCREEN, { screenId: 1, isBlank: true }],
            }),
        });
        const { answer, steps } = await run('/screen');
        expect(answer.text).toBe(
            '**Nothing is showing on the projector.** The screen is off, ' +
                'and this computer has 2 displays to put it on. Screen 0 ' +
                'already holds the song "Amazing Grace" (Verse 1), so ' +
                'turning it on shows that.',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Turn the screen on', '/screen-show'],
        ]);
        expect(steps).toEqual([
            { text: 'Checking the projector screens', isDone: false },
            { text: 'Checking the projector screens', isDone: true },
        ]);
    });

    it('says what each showing screen shows, skipping one it has no word on', async () => {
        routeTools({
            owa_list_screens: genScreens([0, 2], { screens: [SONG_SCREEN] }),
        });
        const { answer } = await run('/screen');
        expect(answer.text).toBe(
            '**Screen 0, 2 are showing right now** -- the projector has the ' +
                'app on it. Screen 0 shows the song "Amazing Grace" (Verse 1).',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Turn every screen off', '/screen-hide'],
            ['Clear everything on it', '/clear-all'],
        ]);
    });

    it('a command that throws is said in its own words, the reason logged', async () => {
        const failure = new Error('socket hang up');
        routeTools({ owa_list_screens: failure });
        const { answer } = await run('/screen');
        expect(answer.text).toBe(
            'I could not do `/screen` just now. Try again in a moment, or ' +
                'ask me in words and I will find another way.',
        );
        expect(answer.text).not.toContain('socket');
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /screen');
    });
});

describe('/screen-show', () => {
    it('cannot turn a screen on it cannot read', async () => {
        routeTools({ owa_list_screens: 'nope' });
        expect((await run('/screen-show')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('points at the button, by words, when the press finds none', async () => {
        const failure = new Error('No control matches "Toggle showing screen"');
        routeTools({ owa_list_screens: genScreens([]), owa_click: failure });
        const { answer } = await run('/screen-show');
        expect(answer.text).toBe(
            'I could not find the screen button in this window. It is the ' +
                'leftmost icon on the screen preview card in the ' +
                '**Presenter** (or press **F5** there).',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Go to the Presenter', '/goto presenter'],
        ]);
        expect(h.appError).toHaveBeenCalledWith(
            failure,
            'builtin /screen-show',
        );
        expect(h.callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Toggle showing screen',
        });
    });
});

describe('/screen-hide', () => {
    it('cannot turn screens off it cannot read', async () => {
        routeTools({ owa_list_screens: 'nope' });
        expect((await run('/screen-hide')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('presses nothing when every screen is already off', async () => {
        routeTools({ owa_list_screens: genScreens([]) });
        const { answer } = await run('/screen-hide');
        expect(answer.text).toBe(
            '**The screen is already off** -- nothing is showing.',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Turn the screen on', '/screen-show'],
        ]);
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_hide_screens',
            expect.anything(),
        );
    });

    it('says so when a screen still reports showing after the hide', async () => {
        routeTools({
            owa_list_screens: genScreens([1]),
            owa_hide_screens: '{}',
        });
        const { answer } = await run('/screen-hide');
        expect(h.callTool).toHaveBeenCalledWith('owa_hide_screens', {});
        expect(answer.text).toBe(
            'I asked the app to hide its screens, but one still reports ' +
                'showing. The leftmost icon on its preview card in the ' +
                'Presenter turns it off (or **F5**).',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Check again', '/screen'],
        ]);
    });

    it('waits for the screen to settle before reading it back', async () => {
        routeTools({
            owa_list_screens: [genScreens([1]), genScreens([])],
            owa_hide_screens: '{}',
        });
        const promise = runBuiltinCommand('/screen-hide', 'presenter');
        await vi.advanceTimersByTimeAsync(599);
        const readCount = h.callTool.mock.calls.filter(([name]) => {
            return name === 'owa_list_screens';
        }).length;
        expect(readCount).toBe(1);
        await vi.advanceTimersByTimeAsync(1);
        expect((await promise).text).toBe(
            '**Every screen is off now.** The projector shows nothing from ' +
                'the app.',
        );
    });
});

describe('the clear commands', () => {
    it('name their own layer and key: background is F7, slide is F8', async () => {
        routeTools({
            owa_list_screens: genScreens([0]),
            owa_click: JSON.stringify({ didChange: true }),
        });
        const background = await run('/screen-clear-background');
        expect(background.answer.text).toBe(
            '**Cleared the background.** Next time, **F7** in the Presenter ' +
                'does the same.',
        );
        expect(background.steps[0].text).toBe('Clearing the background');
        expect(h.callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Clear Background',
        });
        const slide = await run('/clear-slide');
        expect(slide.answer.text).toBe(
            '**Cleared the slide.** Next time, **F8** in the Presenter does ' +
                'the same.',
        );
    });

    it('says where the button is when the press finds none', async () => {
        const failure = new Error('No control matches "Clear All"');
        routeTools({ owa_list_screens: genScreens([0]), owa_click: failure });
        const { answer } = await run('/screen-clear-all');
        expect(answer.text).toBe(
            'I could not find the **Clear All** button in this window. It ' +
                'is on the screen preview card in the **Presenter**, or ' +
                'press **F6** there.',
        );
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /clear-all');
    });

    it('does not claim a clear the button did not show, on a layer holding nothing', async () => {
        routeTools({
            owa_list_screens: genScreens([0]),
            owa_click: JSON.stringify({ didChange: false }),
        });
        const { answer } = await run('/screen-clear-slide');
        expect(answer.text).toBe(
            'I pressed **Clear Slide**, and the button looks the same ' +
                'afterwards -- it is only lit while there is the slide to ' +
                'clear, so there may have been nothing on that layer. Next ' +
                'time, **F8** does the same.',
        );
        expect(toCommands(answer.actions)).toEqual([
            ['Check the screen', '/screen'],
        ]);
        // No layer was held, so nothing was read back.
        const readCount = h.callTool.mock.calls.filter(([name]) => {
            return name === 'owa_list_screens';
        }).length;
        expect(readCount).toBe(1);
    });

    it('reads a held layer back, and believes it only once it is empty', async () => {
        const held = {
            screens: [
                {
                    screenId: 0,
                    controls: {
                        clear: [
                            {
                                label: 'Clear Foreground [F10]',
                                hasSomething: true,
                            },
                        ],
                    },
                },
            ],
        };
        // Still held after the press: not cleared.
        routeTools({
            owa_list_screens: genScreens([0], held),
            owa_click: JSON.stringify({ unverified: true }),
        });
        expect((await run('/screen-clear-foreground')).answer.text).toContain(
            'I pressed **Clear Foreground**, and the button looks the same',
        );
        // Off, held, and empty afterwards: cleared, with the off note.
        routeTools({
            owa_list_screens: [genScreens([], held), genScreens([])],
            owa_click: JSON.stringify({ didChange: false }),
        });
        expect((await run('/screen-clear-foreground')).answer.text).toBe(
            '**Cleared the foreground (countdown, marquee, clock).** The ' +
                'screen is off, so this only emptied what it was holding. ' +
                'Next time, **F10** in the Presenter does the same.',
        );
    });
});

describe('/find', () => {
    it("hands back the guide's own answer for words on screen", async () => {
        const found = { text: 'It is in the Mini Screen panel.' };
        h.answerWhereIs.mockResolvedValue(found);
        const { answer, steps } = await run('/find Clear All', 'reader');
        expect(h.answerWhereIs).toHaveBeenCalledWith('Clear All', 'reader');
        expect(answer).toBe(found);
        expect(steps[0].text).toBe('Looking for “Clear All”');
    });

    it('says nothing reads so, or that it could not look', async () => {
        h.answerWhereIs.mockResolvedValueOnce(null);
        expect((await run('/find Lock')).answer.text).toBe(
            'I could not find anything on screen reading "Lock". Try the ' +
                'exact words written on the button, or open the panel it ' +
                'belongs to first.',
        );
        const failure = new Error('target closed');
        h.answerWhereIs.mockRejectedValueOnce(failure);
        const { answer } = await run('/find Lock');
        expect(answer.text).toBe(
            'I could not look for "Lock" just now -- the app window may be ' +
                'busy. Try again in a moment.',
        );
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /find');
    });
});

describe('/goto', () => {
    it('says so when the main window is already there', async () => {
        routeTools({ owa_goto_page: JSON.stringify({ switched: false }) });
        const { answer } = await run('/goto Bible', 'reader');
        expect(h.callTool).toHaveBeenCalledWith('owa_goto_page', {
            page: 'reader.html',
        });
        expect(answer.text).toBe('**You are already in the Bible Reader.**');
    });

    it('sends the person to the tab when the switch fails', async () => {
        const failure = new Error('navigation refused');
        routeTools({ owa_goto_page: failure });
        const { answer } = await run('/goto slides', 'reader');
        expect(answer.text).toBe(
            'I could not switch to the Document Editor. Click its tab in the ' +
                'header of the main window instead.',
        );
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /goto');
    });
});

describe('/here', () => {
    it('cannot say which window when the app does not answer', async () => {
        routeTools({ owa_app_state: '{}' });
        expect((await run('/here', 'reader')).answer.text).toBe(
            COULD_NOT_REACH,
        );
    });

    it('names the main window, its language, the others open and the version', async () => {
        routeTools({
            owa_app_state: genAppState(
                { page: 'presenter.html', language: 'en' },
                {
                    windows: [
                        { url: 'https://localhost:3000/presenter.html' },
                        { url: 'https://localhost:3000/setting.html?uuid=s' },
                        { url: 'https://localhost:3000/setting.html' },
                        { url: 'https://localhost:3000/reader.html?uuid=r' },
                        { title: 'no address' },
                    ],
                    instances: [{ version: '2026.11.3' }],
                },
            ),
        });
        const { answer } = await run('/here');
        expect(answer.text).toBe(
            '**The main window is on the Presenter** in English. Also open: ' +
                'Settings, Bible Reader.\n\nApp version 2026.11.3.',
        );
    });

    it('names each language it knows, and a page it does not by its file', async () => {
        // Every language on disk with an assistant is named; a code with no
        // package ('xx') is said as it is.
        const knownList = listAssistantLangPackages();
        const said: string[] = [];
        for (const language of [
            'en',
            ...knownList.map(({ langCode }) => langCode),
            'xx',
        ]) {
            routeTools({
                owa_app_state: genAppState({ page: 'reader.html', language }),
            });
            said.push((await run('/here')).answer.text);
        }
        expect(said).toEqual(
            ['English', ...knownList.map(({ name }) => name), 'xx'].map(
                (name) => {
                    return `**The main window is on the Bible Reader** in ${name}.`;
                },
            ),
        );
        routeTools({ owa_app_state: genAppState({ page: 'odd.html' }) });
        expect((await run('/here')).answer.text).toBe(
            '**The main window is on the odd.html**.',
        );
    });

    it('names the window a tab works in apart from the main window', async () => {
        setCurrentWindowAim({
            windowId: 'T7',
            focus: 'setting',
            isSeparateWindow: true,
        });
        routeTools({
            owa_app_state: genAppState(
                { page: 'setting.html', language: 'en' },
                {
                    windows: [
                        { url: 'https://localhost:3000/setting.html?uuid=s' },
                        { url: 'https://localhost:3000/reader.html' },
                    ],
                    instances: [{ version: '1.2.3' }],
                },
            ),
        });
        expect((await run('/here', 'setting')).answer.text).toBe(
            '**This tab works with the Settings, a window of its own** in ' +
                'English. The main window is on the Bible Reader.\n\nApp ' +
                'version 1.2.3.',
        );
    });

    it('leaves out what it cannot read about an aimed window', async () => {
        setCurrentWindowAim({
            windowId: 'T8',
            focus: 'reader',
            isSeparateWindow: true,
        });
        routeTools({
            owa_app_state: genAppState(
                { page: 'reader.html' },
                {
                    windows: [
                        { url: 'https://localhost:3000/reader.html?uuid=r' },
                    ],
                },
            ),
        });
        expect((await run('/here', 'reader')).answer.text).toBe(
            '**This tab works with the Bible Reader, a window of its own**.',
        );
    });
});

describe('/help', () => {
    it('lists the commands with no words, and asks the guide with some', async () => {
        const listed = (await run('/help', 'reader')).answer.text;
        expect(listed.startsWith('**Commands you can type**')).toBe(true);
        expect(listed).toContain('**On the Presenter page** (switch there');
        expect(h.answerFromManual).not.toHaveBeenCalled();

        const page = { text: 'Bible Find searches every verse.' };
        h.answerFromManual.mockResolvedValue(page);
        const { answer, steps } = await run('/help find a verse', 'reader');
        expect(h.answerFromManual).toHaveBeenCalledWith(
            'find a verse',
            'reader',
        );
        expect(answer).toBe(page);
        expect(steps[0].text).toBe('Searching the guide for “find a verse”');
    });

    it('says the guide could not be searched, not why', async () => {
        h.answerFromManual.mockRejectedValue(new Error('index missing'));
        const { answer } = await run('/help screens');
        expect(answer.text).toBe(
            'I could not search the guide just now. Ask the question in ' +
                'full and I will look it up.',
        );
    });
});

describe('/selected and /run', () => {
    it('cannot read a selection or a run sheet when the app does not answer', async () => {
        routeTools({ owa_app_state: '{"windows":[]}' });
        expect((await run('/selected')).answer.text).toBe(COULD_NOT_REACH);
        expect((await run('/run')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('sends a main window off the Presenter there first', async () => {
        routeTools({ owa_app_state: genAppState({ page: 'reader.html' }) });
        const selected = (await run('/selected')).answer;
        expect(selected.text).toBe(
            '**The main window is not on the Presenter**, and the selected ' +
                'song lives there.',
        );
        expect(toCommands(selected.actions)).toEqual([
            ['Go to the Presenter', '/goto presenter'],
        ]);
        const runSheet = (await run('/run')).answer;
        expect(runSheet.text).toBe(
            '**The main window is not on the Presenter**, and the run sheet ' +
                'lives there.',
        );
        expect(toCommands(runSheet.actions)).toEqual([
            ['Go to the Presenter', '/goto presenter'],
        ]);
    });

    it('reads the run sheet off the Presenter, pressing nothing', async () => {
        routeTools({
            owa_app_state: genAppState({
                page: 'presenter.html',
                runSheet: {
                    openSheets: [
                        {
                            name: 'Sunday',
                            lineCount: 3,
                            lines: [],
                            cursor: null,
                            next: null,
                        },
                    ],
                },
            }),
        });
        const { answer, steps } = await run('/run');
        expect(answer.text).toMatch(
            /^\*\*The run sheet "Sunday" is open \(3 lines\)\. Nothing in it has been put up yet\./,
        );
        expect(steps[0].text).toBe('Reading the run sheet');
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );

        routeTools({ owa_app_state: genAppState({ page: 'presenter.html' }) });
        expect((await run('/run')).answer.text).toBe(
            '**The run sheet could not be read from this window.**',
        );
    });
});

describe('/next, /previous and /slide', () => {
    it('cannot step when the app does not answer', async () => {
        routeTools({ owa_app_state: '{}' });
        expect((await run('/next')).answer.text).toBe(COULD_NOT_REACH);
        expect((await run('/slide 2')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('says where the slide is when its card cannot be pressed', async () => {
        const failure = new Error('No control matches "Slide 2"');
        routeTools({
            owa_app_state: genAppState({
                page: 'presenter.html',
                selectedDocument: genSelected(),
            }),
            owa_click: failure,
        });
        const { answer } = await run('/next');
        expect(h.callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Slide 2',
        });
        expect(answer.text).toBe(
            'I could not find slide 2 of "Amazing Grace" on the screen to ' +
                'press. Click it in the slide list instead.',
        );
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /next');
    });

    it('/slide sends a main window off the Presenter there, and needs a song', async () => {
        routeTools({ owa_app_state: genAppState({ page: 'reader.html' }) });
        const away = (await run('/slide 1')).answer;
        expect(away.text).toBe(
            '**The main window is not on the Presenter**, so there is no ' +
                'slide list to choose from.',
        );
        expect(toCommands(away.actions)).toEqual([
            ['Go to the Presenter', '/goto presenter'],
        ]);
        routeTools({
            owa_app_state: genAppState({
                page: 'presenter.html',
                selectedDocument: null,
            }),
        });
        expect((await run('/slide 1')).answer.text).toBe(
            '**Nothing is selected in the Documents list.** Click a song ' +
                'there first.',
        );
    });
});

describe('the asks answered with no model', () => {
    it('a slide or a step asked of an app that does not answer goes on', async () => {
        routeTools({ owa_app_state: 'oops' });
        expect(await answerSlideShowAsk('verse 1')).toBeNull();
        expect(await answerSlideStepAsk('next')).toBeNull();
    });

    it('a screen toggle asked of an app that does not answer says so', async () => {
        routeTools({ owa_list_screens: 'oops' });
        expect(await answerScreenToggleAsk('hide')).toEqual({
            text: COULD_NOT_REACH,
        });
    });
});

describe('/verse, /countdown and /marquee', () => {
    it('cannot say what went up when the app answers nothing readable', async () => {
        routeTools({ owa_present_bible: 'garbled', owa_foreground: 'garbled' });
        expect((await run('/verse John 3:16')).answer.text).toBe(
            COULD_NOT_REACH,
        );
        expect((await run('/countdown 5')).answer.text).toBe(COULD_NOT_REACH);
    });

    it('/marquee stop takes the bottom message off, offering nothing more', async () => {
        routeTools({
            owa_foreground: JSON.stringify({ did: 'stopped', detail: '' }),
        });
        const { answer, steps } = await run('/marquee stop');
        expect(h.callTool).toHaveBeenCalledWith('owa_foreground', {
            action: 'stop',
            widget: 'marquee-bottom',
        });
        expect(answer).toEqual({
            text: '**It is off the screen now.**',
            actions: [],
        });
        expect(steps[0].text).toBe(
            'Taking the scrolling message off the screen',
        );
        await run('/marquee-top OFF');
        expect(h.callTool).toHaveBeenLastCalledWith('owa_foreground', {
            action: 'stop',
            widget: 'marquee-top',
        });
    });
});

describe('/lyric over pasted words', () => {
    it('says the song could not be written out, not why', async () => {
        const failure = new Error('validator crashed');
        h.answerLyricPaste.mockRejectedValue(failure);
        const { answer } = await run(
            '/lyric Amazing grace how sweet the sound\nThat saved a wretch',
            'reader',
        );
        expect(h.answerLyricPaste).toHaveBeenCalledWith(
            'Amazing grace how sweet the sound\nThat saved a wretch',
        );
        expect(h.answerLyricLink).not.toHaveBeenCalled();
        expect(h.answerLyricTitle).not.toHaveBeenCalled();
        expect(answer.text).toBe(
            'I could not write that song out just now. Try again in a ' +
                'moment, or paste the words as plain lines.',
        );
        expect(h.appError).toHaveBeenCalledWith(failure, 'builtin /lyric');
    });
});

describe('the commands the window runs itself', () => {
    it('/clear typed past the window says where it works', async () => {
        const { answer } = await run('/clear', 'reader');
        expect(answer.text).toBe(
            'Type `/clear` in the chat window to clear the chat in front of ' +
                'you.',
        );
        expect(h.callTool).not.toHaveBeenCalled();
    });

    it('/tips brings a hidden line back, and says which it was', async () => {
        h.settingMap.set(
            'chatbot-tip-hidden-until',
            String(Date.now() + 24 * 60 * 60 * 1000),
        );
        const hidden = (await run('/tips', 'reader')).answer.text;
        expect(hidden).toMatch(
            /^The tips are back, on the line above the box\. Press a tip for another one, or the arrows beside it to go through them all\. Here is one:\n\n💡 \S/,
        );
        expect(h.settingMap.get('chatbot-tip-hidden-until')).toBe('');

        const shown = (await run('/tip', 'reader')).answer.text;
        expect(
            shown.startsWith('The tips are on the line above the box.'),
        ).toBe(true);
        // The tip given is the one remembered, so the next window opens on
        // another.
        const shownTip = CHAT_TIP_LIST.find((tip) => {
            return tip.id === h.settingMap.get('chatbot-tip-shown');
        });
        expect(shownTip).not.toBeUndefined();
        expect(shown.endsWith(`\n\n💡 ${shownTip?.text}`)).toBe(true);
    });
});
