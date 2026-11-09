import { describe, expect, it, vi } from 'vitest';

import {
    FOREGROUND_EDIT_ACTIONS,
    FOREGROUND_EDIT_DESCRIPTION,
    FOREGROUND_EDIT_TOOL_NAME,
    FOREGROUND_EDIT_WIDGETS,
    registerForegroundEditTool,
    runForegroundEdit,
} from './agentForegroundEdit.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
    MODEL_ASK_SHARED_TOOL_MAP,
    MODEL_ON_ASK_TOOL_MAP,
    filterModelToolList,
    pickAskToolList,
} from './modelTools.mjs';

function genWorker(answer) {
    const calls = [];
    const worker = vi.fn(async (request) => {
        calls.push(request);
        return answer;
    });
    return { worker, calls };
}

function readText(result) {
    return result.content[0].text;
}

describe('runForegroundEdit', () => {
    it('hands the app only the fields it knows, the look whole', async () => {
        const { worker, calls } = genWorker({
            did: 'changed',
            widget: 'quick-text',
            detail: 'Quick Text › Session 2: size 40 → 50px.',
            name: 'Quick Text › Session 2',
            isChanged: true,
            undoId: '20261109-151623456-k3x9',
        });
        const result = await runForegroundEdit(
            {
                action: 'set',
                widget: 'quick-text',
                session: 'Session 2',
                look: { size: 'larger', color: 'gold' },
                page: 'presenter.html',
                stray: 'never sent',
            },
            worker,
        );
        expect(calls).toEqual([
            {
                action: 'set',
                widget: 'quick-text',
                session: 'Session 2',
                look: { size: 'larger', color: 'gold' },
            },
        ]);
        expect(result.isError).toBeUndefined();
        const answer = JSON.parse(readText(result));
        // The window reads these three off the answer: its Undo button.
        expect(answer).toMatchObject({
            name: 'Quick Text › Session 2',
            isChanged: true,
            undoId: '20261109-151623456-k3x9',
        });
    });

    it("passes the app's refusal on as the model's sentence", async () => {
        const result = await runForegroundEdit(
            { action: 'set', widget: 'marquee-top', look: { position: 'top' } },
            genWorker({
                isError: true,
                reason: 'The marquee-top has no "position".',
            }).worker,
        );
        expect(result.isError).toBe(true);
        expect(readText(result)).toBe('The marquee-top has no "position".');
    });

    it('refuses an unknown action itself, naming the ones there are', async () => {
        const { worker } = genWorker({});
        const result = await runForegroundEdit({ action: 'delete' }, worker);
        expect(result.isError).toBe(true);
        expect(readText(result)).toContain(FOREGROUND_EDIT_ACTIONS.join(', '));
        expect(worker).not.toHaveBeenCalled();
    });

    it('says when the app did not answer', async () => {
        const result = await runForegroundEdit(
            { action: 'read', widget: 'countdown' },
            genWorker(null).worker,
        );
        expect(result.isError).toBe(true);
        expect(readText(result)).toBe('The app did not answer.');
    });
});

describe('the policy around it', () => {
    it('reads quietly; every change acts and names the component', () => {
        expect(
            checkIsActingCall(FOREGROUND_EDIT_TOOL_NAME, { action: 'read' }),
        ).toBe(false);
        expect(
            describeToolNotice(FOREGROUND_EDIT_TOOL_NAME, { action: 'read' }),
        ).toBe(null);
        for (const action of ['set', 'show', 'hide', 'timer', 'session']) {
            expect(
                checkIsActingCall(FOREGROUND_EDIT_TOOL_NAME, { action }),
            ).toBe(true);
        }
        expect(
            describeToolNotice(FOREGROUND_EDIT_TOOL_NAME, {
                action: 'set',
                widget: 'quick-text',
                session: 'Session 2',
            })?.text,
        ).toBe('changed the Quick Text "Session 2"');
        expect(
            describeToolNotice(FOREGROUND_EDIT_TOOL_NAME, {
                action: 'show',
                widget: 'countdown',
                minutes: 5,
            })?.text,
        ).toBe('started a 5 minute countdown on the screen');
    });

    it('removes nothing: a session change is undone, never trashed', () => {
        for (const action of FOREGROUND_EDIT_ACTIONS) {
            expect(
                checkIsRemovingCall(FOREGROUND_EDIT_TOOL_NAME, { action }),
            ).toBe(false);
        }
    });

    it('is offered to a foreground ask only, with the screens beside it', () => {
        expect(MODEL_ON_ASK_TOOL_MAP[FOREGROUND_EDIT_TOOL_NAME]).toBe(
            'foreground',
        );
        expect(MODEL_ASK_SHARED_TOOL_MAP.foreground).toContain(
            'owa_list_screens',
        );
        const tools = [
            { name: FOREGROUND_EDIT_TOOL_NAME },
            { name: 'owa_foreground' },
            { name: 'owa_list_screens' },
        ];
        expect(filterModelToolList(tools)).not.toContainEqual({
            name: FOREGROUND_EDIT_TOOL_NAME,
        });
        expect(pickAskToolList(tools, 'foreground')).toEqual([
            { name: FOREGROUND_EDIT_TOOL_NAME },
            { name: 'owa_list_screens' },
        ]);
    });

    it('takes every component but the stop-only "all"', () => {
        expect(FOREGROUND_EDIT_WIDGETS).toContain('quick-text');
        expect(FOREGROUND_EDIT_WIDGETS).toContain('camera');
        expect(FOREGROUND_EDIT_WIDGETS).not.toContain('all');
    });

    it('registers its schema with the description', () => {
        const server = { registerTool: vi.fn() };
        registerForegroundEditTool(server);
        const [name, config] = server.registerTool.mock.calls[0];
        expect(name).toBe(FOREGROUND_EDIT_TOOL_NAME);
        expect(config.description).toBe(FOREGROUND_EDIT_DESCRIPTION);
        expect(Object.keys(config.inputSchema)).toEqual([
            'action',
            'widget',
            'session',
            'text',
            'texts',
            'ref',
            'version',
            'minutes',
            'at',
            'autoStart',
            'seconds',
            'delay',
            'interval',
            'utcOffset',
            'title',
            'is24Hour',
            'file',
            'camera',
            'source',
            'sound',
            'volume',
            'preset',
            'look',
            'timer',
            'screens',
            'open',
            'name',
        ]);
    });
});
