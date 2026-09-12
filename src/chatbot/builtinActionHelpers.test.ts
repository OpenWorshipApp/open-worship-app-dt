import { beforeEach, describe, expect, test, vi } from 'vitest';

// Built-in commands talk to the app through the MCP client and nothing
// else, so stubbing that leaves the commands themselves under test with no
// app running. Same shape as `helpBotHelpers.test.ts`, for the same reason.
const callTool = vi.fn(async (_name: string, _args?: any) => '');
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
// The spend guard (`/limit`, and the hour line under `/credit`) rides the
// settings store; an in-memory map stands in for the file.
const settingMap = new Map<string, string>();
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));
vi.mock('./mcpClient', () => ({
    callTool: (...args: any[]) => callTool(...(args as [string, any])),
    parseToolJson: (text: string) => {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    },
}));

import {
    BUILTIN_ACTION_LIST,
    BUILTIN_TOOL_NAME,
    checkIsBuiltinCommand,
    matchBuiltinActions,
    parseBuiltinCommand,
    readCountdownArgument,
    runBuiltinCommand,
    toBuiltinCommandText,
} from './builtinActionHelpers';
import {
    SPEND_ALLOW_TOOL_NAME,
    getSpendState,
    recordSpendRound,
    resetSpendGuardForTests,
} from './spendGuardHelpers';

beforeEach(() => {
    callTool.mockReset();
    callTool.mockResolvedValue('');
    settingMap.clear();
    resetSpendGuardForTests();
});

function genScreens(showingScreenIds: number[]) {
    return JSON.stringify({
        isAnyShowing: showingScreenIds.length > 0,
        showingScreenIds,
        displays: [{ id: 1 }],
    });
}

describe('the command list', () => {
    test('names are unique across names and aliases, and dash-case', () => {
        const seen = new Set<string>();
        for (const action of BUILTIN_ACTION_LIST) {
            for (const name of [action.name, ...action.aliases]) {
                expect(seen.has(name), `duplicate ${name}`).toBe(false);
                seen.add(name);
                expect(name).not.toMatch(/\s|[A-Z]/);
            }
            // The hint sits beside the name in a 460px window.
            expect(action.hint.length).toBeLessThan(70);
        }
    });

    test('the two spellings the user asked for both reach the screen', () => {
        expect(
            parseBuiltinCommand('/presenter-screen-show')?.action?.name,
        ).toBe('screen-show');
        expect(
            parseBuiltinCommand('/presenter-screen-hide')?.action?.name,
        ).toBe('screen-hide');
    });

    test('parsing keeps the argument case and reads the name loosely', () => {
        const parsed = parseBuiltinCommand('  /FIND Clear Bible ');
        expect(parsed?.action?.name).toBe('find');
        expect(parsed?.argument).toBe('Clear Bible');
        expect(parseBuiltinCommand('not a command')).toBeNull();
        expect(parseBuiltinCommand('/nope')?.action).toBeNull();
    });

    test('checkIsBuiltinCommand is the slash and nothing else', () => {
        expect(checkIsBuiltinCommand('/screen')).toBe(true);
        expect(checkIsBuiltinCommand('  /screen')).toBe(true);
        expect(checkIsBuiltinCommand('a /screen')).toBe(false);
        // A URL is not a command.
        expect(checkIsBuiltinCommand('https://example.com/x')).toBe(false);
    });
});

describe('the suggestion list', () => {
    test('a bare slash lists everything, letters narrow it', () => {
        expect(matchBuiltinActions('/', 50).length).toBe(
            BUILTIN_ACTION_LIST.length,
        );
        const names = matchBuiltinActions('/scr').map((one) => one.name);
        expect(names).toEqual(['screen', 'screen-show', 'screen-hide']);
        // An alias reaches its command too.
        expect(matchBuiltinActions('/presenter-')[0].name).toBe('screen-show');
        expect(matchBuiltinActions('how do I')).toEqual([]);
    });

    test('a command that takes words is offered with a space to type into', () => {
        const find = BUILTIN_ACTION_LIST.find((one) => one.name === 'find')!;
        const screen = BUILTIN_ACTION_LIST.find(
            (one) => one.name === 'screen',
        )!;
        expect(toBuiltinCommandText(find)).toBe('/find ');
        expect(toBuiltinCommandText(screen)).toBe('/screen');
    });
});

