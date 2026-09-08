import { beforeEach, describe, expect, test, vi } from 'vitest';

// Built-in commands talk to the app through the MCP client and nothing
// else, so stubbing that leaves the commands themselves under test with no
// app running. Same shape as `helpBotHelpers.test.ts`, for the same reason.
const callTool = vi.fn(async (_name: string, _args?: any) => '');
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
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
    runBuiltinCommand,
    toBuiltinCommandText,
} from './builtinActionHelpers';

beforeEach(() => {
    callTool.mockReset();
    callTool.mockResolvedValue('');
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
