import { beforeEach, describe, expect, it, vi } from 'vitest';

// The app the tool talks to, over the CDP door: the pages it lists and what
// the page expression answers. Plain functions over hoisted state, so the
// config's `mockReset` leaves them as they are.
const h = vi.hoisted(() => {
  return {
    targets: [],
    listedPorts: [],
    evaluated: [],
    answer: null,
    portError: null,
    evaluateError: null,
  };
});

vi.mock('./cdp.mjs', () => ({
  requireLivePort: async () => {
    if (h.portError !== null) {
      throw h.portError;
    }
    return 9333;
  },
  listTargets: async (port) => {
    h.listedPorts.push(port);
    return h.targets;
  },
  evaluateInApp: async (expression, options) => {
    h.evaluated.push({ expression, options });
    if (h.evaluateError !== null) {
      throw h.evaluateError;
    }
    return { value: h.answer };
  },
}));

import {
  SCREEN_EDIT_TOOL_NAME,
  registerScreenEditTool,
  runScreenEdit,
} from './agentScreenEdit.mjs';

function getRegisteredHandler() {
  const handlers = new Map();
  registerScreenEditTool({
    registerTool: (name, _config, handler) => {
      handlers.set(name, handler);
    },
  });
  return handlers.get(SCREEN_EDIT_TOOL_NAME);
}

beforeEach(() => {
  h.targets = [];
  h.listedPorts = [];
  h.evaluated = [];
  h.answer = null;
  h.portError = null;
  h.evaluateError = null;
});

describe('the registered owa_screen_edit door', () => {
  it('asks the Presenter page when one is open, with room for a disk read', async () => {
    h.targets = [
      { url: 'https://localhost:3000/reader.html' },
      { url: 'https://localhost:3000/presenter.html' },
    ];
    h.answer = { did: 'screen 0 in KJV + ASV', undoId: 'undo-7' };
    const result = await getRegisteredHandler()({
      screens: [0],
      versions: { add: 'ASV' },
    });
    expect(h.listedPorts).toEqual([9333]);
    expect(h.evaluated).toHaveLength(1);
    expect(h.evaluated[0].options).toEqual({
      port: 9333,
      match: 'presenter.html',
      timeout: 30000,
    });
    // Read as the model meant it: a set, the Bible as a list of one.
    expect(h.evaluated[0].expression).toContain(
      '{"action":"set","screens":[0],"versions":{"add":["ASV"]}}',
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      did: 'screen 0 in KJV + ASV',
      undoId: 'undo-7',
    });
  });

  it('asks whatever page is open when no Presenter is, which answers it is not there', async () => {
    h.targets = [{ url: 'https://localhost:3000/reader.html' }];
    h.answer = {
      needsPage: 'presenter',
      note: 'The screens are controlled from the Presenter page.',
    };
    const result = await getRegisteredHandler()({ action: 'read' });
    expect(h.evaluated[0].options).toEqual({
      port: 9333,
      match: undefined,
      timeout: 30000,
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).needsPage).toBe('presenter');
  });

  it('says why when no app answers, as an error result and never a throw', async () => {
    h.portError = new Error('Open Worship App is not running.');
    const result = await getRegisteredHandler()({ action: 'read' });
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Open Worship App is not running.' }],
    });
    expect(h.evaluated).toEqual([]);
  });

  it('says a page that timed out in words', async () => {
    h.targets = [{ url: 'https://localhost:3000/presenter.html' }];
    h.evaluateError = new Error(
      'This window did not answer. The screens are changed from the ' +
        'Presenter page.',
    );
    const result = await getRegisteredHandler()({ action: 'set', show: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('did not answer');
  });

  it('sends nothing for an action that is not one, even through the door', async () => {
    h.targets = [{ url: 'https://localhost:3000/presenter.html' }];
    const result = await runScreenEdit({ action: 'remove' });
    expect(result.isError).toBe(true);
    expect(h.listedPorts).toEqual([]);
    expect(h.evaluated).toEqual([]);
  });
});