describe('/screen-show', () => {
    test('presses the toggle and reports what the app says AFTERWARDS', async () => {
        let isShowing = false;
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genScreens(isShowing ? [0] : []);
            }
            if (name === 'owa_click') {
                isShowing = true;
                return JSON.stringify({ didChange: true });
            }
            return '';
        });
        const answer = await runBuiltinCommand('/screen-show', 'presenter');
        expect(answer.text).toContain('The screen is on now');
        expect(callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Toggle showing screen',
        });
        // The offer under it is now the opposite command, as a button that
        // carries the command line rather than a tool name.
        expect(answer.actions?.[0]).toEqual({
            label: 'Turn every screen off',
            toolName: BUILTIN_TOOL_NAME,
            args: { command: '/screen-hide' },
        });
    });

    test('does not claim a screen it cannot see', async () => {
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genScreens([]);
            }
            return JSON.stringify({ didChange: false, unverified: 'x' });
        });
        const answer = await runBuiltinCommand('/screen-show', 'presenter');
        expect(answer.text).toContain('still reports nothing showing');
        expect(answer.text).not.toContain('is on now');
    });

    test('says so when it is already on, and presses nothing', async () => {
        callTool.mockResolvedValue(genScreens([0]));
        const answer = await runBuiltinCommand('/screen-show', 'presenter');
        expect(answer.text).toContain('already on');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });

    test("a tool's own error never reaches the user", async () => {
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genScreens([]);
            }
            throw new Error(
                'No control matching "Toggle showing screen" on presenter.html; nearMisses: [...]',
            );
        });
        const answer = await runBuiltinCommand('/screen-show', 'reader');
        expect(answer.text).not.toContain('presenter.html');
        expect(answer.text).toContain('Presenter');
    });
});

describe('/screen-hide and the clears', () => {
    test('hides every screen and reads them back', async () => {
        let isShowing = true;
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genScreens(isShowing ? [0] : []);
            }
            if (name === 'owa_hide_screens') {
                isShowing = false;
            }
            return '';
        });
        const answer = await runBuiltinCommand('/screen-hide', 'presenter');
        expect(answer.text).toContain('Every screen is off now');
        expect(callTool).toHaveBeenCalledWith('owa_hide_screens', {});
    });

    test('a clear with the screen off presses nothing', async () => {
        callTool.mockResolvedValue(genScreens([]));
        const answer = await runBuiltinCommand('/clear-all', 'presenter');
        expect(answer.text).toContain('nothing to clear');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });

    test('a clear presses the button by its words and teaches the key', async () => {
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genScreens([0]);
            }
            return JSON.stringify({ didChange: true });
        });
        const answer = await runBuiltinCommand('/clear-bible', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Clear Bible',
        });
        expect(answer.text).toContain('F9');
    });
});

