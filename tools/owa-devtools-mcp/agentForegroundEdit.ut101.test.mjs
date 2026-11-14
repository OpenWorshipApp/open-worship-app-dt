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
    return { value: h.answer };
  },
}));

import { describeForeground } from './agentForeground.mjs';
import {
  FOREGROUND_EDIT_TOOL_NAME,
  registerForegroundEditTool,
} from './agentForegroundEdit.mjs';

function getRegisteredHandler() {
  const handlers = new Map();
  registerForegroundEditTool({
    registerTool: (name, _config, handler) => {
      handlers.set(name, handler);
    },
  });
  return handlers.get(FOREGROUND_EDIT_TOOL_NAME);
}

beforeEach(() => {
  h.targets = [];
  h.listedPorts = [];
  h.evaluated = [];
  h.answer = null;
  h.portError = null;
});

describe('the registered owa_foreground_edit door', () => {
  it('asks the Presenter page when one is open, with room for a slow read', async () => {
    h.targets = [
      { url: 'https://localhost:3000/reader.html' },
      { url: 'https://localhost:3000/presenter.html' },
    ];
    h.answer = {
      did: 'read',
      widget: 'countdown',
      detail: 'Countdown › Default.',
    };
    const result = await getRegisteredHandler()({
      action: 'read',
      widget: 'countdown',
      session: 'Default',
    });
    expect(h.listedPorts).toEqual([9333]);
    expect(h.evaluated).toHaveLength(1);
    expect(h.evaluated[0].options).toEqual({
      port: 9333,
      match: 'presenter.html',
      timeout: 30000,
    });
    expect(h.evaluated[0].expression).toContain('"session":"Default"');
    expect(h.evaluated[0].expression).toContain('"action":"read"');
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(h.answer);
  });

  it("lets the main window answer when no Presenter is open, its refusal the model's", async () => {
    h.targets = [{ url: 'https://localhost:3000/reader.html' }];
    h.answer = {
      isError: true,
      reason: 'A foreground extra is started from the Presenter page.',
    };
    const result = await getRegisteredHandler()({
      action: 'show',
      widget: 'countdown',
    });
    expect(h.evaluated[0].options.match).toBeUndefined();
    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'A foreground extra is started from the Presenter page.',
        },
      ],
    });
  });

  it('answers a lost connection as an error result, never a throw', async () => {
    h.portError = new Error('No running app was found.');
    const result = await getRegisteredHandler()({
      action: 'read',
      widget: 'countdown',
    });
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'No running app was found.' }],
    });
    expect(h.evaluated).toEqual([]);
  });
});

describe('describeForeground for a read, a timer and a change', () => {
  it('says a read or a timer press by its detail', () => {
    expect(
      describeForeground({
        did: 'read',
        widget: 'countdown',
        detail: 'Countdown › Default.',
      }),
    ).toBe('Countdown › Default.');
    expect(
      describeForeground({
        did: 'timer',
        widget: 'countdown',
        detail: 'The countdown on screen 0 is paused.',
      }),
    ).toBe('The countdown on screen 0 is paused.');
    expect(describeForeground({ did: 'timer', widget: 'stopwatch' })).toBe(
      'Done.',
    );
  });

  it('says a change with its note, and a new session plainly', () => {
    expect(
      describeForeground({
        did: 'changed',
        widget: 'quick-text',
        detail: 'Quick Text › Default: size 100 → 125px.',
        note: 'It is not on a screen.',
      }),
    ).toBe('Quick Text › Default: size 100 → 125px. It is not on a screen.');
    expect(
      describeForeground({
        did: 'created',
        widget: 'quick-text',
        detail: '',
        note: '',
      }),
    ).toBe('Changed.');
  });
});
