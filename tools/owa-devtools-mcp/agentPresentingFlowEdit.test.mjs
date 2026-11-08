import { describe, expect, it, vi } from 'vitest';

import {
    FLOW_EDIT_ACTIONS,
    FLOW_EDIT_DESCRIPTION,
    FLOW_EDIT_TOOL_NAME,
    registerPresentingFlowEditTool,
    runPresentingFlowEdit,
    toFlowEditTarget,
} from './agentPresentingFlowEdit.mjs';
import { AGENT_REMOVING_ACTIONS } from './agentData.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
    MODEL_ON_ASK_TOOL_MAP,
    filterModelToolList,
    pickAskToolList,
} from './modelTools.mjs';

const FLOW_PATH = 'C:\\data\\elsewhere\\Sunday.owpf';

function genWorker(answer) {
    const calls = [];
    const worker = vi.fn(async (request, page) => {
        calls.push({ request, page });
        return answer;
    });
    return { worker, calls };
}

function readText(result) {
    return result.content[0].text;
}

describe('what `file` names', () => {
    it('is a whole .owpf path or a Presenting Flows name', () => {
        expect(toFlowEditTarget(FLOW_PATH)).toEqual({
            filePath: FLOW_PATH,
            name: 'Sunday',
        });
        expect(toFlowEditTarget(' Sunday.owpf ')).toEqual({ name: 'Sunday' });
    });

    it('refuses another kind, a path climbing out, and nothing', () => {
        expect(toFlowEditTarget('C:\\data\\Sermon.ows')).toHaveProperty(
            'reason',
        );
        expect(toFlowEditTarget('C:\\data\\..\\x\\Sunday.owpf')).toHaveProperty(
            'reason',
        );
        expect(toFlowEditTarget('  ')).toHaveProperty('reason');
    });
});

describe('one call', () => {
    it('reads the lines through the app, by path', async () => {
        const { worker, calls } = genWorker({ name: 'Sunday', lines: [] });
        const result = await runPresentingFlowEdit(
            { file: FLOW_PATH, action: 'lines', line: 2, page: 'presenter' },
            worker,
        );
        expect(calls).toEqual([
            {
                request: { action: 'lines', filePath: FLOW_PATH, line: 2 },
                page: 'presenter',
            },
        ]);
        expect(JSON.parse(readText(result))).toEqual({
            name: 'Sunday',
            lines: [],
        });
    });

    it('says what changed in the shape the window reads', async () => {
        const changes = [{ add: { actionId: 'clear-all' }, after: 1 }];
        const { worker, calls } = genWorker({
            sheet: 'Sunday',
            count: 4,
            changed: ['added "Clear All" after line 1 "Welcome"'],
            didChange: true,
            undoId: 'u-1',
        });
        const result = await runPresentingFlowEdit(
            { file: 'Sunday', action: 'update-lines', changes },
            worker,
        );
        expect(calls[0].request).toEqual({
            action: 'update-lines',
            name: 'Sunday',
            changes,
        });
        expect(JSON.parse(readText(result))).toMatchObject({
            name: 'Sunday',
            isChanged: true,
            undoId: 'u-1',
            count: 4,
        });
    });

    it('passes a refusal on, and refuses an unknown action itself', async () => {
        const refused = await runPresentingFlowEdit(
            { file: 'Sunday', action: 'remove-lines', lines: [9] },
            genWorker({ isError: true, reason: 'There is no line 9.' }).worker,
        );
        expect(refused.isError).toBe(true);
        expect(readText(refused)).toBe('There is no line 9.');
        const unknown = await runPresentingFlowEdit(
            { file: 'Sunday', action: 'delete' },
            genWorker({}).worker,
        );
        expect(readText(unknown)).toContain(FLOW_EDIT_ACTIONS.join(', '));
    });
});

describe('the policy around it', () => {
    it('reads quietly, and every change acts and is announced by sheet', () => {
        expect(checkIsActingCall(FLOW_EDIT_TOOL_NAME, { action: 'lines' })).toBe(
            false,
        );
        expect(describeToolNotice(FLOW_EDIT_TOOL_NAME, { action: 'lines' })).toBe(
            null,
        );
        expect(
            checkIsActingCall(FLOW_EDIT_TOOL_NAME, { action: 'update-lines' }),
        ).toBe(true);
        expect(
            describeToolNotice(FLOW_EDIT_TOOL_NAME, {
                action: 'update-lines',
                file: FLOW_PATH,
            })?.text,
        ).toBe('changed the run sheet "Sunday"');
    });

    it('takes lines away only through remove-lines, a removal', () => {
        expect(AGENT_REMOVING_ACTIONS).toContain('remove-lines');
        expect(
            checkIsRemovingCall(FLOW_EDIT_TOOL_NAME, { action: 'remove-lines' }),
        ).toBe(true);
        expect(
            checkIsRemovingCall(FLOW_EDIT_TOOL_NAME, { action: 'update-lines' }),
        ).toBe(false);
        expect(
            describeToolNotice(FLOW_EDIT_TOOL_NAME, {
                action: 'remove-lines',
                file: 'Sunday',
            })?.text,
        ).toBe('removed a line from the run sheet "Sunday"');
    });

    it('is offered to a flow ask only', () => {
        expect(MODEL_ON_ASK_TOOL_MAP[FLOW_EDIT_TOOL_NAME]).toBe('flow');
        const tools = [
            { name: FLOW_EDIT_TOOL_NAME },
            { name: 'owa_presenting_flow' },
            { name: 'owa_help_search' },
        ];
        expect(filterModelToolList(tools)).not.toContainEqual({
            name: FLOW_EDIT_TOOL_NAME,
        });
        expect(pickAskToolList(tools, 'flow')).toEqual([
            { name: FLOW_EDIT_TOOL_NAME },
        ]);
    });

    it('registers its schema with the description', () => {
        const server = { registerTool: vi.fn() };
        registerPresentingFlowEditTool(server);
        const [name, config] = server.registerTool.mock.calls[0];
        expect(name).toBe(FLOW_EDIT_TOOL_NAME);
        expect(config.description).toBe(FLOW_EDIT_DESCRIPTION);
        expect(Object.keys(config.inputSchema)).toEqual([
            'file',
            'action',
            'line',
            'changes',
            'lines',
            'page',
        ]);
    });
});