describe('the rest', () => {
    test('/goto names the pages when given none', async () => {
        const answer = await runBuiltinCommand('/goto', 'presenter');
        expect(answer.text).toContain('/goto presenter');
        expect(callTool).not.toHaveBeenCalled();
    });

    test('/goto reader switches the main window', async () => {
        callTool.mockResolvedValue(JSON.stringify({ switched: true }));
        const answer = await runBuiltinCommand('/goto reader', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_goto_page', {
            page: 'reader.html',
        });
        expect(answer.text).toContain('Bible Reader');
    });

    test('an unknown command lists the real ones', async () => {
        const answer = await runBuiltinCommand('/nope', 'presenter');
        expect(answer.text).toContain('/nope');
        expect(answer.text).toContain('/screen-show');
        expect(callTool).not.toHaveBeenCalled();
    });

    test('/find with no words asks for them rather than searching', async () => {
        const answer = await runBuiltinCommand('/find', 'presenter');
        expect(answer.text).toContain('/find Clear Bible');
        expect(callTool).not.toHaveBeenCalled();
    });

    test('progress is reported around the work, and closed', async () => {
        callTool.mockResolvedValue(genScreens([]));
        const steps: any[] = [];
        await runBuiltinCommand('/screen', 'presenter', (step) => {
            steps.push(step);
        });
        expect(steps.map((step) => step.isDone)).toEqual([false, true]);
        expect(steps[0].text).toBe('Checking the projector screens');
    });
});

// The slide commands read what the presenter says is selected, press the
// next card by its exact words, and report what the app says went up.
function genAppState(selectedDocument: any, page = 'presenter.html') {
    return JSON.stringify({
        mainWindow: { page, selectedDocument },
    });
}

const SELECTED = {
    name: 'Amazing Grace',
    kind: 'song',
    slideCount: 3,
    slides: [],
    onScreen: {
        n: 1,
        name: 'Verse 1',
        find: 'Slide 1: Verse 1',
        text: 'Amazing grace',
        onScreens: [0],
    },
    next: {
        n: 2,
        name: 'Verse 2',
        find: 'Slide 2: Verse 2',
        text: 'Twas grace',
    },
    previous: { n: 3, name: 'Verse 3', find: 'Slide 3: Verse 3', text: null },
};

describe('/selected, /next and /previous', () => {
    test('/selected says the song, the slide up and the next, with buttons that step', async () => {
        callTool.mockResolvedValue(genAppState(SELECTED));
        const answer = await runBuiltinCommand('/selected', 'presenter');
        expect(answer.text).toContain('"Amazing Grace" is selected (3 slides)');
        expect(answer.text).toContain('slide 1 "Verse 1"');
        expect(answer.text).toContain('Next is slide 2 "Verse 2"');
        expect(answer.actions?.map((one) => one.args)).toEqual([
            { command: '/next' },
            { command: '/previous' },
        ]);
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });

    test('/next presses the next card by its exact words and reports what is up AFTERWARDS', async () => {
        let onScreenN = 1;
        callTool.mockImplementation(async (name: string, args?: any) => {
            if (name === 'owa_app_state') {
                const upNow =
                    onScreenN === 1 ? SELECTED.onScreen : SELECTED.next;
                return genAppState({
                    ...SELECTED,
                    onScreen: { ...upNow, onScreens: [0] },
                    next: onScreenN === 1 ? SELECTED.next : SELECTED.previous,
                });
            }
            if (name === 'owa_click') {
                expect(args).toEqual({ find: 'Slide 2: Verse 2' });
                onScreenN = 2;
                return JSON.stringify({ didChange: true });
            }
            if (name === 'owa_list_screens') {
                return genScreens([0]);
            }
            return '';
        });
        const answer = await runBuiltinCommand('/next', 'presenter');
        expect(answer.text).toContain(
            'Slide 2 "Verse 2" of "Amazing Grace" is on the screen now',
        );
        expect(answer.text).toContain('"Twas grace"');
        expect(answer.text).not.toContain('screen itself is off');
        expect(callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Slide 2: Verse 2',
        });
    });

    test('/next says when the press did not land, and when the screen is off', async () => {
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_app_state') {
                return genAppState(SELECTED);
            }
            if (name === 'owa_click') {
                return JSON.stringify({ didChange: false });
            }
            return genScreens([]);
        });
        const answer = await runBuiltinCommand('/next', 'presenter');
        expect(answer.text).toContain('I pressed slide 2');
        expect(answer.text).toContain('does not show it on a screen yet');

        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_app_state') {
                return genAppState({
                    ...SELECTED,
                    onScreen: SELECTED.next,
                    next: null,
                });
            }
            return genScreens([]);
        });
        const off = await runBuiltinCommand('/next', 'presenter');
        expect(off.text).toContain('There is no next slide');
    });

    test('/previous with nothing of the song up offers its first slide instead', async () => {
        callTool.mockResolvedValue(
            genAppState({ ...SELECTED, onScreen: null, previous: null }),
        );
        const answer = await runBuiltinCommand('/previous', 'presenter');
        expect(answer.text).toContain('There is no previous slide');
        expect(answer.actions?.[0]?.args).toEqual({ command: '/next' });
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });

    test('off the presenter, and with nothing selected, they say so and press nothing', async () => {
        callTool.mockResolvedValue(genAppState(null, 'reader.html'));
        const away = await runBuiltinCommand('/next', 'presenter');
        expect(away.text).toContain('not on the Presenter');
        expect(away.actions?.[0]?.args).toEqual({ command: '/goto presenter' });

        callTool.mockResolvedValue(genAppState(null));
        const nothing = await runBuiltinCommand('/next', 'presenter');
        expect(nothing.text).toContain('Nothing is selected');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });
});

