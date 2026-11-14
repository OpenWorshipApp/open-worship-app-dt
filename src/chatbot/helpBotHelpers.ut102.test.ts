import { beforeEach, describe, expect, test, vi } from 'vitest';

// The offline bot talks to the app through the MCP client alone, so the
// client stands in for the app; `loggerHelpers` reaches `appProvider`, which
// touches `document` while it loads (memory `appprovider-mock-node-env`).
const { mocks } = vi.hoisted(() => ({
    mocks: {
        appError: vi.fn(),
        callTool: vi.fn(async (..._args: any[]): Promise<string> => ''),
        parseToolJson: vi.fn((_text?: any) => null as any),
    },
}));

vi.mock('../helper/loggerHelpers', () => ({
    appError: (...args: any[]) => mocks.appError(...args),
}));
vi.mock('./mcpClient', () => ({
    callTool: (...args: any[]) => mocks.callTool(...args),
    parseToolJson: (...args: any[]) => mocks.parseToolJson(...args),
}));

import {
    answerLyricSources,
    genBackToPresenterLead,
    genBackToPresenterRoute,
    runBotAction,
} from './helpBotHelpers';

const PANEL_EXCERPT = 'Open the **Documents** list and pick the slide.';

describe('the way back to the Presenter, from every page that has one', () => {
    test('the Screen Mirror page names its own first button', () => {
        expect(genBackToPresenterRoute('screen-mirror')).toBe(
            'click **Presenter** at the top left of the window',
        );
        const lead = genBackToPresenterLead('screen-mirror', PANEL_EXCERPT);
        expect(lead).toContain(
            'First click **Presenter** at the top left of the window, then:',
        );
        expect(lead.endsWith('\n\n')).toBe(true);
    });

    test('the Slide Editor names the Presenter tab', () => {
        expect(
            genBackToPresenterLead('appDocumentEditor', PANEL_EXCERPT),
        ).toContain(
            'First click the **Presenter** tab at the top of the window, then:',
        );
    });
});

describe('a screen change pressed with no assistant, the rest', () => {
    const listState = {
        showingScreenIds: [0],
        displays: [{ id: 7, label: 'Monitor', width: 1920, height: 1080 }],
        screens: [
            {
                screenId: 0,
                isShowing: true,
                isLocked: false,
                isSelected: true,
                display: { id: 7, label: 'Monitor' },
                stage: 0,
                bible: null,
            },
        ],
    };

    beforeEach(() => {
        mocks.callTool.mockImplementation(async (name: string, args?: any) => {
            if (name === 'owa_screen_edit' && args?.action === 'set') {
                return JSON.stringify({
                    did: 'Cleared the Bible off screen 0.',
                    undoId: 'u3',
                });
            }
            return name;
        });
        mocks.parseToolJson.mockImplementation((text?: any) => {
            return text === 'owa_list_screens' ? listState : null;
        });
    });

    test('a press whose change cannot be read changes nothing', async () => {
        const result = await runBotAction({
            label: 'Lock',
            toolName: 'owa_screen_change',
            args: { kind: 'lock', set: [0] },
        });
        expect(result.isNeedingModel).toBe(false);
        expect(mocks.callTool).not.toHaveBeenCalled();
    });

    test('a clear is said by what each screen holds now, with its Undo', async () => {
        const result = await runBotAction({
            label: 'Clear',
            toolName: 'owa_screen_change',
            args: { kind: 'clear', set: { screens: [0], clear: 'bible' } },
        });
        expect(mocks.callTool).toHaveBeenCalledWith('owa_screen_edit', {
            screens: [0],
            clear: 'bible',
            action: 'set',
        });
        // A clear reads no edit state: the list says it all.
        expect(mocks.callTool).not.toHaveBeenCalledWith('owa_screen_edit', {
            action: 'read',
        });
        expect(result.text).toBe(
            'Done. Screen 0 is showing right now, on a machine with 1 ' +
                'display(s) -- nothing on any layer.',
        );
        expect(result.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u3', name: expect.any(String), kind: 'screen' },
            },
        ]);
    });
});

describe('a song file the drafter could not be asked about', () => {
    test('is a song not found in it, and the failure is logged', async () => {
        const error = new Error('the tool host is down');
        mocks.callTool.mockRejectedValue(error);
        const answer = await answerLyricSources([
            { kind: 'text', name: 'hymn.txt', text: 'Words of a hymn' },
        ]);
        expect(answer.text).toContain('I could not find a song in "hymn.txt".');
        expect(answer.actions ?? []).toEqual([]);
        expect(mocks.appError).toHaveBeenCalledWith(
            error,
            'offline song files',
        );
    });
});
