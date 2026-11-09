import { beforeEach, describe, expect, it, vi } from 'vitest';

// `owa_presenting_flow_edit` through its OWN worker: the request is handed to
// the app as an `owa-agent-data` expression (`evaluateInApp`, stood in here),
// and what the registered handler answers when the app says nothing or the
// call throws. The rules of the request itself are in
// `agentPresentingFlowEdit.test.mjs`.

const { evaluateInAppMock } = vi.hoisted(() => ({
  evaluateInAppMock: vi.fn(),
}));

vi.mock('./cdp.mjs', () => ({ evaluateInApp: evaluateInAppMock }));

import {
  FLOW_EDIT_TOOL_NAME,
  registerPresentingFlowEditTool,
  runPresentingFlowEdit,
} from './agentPresentingFlowEdit.mjs';

const FLOW_PATH = 'C:\\data\\elsewhere\\Sunday.owpf';

function readText(result) {
  return result.content[0].text;
}

function getRegisteredHandler() {
  const server = { registerTool: vi.fn() };
  registerPresentingFlowEditTool(server);
  const [name, , handler] = server.registerTool.mock.calls[0];
  expect(name).toBe(FLOW_EDIT_TOOL_NAME);
  return handler;
}

beforeEach(() => {
  evaluateInAppMock.mockReset();
});

describe('the worker that asks the app', () => {
  it('sends the request on the presenting-flow-edit relay, to the page asked', async () => {
    evaluateInAppMock.mockResolvedValue({
      value: { name: 'Sunday', count: 0, lines: [] },
    });
    const result = await runPresentingFlowEdit({
      file: FLOW_PATH,
      action: 'lines',
      line: 3,
      page: 'presenter.html',
    });
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
    const [expression, options] = evaluateInAppMock.mock.calls[0];
    expect(options).toEqual({ match: 'presenter.html' });
    // The request rides inside the expression with its domain.
    expect(expression).toContain('"domain":"presenting-flow-edit"');
    expect(expression).toContain('"action":"lines"');
    expect(expression).toContain('"line":3');
    expect(expression).toContain(JSON.stringify(FLOW_PATH));
    expect(JSON.parse(readText(result))).toEqual({
      name: 'Sunday',
      count: 0,
      lines: [],
    });
  });

  it('an app that answers nothing is said so, as an error', async () => {
    for (const value of [null, 'not an object', 7]) {
      evaluateInAppMock.mockResolvedValueOnce({ value });
      const result = await runPresentingFlowEdit({
        file: 'Sunday',
        action: 'lines',
      });
      expect(result.isError).toBe(true);
      expect(readText(result)).toBe('The app did not answer.');
    }
  });

  it('a refusal with no reason gets the stock sentence', async () => {
    evaluateInAppMock.mockResolvedValue({ value: { isError: true } });
    const result = await runPresentingFlowEdit({
      file: 'Sunday',
      action: 'remove-lines',
      lines: [1],
    });
    expect(result.isError).toBe(true);
    expect(readText(result)).toBe('The presenting flow could not be read.');
  });

  it('a change the app says did not happen is not called changed', async () => {
    evaluateInAppMock.mockResolvedValue({
      value: { sheet: 'Sunday', changed: [], didChange: false },
    });
    const result = await runPresentingFlowEdit({
      file: FLOW_PATH,
      action: 'update-lines',
      changes: [{ line: 1, park: true }],
    });
    const answer = JSON.parse(readText(result));
    expect(answer).toEqual({
      name: 'Sunday',
      isChanged: false,
      sheet: 'Sunday',
      changed: [],
    });
    expect(answer).not.toHaveProperty('didChange');
  });

  it('a `file` that names nothing is refused before the app is asked', async () => {
    const result = await runPresentingFlowEdit({
      file: '   ',
      action: 'lines',
    });
    expect(result.isError).toBe(true);
    expect(readText(result)).toContain('Name the presenting flow');
    expect(evaluateInAppMock).not.toHaveBeenCalled();
    const noArgs = await runPresentingFlowEdit(undefined);
    expect(noArgs.isError).toBe(true);
    expect(evaluateInAppMock).not.toHaveBeenCalled();
  });
});

describe('the registered handler', () => {
  it('answers through the real worker', async () => {
    evaluateInAppMock.mockResolvedValue({
      value: { sheet: 'Sunday', changed: ['x'], didChange: true },
    });
    const handler = getRegisteredHandler();
    const result = await handler({
      file: 'Sunday',
      action: 'update-lines',
      changes: [{ add: { actionId: 'clear-all' } }],
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(readText(result))).toMatchObject({
      name: 'Sunday',
      isChanged: true,
      changed: ['x'],
    });
  });

  it('turns a thrown call into an error result, never a throw', async () => {
    evaluateInAppMock.mockRejectedValue(
      new Error('This window did not answer.'),
    );
    const handler = getRegisteredHandler();
    const result = await handler({ file: 'Sunday', action: 'lines' });
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'This window did not answer.' }],
    });
  });

  it('a thrown non-Error is written as its own words', async () => {
    evaluateInAppMock.mockRejectedValue('socket closed');
    const handler = getRegisteredHandler();
    const result = await handler({ file: 'Sunday', action: 'lines' });
    expect(result.isError).toBe(true);
    expect(readText(result)).toBe('socket closed');
  });
});