describe('/verse', () => {
    const presented = {
        isPresented: true,
        reference: 'John 3:16',
        version: 'KJV',
        text: '(16): For God so loved the world',
        screens: [
            { screenId: 0, isShowing: false, isLocked: false, bible: {} },
        ],
        isAnyShowing: false,
    };

    test('presents by the words typed and reports what the screen holds AFTERWARDS', async () => {
        callTool.mockResolvedValue(JSON.stringify(presented));
        const answer = await runBuiltinCommand('/verse John 3:16', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_present_bible', {
            reference: 'John 3:16',
        });
        expect(answer.text).toContain('John 3:16 (KJV) is on the screen now');
        expect(answer.text).toContain('For God so loved');
        expect(answer.text).toContain(
            'off, so the projector is not showing it yet',
        );
        // The screen is off: the one press the person wants next is offered,
        // and the way back off.
        expect(answer.actions?.map((one) => one.args?.command)).toEqual([
            '/screen-show',
            '/clear-bible',
        ]);
        expect(answer.actions?.[0]?.toolName).toBe(BUILTIN_TOOL_NAME);
    });

    test('with the screen showing, offers only the way off', async () => {
        callTool.mockResolvedValue(
            JSON.stringify({
                ...presented,
                isAnyShowing: true,
                screens: [
                    {
                        screenId: 0,
                        isShowing: true,
                        isLocked: false,
                        bible: {},
                    },
                ],
            }),
        );
        const answer = await runBuiltinCommand('/verse John 3:16', 'presenter');
        expect(answer.text).toContain('Screen 0 is showing it');
        expect(answer.actions?.map((one) => one.args?.command)).toEqual([
            '/clear-bible',
        ]);
    });

    test('with no words asks for them and presents nothing', async () => {
        const answer = await runBuiltinCommand('/verse', 'presenter');
        expect(answer.text).toContain('Say which passage');
        expect(callTool).not.toHaveBeenCalled();
    });

    test("repeats the app's own refusal, and never a tool's error", async () => {
        callTool.mockRejectedValue(
            new Error(
                '"Jhn 99" could not be read as a passage in any installed ' +
                    'version. Write it as book, chapter and verse. ' +
                    'Installed versions: KJV.',
            ),
        );
        const refused = await runBuiltinCommand('/verse Jhn 99', 'presenter');
        expect(refused.text).toContain('could not be read as a passage');
        expect(refused.text).toContain('Installed versions: KJV');

        callTool.mockRejectedValue(
            new Error('This window did not answer. presenter.html ...'),
        );
        const failed = await runBuiltinCommand('/verse John 3:16', 'presenter');
        expect(failed.text).not.toContain('presenter.html');
        expect(failed.text).toContain(
            'could not put "John 3:16" on the screen',
        );
    });
});

describe('/countdown and /marquee', () => {
    const startedCountdown = {
        did: 'started',
        widget: 'countdown',
        detail: 'a 5 minute countdown, ending at 11:45 AM',
        screens: [
            {
                screenId: 0,
                isShowing: false,
                isLocked: false,
                foreground: ['countdown to 11:45:01 AM'],
            },
        ],
        isAnyShowing: false,
    };

    test('reads minutes, hours, a clock time and a stop word off the argument', () => {
        expect(readCountdownArgument('5')).toEqual({ minutes: 5 });
        expect(readCountdownArgument(' for 10 min ')).toEqual({ minutes: 10 });
        expect(readCountdownArgument('1.5h')).toEqual({ minutes: 90 });
        expect(readCountdownArgument('10:30')).toEqual({ at: '10:30' });
        expect(readCountdownArgument('to 6:45 pm')).toEqual({ at: '6:45 pm' });
        expect(readCountdownArgument('7pm')).toEqual({ at: '7pm' });
        expect(readCountdownArgument('stop')).toEqual({ stop: true });
        expect(readCountdownArgument('')).toBeNull();
        expect(readCountdownArgument('soon')).toBeNull();
    });

    test('starts by the minutes typed and reports what the screen holds AFTERWARDS', async () => {
        callTool.mockResolvedValue(JSON.stringify(startedCountdown));
        const answer = await runBuiltinCommand('/countdown 5', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            widget: 'countdown',
            minutes: 5,
        });
        expect(answer.text).toContain(
            'A 5 minute countdown, ending at 11:45 AM is on the screen now',
        );
        expect(answer.text).toContain(
            'off, so the projector is not showing it yet',
        );
        // The screen is off: the one press the person wants next is offered,
        // and the way back off.
        expect(answer.actions?.map((one) => one.args?.command)).toEqual([
            '/screen-show',
            '/countdown stop',
        ]);
        expect(answer.actions?.[0]?.toolName).toBe(BUILTIN_TOOL_NAME);
    });

    test('counts down to a time, and stops on the word', async () => {
        callTool.mockResolvedValue(
            JSON.stringify({
                ...startedCountdown,
                detail: 'a countdown to 10:30 AM',
            }),
        );
        await runBuiltinCommand('/timer to 10:30', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            widget: 'countdown',
            at: '10:30',
        });
        callTool.mockResolvedValue(
            JSON.stringify({
                did: 'stopped',
                widget: 'countdown',
                detail: 'The countdown is off the screen now.',
                screens: [],
                isAnyShowing: false,
            }),
        );
        const stopped = await runBuiltinCommand('/countdown stop', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            action: 'stop',
            widget: 'countdown',
        });
        expect(stopped.text).toContain('The countdown is off the screen now.');
        expect(stopped.actions).toEqual([]);
    });

    test('with no words says how, and presents nothing', async () => {
        const answer = await runBuiltinCommand('/countdown', 'presenter');
        expect(answer.text).toContain('Say how long');
        expect(answer.text).toContain('/countdown 5');
        expect(callTool).not.toHaveBeenCalled();
    });

    test("repeats the app's own refusal, and never a tool's error", async () => {
        callTool.mockRejectedValue(
            new Error(
                '9:00 AM has already passed today, so there is nothing to count down to. Give a later time, or say how many minutes.',
            ),
        );
        const refused = await runBuiltinCommand('/countdown 9:00', 'presenter');
        expect(refused.text).toContain('has already passed today');
        callTool.mockRejectedValue(
            new Error('This window did not answer. presenter.html ...'),
        );
        const failed = await runBuiltinCommand('/countdown 5', 'presenter');
        expect(failed.text).not.toContain('presenter.html');
        expect(failed.text).toContain('could not start the countdown');
    });

    test('/marquee scrolls the words along the bottom, /marquee-top along the top', async () => {
        callTool.mockResolvedValue(
            JSON.stringify({
                did: 'started',
                widget: 'marquee-bottom',
                detail: 'a message scrolling along the bottom: "Silence your phones"',
                screens: [
                    {
                        screenId: 0,
                        isShowing: true,
                        isLocked: false,
                        foreground: [],
                    },
                ],
                isAnyShowing: true,
            }),
        );
        const answer = await runBuiltinCommand(
            '/marquee Silence  your phones',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            widget: 'marquee-bottom',
            text: 'Silence your phones',
        });
        expect(answer.text).toContain('is on the screen now');
        expect(answer.text).toContain('Screen 0 is showing it');
        // Showing already: only the way off is offered.
        expect(answer.actions?.map((one) => one.args?.command)).toEqual([
            '/marquee stop',
        ]);
        await runBuiltinCommand('/marquee-top Welcome', 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_foreground', {
            widget: 'marquee-top',
            text: 'Welcome',
        });
        const empty = await runBuiltinCommand('/marquee', 'presenter');
        expect(empty.text).toContain('Say the words to scroll');
    });
});

describe('a clear with content held on an OFF screen', () => {
    // The screen is off but still holds a countdown for when it is turned on:
    // that is what /clear-foreground is typed for, and it used to answer
    // "nothing to clear" (2026-09-11).
    test('presses the button anyway and says the screen is off', async () => {
        let isForegroundHeld = true;
        const genOffScreens = () =>
            JSON.stringify({
                isAnyShowing: false,
                showingScreenIds: [],
                displays: [{ id: 1 }],
                screens: [
                    {
                        screenId: 0,
                        isShowing: false,
                        isLocked: false,
                        foreground: isForegroundHeld
                            ? ['countdown to 11:45 AM']
                            : [],
                        isBlank: false,
                        controls: {
                            showHide: 'Toggle showing screen [F5]',
                            clear: [
                                {
                                    label: 'Clear All [F6]',
                                    hasSomething: isForegroundHeld,
                                },
                                {
                                    label: 'Clear Bible [F9]',
                                    hasSomething: false,
                                },
                                {
                                    label: 'Clear Foreground [F10]',
                                    hasSomething: isForegroundHeld,
                                },
                            ],
                        },
                    },
                ],
            });
        callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_list_screens') {
                return genOffScreens();
            }
            // A Clear button is a plain press: the click reads as unproven,
            // and the layer read back afterwards is what proves it.
            isForegroundHeld = false;
            return JSON.stringify({
                didChange: false,
                unverified: 'The press left this control exactly as it was',
            });
        });
        const cleared = await runBuiltinCommand(
            '/clear-foreground',
            'presenter',
        );
        expect(callTool).toHaveBeenCalledWith('owa_click', {
            find: 'Clear Foreground',
        });
        expect(cleared.text).toContain('Cleared the foreground');
        expect(cleared.text).toContain(
            'The screen is off, so this only emptied',
        );
        // A layer with nothing on it, on the same off screen, is still nothing.
        callTool.mockClear();
        const nothing = await runBuiltinCommand('/clear-bible', 'presenter');
        expect(nothing.text).toContain('nothing to clear');
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_click',
            expect.anything(),
        );
    });
});

describe('/credit', () => {
    // The tab's own total, handed in by the window. No tool reads it, so a
    // model asked the same question can only quote the manual's sample
    // figure back; this one says the real number and pays no round for it.
    const SPENT = {
        rounds: 3,
        unpricedRounds: 0,
        input: 6,
        cacheRead: 30650,
        cacheWrite: 15924,
        output: 240,
        costUsd: 0.0482,
    };

    test('says the tab total, the sums and the caveat, and asks the app nothing', async () => {
        const answer = await runBuiltinCommand(
            '/credit',
            'presenter',
            undefined,
            SPENT,
        );
        expect(answer.text).toContain('≈ $0.05 · 46.8k tokens');
        expect(answer.text).toContain('3 model rounds');
        expect(answer.text).toContain('30,650 read from the cache');
        expect(answer.text).toContain('An estimate');
        expect(callTool).not.toHaveBeenCalled();
    });

    test('the other spellings reach it, and an unspent tab says so', async () => {
        for (const line of ['/cost', '/usage', '/spent', '/tokens']) {
            const answer = await runBuiltinCommand(line, 'presenter');
            expect(answer.text, line).toContain('Nothing has been spent');
        }
        expect(callTool).not.toHaveBeenCalled();
    });

    test('a free tab reads free, with the tokens still counted', async () => {
        const answer = await runBuiltinCommand('/credit', 'reader', undefined, {
            ...SPENT,
            costUsd: 0,
        });
        expect(answer.text).toContain('free · 46.8k tokens');
        expect(answer.text).toContain('free service');
    });
});

describe('/limit', () => {
    // A cache-cold round on the dearest model, ~$0.19.
    const DEAR_ROUND = {
        provider: 'anthropic' as const,
        model: 'claude-opus-5',
        input: 30000,
        cacheRead: 0,
        cacheWrite: 0,
        output: 1500,
    };

    test('says the cap and where the hour stands, and asks the app nothing', async () => {
        const answer = await runBuiltinCommand('/limit', 'presenter');
        expect(answer.text).toContain('**Limit: $1 an hour.**');
        expect(answer.text).toContain(
            'Nothing has been spent in the last hour',
        );
        expect(answer.text).toContain('150 model calls');
        expect(answer.actions).toBeUndefined();
        expect(callTool).not.toHaveBeenCalled();
    });

    test('sets the cap in dollars, and turns the money cap off', async () => {
        let answer = await runBuiltinCommand('/limit 2', 'presenter');
        expect(answer.text).toContain('**The limit is now $2 an hour.**');
        expect(getSpendState().limitUsd).toBe(2);
        answer = await runBuiltinCommand('/budget $0.50', 'presenter');
        expect(answer.text).toContain('$0.50 an hour');
        expect(getSpendState().limitUsd).toBe(0.5);
        answer = await runBuiltinCommand('/limit off', 'presenter');
        expect(answer.text).toContain('**The money cap is off.**');
        expect(getSpendState().limitUsd).toBeNull();
    });

    test('a word that is not a limit is refused with the shapes that are', async () => {
        const answer = await runBuiltinCommand('/limit lots', 'presenter');
        expect(answer.text).toContain('I do not read "lots" as a limit');
        expect(answer.text).toContain('/limit off');
        expect(getSpendState().limitUsd).toBe(1);
    });

    test('a paused window is told so, with the button, and /limit more lifts it', async () => {
        await runBuiltinCommand('/limit 0.25', 'presenter');
        recordSpendRound(DEAR_ROUND);
        recordSpendRound(DEAR_ROUND);
        expect(getSpendState().isTripped).toBe(true);
        let answer = await runBuiltinCommand('/limit', 'presenter');
        expect(answer.text).toContain('PAUSED');
        expect(answer.actions?.[0]?.toolName).toBe(SPEND_ALLOW_TOOL_NAME);
        answer = await runBuiltinCommand('/limit more', 'presenter');
        expect(answer.text).toContain('the hour starts again from now');
        expect(answer.text).toContain('$0.25 available');
        expect(getSpendState().isTripped).toBe(false);
    });

    test('/credit carries the hour line too', async () => {
        recordSpendRound(DEAR_ROUND);
        const answer = await runBuiltinCommand(
            '/credit',
            'presenter',
            undefined,
            {
                rounds: 1,
                unpricedRounds: 0,
                input: 30000,
                cacheRead: 0,
                cacheWrite: 0,
                output: 1500,
                costUsd: 0.1875,
            },
        );
        expect(answer.text).toContain(
            'In the last hour: about $0.19 over 1 model call,',
        );
        expect(answer.text).toContain('Type `/limit`');
    });
});

// A song with no model: the page is read by the drafter itself and the
// file waits on the Create button. Measured 2026-09-10: the same ask put to
// the assistant drafted the song AND created the file in one breath.
describe('/lyric', () => {
    const PAGE = 'https://hymnary.example/text/amazing_grace';
    const DRAFT = [
        'Drafted a song from the page.',
        '',
        'Valid Open Lyric. No problems found.',
        '',
        'Song: "Amazing Grace" by John Newton — key C, 120bpm, 4/4',
        'Sections (1): Verse 1 (4 lines)',
        'Play order: Verse 1',
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

    test('is in the list, takes words, and the aliases reach it', () => {
        expect(parseBuiltinCommand('/lyrics ' + PAGE)?.action?.name).toBe(
            'lyric',
        );
        expect(parseBuiltinCommand('/hymn x')?.action?.name).toBe('lyric');
        expect(parseBuiltinCommand('/new-song')?.action?.name).toBe('lyric');
        // `/song` stays what it was: which song is SELECTED.
        expect(parseBuiltinCommand('/song')?.action?.name).toBe('selected');
        expect(
            toBuiltinCommandText(parseBuiltinCommand('/lyric')!.action!),
        ).toBe('/lyric ');
    });

    test('an address has the page read by the drafter, and offers the two buttons', async () => {
        callTool.mockResolvedValue(DRAFT);
        const answer = await runBuiltinCommand(`/lyric ${PAGE}`, 'presenter');
        expect(callTool).toHaveBeenCalledTimes(1);
        expect(callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            url: PAGE,
            mode: 'draft',
        });
        expect(answer.text).toContain('I read hymnary.example');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Create "Amazing Grace"',
            'Copy song text',
        ]);
        // Nothing written: no create call was made.
        expect(callTool).not.toHaveBeenCalledWith(
            'owa_lyric_file',
            expect.anything(),
        );
    });

    test('pasted words after the command are drafted as a paste', async () => {
        callTool.mockResolvedValue(
            DRAFT.replace('from the page', 'from the text'),
        );
        const words = [
            'Verse 1',
            'Amazing grace! how sweet the sound,',
            'That saved a wretch like me!',
            'I once was lost, but now am found,',
            'Was blind, but now I see.',
        ].join('\n');
        const answer = await runBuiltinCommand(`/lyric ${words}`, 'presenter');
        expect(callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            text: words,
            mode: 'draft',
        });
        expect(answer.actions?.[0]?.label).toBe('Create "Amazing Grace"');
    });

    test('no words asks for the song and calls nothing', async () => {
        const answer = await runBuiltinCommand('/lyric', 'presenter');
        expect(callTool).not.toHaveBeenCalled();
        expect(answer.text).toContain('Give me the song');
    });

    test('words that are not a song say so; a refused read gets a sentence', async () => {
        callTool.mockResolvedValue(
            'That does not look like the words of a song.',
        );
        let answer = await runBuiltinCommand('/lyric hello there', 'presenter');
        expect(answer.text).toContain('did not read as the words of a song');
        callTool.mockRejectedValue(new Error('Refused: address budget spent'));
        answer = await runBuiltinCommand(`/lyric ${PAGE}`, 'presenter');
        expect(answer.text).toContain('I could not read hymnary.example');
        expect(answer.text).not.toContain('budget');
    });

    test('progress names the site while the page is read', async () => {
        callTool.mockResolvedValue(DRAFT);
        const steps: any[] = [];
        await runBuiltinCommand(`/lyric ${PAGE}`, 'presenter', (step) => {
            steps.push(step);
        });
        expect(steps.map((step) => step.isDone)).toEqual([false, true]);
        expect(steps[0].text).toBe(
            'Reading hymnary.example and writing the song out',
        );
    });
});
